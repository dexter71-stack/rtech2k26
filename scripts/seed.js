require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const DEMO_PASSWORD = 'Galeto@2026';

const DOMAIN_UNITS = [
  { name: 'Quilograma', symbol: 'kg' },
  { name: 'Grama', symbol: 'g' },
  { name: 'Litro', symbol: 'L' },
  { name: 'Mililitro', symbol: 'ml' },
  { name: 'Unidade', symbol: 'un' },
  { name: 'Pacote', symbol: 'pacote' },
  { name: 'Caixa', symbol: 'caixa' },
];

const DEMO_CATEGORY = [
  'Carnes',
  'Temperos e Especiarias',
  'Legumes e Verduras',
  'Grãos e Cereais',
  'Bebidas',
  'Embalagens',
  'Carvão e Combustível',
  'Diversos',
];

const DEMO_USERS = [
  {
    name: 'Administrador (demonstração)',
    email: 'admin@galeto.local',
    username: 'admin',
    position: 'Administrador do sistema',
    role: 'admin',
  },
  {
    name: 'Gerente (demonstração)',
    email: 'gerente@galeto.local',
    username: 'gerente',
    position: 'Gerente operacional',
    role: 'gerente',
  },
  {
    name: 'Funcionário (demonstração)',
    email: 'funcionario@galeto.local',
    username: 'funcionario',
    position: 'Auxiliar de cozinha',
    role: 'funcionario',
  },
];

async function run() {
  const pool = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3308),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'galeto_gestao',
  });

  // Unidades de medida do domínio.
  for (const unit of DOMAIN_UNITS) {
    await pool.query(
      'INSERT INTO units (name, symbol) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM units WHERE symbol = ?)',
      [unit.name, unit.symbol, unit.symbol]
    );
  }
  console.log('✅ ' + DOMAIN_UNITS.length + ' unidades de medida garantidas');

  // Categorias iniciais de galeteria.
  for (const name of DEMO_CATEGORY) {
    await pool.query(
      'INSERT INTO categories (name) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = ?)',
      [name, name]
    );
  }
  console.log('✅ ' + DEMO_CATEGORY.length + ' categorias garantidas');

  // Usuários demonstrativos com senha compartilhada (trocar após o 1º acesso).
  for (const user of DEMO_USERS) {
    await pool.query(
      'INSERT INTO users (name, email, username, password_hash, position, role, status) SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = ?)',
      [user.name, user.email, user.username, await bcrypt.hash(DEMO_PASSWORD, 10), user.position, user.role, 'ativo', user.email]
    );
  }
  console.log('✅ Usuários demonstrativos garantidos (demonstração)');
  console.log('   senha padrão de demonstração: ' + DEMO_PASSWORD);

  await pool.end();
  console.log('Seeds concluídas.');
}

run().catch(async (err) => {
  console.error('❌ Erro nas seeds:', err.message);
  process.exit(1);
});