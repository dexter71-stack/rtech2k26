// Comunicação — Etapa 5: mural de comunicados internos com prioridade,
// confirmação de leitura e histórico de arquivados (admin/gerente).
// Publicar/arquivar/ver leituras é validado no backend.
(async () => {
  const user = await renderLayout({
    page: 'comunicacao',
    title: 'Comunicação',
    description: 'Mural de comunicados internos com prioridade e confirmação de leitura',
  });
  if (!user) return;

  const podeGerenciar = user.role === 'admin' || user.role === 'gerente';
  const state = { status: 'ativo', rows: [], resumo: { ativos: 0, naoLidos: 0, alta: 0 } };
  const pageEl = document.querySelector('.page');
  const $ = (sel) => document.querySelector(sel);

  const PRIO = {
    alta: { label: 'Alta', cls: 'badge-danger', cor: '#ff5d73' },
    media: { label: 'Média', cls: 'badge-warn', cor: '#ffb84d' },
    baixa: { label: 'Baixa', cls: 'badge-neutral', cor: '#5f7c71' },
  };

  pageEl.innerHTML = `
    <div id="page-actions-host" style="margin-bottom:16px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      ${podeGerenciar ? `
        <select class="input" id="f-status" style="max-width:190px;">
          <option value="ativo">Mural ativo</option>
          <option value="arquivado">Arquivados</option>
        </select>
        <span style="flex:1;"></span>
        <button class="btn btn-primary" id="btn-new">+ Novo comunicado</button>`
      : '<span style="flex:1;"></span><button class="btn btn-outline btn-sm" id="btn-refresh">Atualizar</button>'}
    </div>

    <div class="stats-grid" id="com-stats"></div>
    <div id="com-list"><div class="loading"><div class="spinner"></div> Carregando comunicados...</div></div>

    ${podeGerenciar ? `
    <div class="modal-backdrop" id="com-modal">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal__head">
          <h3>Novo comunicado</h3>
          <button class="close" type="button" onclick="closeModal('com-modal')" aria-label="Fechar">✕</button>
        </div>
        <form id="com-form" novalidate>
          <div class="modal__body">
            <div id="c-errors" class="alert alert-danger" style="display:none;"></div>
            <div class="field">
              <label for="c-title">Título *</label>
              <input class="input" id="c-title" maxlength="120" placeholder="Ex.: Abertura do galpão no feriado" required />
            </div>
            <div class="field">
              <label for="c-priority">Prioridade *</label>
              <select class="input" id="c-priority">
                <option value="baixa">Baixa</option>
                <option value="media" selected>Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div class="field">
              <label for="c-message">Mensagem *</label>
              <textarea class="input" id="c-message" rows="6" maxlength="4000" placeholder="Escreva o comunicado para a equipe..." required></textarea>
              <div class="hint">Todos os funcionários ativos verão o comunicado no mural.</div>
            </div>
          </div>
          <div class="modal__foot">
            <button class="btn btn-outline" type="button" onclick="closeModal('com-modal')">Cancelar</button>
            <button class="btn btn-primary" type="submit" id="c-save">Publicar</button>
          </div>
        </form>
      </div>
    </div>` : ''}

    <div class="modal-backdrop" id="reads-modal">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal__head">
          <h3 id="reads-title">Leituras</h3>
          <button class="close" type="button" onclick="closeModal('reads-modal')" aria-label="Fechar">✕</button>
        </div>
        <div class="modal__body">
          <div class="hint" id="reads-summary" style="margin-bottom:10px;"></div>
          <div id="reads-body"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
        </div>
        <div class="modal__foot">
          <button class="btn btn-outline" type="button" onclick="closeModal('reads-modal')">Fechar</button>
        </div>
      </div>
    </div>`;

  if ($('#f-status')) {
    $('#f-status').addEventListener('change', (e) => {
      state.status = e.target.value;
      load();
    });
    $('#btn-new').addEventListener('click', () => openModal('com-modal'));
    $('#com-form').addEventListener('submit', publicar);
  } else {
    $('#btn-refresh').addEventListener('click', load);
  }

  async function load() {
    const listEl = $('#com-list');
    listEl.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando comunicados...</div>';
    try {
      const data = await api(`/api/comunicados?status=${state.status}&pageSize=50`);
      state.rows = data.rows;
      state.resumo = data.resumo;
      renderStats();
      renderList(data.total);
      bindActions();
    } catch (err) {
      listEl.innerHTML = `<div class="alert alert-danger">Falha ao carregar o mural: ${esc(err.message)}</div>`;
    }
  }

  function renderStats() {
    const { ativos, naoLidos, alta } = state.resumo;
    $('#com-stats').innerHTML = `
      <div class="stat">
        <div class="label">Comunicados no mural</div>
        <div class="value">${ativos}</div>
        <div class="hint">publicados e não arquivados</div>
      </div>
      <div class="stat ${naoLidos > 0 ? 'is-warn' : 'is-ok'}">
        <div class="label">Não lidos por você</div>
        <div class="value">${naoLidos}</div>
        <div class="hint">${naoLidos > 0 ? 'marque como lido ao terminar a leitura' : 'tudo em dia'}</div>
      </div>
      <div class="stat ${alta > 0 ? 'is-danger' : ''}">
        <div class="label">Prioridade alta</div>
        <div class="value">${alta}</div>
        <div class="hint">comunicados urgentes no mural</div>
      </div>`;
  }

  function renderList(total) {
    const listEl = $('#com-list');
    if (!state.rows.length) {
      listEl.innerHTML = `
        <div class="card"><div class="card__body">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 15v-4a5 5 0 1 0-10 0v4l-2 3h14z"/><path d="M10 20h4"/></svg>
            <strong>${state.status === 'arquivado' ? 'Nenhum comunicado arquivado' : 'Nenhum comunicado no mural'}</strong>
            <span>${state.status === 'arquivado' ? 'Os comunicados arquivados ficam aqui como histórico.' : podeGerenciar ? 'Publique o primeiro comunicado para a equipe.' : 'Quando a gestão publicar algo, aparece aqui.'}</span>
          </div>
        </div></div>`;
      return;
    }

    const aviso = total > state.rows.length
      ? `<div class="alert alert-info" style="margin-bottom:12px;">Mostrando os ${state.rows.length} comunicados mais relevantes de ${total}. Arquive os antigos para manter o mural enxuto.</div>`
      : '';

    listEl.innerHTML = aviso + state.rows.map((r) => {
      const prio = PRIO[r.priority] || PRIO.media;
      const novo = r.status === 'ativo' && !Number(r.read_by_me);
      return `
      <div class="card" style="margin-bottom:12px; border-left:4px solid ${prio.cor};">
        <div class="card__head" style="flex-wrap:wrap; gap:8px;">
          <h2 style="font-size:16px;">${esc(r.title)}</h2>
          <span class="badge ${prio.cls}">Prioridade ${prio.label}</span>
          ${novo ? '<span class="badge badge-info">Novo</span>' : ''}
          ${r.status === 'arquivado' ? '<span class="badge badge-neutral">Arquivado</span>' : ''}
          <span class="spacer"></span>
          ${podeGerenciar ? `<span class="badge badge-neutral">${Number(r.read_count)}/${Number(r.active_users)} leram</span>
            <button class="btn btn-outline btn-sm" data-reads="${r.id}">Leituras</button>
            ${r.status === 'ativo'
              ? `<button class="btn btn-danger-outline btn-sm" data-archive="${r.id}">Arquivar</button>`
              : `<button class="btn btn-outline btn-sm" data-reopen="${r.id}">Reabrir</button>`}` : ''}
        </div>
        <div class="card__body" style="white-space:pre-wrap; padding-top:12px; padding-bottom:12px;">${esc(r.message)}</div>
        <div style="padding:0 18px 14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <span class="cell-muted" style="font-size:12.5px;">${esc(r.author_name || 'Gestão')} · ${fmtDateTime(r.created_at)}</span>
          <span style="flex:1;"></span>
          ${novo ? `<button class="btn btn-primary btn-sm" data-read="${r.id}">Marcar como lido</button>`
            : r.status === 'ativo' ? '<span class="cell-muted" style="font-size:12.5px;">✓ Lido</span>' : ''}
        </div>
      </div>`;
    }).join('');
  }

  function bindActions() {
    document.querySelectorAll('[data-read]').forEach((b) =>
      b.addEventListener('click', () => marcarLido(Number(b.dataset.read))));
    document.querySelectorAll('[data-archive]').forEach((b) =>
      b.addEventListener('click', () => alterarStatus(Number(b.dataset.archive), 'arquivar')));
    document.querySelectorAll('[data-reopen]').forEach((b) =>
      b.addEventListener('click', () => alterarStatus(Number(b.dataset.reopen), 'reabrir')));
    document.querySelectorAll('[data-reads]').forEach((b) =>
      b.addEventListener('click', () => verLeituras(Number(b.dataset.reads))));
  }

  async function marcarLido(id) {
    try {
      await api(`/api/comunicados/${id}/lido`, { method: 'POST' });
      toast('Comunicado marcado como lido.');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function alterarStatus(id, acao) {
    const texto = acao === 'arquivar'
      ? 'Arquivar este comunicado? Ele sai do mural, mas o histórico de leituras é mantido.'
      : 'Reabrir este comunicado no mural?';
    if (!confirm(texto)) return;
    try {
      await api(`/api/comunicados/${id}/${acao}`, { method: 'POST' });
      toast(acao === 'arquivar' ? 'Comunicado arquivado.' : 'Comunicado reaberto no mural.');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function verLeituras(id) {
    const body = $('#reads-body');
    body.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
    openModal('reads-modal');
    try {
      const data = await api(`/api/comunicados/${id}/leituras`);
      const { comunicado, rows } = data;
      $('#reads-title').textContent = `Leituras — ${comunicado.title}`;
      $('#reads-summary').textContent = `${Number(comunicado.read_count)} de ${Number(comunicado.active_users)} funcionário(s) ativo(s) leram.`;
      if (!rows.length) {
        body.innerHTML = '<div class="empty-state"><strong>Ninguém marcou como lido ainda</strong><span>O comunicado continua aparecendo como novo no mural.</span></div>';
        return;
      }
      body.innerHTML = `
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Funcionário</th><th>Perfil</th><th>Leu em</th></tr></thead>
            <tbody>
              ${rows.map((r) => `<tr>
                <td>${esc(r.user_name)}</td>
                <td class="cell-muted">${esc(ROLE_LABELS[r.role] || r.role)}</td>
                <td class="cell-muted">${fmtDateTime(r.read_at)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      body.innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`;
    }
  }

  async function publicar(e) {
    e.preventDefault();
    const errBox = $('#c-errors');
    errBox.style.display = 'none';
    const body = {
      title: $('#c-title').value.trim(),
      message: $('#c-message').value.trim(),
      priority: $('#c-priority').value,
    };
    const btn = $('#c-save');
    btn.disabled = true;
    try {
      await api('/api/comunicados', { method: 'POST', body });
      closeModal('com-modal');
      $('#com-form').reset();
      toast('Comunicado publicado no mural.');
      state.status = 'ativo';
      if ($('#f-status')) $('#f-status').value = 'ativo';
      await load();
    } catch (err) {
      const details = Array.isArray(err.details) && err.details.length
        ? '<ul style="margin-left:16px;">' + err.details.map((d) => `<li>${esc(d)}</li>`).join('') + '</ul>'
        : '';
      errBox.innerHTML = esc(err.message) + details;
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false;
    }
  }

  load();
})();
