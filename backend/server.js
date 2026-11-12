// Servidor HTTP do Galeto Gestão.
require('dotenv').config();
const { createApp } = require('./app');
const { pool, config } = require('./config/db');

const app = createApp();
const port = Number(process.env.PORT || 3000);

async function start() {
  // Verifica o banco antes de abrir a porta.
  try {
    // No PostgreSQL (pg.Pool), usamos pool.query('SELECT 1') para testar
    await pool.query('SELECT 1');
    console.log(`✅ Banco conectado: ${config.host}:${config.port}/${config.database}`);
  } catch (err) {
    console.error('❌ Falha na conexão com o banco de dados:', err.message);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`🚀 Galeto Gestão em http://localhost:${port}`);
  });
}

process.on('unhandledRejection', (err) => console.error('[rejeição não tratada]', err));
process.on('uncaughtException', (err) => console.error('[exceção não tratada]', err));

start();