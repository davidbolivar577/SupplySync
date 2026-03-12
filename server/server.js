const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db'); // Import the db connection we just verified

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allows the frontend to talk to this backend
app.use(express.json()); // Allows us to read JSON data sent in requests

// 1. Basic Test Route
app.get('/', (req, res) => {
  res.json({ message: "SupplySync Backend is Running!" });
});

// GET ALL ACTIVE INVENTORY
app.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory WHERE is_active = true ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET ALL ACTIVE CONTRACTORS
app.get('/contractors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contractors WHERE is_active = true ORDER BY first_name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET ALL ACTIVE PROJECTS
app.get('/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects WHERE is_active = true ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST: PROCESS A CHECKOUT (Bulk-Safe)
app.post('/checkout', async (req, res) => {
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
app.post('/return', async (req, res) => {
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
app.get('/transactions', async (req, res) => {
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
app.get('/history', async (req, res) => {
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
app.post('/inventory', async (req, res) => {
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
app.post('/contractors', async (req, res) => {
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
app.post('/projects', async (req, res) => {
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
app.put('/inventory/:id', async (req, res) => {
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
app.post('/contractors', async (req, res) => {
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
app.post('/projects', async (req, res) => {
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
app.put('/contractors/:id', async (req, res) => {
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
app.put('/projects/:id', async (req, res) => {
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
app.delete('/inventory/:id', async (req, res) => {
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
app.delete('/contractors/:id', async (req, res) => {
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
app.delete('/projects/:id', async (req, res) => {
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