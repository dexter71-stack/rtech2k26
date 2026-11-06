// Fornecedores — Etapa 3: cadastro, contatos e histórico de compras por parceiro.
(async () => {
  const user = await renderLayout({
    page: 'fornecedores',
    title: 'Fornecedores',
    description: 'Parceiros de compra, contatos e volume já comprado',
  });
  if (!user) return;

  const podeGerenciar = user.role === 'admin' || user.role === 'gerente';
  const state = { page: 1, pageSize: 20, total: 0, rows: [], editingId: null };

  const pageEl = document.querySelector('.page');
  pageEl.innerHTML = `
    <div id="page-actions-host" style="margin-bottom:16px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <input class="input" id="f-search" placeholder="Buscar por nome, CNPJ ou contato..." style="max-width:300px;" />
      <select class="input" id="f-status" style="max-width:150px;">
        <option value="">Todos os status</option>
        <option value="ativo">Ativos</option>
        <option value="inativo">Inativos</option>
      </select>
      <span style="flex:1;"></span>
      ${podeGerenciar ? '<button class="btn btn-primary" id="btn-new">+ Novo fornecedor</button>' : ''}
    </div>

    <div class="card">
      <div class="card__head">
        <h2>Fornecedores</h2>
        <span class="sub" id="total-info">—</span>
        <span class="spacer"></span>
        <button class="btn btn-outline btn-sm" id="btn-refresh">Atualizar</button>
      </div>
      <div class="card__body--flush" id="forn-table"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
    </div>`;

  const $ = (sel) => document.querySelector(sel);
  $('#f-search').addEventListener('input', debounce(() => { state.page = 1; load(); }, 350));
  $('#f-status').addEventListener('change', () => { state.page = 1; load(); });
  $('#btn-refresh').addEventListener('click', load);
  if (podeGerenciar) $('#btn-new').addEventListener('click', () => openModalFornecedor(null));

  async function load() {
    const box = $('#forn-table');
    box.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando fornecedores...</div>';
    const qs = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
    if ($('#f-search').value.trim()) qs.set('search', $('#f-search').value.trim());
    if ($('#f-status').value) qs.set('status', $('#f-status').value);

    try {
      const data = await api(`/api/fornecedores?${qs}`);
      state.rows = data.rows;
      state.total = data.total;
      $('#total-info').textContent = `${data.total} fornecedor(es)`;
      renderRows();
    } catch (err) {
      box.innerHTML = `<div class="alert alert-danger" style="margin:16px;">Falha ao carregar: ${esc(err.message)}</div>`;
    }
  }

  function renderRows() {
    const box = $('#forn-table');
    if (!state.rows.length) {
      box.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg>
          <strong>Nenhum fornecedor encontrado</strong>
          <span>${podeGerenciar ? 'Cadastre o primeiro parceiro em “+ Novo fornecedor”.' : 'Fornecedores aparecerão aqui quando cadastrados.'}</span>
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="table-wrap">
        <table class="table table-stacked">
          <thead>
            <tr><th>Fornecedor</th><th>Contato</th><th>Compras</th><th>Total comprado</th><th>Situação</th>${podeGerenciar ? '<th style="text-align:right;">Ações</th>' : ''}</tr>
          </thead>
          <tbody>
            ${state.rows.map((s) => `
              <tr>
                <td data-label="Fornecedor">
                  <div class="cell-strong">${esc(s.name)}</div>
                  <div class="cell-muted">${esc(s.legal_name || '')}${s.document ? ` · ${esc(s.document)}` : ''}</div>
                </td>
                <td data-label="Contato">
                  <div>${esc(s.contact_name || '—')}</div>
                  <div class="cell-muted">${esc(s.phone || '')}${s.phone && s.email ? ' · ' : ''}${esc(s.email || '')}</div>
                </td>
                <td data-label="Compras">${s.purchase_count}</td>
                <td data-label="Total comprado"><div class="cell-strong">${brl(s.purchased_total)}</div><div class="cell-muted">compras recebidas</div></td>
                <td data-label="Situação"><span class="badge ${s.status === 'ativo' ? 'badge-ok' : 'badge-neutral'}">${s.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></td>
                ${podeGerenciar ? `
                  <td data-label="Ações">
                    <div class="actions">
                      <button class="btn btn-outline btn-sm" data-edit="${s.id}">Editar</button>
                      <button class="btn btn-danger-outline btn-sm" data-del="${s.id}" ${s.purchase_count > 0 ? 'disabled title="Possui compras registradas — inative em vez de excluir"' : ''}>Excluir</button>
                    </div>
                  </td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    box.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openModalFornecedor(Number(b.dataset.edit))));
    box.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => excluir(Number(b.dataset.del))));
  }

  function openModalFornecedor(id) {
    const editing = id != null;
    state.editingId = id;
    const s = editing ? state.rows.find((r) => r.id === id) : null;
    const modal = document.getElementById('modal-forn');
    if (modal) modal.remove();

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-backdrop" id="modal-forn">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__head">
            <h3>${editing ? `Editar — ${esc(s.name)}` : 'Novo fornecedor'}</h3>
            <button class="close" type="button" onclick="closeModal('modal-forn')" aria-label="Fechar">✕</button>
          </div>
          <form id="forn-form" novalidate>
            <div class="modal__body">
              <div id="forn-errors" class="alert alert-danger" style="display:none;"></div>
              <div class="field">
                <label for="s-name">Nome fantasia *</label>
                <input class="input" id="s-name" maxlength="120" value="${esc(s ? s.name : '')}" required />
              </div>
              <div class="form-row">
                <div class="field">
                  <label for="s-legal">Razão social</label>
                  <input class="input" id="s-legal" maxlength="160" value="${esc(s ? (s.legal_name || '') : '')}" />
                </div>
                <div class="field">
                  <label for="s-doc">CNPJ / CPF</label>
                  <input class="input" id="s-doc" maxlength="30" placeholder="00.000.000/0000-00" value="${esc(s ? (s.document || '') : '')}" />
                </div>
              </div>
              <div class="form-row">
                <div class="field">
                  <label for="s-contact">Pessoa de contato</label>
                  <input class="input" id="s-contact" maxlength="120" value="${esc(s ? (s.contact_name || '') : '')}" />
                </div>
                <div class="field">
                  <label for="s-phone">Telefone</label>
                  <input class="input" id="s-phone" maxlength="30" value="${esc(s ? (s.phone || '') : '')}" />
                </div>
              </div>
              <div class="field">
                <label for="s-email">E-mail</label>
                <input class="input" id="s-email" type="email" maxlength="160" value="${esc(s ? (s.email || '') : '')}" />
              </div>
              <div class="field">
                <label for="s-address">Endereço</label>
                <input class="input" id="s-address" maxlength="255" value="${esc(s ? (s.address || '') : '')}" />
              </div>
              <div class="form-row">
                <div class="field">
                  <label for="s-status">Situação</label>
                  <select class="input" id="s-status">
                    <option value="ativo" ${!s || s.status === 'ativo' ? 'selected' : ''}>Ativo</option>
                    <option value="inativo" ${s && s.status === 'inativo' ? 'selected' : ''}>Inativo</option>
                  </select>
                </div>
                <div class="field">
                  <label for="s-notes">Observações</label>
                  <input class="input" id="s-notes" maxlength="500" value="${esc(s ? (s.notes || '') : '')}" />
                </div>
              </div>
            </div>
            <div class="modal__foot">
              <button type="button" class="btn btn-outline" onclick="closeModal('modal-forn')">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="s-save">Salvar</button>
            </div>
          </form>
        </div>
      </div>`);

    openModal('modal-forn');
    document.getElementById('s-name').focus();
    document.getElementById('forn-form').addEventListener('submit', salvar);
  }

  async function salvar(e) {
    e.preventDefault();
    const errBox = document.getElementById('forn-errors');
    errBox.style.display = 'none';
    const body = {
      name: document.getElementById('s-name').value.trim(),
      legal_name: document.getElementById('s-legal').value.trim(),
      document: document.getElementById('s-doc').value.trim(),
      contact_name: document.getElementById('s-contact').value.trim(),
      phone: document.getElementById('s-phone').value.trim(),
      email: document.getElementById('s-email').value.trim(),
      address: document.getElementById('s-address').value.trim(),
      status: document.getElementById('s-status').value,
      notes: document.getElementById('s-notes').value.trim(),
    };
    const btn = document.getElementById('s-save');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      if (state.editingId != null) {
        await api(`/api/fornecedores/${state.editingId}`, { method: 'PUT', body });
        toast('Fornecedor atualizado.');
      } else {
        await api('/api/fornecedores', { method: 'POST', body });
        toast('Fornecedor cadastrado.');
      }
      closeModal('modal-forn');
      load();
    } catch (err) {
      const details = Array.isArray(err.details) && err.details.length
        ? '<ul style="margin-left:16px;">' + err.details.map((d) => `<li>${esc(d)}</li>`).join('') + '</ul>' : '';
      errBox.innerHTML = esc(err.message) + details;
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar';
    }
  }

  async function excluir(id) {
    const s = state.rows.find((r) => r.id === id);
    if (!confirm(`Excluir o fornecedor "${s.name}"? Compras históricas impedem a exclusão — nesse caso, inative-o.`)) return;
    try {
      await api(`/api/fornecedores/${id}`, { method: 'DELETE' });
      toast('Fornecedor excluído.');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function brl(v) {
    return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  load();
})();
