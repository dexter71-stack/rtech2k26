require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { config } = require('../backend/config/db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'migrations');

async function run() {
  // Conecta sem selecionar banco para criar o schema, se necessario.
  const bootstrap = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true,
  });

  // Criar database
  await bootstrap.query('CREATE DATABASE IF NOT EXISTS `' + config.database + '` CHARACTER SET utf8mb4');

  // Usar database
  await bootstrap.query('USE `' + config.database + '`');

  // Tabela de controle de migratorios
  await bootstrap.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)'
  );

  const [applied] = await bootstrap.query('SELECT name FROM schema_migrations');
  const appliedNames = new Set(applied.map((row) => row.name));

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  if (!files.length) console.log('Nenhuma migration encontrada.');

  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log('â—¦  ' + file + ' ja aplicada');
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await bootstrap.query(sql);
    await bootstrap.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    console.log('✅ ' + file + ' aplicada');
  }

  await bootstrap.end();
  console.log('Migrations concluídas.');
}

run().catch((err) => {
  console.error('❌ Erro nas migrations:', err.message);
  process.exit(1);
});