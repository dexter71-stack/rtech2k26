// Pool de conexão com o PostgreSQL (Supabase).
// Configurado para funcionar no Render (Node.js) conectando no Supabase.
// Usa SSL obrigatório e connectionString padrão do Supabase.
require('dotenv').config();
const { Pool } = require('pg');

// Usar connectionString pronto do Supabase (funciona melhor que separar host/port)
// Substitua os valores abaixo se mudar a senha ou o projeto:
const connectionString = process.env.DB_CONNECTION_STRING ||
  'postgres://postgres:A2b2d2s3103@db.urkhppoeathgffpqdqxd.supabase.co:5432/postgres?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  // Quebrar conexões idle após 1 hora
  idleTimeout: 600000,
  connectionTimeout: 20000,
});

pool.on('connect', (client) => {
  client.query('SET timezone = "UTC"');
});

pool.on('error', (err) => {
  console.error('❌ Erro no pool do PostgreSQL (idle client)', err);
  process.exit(-1);
});

module.exports = { pool };