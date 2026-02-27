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

// ... (previous code)

// GET ALL INVENTORY
app.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ... (app.listen code is below this)

// ... (Your existing /inventory route is above this)

// POST: CHECKOUT ITEM
app.post('/checkout', async (req, res) => {
  const { inventoryId, contractorId, projectId } = req.body;

  try {
    // Start a "Transaction" (safe mode)
    await pool.query('BEGIN');

    // 1. Decrease Quantity
    const updateResult = await pool.query(
      'UPDATE inventory SET quantity = quantity - 1 WHERE id = $1 RETURNING *',
      [inventoryId]
    );

    if (updateResult.rows.length === 0) {
      throw new Error('Item not found');
    }

    // 2. Log the Transaction
    await pool.query(
      `INSERT INTO transactions 
      (inventory_id, contractor_id, project_id, action_type, quantity_changed) 
      VALUES ($1, $2, $3, 'CHECK_OUT', -1)`,
      [inventoryId, contractorId, projectId]
    );

    // Commit the changes (save them)
    await pool.query('COMMIT');

    res.json({ message: 'Checkout successful', item: updateResult.rows[0] });

  } catch (err) {
    await pool.query('ROLLBACK'); // Undo changes if error
    console.error(err.message);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// ... (app.listen is below this)
// POST: RETURN ITEM
app.post('/return', async (req, res) => {
  const { inventoryId, contractorId, projectId } = req.body;

  try {
    await pool.query('BEGIN');

    // 1. Increase Quantity
    const updateResult = await pool.query(
      'UPDATE inventory SET quantity = quantity + 1 WHERE id = $1 RETURNING *',
      [inventoryId]
    );

    if (updateResult.rows.length === 0) {
      throw new Error('Item not found');
    }

    // 2. Log the Return Transaction
    await pool.query(
      `INSERT INTO transactions 
      (inventory_id, contractor_id, project_id, action_type, quantity_changed) 
      VALUES ($1, $2, $3, 'RETURN', 1)`,
      [inventoryId, contractorId, projectId]
    );

    await pool.query('COMMIT');

    res.json({ message: 'Return successful', item: updateResult.rows[0] });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Return failed' });
  }
});

// GET: TRANSACTION HISTORY
app.get('/transactions', async (req, res) => {
  try {
    const query = `
      SELECT t.id, i.name as item, c.first_name, c.last_name, t.action_type, 
      t.transaction_date as timestamp  
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

// GET: ALL CONTRACTORS (for dropdowns)
app.get('/contractors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contractors ORDER BY last_name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: ALL PROJECTS (for dropdowns)
app.get('/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY name ASC');
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

// 2. Start the Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});