// Lotes e Validade — Etapa 2: rastreabilidade por lote, FEFO e janelas de vencimento.
// Entradas/saídas são registradas em Movimentações; aqui é o painel de validade.
const hoje = () => new Date().toISOString().slice(0, 10);

(function () {
  const params = new URLSearchParams(location.search);
  if (params.get('product_id')) sessionStorage.setItem('gg_lotes_produto', params.get('product_id'));
})();

(async () => {
  const user = await renderLayout({
    page: 'validade',
    title: 'Lotes e Validade',
    description: 'Rastreabilidade dos lotes, alertas de vencimento e desperdício a evitar',
  });
  if (!user) return;

  const podeGerenciar = user.role === 'admin' || user.role === 'gerente';
  const state = { page: 1, pageSize: 30, total: 0, rows: [], produtos: [], baixoEstoque: [], semEstoque: [] };

  const pageEl = document.querySelector('.page');
  pageEl.innerHTML = `
    <div class="stats-grid" id="alert-stats">
      <div class="stat ${state.baixoEstoque ? '' : ''}" id="stat-baixo" style="cursor:pointer;" title="Ver na lista abaixo">
        <div class="label">Produtos com estoque baixo</div>
        <div class="value">—</div>
      </div>
      <div class="stat" id="stat-sem">
        <div class="label">Produtos sem estoque</div>
        <div class="value">—</div>
      </div>
      <div class="stat" id="stat-venc">
        <div class="label">Lotes vencendo (7 dias)</div>
        <div class="value">—</div>
      </div>
      <div class="stat" id="stat-vencidos">
        <div class="label">Lotes já vencidos</div>
        <div class="value">—</div>
      </div>
    </div>

    <div id="page-actions-host" style="margin:16px 0; display:flex; gap:8px; flex-wrap:wrap;">
      <input class="input" id="f-search" placeholder="Buscar por produto, código ou fornecedor..." style="max-width:280px;" />
      <input class="input" id="f-produto" list="prod-list" placeholder="Produto específico" style="max-width:250px;" />
      <datalist id="prod-list"></datalist>
      <select class="input" id="f-janela" style="max-width:220px;">
        <option value="">Todos os prazos</option>
        <option value="7" ${podeGerenciar ? '' : ''}>Vencendo em até 7 dias (FEFO)</option>
        <option value="15">Vencendo em até 15 dias</option>
        <option value="30">Vencendo em até 30 dias</option>
      </select>
      <select class="input" id="f-status" style="max-width:160px;">
        <option value="">Todos os status</option>
        <option value="ativo">Ativos</option>
        <option value="esgotado">Esgotados</option>
        <option value="vencido">Vencidos</option>
      </select>
      <span style="flex:1;"></span>
      ${podeGerenciar ? '<a class="btn btn-primary" href="/pages/movimentacoes/">+ Registrar entrada</a>' : ''}
      <button class="btn btn-outline btn-sm" id="btn-refresh">Atualizar</button>
    </div>

    <div class="card">
      <div class="card__head">
        <h2>Lotes</h2>
        <span class="sub" id="total-info">—</span>
      </div>
      <div class="card__body--flush" id="lotes-table"><div class="loading"><div class="spinner"></div> Carregando lotes...</div></div>
    </div>`;

  const $ = (sel) => document.querySelector(sel);
  $('#f-search').addEventListener('input', debounce(() => { state.page = 1; load(); }, 350));
  $('#btn-refresh').addEventListener('click', load);

  async function loadProdutos() {
    const [produtos, alertas] = await Promise.all([
      api('/api/produtos?pageSize=100&status=ativo'),
      api('/api/alertas?dias=7'),
    ]);
    state.produtos = produtos.rows;
    $('#prod-list').innerHTML = state.produtos.map((p) => `<option value="${esc(p.name)}">`).join('');
    $('#stat-baixo .value').textContent = alertas.baixoEstoque.length;
    $('#stat-sem .value').textContent = alertas.semEstoque.length;
    $('#stat-venc .value').textContent = alertas.vencendo.length;
    $('#stat-vencidos .value').textContent = alertas.vencidos.length;
    $('#stat-baixo').classList.toggle('is-warn', alertas.baixoEstoque.length > 0);
    $('#stat-sem').classList.toggle('is-danger', alertas.semEstoque.length > 0);
    $('#stat-venc').classList.toggle('is-warn', alertas.vencendo.length > 0);
    $('#stat-vencidos').classList.toggle('is-danger', alertas.vencidos.length > 0);
  }

  async function load() {
    const box = $('#lotes-table');
    box.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando lotes...</div>';
    const qs = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
    if ($('#f-search').value.trim()) qs.set('search', $('#f-search').value.trim());
    const nomeProd = $('#f-produto').value.trim();
    const prod = state.produtos.find((p) => p.name === nomeProd);
    if (prod) qs.set('product_id', prod.id);
    if ($('#f-janela').value) { qs.set('vence_em_dias', $('#f-janela').value); qs.set('com_saldo', '1'); }
    if ($('#f-status').value) qs.set('status', $('#f-status').value);

    try {
      const data = await api(`/api/lotes?${qs}`);
      state.rows = data.rows;
      state.total = data.total;
      $('#total-info').textContent = `${data.total} lote(s)`;
      renderRows();
    } catch (err) {
      box.innerHTML = `<div class="alert alert-danger" style="margin:16px;">Falha ao carregar: ${esc(err.message)}</div>`;
    }
  }

  function badgeStatus(l) {
    const dias = l.dias_para_vencer;
    if (l.status === 'esgotado') return '<span class="badge badge-neutral">Esgotado</span>';
    if (l.status === 'vencido' || dias < 0) return `<span class="badge badge-danger">Vencido ${dias !== undefined ? `(${Math.abs(dias)}d)` : ''}</span>`;
    if (dias !== undefined && dias <= 7) return `<span class="badge badge-warn">Vence em ${dias}d</span>`;
    return '<span class="badge badge-ok">Na validade</span>';
  }

  function renderRows() {
    const box = $('#lotes-table');
    if (!state.rows.length) {
      box.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>
          <strong>Nenhum lote no filtro</strong>
          <span>Os lotes aparecem quando entradas são registradas em Movimentações.</span>
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="table-wrap">
        <table class="table table-stacked">
          <thead>
            <tr><th>Lote</th><th>Produto</th><th>Recebido</th><th>Validade</th><th>Saldo</th><th>Fornecedor</th></tr>
          </thead>
          <tbody>
            ${state.rows.map((l) => {
      const ingresso = Number(l.received_qty);
      const restante = Number(l.remaining_qty);
      const paretocent = ingresso > 0 ? Math.round((restante / ingresso) * 100) : 0;
      return `
                <tr>
                  <td data-label="Lote">
                    <div class="cell-strong">${esc(l.code || `#${l.id}`)}</div>
                    ${badgeStatus(l)}
                  </td>
                  <td data-label="Produto">${esc(l.product_name)}<div class="cell-muted">${esc(l.category_name || '')}</div></td>
                  <td data-label="Recebido"><div class="cell-muted">${fmtDateTime(l.received_date)}</div></td>
                  <td data-label="Validade"><div class="cell-muted">${fmtDateTime(l.expires_date).split(' ')[0]}</div></td>
                  <td data-label="Saldo">
                    <div class="cell-strong">${fmtNum(restante)} ${esc(l.unit_symbol || '')}</div>
                    <div class="cell-muted">${paretocent}% do lote (${fmtNum(ingresso)})</div>
                  </td>
                  <td data-label="Fornecedor">${esc(l.supplier_name || '—')}</td>
                </tr>`;
    }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  $('#f-produto').addEventListener('change', load);
  $('#f-janela').addEventListener('change', load);
  $('#f-status').addEventListener('change', load);

  try {
    await loadProdutos();
    // Pré-seleciona produto se a página veio de "Lotes" na tela de estoque.
    const pre = sessionStorage.getItem('gg_lotes_produto');
    if (pre) {
      const p = state.produtos.find((x) => x.id === Number(pre));
      if (p) $('#f-produto').value = p.name;
      sessionStorage.removeItem('gg_lotes_produto');
    }
    await load();
  } catch (err) {
    pageEl.innerHTML = `<div class="alert alert-danger">Falha ao carregar a página: ${esc(err.message)}</div>`;
  }
})();
