// Configurações — Etapa 6: parâmetros da galeteria (nome, contato e janela de
// alerta de validade) e auditoria completa com filtros e exportação CSV.
// Alteração de parâmetros e consulta da auditoria são restritas ao administrador.
(async () => {
  const user = await renderLayout({
    page: 'configuracoes',
    title: 'Configurações',
    description: 'Parâmetros da galeteria e auditoria completa do sistema',
  });
  if (!user) return;
  if (!requireAdminOrRedirect(user)) return;

  const state = { page: 1, pageSize: 25, total: 0 };
  const pageEl = document.querySelector('.page');
  const $ = (sel) => document.querySelector(sel);

  pageEl.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card__head" style="flex-wrap:wrap; gap:6px;">
        <h2>Parâmetros da galeteria</h2>
        <span class="sub">usados no layout, no dashboard e nos alertas de validade</span>
      </div>
      <div class="card__body">
        <form id="cfg-form" novalidate>
          <div id="cfg-errors" class="alert alert-danger" style="display:none;"></div>
          <div class="form-row">
            <div class="field">
              <label for="cfg-name">Nome do estabelecimento *</label>
              <input class="input" id="cfg-name" maxlength="80" required />
            </div>
            <div class="field">
              <label for="cfg-phone">Telefone</label>
              <input class="input" id="cfg-phone" maxlength="30" placeholder="(82) 9...." />
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="cfg-address">Endereço</label>
              <input class="input" id="cfg-address" maxlength="160" />
            </div>
            <div class="field">
              <label for="cfg-days">Alerta de validade (dias) *</label>
              <input class="input" id="cfg-days" type="number" min="1" max="90" step="1" required />
              <div class="hint">janela do “próximos do vencimento” no dashboard, em Lotes e em /api/alertas</div>
            </div>
          </div>
          <button class="btn btn-primary" type="submit" id="cfg-save">Salvar parâmetros</button>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card__head" style="flex-wrap:wrap; gap:8px;">
        <h2>Auditoria completa</h2>
        <span class="sub" id="aud-total">—</span>
        <span class="spacer"></span>
        <a class="btn btn-outline btn-sm" id="aud-export" href="#">Exportar CSV</a>
      </div>
      <div class="card__body" style="display:flex; gap:8px; flex-wrap:wrap; padding-bottom:0;">
        <input class="input" id="a-user" placeholder="Usuário (nome ou e-mail)" style="max-width:220px;" />
        <input class="input" id="a-module" placeholder="Módulo" style="max-width:150px;" />
        <input class="input" id="a-action" placeholder="Ação" style="max-width:150px;" />
        <input class="input" id="a-de" type="date" title="De" style="max-width:160px;" />
        <input class="input" id="a-ate" type="date" title="Até" style="max-width:160px;" />
        <button class="btn btn-outline btn-sm" id="a-filter">Filtrar</button>
        <button class="btn btn-outline btn-sm" id="a-clear">Limpar</button>
        <span style="flex:1;"></span>
        <button class="btn btn-outline btn-sm" id="a-refresh">Atualizar</button>
      </div>
      <div class="card__body--flush" id="aud-table">
        <div class="loading"><div class="spinner"></div> Carregando auditoria...</div>
      </div>
      <div class="card__body" id="aud-pager" style="display:none; justify-content:space-between; align-items:center;">
        <span class="sub" id="aud-info"></span>
        <span style="display:flex; gap:8px;">
          <button class="btn btn-outline btn-sm" id="aud-prev">Anterior</button>
          <button class="btn btn-outline btn-sm" id="aud-next">Próxima</button>
        </span>
      </div>
    </div>

    <div class="alert alert-info">
      <div><strong>O que fica registrado.</strong> Login/logout, funcionários, estoque, compras, fornecedores, movimentações, desperdício, comunicados e alterações de parâmetros. A auditoria não pode ser editada nem apagada pela interface.</div>
    </div>`;

  $('#cfg-form').addEventListener('submit', salvarConfig);
  $('#a-filter').addEventListener('click', () => { state.page = 1; carregarAuditoria(); });
  $('#a-refresh').addEventListener('click', () => carregarAuditoria());
  $('#a-clear').addEventListener('click', () => {
    for (const id of ['#a-user', '#a-module', '#a-action', '#a-de', '#a-ate']) $(id).value = '';
    state.page = 1;
    carregarAuditoria();
  });
  $('#aud-prev').addEventListener('click', () => { if (state.page > 1) { state.page -= 1; carregarAuditoria(); } });
  $('#aud-next').addEventListener('click', () => {
    if (state.page * state.pageSize < state.total) { state.page += 1; carregarAuditoria(); }
  });
  for (const id of ['#a-user', '#a-module', '#a-action']) {
    $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.page = 1; carregarAuditoria(); } });
  }

  async function carregarConfig() {
    try {
      const { settings } = await api('/api/configuracoes');
      $('#cfg-name').value = settings.establishment_name;
      $('#cfg-address').value = settings.establishment_address || '';
      $('#cfg-phone').value = settings.establishment_phone || '';
      $('#cfg-days').value = settings.alertDays;
    } catch (err) {
      $('#cfg-errors').innerHTML = esc(err.message);
      $('#cfg-errors').style.display = 'block';
    }
  }

  async function salvarConfig(e) {
    e.preventDefault();
    const errBox = $('#cfg-errors');
    errBox.style.display = 'none';
    const btn = $('#cfg-save');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      const { settings } = await api('/api/configuracoes', {
        method: 'PUT',
        body: {
          establishment_name: $('#cfg-name').value.trim(),
          establishment_address: $('#cfg-address').value.trim(),
          establishment_phone: $('#cfg-phone').value.trim(),
          alert_days: Number($('#cfg-days').value),
        },
      });
      window.APP_SETTINGS = settings;
      const brand = document.querySelector('.sidebar__brand small');
      if (brand) brand.textContent = settings.establishment_name;
      toast('Parâmetros salvos. A janela de alerta já vale para o dashboard.');
      await carregarConfig();
      await carregarAuditoria();
    } catch (err) {
      const details = Array.isArray(err.details) && err.details.length
        ? '<ul style="margin-left:16px;">' + err.details.map((d) => `<li>${esc(d)}</li>`).join('') + '</ul>'
        : '';
      errBox.innerHTML = esc(err.message) + details;
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar parâmetros';
    }
  }

  function montarQuery() {
    const qs = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
    const userFilter = $('#a-user').value.trim();
    const moduleName = $('#a-module').value.trim();
    const action = $('#a-action').value.trim();
    if (userFilter) qs.set('user', userFilter);
    if (moduleName) qs.set('module', moduleName);
    if (action) qs.set('action', action);
    if ($('#a-de').value) qs.set('dateFrom', $('#a-de').value);
    if ($('#a-ate').value) qs.set('dateTo', $('#a-ate').value);
    return qs;
  }

  async function carregarAuditoria() {
    const box = $('#aud-table');
    box.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando auditoria...</div>';
    const qs = montarQuery();

    try {
      const data = await api(`/api/audit?${qs}`);
      state.total = data.total;
      renderAuditoria(data.rows);

      const expQs = new URLSearchParams(qs);
      expQs.delete('page');
      expQs.delete('pageSize');
      expQs.set('format', 'csv');
      $('#aud-export').href = `/api/audit?${expQs}`;

      const pager = $('#aud-pager');
      pager.style.display = data.total > 0 ? 'flex' : 'none';
      const inicio = (data.page - 1) * data.pageSize + 1;
      const fim = Math.min(data.page * data.pageSize, data.total);
      $('#aud-total').textContent = `${data.total} evento(s) registrados`;
      $('#aud-info').textContent = `Mostrando ${inicio}–${fim} de ${data.total}`;
      $('#aud-prev').disabled = data.page <= 1;
      $('#aud-next').disabled = data.page * data.pageSize >= data.total;
    } catch (err) {
      box.innerHTML = `<div class="alert alert-danger" style="margin:16px;">Falha ao carregar a auditoria: ${esc(err.message)}</div>`;
      $('#aud-pager').style.display = 'none';
      $('#aud-total').textContent = '—';
    }
  }

  function renderAuditoria(rows) {
    const box = $('#aud-table');
    if (!rows.length) {
      box.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/></svg>
          <strong>Nenhum evento no filtro</strong>
          <span>Ajuste o período, o módulo ou o usuário para consultar a auditoria.</span>
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="table-wrap">
        <table class="table table-stacked">
          <thead>
            <tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Módulo</th><th>Descrição</th><th>IP</th></tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td data-label="Quando" class="cell-muted">${fmtDateTime(r.created_at)}</td>
                <td data-label="Usuário">${esc(r.user_name || 'sistema')}</td>
                <td data-label="Ação"><span class="badge badge-neutral">${esc(r.action)}</span></td>
                <td data-label="Módulo">${esc(r.module || '—')}</td>
                <td data-label="Descrição">${esc(r.description || '—')}${r.record_id ? ` <span class="cell-muted">(${esc(r.record_id)})</span>` : ''}</td>
                <td data-label="IP" class="cell-muted">${esc(r.ip || '—')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  await carregarConfig();
  await carregarAuditoria();
})();
