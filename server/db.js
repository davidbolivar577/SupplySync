const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false // Required for most remote hosts (Render, Railway, Neon, etc.)
    }
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Connection Failed:', err);
    } else {
        console.log('✅ Remote Database Connected! Server Time:', res.rows[0].now);
    }
});

module.exports = pool;