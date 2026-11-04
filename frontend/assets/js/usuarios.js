// Funcionários — Etapa 1: listagem, cadastro, edição e situação da conta.
// CRUD restrito ao Administrador (validação reforçada no backend).
const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'funcionario', label: 'Funcionário' },
];

(async () => {
  const user = await renderLayout({
    page: 'usuarios',
    title: 'Funcionários',
    description: 'Cadastro, perfil de acesso e situação das contas',
  });
  if (!user) return;
  if (!requireAdminOrRedirect(user)) return;

  const pageEl = document.querySelector('.page');
  const state = { page: 1, pageSize: 20, total: 0, rows: [], filters: {}, editingId: null };

  pageEl.innerHTML = `
    <div id="page-actions-host" style="margin-bottom:16px; display:flex; gap:8px; flex-wrap:wrap;">
      <input class="input" id="f-search" placeholder="Buscar por nome, e-mail ou usuário..." style="max-width:300px;" />
      <select class="input" id="f-role" style="max-width:170px;">
        <option value="">Todos os perfis</option>
        ${ROLES.map((r) => `<option value="${r.value}">${r.label}</option>`).join('')}
      </select>
      <select class="input" id="f-status" style="max-width:150px;">
        <option value="">Todas as situações</option>
        <option value="ativo">Ativo</option>
        <option value="inativo">Inativo</option>
      </select>
      <span style="flex:1;"></span>
      <button class="btn btn-primary" id="btn-new">+ Novo funcionário</button>
    </div>
    <div class="card">
      <div class="card__head">
        <h2>Equipe cadastrada</h2>
        <span class="sub" id="total-info">—</span>
        <span class="spacer"></span>
        <button class="btn btn-outline btn-sm" id="btn-refresh">Atualizar</button>
      </div>
      <div class="card__body--flush" id="users-table">
        <div class="loading"><div class="spinner"></div> Carregando...</div>
      </div>
    </div>
    <div class="alert alert-info">
      <div><strong>Perfis e permissões.</strong> Administrador: acesso completo e cadastro da equipe. Gerente: estoque, compras, fornecedores, desperdício e validade (a partir da Etapa 2). Funcionário: consulta e registros autorizados.</div>
    </div>

    <!-- Modal de cadastro/edição -->
    <div class="modal-backdrop" id="user-modal">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal__head">
          <h3 id="modal-title">Novo funcionário</h3>
          <button class="close" type="button" onclick="closeModal('user-modal')" aria-label="Fechar">✕</button>
        </div>
        <form id="user-form" novalidate>
          <div class="modal__body">
            <div id="form-errors" class="alert alert-danger" style="display:none;"></div>
            <div class="field">
              <label for="u-name">Nome completo *</label>
              <input class="input" id="u-name" maxlength="120" required />
            </div>
            <div class="form-row">
              <div class="field">
                <label for="u-email">E-mail *</label>
                <input class="input" id="u-email" type="email" maxlength="160" required />
              </div>
              <div class="field">
                <label for="u-username">Usuário de acesso *</label>
                <input class="input" id="u-username" maxlength="40" required />
                <div class="hint">letras minúsculas, números, ponto, hífen ou underline</div>
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label for="u-position">Cargo *</label>
                <input class="input" id="u-position" maxlength="80" placeholder="Ex.: Auxiliar de cozinha" required />
              </div>
              <div class="field">
                <label for="u-role">Perfil de acesso *</label>
                <select class="input" id="u-role" required>
                  ${ROLES.map((r) => `<option value="${r.value}">${r.label}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="field">
              <label for="u-password" id="password-label">Senha *</label>
              <input class="input" id="u-password" type="password" maxlength="64" autocomplete="new-password" required />
              <div class="hint">mínimo de 8 caracteres, com letras e números</div>
            </div>
          </div>
          <div class="modal__foot">
            <button type="button" class="btn btn-outline" onclick="closeModal('user-modal')">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btn-save">Salvar</button>
          </div>
        </form>
      </div>
    </div>`;

  const $ = (sel) => document.querySelector(sel);

  $('#f-search').addEventListener('input', debounce(() => { state.page = 1; load(); }, 350));
  $('#f-role').addEventListener('change', () => { state.page = 1; load(); });
  $('#f-status').addEventListener('change', () => { state.page = 1; load(); });
  $('#btn-new').addEventListener('click', () => openModal(null));
  $('#btn-refresh').addEventListener('click', load);
  $('#user-form').addEventListener('submit', onSubmit);

  async function load() {
    state.filters = {
      search: $('#f-search').value.trim() || undefined,
      role: $('#f-role').value || undefined,
      status: $('#f-status').value || undefined,
    };
    const box = $('#users-table');
    box.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando funcionários...</div>';

    const qs = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
    if (state.filters.search) qs.set('search', state.filters.search);
    if (state.filters.role) qs.set('role', state.filters.role);
    if (state.filters.status) qs.set('status', state.filters.status);

    try {
      const data = await api(`/api/users?${qs}`);
      state.rows = data.rows;
      state.total = data.total;
      $('#total-info').textContent = `${data.total} funcionário(s)`;
      renderRows();
    } catch (err) {
      box.innerHTML = `<div class="alert alert-danger" style="margin:16px;">Falha ao carregar: ${esc(err.message)}</div>`;
    }
  }

  function renderRows() {
    const box = $('#users-table');
    if (!state.rows.length) {
      box.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 19a6.5 6.5 0 0 1 13 0"/></svg>
          <strong>Nenhum funcionário encontrado</strong>
          <span>Use “+ Novo funcionário” para cadastrar a equipe.</span>
        </div>`;
      return;
    }
    box.innerHTML = `
      <div class="table-wrap">
        <table class="table table-stacked">
          <thead>
            <tr><th>Funcionário</th><th>Cargo</th><th>Perfil</th><th>Situação</th><th>Cadastro</th><th style="text-align:right;">Ações</th></tr>
          </thead>
          <tbody>
            ${state.rows.map((u) => `
              <tr data-id="${u.id}">
                <td data-label="Funcionário">
                  <div class="cell-strong">${esc(u.name)}</div>
                  <div class="cell-muted">${esc(u.email)} · @${esc(u.username)}</div>
                </td>
                <td data-label="Cargo">${esc(u.position || '—')}</td>
                <td data-label="Perfil"><span class="badge ${u.role === 'admin' ? 'badge-danger' : u.role === 'gerente' ? 'badge-info' : 'badge-neutral'}">${esc(ROLE_LABELS[u.role] || u.role)}</span></td>
                <td data-label="Situação"><span class="badge ${u.status === 'ativo' ? 'badge-ok' : 'badge-neutral'}">${u.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></td>
                <td data-label="Cadastro" class="cell-muted">${fmtDateTime(u.created_at)}</td>
                <td data-label="Ações">
                  <div class="actions">
                    <button class="btn btn-outline btn-sm" data-edit="${u.id}">Editar</button>
                    ${u.status === 'ativo'
                      ? `<button class="btn btn-danger-outline btn-sm" data-toggle="${u.id}" data-to="inativo" ${u.id === currentUserId ? 'disabled title="Não é possível desativar a própria conta"' : ''}>Desativar</button>`
                      : `<button class="btn btn-outline btn-sm" data-toggle="${u.id}" data-to="ativo">Reativar</button>`}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    box.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openModal(Number(b.dataset.edit))));
    box.querySelectorAll('[data-toggle]').forEach((b) =>
      b.addEventListener('click', () => toggleStatus(Number(b.dataset.toggle), b.dataset.to)));
  }

  const currentUserId = user.id;
  let editing = false;

  function openModal(id) {
    editing = id != null;
    state.editingId = id;
    const u = editing ? state.rows.find((r) => r.id === id) : null;
    $('#modal-title').textContent = editing ? `Editar — ${u.name}` : 'Novo funcionário';
    $('#u-name').value = u ? u.name : '';
    $('#u-email').value = u ? u.email : '';
    $('#u-username').value = u ? u.username : '';
    $('#u-position').value = u ? (u.position || '') : '';
    $('#u-role').value = u ? u.role : 'funcionario';
    $('#u-password').value = '';
    $('#u-password').required = !editing;
    $('#password-label').textContent = editing ? 'Nova senha (opcional)' : 'Senha *';
    $('#form-errors').style.display = 'none';
    openModal('user-modal');
    $('#u-name').focus();
  }

  async function onSubmit(event) {
    event.preventDefault();
    const errBox = $('#form-errors');
    errBox.style.display = 'none';

    const body = {
      name: $('#u-name').value.trim(),
      email: $('#u-email').value.trim(),
      username: $('#u-username').value.trim().toLowerCase(),
      position: $('#u-position').value.trim(),
      role: $('#u-role').value,
    };
    const password = $('#u-password').value;
    if (password || !editing) body.password = password;

    const btn = $('#btn-save');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      if (editing) {
        await api(`/api/users/${state.editingId}`, { method: 'PUT', body });
        toast('Funcionário atualizado com sucesso.');
      } else {
        await api('/api/users', { method: 'POST', body });
        toast('Funcionário cadastrado com sucesso.');
      }
      closeModal('user-modal');
      load();
    } catch (err) {
      const details = Array.isArray(err.details) && err.details.length
        ? '<ul style="margin-left:16px;">' + err.details.map((d) => `<li>${esc(d)}</li>`).join('') + '</ul>'
        : '';
      errBox.innerHTML = esc(err.message) + details;
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar';
    }
  }

  async function toggleStatus(id, to) {
    const verb = to === 'ativo' ? 'Reativar' : 'Desativar';
    if (!confirm(`${verb} a conta do funcionário?`)) return;
    try {
      await api(`/api/users/${id}/${to === 'ativo' ? 'activate' : 'deactivate'}`, { method: 'POST' });
      toast(to === 'ativo' ? 'Conta reativada.' : 'Conta desativada.');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  load();
})();
