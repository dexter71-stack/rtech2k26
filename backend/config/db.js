// Pool de conexão com o banco de dados (MySQL/MariaDB).
// Quantidades e valores financeiros chegam como string do DECIMAL
// para preservar precisão; conversão só ocorre na camada de exibição.
require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3308),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'galeto_gestao',
};

const pool = mysql.createPool({
  ...config,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  // Controla fuso/serialização de datas (DATETIME como objeto Date).
  dateStrings: ['DATETIME'],
});

module.exports = { pool, config };
