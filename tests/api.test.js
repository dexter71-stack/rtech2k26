// Suíte de integração da API (Etapas 1–6).
// Roda contra um banco isolado (galeto_gestao_test) com a aplicação real,
// em processo, e cobre autenticação/permissões, estoque, compras, desperdício,
// comunicação, configurações e auditoria.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../backend/app');
const { pool } = require('../backend/config/db');
const Client = require('./helpers/client');

const hoje = () => new Date().toISOString().slice(0, 10);
const maisDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

let server;
let base;
let admin;
let funcionario;

test.before(async () => {
  const app = createApp();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  admin = new Client(base);
  const loginAdmin = await admin.login('admin');
  assert.equal(loginAdmin.status, 200, 'login do administrador deve funcionar');

  funcionario = new Client(base);
  const loginFuncionario = await funcionario.login('funcionario');
  assert.equal(loginFuncionario.status, 200, 'login do funcionário deve funcionar');
});

test.after(async () => {
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

test('Suíte da API — Etapas 1 a 6', async (t) => {
  const ctx = {};

  await t.test('autenticação, sessão e permissões', async () => {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);

    const anon = new Client(base);
    assert.equal((await anon.get('/api/auth/me')).status, 401, 'sem sessão deve dar 401');

    const invalido = new Client(base);
    const ruim = await invalido.post('/api/auth/login', { identifier: 'admin', password: 'senha-errada' });
    assert.equal(ruim.status, 401);

    const me = await admin.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.data.user.role, 'admin');
    assert.equal(me.data.user.password_hash, undefined, 'hash de senha nunca deve ser exposto');

    assert.equal((await funcionario.get('/api/users')).status, 403, 'funcionário não gerencia usuários');

    const gerente = new Client(base);
    assert.equal((await gerente.login('gerente')).status, 200);
    assert.equal((await gerente.post('/api/auth/logout')).status, 200);
    assert.equal((await gerente.get('/api/auth/me')).status, 401, 'logout deve encerrar a sessão');
  });

  await t.test('estoque: produto, entrada, saída e estorno', async () => {
    const categorias = await admin.get('/api/catalogo/categorias');
    const unidades = await admin.get('/api/catalogo/unidades');
    assert.equal(categorias.status, 200);
    assert.ok(categorias.data.rows.length > 0, 'seed deve ter categorias');

    const categoria = categorias.data.rows[0].id;
    const kg = unidades.data.rows.find((u) => u.symbol === 'kg');
    assert.ok(kg, 'seed deve ter a unidade kg');

    const semNome = await admin.post('/api/produtos', { category_id: categoria, unit_id: kg.id });
    assert.equal(semNome.status, 400, 'produto sem nome é inválido');

    const criado = await admin.post('/api/produtos', {
      name: 'Produto Teste Estoque',
      category_id: categoria,
      unit_id: kg.id,
      min_stock: 2,
      reference_cost: 20,
    });
    assert.equal(criado.status, 201);
    ctx.productId = criado.data.product.id;

    const entrada = await admin.post('/api/movimentacoes', {
      type: 'entrada_ajuste',
      product_id: ctx.productId,
      quantity: 8,
      received_date: hoje(),
      expires_date: maisDias(30),
      code: 'LT-ESTOQUE',
    });
    assert.equal(entrada.status, 201);
    ctx.entradaId = entrada.data.movement.id;

    let produto = await admin.get(`/api/produtos/${ctx.productId}`);
    assert.equal(Number(produto.data.product.current_stock), 8, 'entrada deve somar no estoque');

    const lotes = await admin.get(`/api/movimentacoes/produto/${ctx.productId}/lotes?incluir_todos=1`);
    assert.equal(lotes.status, 200);
    const lote = lotes.data.rows.find((l) => l.code === 'LT-ESTOQUE');
    assert.ok(lote, 'lote da entrada deve existir');
    ctx.loteId = lote.id;

    const saida = await admin.post('/api/movimentacoes', {
      type: 'saida_ajuste',
      product_id: ctx.productId,
      quantity: 3,
      batch_id: ctx.loteId,
    });
    assert.equal(saida.status, 201);
    ctx.saidaId = saida.data.movement.id;

    produto = await admin.get(`/api/produtos/${ctx.productId}`);
    assert.equal(Number(produto.data.product.current_stock), 5);

    const estorno = await admin.post(`/api/movimentacoes/${ctx.saidaId}/estorno`);
    assert.equal(estorno.status, 201);
    produto = await admin.get(`/api/produtos/${ctx.productId}`);
    assert.equal(Number(produto.data.product.current_stock), 8, 'estorno devolve o saldo');

    const excesso = await admin.post('/api/movimentacoes', {
      type: 'saida_ajuste',
      product_id: ctx.productId,
      quantity: 999,
    });
    assert.equal(excesso.status, 409, 'saída maior que o saldo deve ser bloqueada');
  });

  await t.test('compras: pedido, recebimento e estorno', async () => {
    assert.equal((await funcionario.get('/api/compras')).status, 403, 'compras é restrito à gestão');

    const fornecedor = await admin.post('/api/fornecedores', { name: 'Fornecedor Teste' });
    assert.equal(fornecedor.status, 201);

    const pedido = await admin.post('/api/compras', {
      supplier_id: fornecedor.data.supplier.id,
      order_date: hoje(),
      items: [{
        product_id: ctx.productId,
        quantity: 5,
        unit_cost: 10,
        expires_date: maisDias(60),
        batch_code: 'CMP-TESTE',
      }],
    });
    assert.equal(pedido.status, 201);
    assert.equal(pedido.data.purchase.status, 'pendente');
    assert.equal(Number(pedido.data.purchase.total_amount), 50);
    ctx.compraId = pedido.data.purchase.id;

    const recebido = await admin.post(`/api/compras/${ctx.compraId}/receber`, {
      received_date: hoje(),
      invoice_number: 'NF-TESTE-1',
    });
    assert.equal(recebido.status, 200);
    assert.equal(recebido.data.purchase.status, 'recebida');

    let produto = await admin.get(`/api/produtos/${ctx.productId}`);
    assert.equal(Number(produto.data.product.current_stock), 13, 'recebimento entra no estoque');

    const estorno = await admin.post(`/api/compras/${ctx.compraId}/estornar`);
    assert.equal(estorno.status, 200);
    assert.equal(estorno.data.purchase.status, 'estornada');

    produto = await admin.get(`/api/produtos/${ctx.productId}`);
    assert.equal(Number(produto.data.product.current_stock), 8, 'estorno da compra devolve o saldo');
  });

  await t.test('desperdício: baixa no lote, custo e estorno', async () => {
    // O lote da entrada de ajuste não tem custo próprio: o prejuízo usa o custo
    // de referência do produto (fixado aqui para o teste ficar determinístico).
    const custo = await admin.put(`/api/produtos/${ctx.productId}`, { reference_cost: 20 });
    assert.equal(custo.status, 200);

    const perda = await admin.post('/api/desperdicios', {
      product_id: ctx.productId,
      batch_id: ctx.loteId,
      quantity: 2,
      reason: 'avaria',
      waste_date: hoje(),
      notes: 'Teste automatizado',
    });
    assert.equal(perda.status, 201);
    assert.equal(Number(perda.data.waste.total_cost), 40, 'prejuízo usa o custo de referência do produto');
    ctx.perdaId = perda.data.waste.id;

    let produto = await admin.get(`/api/produtos/${ctx.productId}`);
    assert.equal(Number(produto.data.product.current_stock), 6);

    const loteInexistente = await admin.post('/api/desperdicios', {
      product_id: ctx.productId,
      batch_id: 999999,
      quantity: 1,
      reason: 'outro',
      waste_date: hoje(),
    });
    assert.equal(loteInexistente.status, 404, 'lote de outro produto/sem saldo deve ser recusado');

    const lista = await admin.get('/api/desperdicios');
    assert.equal(lista.status, 200);
    assert.ok(lista.data.total >= 1);
    assert.equal(Number(lista.data.resumo.cost), 40);

    const estorno = await admin.post(`/api/desperdicios/${ctx.perdaId}/estorno`);
    assert.equal(estorno.status, 201);
    produto = await admin.get(`/api/produtos/${ctx.productId}`);
    assert.equal(Number(produto.data.product.current_stock), 8, 'estorno da perda devolve o saldo');
  });

  await t.test('comunicação: publicação, leitura, arquivamento e permissões', async () => {
    const criado = await admin.post('/api/comunicados', {
      title: 'Aviso de teste',
      message: 'Mensagem do teste automatizado.',
      priority: 'alta',
    });
    assert.equal(criado.status, 201);
    ctx.comunicadoId = criado.data.comunicado.id;

    const lista = await funcionario.get('/api/comunicados');
    assert.equal(lista.status, 200);
    assert.equal(lista.data.total, 1);
    assert.equal(Number(lista.data.rows[0].read_by_me), 0);
    assert.equal(lista.data.resumo.naoLidos, 1);

    const leitura = await funcionario.post(`/api/comunicados/${ctx.comunicadoId}/lido`);
    assert.equal(leitura.status, 200);
    assert.equal(Number(leitura.data.comunicado.read_by_me), 1);

    const leituras = await admin.get(`/api/comunicados/${ctx.comunicadoId}/leituras`);
    assert.equal(leituras.status, 200);
    assert.equal(Number(leituras.data.comunicado.read_count), 1);
    assert.equal(leituras.data.rows.length, 1);

    const semPermissao = await funcionario.post('/api/comunicados', {
      title: 'Não pode',
      message: 'Teste',
      priority: 'baixa',
    });
    assert.equal(semPermissao.status, 403, 'funcionário não publica comunicados');

    const curto = await admin.post('/api/comunicados', { title: 'a', message: 'b', priority: 'alta' });
    assert.equal(curto.status, 400);

    const arquivar = await admin.post(`/api/comunicados/${ctx.comunicadoId}/arquivar`);
    assert.equal(arquivar.status, 200);
    assert.equal((await funcionario.get('/api/comunicados')).data.total, 0, 'arquivado sai do mural');

    const reabrir = await admin.post(`/api/comunicados/${ctx.comunicadoId}/reabrir`);
    assert.equal(reabrir.status, 200);
    assert.equal((await funcionario.get('/api/comunicados')).data.total, 1);
  });

  await t.test('configurações: parâmetros, efeito no dashboard e permissões', async () => {
    const padrao = await admin.get('/api/configuracoes');
    assert.equal(padrao.status, 200);
    assert.equal(padrao.data.settings.alertDays, 7);
    assert.ok(padrao.data.settings.establishment_name.length >= 2);

    const proibido = await funcionario.put('/api/configuracoes', {
      establishment_name: 'Tentativa',
      alert_days: 7,
    });
    assert.equal(proibido.status, 403, 'só administrador altera parâmetros');

    const invalido = await admin.put('/api/configuracoes', {
      establishment_name: 'Galeto Teste',
      alert_days: 0,
    });
    assert.equal(invalido.status, 400);

    const alterado = await admin.put('/api/configuracoes', {
      establishment_name: 'Galeto Teste',
      establishment_address: 'Endereço de teste',
      establishment_phone: '',
      alert_days: 10,
    });
    assert.equal(alterado.status, 200);
    assert.equal(alterado.data.settings.alertDays, 10);

    const dash = await admin.get('/api/dashboard/summary');
    assert.equal(dash.status, 200);
    assert.equal(dash.data.alertaDias, 10, 'dashboard usa a janela configurada');

    const audit = await admin.get('/api/audit?pageSize=10');
    assert.equal(audit.status, 200);
    assert.ok(audit.data.total > 0);

    const porUsuario = await admin.get('/api/audit?user=funcionario');
    assert.equal(porUsuario.status, 200);
    assert.ok(porUsuario.data.rows.every((r) => /funcionário/i.test(r.user_name || '')));

    const porModulo = await admin.get('/api/audit?module=Configura');
    assert.equal(porModulo.status, 200);
    assert.ok(porModulo.data.total >= 1);

    const datasInvalidas = await admin.get('/api/audit?dateFrom=2026-12-01&dateTo=2026-11-01');
    assert.equal(datasInvalidas.status, 400);

    const csv = await admin.get('/api/audit?format=csv');
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type') || '', /text\/csv/);
    assert.match(csv.text, /Quando;Usuário;Ação;Módulo/);

    assert.equal((await funcionario.get('/api/audit')).status, 403, 'auditoria é do administrador');
  });
});
