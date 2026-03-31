const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Read the CA certificate content from the .pem file
const caCert = fs.readFileSync(path.join(__dirname, 'byuicse-psql-cert.pem'));

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    ssl: {
        ca: caCert,                 // Use the certificate content
        rejectUnauthorized: true,   // Keep this true for proper security
        checkServerIdentity: () => { return undefined; } // Skip hostname verification
    }
});

// Test the connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Connection Failed:', err);
    } else {
        console.log('✅ Remote Database Connected! Server Time:', res.rows[0].now);
    }
});

module.exports = pool;