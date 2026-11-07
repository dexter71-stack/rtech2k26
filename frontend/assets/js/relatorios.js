// Relatórios — Etapa 5: estoque, compras, desperdício e validade com filtros,
// resumo calculado no backend e exportação CSV (mesmos filtros da tela).
// Compras é restrito a administrador/gerente também no backend.
(async () => {
  const user = await renderLayout({
    page: 'relatorios',
    title: 'Relatórios',
    description: 'Relatórios operacionais com filtros e exportação em CSV',
  });
  if (!user) return;

  const podeCompras = user.role === 'admin' || user.role === 'gerente';
  const TIPOS = [
    { id: 'estoque', label: 'Estoque' },
    ...(podeCompras ? [{ id: 'compras', label: 'Compras' }] : []),
    { id: 'desperdicio', label: 'Desperdício' },
    { id: 'validade', label: 'Validade' },
  ];
  const MOTIVOS = [
    { value: 'vencido', label: 'Passou da validade' },
    { value: 'avaria', label: 'Avaria / dano' },
    { value: 'preparo', label: 'Erro de preparo' },
    { value: 'sobra', label: 'Sobra de produção' },
    { value: 'outro', label: 'Outro motivo' },
  ];

  const state = { tipo: 'estoque', dados: null };
  const pageEl = document.querySelector('.page');
  const $ = (sel) => document.querySelector(sel);

  pageEl.innerHTML = `
    <div id="page-actions-host" style="margin-bottom:16px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <div id="rel-tabs" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
      <span style="flex:1;"></span>
      <a class="btn btn-outline btn-sm" id="rel-export" href="#" style="pointer-events:none; opacity:.55;">Exportar CSV</a>
    </div>

    <div class="stats-grid" id="rel-resumo">
      <div class="stat"><div class="label">Carregando</div><div class="value">—</div></div>
    </div>

    <div class="card">
      <div class="card__head" style="flex-wrap:wrap; gap:6px;">
        <h2 id="rel-titulo">Relatório</h2>
        <span class="sub" id="rel-nota"></span>
      </div>
      <div class="card__body" id="rel-filtros" style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; padding-bottom:0;"></div>
      <div class="card__body--flush" id="rel-table"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
    </div>`;

  function renderTabs() {
    $('#rel-tabs').innerHTML = TIPOS.map((t) =>
      `<button class="btn btn-sm ${t.id === state.tipo ? 'btn-primary' : 'btn-outline'}" data-tipo="${t.id}">${t.label}</button>`
    ).join('');
    document.querySelectorAll('[data-tipo]').forEach((b) =>
      b.addEventListener('click', () => {
        if (state.tipo === b.dataset.tipo) return;
        state.tipo = b.dataset.tipo;
        renderTabs();
        renderFiltros();
        carregar();
      }));
  }

  function renderFiltros() {
    const box = $('#rel-filtros');
    if (state.tipo === 'estoque') {
      box.innerHTML = `
        <div class="field"><label for="f-search">Buscar</label>
          <input class="input" id="f-search" placeholder="Produto ou categoria" style="min-width:220px;" /></div>
        <div class="field"><label for="f-status">Status</label>
          <select class="input" id="f-status" style="max-width:150px;">
            <option value="">Todos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option>
          </select></div>
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; padding-bottom:9px;">
          <input type="checkbox" id="f-abaixo" /> Somente abaixo do mínimo
        </label>
        <button class="btn btn-primary btn-sm" id="f-aplicar" style="margin-bottom:1px;">Gerar</button>`;
    } else if (state.tipo === 'compras') {
      box.innerHTML = `
        <div class="field"><label for="f-de">Pedido de</label><input class="input" id="f-de" type="date" style="max-width:160px;" /></div>
        <div class="field"><label for="f-ate">até</label><input class="input" id="f-ate" type="date" style="max-width:160px;" /></div>
        <div class="field"><label for="f-status">Situação</label>
          <select class="input" id="f-status" style="max-width:160px;">
            <option value="">Todas</option><option value="pendente">Pendentes</option>
            <option value="recebida">Recebidas</option><option value="cancelada">Canceladas</option>
            <option value="estornada">Estornadas</option>
          </select></div>
        <button class="btn btn-primary btn-sm" id="f-aplicar" style="margin-bottom:1px;">Gerar</button>`;
    } else if (state.tipo === 'desperdicio') {
      box.innerHTML = `
        <div class="field"><label for="f-de">Perda de</label><input class="input" id="f-de" type="date" style="max-width:160px;" /></div>
        <div class="field"><label for="f-ate">até</label><input class="input" id="f-ate" type="date" style="max-width:160px;" /></div>
        <div class="field"><label for="f-motivo">Motivo</label>
          <select class="input" id="f-motivo" style="max-width:190px;">
            <option value="">Todos</option>${MOTIVOS.map((m) => `<option value="${m.value}">${m.label}</option>`).join('')}
          </select></div>
        <div class="field"><label for="f-status">Situação</label>
          <select class="input" id="f-status" style="max-width:150px;">
            <option value="">Todas</option><option value="registrado">Registradas</option><option value="estornado">Estornadas</option>
          </select></div>
        <button class="btn btn-primary btn-sm" id="f-aplicar" style="margin-bottom:1px;">Gerar</button>`;
    } else {
      box.innerHTML = `
        <div class="field"><label for="f-dias">Vencendo em até</label>
          <select class="input" id="f-dias" style="max-width:170px;">
            <option value="7">7 dias</option><option value="15">15 dias</option>
            <option value="30" selected>30 dias</option><option value="60">60 dias</option>
            <option value="90">90 dias</option><option value="365">365 dias</option>
          </select></div>
        <button class="btn btn-primary btn-sm" id="f-aplicar" style="margin-bottom:1px;">Gerar</button>`;
    }

    $('#f-aplicar').addEventListener('click', carregar);
    const busca = $('#f-search');
    if (busca) {
      busca.addEventListener('keydown', (e) => { if (e.key === 'Enter') carregar(); });
    }
  }

  function montarQuery() {
    const qs = new URLSearchParams();
    if (state.tipo === 'estoque') {
      const search = $('#f-search').value.trim();
      if (search) qs.set('search', search);
      if ($('#f-status').value) qs.set('status', $('#f-status').value);
      if ($('#f-abaixo').checked) qs.set('abaixoMinimo', '1');
    } else if (state.tipo === 'compras' || state.tipo === 'desperdicio') {
      if ($('#f-de').value) qs.set('dateFrom', $('#f-de').value);
      if ($('#f-ate').value) qs.set('dateTo', $('#f-ate').value);
      if (state.tipo === 'compras') {
        if ($('#f-status').value) qs.set('status', $('#f-status').value);
      } else {
        if ($('#f-motivo').value) qs.set('reason', $('#f-motivo').value);
        if ($('#f-status').value) qs.set('status', $('#f-status').value);
      }
    } else if ($('#f-dias')) {
      qs.set('dias', $('#f-dias').value);
    }
    return qs;
  }

  const fmtData = (v) => {
    if (!v) return '—';
    const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleDateString('pt-BR');
  };

  const BADGES = {
    ativo: 'badge-ok', inativo: 'badge-neutral',
    Recebida: 'badge-ok', Pendente: 'badge-warn', Cancelada: 'badge-neutral', Estornada: 'badge-danger',
    Registrado: 'badge-neutral', Estornado: 'badge-neutral',
    'Passou da validade': 'badge-danger', 'Avaria / dano': 'badge-warn',
    Ativo: 'badge-ok', Vencido: 'badge-danger',
  };

  function valorCelula(col, row) {
    const v = row[col.key];
    if (col.key === 'status' || col.key === 'reason') {
      const cls = BADGES[String(v)];
      if (cls) return `<span class="badge ${cls}">${esc(v)}</span>`;
    }
    if (col.type === 'dinheiro') return fmtMoney(v);
    if (col.type === 'numero') return fmtNum(v);
    if (col.type === 'data') return fmtData(v);
    return esc(v === null || v === undefined || v === '' ? '—' : v);
  }

  function tomDoResumo(item) {
    const n = Number(item.valor) || 0;
    if (['Abaixo do mínimo', 'Sem estoque', 'Vencidos', 'Prejuízo', 'Estornados'].includes(item.label)) {
      return n > 0 ? 'is-danger' : '';
    }
    if (['Vencem em 7 dias', 'Pendentes'].includes(item.label)) return n > 0 ? 'is-warn' : '';
    return '';
  }

  function renderResumo(dados) {
    $('#rel-resumo').innerHTML = dados.resumo.map((r) => `
      <div class="stat ${tomDoResumo(r)}">
        <div class="label">${esc(r.label)}</div>
        <div class="value">${r.tipo === 'dinheiro' ? fmtMoney(r.valor) : fmtNum(r.valor, 0)}</div>
      </div>`).join('');
  }

  function renderTabela(dados) {
    const box = $('#rel-table');
    if (!dados.linhas.length) {
      box.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/></svg>
          <strong>Nenhum registro no filtro</strong>
          <span>Ajuste o período ou os filtros para gerar o relatório.</span>
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="table-wrap">
        <table class="table table-stacked">
          <thead>
            <tr>${dados.colunas.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${dados.linhas.map((row) => `
              <tr>${dados.colunas.map((c) => `<td data-label="${esc(c.label)}">${valorCelula(c, row)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  async function carregar() {
    const box = $('#rel-table');
    box.innerHTML = '<div class="loading"><div class="spinner"></div> Gerando relatório...</div>';
    const qs = montarQuery();
    const url = `/api/relatorios/${state.tipo}?${qs}`;

    try {
      const dados = await api(url);
      state.dados = dados;
      $('#rel-titulo').textContent = dados.titulo;
      const limiteInfo = dados.linhas.length >= dados.limite ? ` Exibindo até ${dados.limite} linhas — o CSV usa o mesmo recorte.` : '';
      $('#rel-nota').textContent = dados.nota + limiteInfo;
      renderResumo(dados);
      renderTabela(dados);

      const exp = $('#rel-export');
      const expQs = new URLSearchParams(qs);
      expQs.set('format', 'csv');
      exp.href = `/api/relatorios/${state.tipo}?${expQs}`;
      exp.style.pointerEvents = 'auto';
      exp.style.opacity = '1';
    } catch (err) {
      box.innerHTML = `<div class="alert alert-danger" style="margin:16px;">Não foi possível gerar o relatório: ${esc(err.message)}</div>`;
      $('#rel-resumo').innerHTML = '';
      $('#rel-nota').textContent = '';
      const exp = $('#rel-export');
      exp.href = '#';
      exp.style.pointerEvents = 'none';
      exp.style.opacity = '.55';
    }
  }

  renderTabs();
  renderFiltros();
  carregar();
})();
