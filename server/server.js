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

// 2. Start the Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});