const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Apply middleware
app.use(cors());
app.use(express.json());

// Authenticate Google OAuth token and issue session JWT
app.post('/auth/google', async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const email = payload.email;
    const googleId = payload.sub;

    const userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: "Access denied. User not found." });
    }

    const user = userQuery.rows[0];
    const now = new Date();

    if (user.access_expires_at && new Date(user.access_expires_at) < now) {
      return res.status(403).json({ error: "Access has expired." });
    }

    if (user.status === 'pending' && user.invite_expires_at && new Date(user.invite_expires_at) < now) {
      await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
      return res.status(403).json({ error: "Invite has expired." });
    }

    if (user.status === 'pending') {
      await pool.query(
        'UPDATE users SET status = $1, google_id = $2, invite_expires_at = NULL, last_login = CURRENT_TIMESTAMP WHERE id = $3',
        ['active', googleId, user.id]
      );
    } else {
      await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    }

    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token: sessionToken, user: { email: user.email, role: user.role } });
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(401).json({ error: "Invalid Google token." });
  }
});

// Dispatch magic login link via email
app.post('/auth/send-link', async (req, res) => {
  const { email } = req.body;

  try {
    const userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userQuery.rows.length === 0) {
      return res.json({ message: "If the email exists, a link was sent." }); 
    }
    const user = userQuery.rows[0];

    const linkToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '15m' }
    );

    const loginLink = `${process.env.FRONTEND_URL}?link_token=${linkToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Inventory Portal Login Link',
      html: `<h3>Login Request</h3>
             <p>Click the link below to securely log in. This link expires in 15 minutes.</p>
             <a href="${loginLink}" style="padding:10px 20px; background:#007bff; color:white; text-decoration:none; border-radius:5px; display:inline-block; margin-top:10px;">Log In</a>`
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "Login link sent." });
  } catch (err) {
    console.error("Nodemailer Error:", err);
    res.status(500).json({ error: "Server error dispatching login link." });
  }
});

// Verify magic login link token
app.post('/auth/verify-link', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "No token provided." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const sessionToken = jwt.sign(
      { id: decoded.id, email: decoded.email, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token: sessionToken, user: { role: decoded.role } });
  } catch (err) {
    res.status(401).json({ error: "Login link is invalid or expired." });
  }
});

// JWT verification middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token." });
    }
    req.user = user; 
    next(); 
  });
};

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: "API is running." });
});

// Retrieve active inventory
app.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory WHERE is_active = true ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving inventory.' });
  }
});

// Retrieve active contractors
app.get('/contractors', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contractors WHERE is_active = true ORDER BY first_name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving contractors.' });
  }
});

// Retrieve active projects
app.get('/projects', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects WHERE is_active = true ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving projects.' });
  }
});

// Process checkout transaction (subtract inventory and log)
app.post('/checkout', authenticateToken, async (req, res) => {
  const { items, contractor_id, project_id } = req.body;
  
  // 1. Grab a dedicated connection from the pool
  const client = await pool.connect(); 
  
  try {
    await client.query('BEGIN'); // Start transaction on THIS specific connection
    
    for (const item of items) {
      await client.query(
        'UPDATE inventory SET quantity = quantity - $1 WHERE id = $2',
        [item.quantity, item.id]
      );
      await client.query(
        `INSERT INTO transactions (inventory_id, contractor_id, project_id, action_type, quantity_changed) 
         VALUES ($1, $2, $3, 'CHECKOUT', $4)`,
        [item.id, contractor_id || null, project_id || null, item.quantity]
      );
    }
    
    await client.query('COMMIT'); // Save changes
    res.json({ message: "Checkout processed successfully." });
  } catch (err) {
    await client.query('ROLLBACK'); // Undo everything if an error occurs
    console.error("Checkout Error:", err.message);
    res.status(500).json({ error: "Failed to process checkout." });
  } finally {
    // 2. CRITICAL: Release the connection back to the pool
    client.release(); 
  }
});

// Process return transaction (add inventory and log)
app.post('/return', authenticateToken, async (req, res) => {
  const { items, contractor_id, project_id } = req.body;
  
  // 1. Grab a dedicated connection from the pool
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN'); // Start transaction on THIS specific connection
    
    for (const item of items) {
      await client.query(
        'UPDATE inventory SET quantity = quantity + $1 WHERE id = $2',
        [item.quantity, item.id]
      );
      await client.query(
        `INSERT INTO transactions (inventory_id, contractor_id, project_id, action_type, quantity_changed) 
         VALUES ($1, $2, $3, 'RETURN', $4)`,
        [item.id, contractor_id || null, project_id || null, item.quantity]
      );
    }
    
    await client.query('COMMIT'); // Save changes
    res.json({ message: "Return processed successfully." });
  } catch (err) {
    await client.query('ROLLBACK'); // Undo everything if an error occurs
    console.error("Return Error:", err.message);
    res.status(500).json({ error: "Failed to process return." });
  } finally {
    // 2. CRITICAL: Release the connection back to the pool
    client.release();
  }
});

// Retrieve transaction history
app.get('/history', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT t.id, i.name as item, c.first_name, c.last_name, p.name as project_name, 
      t.action_type, t.quantity_changed, t.transaction_date as timestamp  
      FROM transactions t
      LEFT JOIN inventory i ON t.inventory_id = i.id
      LEFT JOIN contractors c ON t.contractor_id = c.id
      LEFT JOIN projects p ON t.project_id = p.id
      ORDER BY t.transaction_date DESC 
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving history.' });
  }
});

// Add a new inventory item
app.post('/inventory', authenticateToken, async (req, res) => {
  if (req.user.role === 'limited') {
    return res.status(403).json({ error: "Access denied." });
  }

  let { name, category, quantity, location, unit_cost } = req.body;

  if (req.user.role !== 'admin') {
    quantity = 0; 
  }

  try {
    const newItem = await pool.query(
      `INSERT INTO inventory (name, category, quantity, location, unit_cost) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, category, quantity, location, unit_cost]
    );
    res.json(newItem.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error adding inventory item.' });
  }
});

// Update an existing inventory item
app.put('/inventory/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Access denied." });
  }
  try {
    const { id } = req.params;
    const { name, category, quantity, location, unit_cost } = req.body;

    const updateQuery = await pool.query(
      `UPDATE inventory 
       SET name = $1, category = $2, quantity = $3, location = $4, unit_cost = $5 
       WHERE id = $6 
       RETURNING *`,
      [name, category, quantity, location, unit_cost, id]
    );

    res.json(updateQuery.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating inventory item.' });
  }
});

// Soft delete an inventory item
app.delete('/inventory/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Access denied." });
  }
  try {
    const { id } = req.params;
    await pool.query('UPDATE inventory SET is_active = false WHERE id = $1', [id]);
    res.json({ message: 'Inventory item soft deleted.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting inventory item.' });
  }
});

// Add a new contractor
app.post('/contractors', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Access denied." });
  }
  try {
    const { first_name, last_name } = req.body;
    const newContractor = await pool.query(
      'INSERT INTO contractors (first_name, last_name) VALUES ($1, $2) RETURNING *', 
      [first_name, last_name]
    );
    res.json(newContractor.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error adding contractor.' });
  }
});

// Update an existing contractor
app.put('/contractors/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Access denied." });
  }
  try {
    const { id } = req.params;
    const { first_name, last_name } = req.body;
    await pool.query('UPDATE contractors SET first_name = $1, last_name = $2 WHERE id = $3', [first_name, last_name, id]);
    res.json({ message: 'Contractor updated.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating contractor.' });
  }
});

// Soft delete a contractor
app.delete('/contractors/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Access denied." });
  }
  try {
    const { id } = req.params;
    await pool.query('UPDATE contractors SET is_active = false WHERE id = $1', [id]);
    res.json({ message: 'Contractor soft deleted.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting contractor.' });
  }
});

// Add a new project
app.post('/projects', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Access denied." });
  }
  try {
    const { name } = req.body;
    const newProject = await pool.query(
      'INSERT INTO projects (name) VALUES ($1) RETURNING *', 
      [name]
    );
    res.json(newProject.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error adding project.' });
  }
});

// Update an existing project
app.put('/projects/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Access denied." });
  }
  try {
    const { id } = req.params;
    const { name } = req.body;
    await pool.query('UPDATE projects SET name = $1 WHERE id = $2', [name, id]);
    res.json({ message: 'Project updated.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating project.' });
  }
});

// Soft delete a project
app.delete('/projects/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Access denied." });
  }
  try {
    const { id } = req.params;
    await pool.query('UPDATE projects SET is_active = false WHERE id = $1', [id]);
    res.json({ message: 'Project soft deleted.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting project.' });
  }
});

// Add a new system user
app.post('/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Access denied." });
  }

  const { email, role, access_expires_at } = req.body;

  try {
    const invite_expires_at = new Date();
    invite_expires_at.setDate(invite_expires_at.getDate() + 7);

    const newUser = await pool.query(
      `INSERT INTO users (email, role, status, access_expires_at, invite_expires_at) 
       VALUES ($1, $2, 'pending', $3, $4) 
       RETURNING id, email, role, status`,
      [email, role, access_expires_at || null, invite_expires_at]
    );

    res.json({ message: "User invited successfully.", user: newUser.rows[0] });
  } catch (err) {
    console.error("Error adding user:", err.message);
    if (err.code === '23505') { 
      return res.status(400).json({ error: "User with this email already exists." });
    }
    res.status(500).json({ error: "Server error adding user." });
  }
});

// Initialize server listening
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// --- GRACEFUL SHUTDOWN HANDLER ---
// Listen for Render/Node terminating the server
const shutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  try {
    // 1. Tell the database pool to close all active and idle connections
    await pool.end();
    console.log('✅ Database connection pool completely closed.');
    
    // 2. Exit the Node process successfully
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during database pool shutdown:', err.message);
    process.exit(1);
  }
};

// Catch termination signals from the server OS (like Render pausing or redeploying)
process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C in terminal
process.on('SIGTERM', () => shutdown('SIGTERM')); // Render shutdown signal