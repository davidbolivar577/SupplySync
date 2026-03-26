const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db'); // Import the db connection we just verified

const app = express();
const PORT = process.env.PORT || 5000;

const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Middleware
app.use(cors()); // Allows the frontend to talk to this backend
app.use(express.json()); // Allows us to read JSON data sent in requests

// --- AUTHENTICATION ROUTE ---
app.post('/auth/google', async (req, res) => {
  const { token } = req.body;

  try {
    // 1. Verify the token with Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    // Extract the payload (email, google_id, etc.)
    const payload = ticket.getPayload();
    const email = payload.email;
    const googleId = payload.sub;

    // 2. Check the database for this email
    const userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: "Access denied. You are not invited." });
    }

    const user = userQuery.rows[0];

    // 3. Check for Time-Bound Expirations
    const now = new Date();
    if (user.access_expires_at && new Date(user.access_expires_at) < now) {
      return res.status(403).json({ error: "Your access has expired." });
    }
    if (user.status === 'pending' && user.invite_expires_at && new Date(user.invite_expires_at) < now) {
      // Lazy delete the expired invite
      await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
      return res.status(403).json({ error: "Your invite has expired. Please contact the admin." });
    }

    // 4. If they are pending but valid, activate them!
    if (user.status === 'pending') {
      await pool.query(
        'UPDATE users SET status = $1, google_id = $2, invite_expires_at = NULL, last_login = CURRENT_TIMESTAMP WHERE id = $3',
        ['active', googleId, user.id]
      );
    } else {
      // Just update last login
      await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    }

    // 5. Generate your app's session token (JWT)
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // Token expires in 24 hours
    );

    // 6. Send the token and user data back to React
    res.json({ 
      token: sessionToken, 
      user: { email: user.email, role: user.role } 
    });

  } catch (error) {
    console.error("Auth Error:", error);
    res.status(401).json({ error: "Invalid Google token" });
  }
});

// --- REQUEST LOGIN LINK ---
app.post('/auth/send-link', async (req, res) => {
  const { email } = req.body;

  try {
    // 1. Check if user exists in the database
    const userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userQuery.rows.length === 0) {
      return res.json({ message: "If that email exists, a link was sent." }); 
    }
    const user = userQuery.rows[0];

    // 2. Create the 15-minute token
    const linkToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '15m' }
    );

    // 3. Build the link
    const loginLink = `${process.env.FRONTEND_URL}?link_token=${linkToken}`;

    // 4. Send the email using Nodemailer
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email, // This will now send to ANY email address!
      subject: 'Your Inventory Portal Login Link',
      html: `<h3>Welcome back!</h3>
             <p>Click the link below to securely log in to the portal. This link expires in 15 minutes.</p>
             <a href="${loginLink}" style="padding:10px 20px; background:#007bff; color:white; text-decoration:none; border-radius:5px; display:inline-block; margin-top:10px;">Log In Now</a>`
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "Login link sent!" });

  } catch (err) {
    console.error("Nodemailer Error:", err);
    res.status(500).json({ error: "Server error sending login link." });
  }
});

// --- VERIFY LOGIN LINK ---
app.post('/auth/verify-link', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Create the standard 24-hour session token
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

// --- AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  // 1. Grab the Authorization header from the incoming request
  const authHeader = req.headers['authorization'];
  
  // 2. The header format is "Bearer <token>". We just want the token.
  const token = authHeader && authHeader.split(' ')[1]; 

  // 3. If there is no token at all, reject immediately
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  // 4. Verify the token using your secret key
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token." });
    }
    
    // 5. Token is valid! Attach the decoded user data to the request
    req.user = user; 
    
    // 6. Move on to the actual route handler
    next(); 
  });
};

// 1. Basic Test Route
app.get('/', (req, res) => {
  res.json({ message: "SupplySync Backend is Running!" });
});

// GET ALL ACTIVE INVENTORY
app.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory WHERE is_active = true ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET ALL ACTIVE CONTRACTORS
app.get('/contractors', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contractors WHERE is_active = true ORDER BY first_name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET ALL ACTIVE PROJECTS
app.get('/projects', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects WHERE is_active = true ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST: PROCESS A CHECKOUT (Bulk-Safe)
app.post('/checkout', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { inventoryId, contractorId, projectId, quantityChanged } = req.body;
    
    await client.query('BEGIN');

    // Step A: Decrease by the requested quantity
    const updateRes = await client.query(
      `UPDATE inventory 
       SET quantity = quantity - $2 
       WHERE id = $1 AND quantity >= $2 
       RETURNING *`,
      [inventoryId, quantityChanged]
    );

    if (updateRes.rowCount === 0) {
      throw new Error('Not enough items in stock to fulfill this checkout');
    }

    // Step B: Log the transaction with the dynamic quantity
    await client.query(
      `INSERT INTO transactions (inventory_id, contractor_id, project_id, action_type, quantity_changed) 
       VALUES ($1, $2, $3, 'CHECK_OUT', $4)`,
      [inventoryId, contractorId, projectId, quantityChanged]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Checkout successful' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Checkout failed:", err.message);
    res.status(500).json({ error: 'Checkout failed' });
  } finally {
    client.release();
  }
});

// POST: PROCESS A RETURN (Bulk-Safe)
app.post('/return', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { inventoryId, contractorId, projectId, quantityChanged } = req.body;
    
    await client.query('BEGIN');

    // Step A: Increase by the requested quantity
    await client.query(
      `UPDATE inventory 
       SET quantity = quantity + $2 
       WHERE id = $1`,
      [inventoryId, quantityChanged]
    );

    // Step B: Log the transaction with the dynamic quantity
    await client.query(
      `INSERT INTO transactions (inventory_id, contractor_id, project_id, action_type, quantity_changed) 
       VALUES ($1, $2, $3, 'RETURN', $4)`,
      [inventoryId, contractorId, projectId, quantityChanged]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Return successful' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Return failed:", err.message);
    res.status(500).json({ error: 'Return failed' });
  } finally {
    client.release();
  }
});

// GET RECENT TRANSACTIONS
app.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT t.id, i.name as item, c.first_name, c.last_name, t.action_type, 
      t.quantity_changed, t.transaction_date as timestamp  
      FROM transactions t
      JOIN inventory i ON t.inventory_id = i.id
      JOIN contractors c ON t.contractor_id = c.id
      ORDER BY t.transaction_date DESC 
      LIMIT 10
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET ALL HISTORY (For Detailed Search / Reports)
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
    res.status(500).json({ error: 'Server error' });
  }
});

// POST: ADD NEW INVENTORY ITEM
app.post('/inventory', authenticateToken, async (req, res) => {
  const { name, category, quantity, location, unit_cost } = req.body;

  try {
    const newTool = await pool.query(
      `INSERT INTO inventory (name, category, quantity, location, unit_cost) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [name, category, quantity, location, unit_cost]
    );

    res.json(newTool.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// POST: ADD NEW CONTRACTOR
app.post('/contractors', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, phone, email } = req.body;
    const newContractor = await pool.query(
      'INSERT INTO contractors (first_name, last_name, phone, email) VALUES ($1, $2, $3, $4) RETURNING *',
      [first_name, last_name, phone, email]
    );
    res.json(newContractor.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to add contractor' });
  }
});

// POST: ADD NEW PROJECT
app.post('/projects', authenticateToken, async (req, res) => {
  try {
    const { name, address } = req.body;
    const newProject = await pool.query(
      "INSERT INTO projects (name, address, status) VALUES ($1, $2, 'ACTIVE') RETURNING *",
      [name, address]
    );
    res.json(newProject.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to add project' });
  }
});

// PUT: UPDATE EXISTING INVENTORY ITEM
app.put('/inventory/:id', authenticateToken, async (req, res) => {
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
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// ==========================================
// ADMIN TOOLS: CONTRACTORS & PROJECTS
// ==========================================

// Add a new Contractor
app.post('/contractors', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name } = req.body;
    await pool.query('INSERT INTO contractors (first_name, last_name) VALUES ($1, $2)', [first_name, last_name]);
    res.json({ message: 'Contractor added successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error adding contractor' });
  }
});

// Add a new Project
app.post('/projects', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    await pool.query('INSERT INTO projects (name) VALUES ($1)', [name]);
    res.json({ message: 'Project added successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error adding project' });
  }
});

// Update a Contractor
app.put('/contractors/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name } = req.body;
    await pool.query('UPDATE contractors SET first_name = $1, last_name = $2 WHERE id = $3', [first_name, last_name, id]);
    res.json({ message: 'Contractor updated' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating contractor' });
  }
});

// Update a Project
app.put('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    await pool.query('UPDATE projects SET name = $1 WHERE id = $2', [name, id]);
    res.json({ message: 'Project updated' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating project' });
  }
});

// SOFT DELETE AN INVENTORY ITEM
app.delete('/inventory/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE inventory SET is_active = false WHERE id = $1', [id]);
    res.json({ message: 'Item soft deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error soft deleting item' });
  }
});

// SOFT DELETE A CONTRACTOR
app.delete('/contractors/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE contractors SET is_active = false WHERE id = $1', [id]);
    res.json({ message: 'Contractor soft deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error soft deleting contractor' });
  }
});

// SOFT DELETE A PROJECT
app.delete('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE projects SET is_active = false WHERE id = $1', [id]);
    res.json({ message: 'Project soft deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error soft deleting project' });
  }
});

// 2. Start the Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});