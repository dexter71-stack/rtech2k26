// Runner da suíte de integração da API.
// Cria um banco ISOLADO (padrão: galeto_gestao_test), aplica migrations e seed,
// roda os testes e apaga o banco no final. Nunca toca no banco de desenvolvimento.
require('dotenv').config();
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

const ROOT = path.join(__dirname, '..');
const TEST_DB = process.env.TEST_DB_NAME || 'galeto_gestao_test';

if (!/_test$/.test(TEST_DB)) {
  console.error(`❌ Por segurança, o banco de teste precisa terminar em "_test" (recebido: ${TEST_DB}).`);
  process.exit(1);
}

const conexaoBase = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3308),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

const env = { ...process.env, DB_NAME: TEST_DB, NODE_ENV: 'test' };

function executar(args, descricao) {
  const resultado = spawnSync(process.execPath, args, { cwd: ROOT, env, stdio: 'inherit' });
  if (resultado.status !== 0) {
    throw new Error(`${descricao} falhou (código ${resultado.status}).`);
  }
}

async function recriarBanco() {
  const conn = await mysql.createConnection(conexaoBase);
  await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await conn.end();
}

async function apagarBanco() {
  const conn = await mysql.createConnection(conexaoBase);
  await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await conn.end();
}

(async () => {
  console.log(`🧪 Banco de teste isolado: ${TEST_DB}`);
  await recriarBanco();

  executar(['scripts/migrate.js'], 'Migrations');
  executar(['scripts/seed.js'], 'Seed');

  const resultado = spawnSync(
    process.execPath,
    ['--test', '--test-concurrency=1', '--test-reporter=spec', 'tests/api.test.js'],
    { cwd: ROOT, env, stdio: 'inherit' }
  );

  await apagarBanco();
  console.log(`🧹 Banco de teste ${TEST_DB} removido.`);
  process.exit(resultado.status || 0);
})().catch(async (err) => {
  console.error(`❌ ${err.message}`);
  try { await apagarBanco(); } catch (e) { /* banco já removido */ }
  process.exit(1);
});
