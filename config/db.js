// MySQL connection pool (promise-based).
// This connects to the same "diceapp" database your CodeIgniter app used
// via $this->load->database('diceapp', TRUE). No schema changes needed.
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'diceapp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

module.exports = pool;
