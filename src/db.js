// Database connection configuration
const mysql = require('mysql2/promise');

// Create a connection pool for better performance
// Read credentials from environment variables. For local development you can create a .env file.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '', // Set DB_PASSWORD in environment or .env
  database: process.env.DB_NAME || 'nailedit',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
