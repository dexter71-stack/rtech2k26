// Estoque — Etapa 2: produtos com estoque calculado, categorias e unidades.
// Escrita (produtos/catálogo) restrita a administrador/gerente no backend.
(async () => {
  const user = await renderLayout({
    page: 'estoque',
    title: 'Estoque',
    description: 'Produtos cadastrados, estoque atual e catálogo (categorias/unidades)',
  });
  if (!user) return;

  const podeGerenciar = user.role === 'admin' || user.role === 'gerente';
  const state = { page: 1, pageSize: 20, total: 0, rows: [], categorias: [], unidades: [], editingId: null };

  const pageEl = document.querySelector('.page');
  pageEl.innerHTML = `
    <div id="page-actions-host" style="margin-bottom:16px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <input class="input" id="f-search" placeholder="Buscar produto..." style="max-width:260px;" />
      <select class="input" id="f-categoria" style="max-width:220px;"><option value="">Todas as categorias</option></select>
      <select class="input" id="f-status" style="max-width:180px;">
        ${podeGerenciar ? '<option value="">Ativos e inativos</option>' : ''}
        <option value="ativo" ${podeGerenciar ? '' : 'selected'}>Ativos</option>
        ${podeGerenciar ? '<option value="inativo">Inativos</option>' : ''}
      </select>
      ${podeGerenciar ? '<span style="flex:1;"></span><button class="btn btn-outline" id="btn-catalogo">Categorias e unidades</button><button class="btn btn-primary" id="btn-new">+ Novo produto</button>' : ''}
    </div>

    <div class="card">
      <div class="card__head">
        <h2>Produtos</h2>
        <span class="sub" id="total-info">—</span>
        <span class="spacer"></span>
        <button class="btn btn-outline btn-sm" id="btn-refresh">Atualizar</button>
      </div>
      <div class="card__body--flush" id="prod-table"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
    </div>

    <div class="alert alert-info">
      <div><strong>Estoque calculado em tempo real.</strong> O valor “Atual” soma o saldo de todos os lotes ativos do produto — nunca é editado à mão. Produtos abaixo do mínimo aparecem laranja; sem estoque, vermelho.</div>
    </div>

    <!-- Modal de cadastro/edição de produto -->
    <div class="modal-backdrop" id="produto-modal">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal__head">
          <h3 id="pm-title">Novo produto</h3>
          <button class="close" type="button" onclick="closeModal('produto-modal')" aria-label="Fechar">✕</button>
        </div>
        <form id="produto-form" novalidate>
          <div class="modal__body">
            <div id="pm-errors" class="alert alert-danger" style="display:none;"></div>
            <div class="field">
              <label for="p-name">Nome do produto *</label>
              <input class="input" id="p-name" maxlength="120" placeholder="Ex.: Coxa de frango" required />
            </div>
            <div class="form-row">
              <div class="field">
                <label for="p-categoria">Categoria *</label>
                <select class="input" id="p-categoria" required></select>
              </div>
              <div class="field">
                <label for="p-unidade">Unidade de medida *</label>
                <select class="input" id="p-unidade" required></select>
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label for="p-min">Estoque mínimo (alerta) *</label>
                <input class="input" id="p-min" type="number" min="0" step="0.001" value="0" required />
              </div>
              <div class="field">
                <label for="p-max">Estoque máximo (opcional)</label>
                <input class="input" id="p-max" type="number" min="0" step="0.001" />
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label for="p-custo">Custo de referência (R$)</label>
                <input class="input" id="p-custo" type="number" min="0" step="0.01" value="0" />
                <div class="hint">valor médio por unidade, usado em relatórios</div>
              </div>
              <div class="field">
                <label for="p-status">Situação</label>
                <select class="input" id="p-status">
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label for="p-desc">Descrição</label>
              <input class="input" id="p-desc" maxlength="255" />
            </div>
            <div class="field">
              <label for="p-notes">Observações internas</label>
              <input class="input" id="p-notes" maxlength="500" />
            </div>
          </div>
          <div class="modal__foot">
            <button type="button" class="btn btn-outline" onclick="closeModal('produto-modal')">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="p-save">Salvar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal de catálogo: categorias e unidades -->
    <div class="modal-backdrop" id="catalogo-modal">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal__head">
          <h3>Categorias e unidades</h3>
          <button class="close" type="button" onclick="closeModal('catalogo-modal')" aria-label="Fechar">✕</button>
        </div>
        <div class="modal__body">
          <div id="cat-errors" class="alert alert-danger" style="display:none;"></div>
          <h4 style="font-size:13px; margin-bottom:8px;">Categorias</h4>
          <form id="cat-add" style="display:flex; gap:8px; margin-bottom:10px;">
            <input class="input" id="cat-name" placeholder="Nova categoria" maxlength="80" required style="flex:1;" />
            <button class="btn btn-primary btn-sm" type="submit">Adicionar</button>
          </form>
          <div id="cat-list" style="display:flex; flex-direction:column; gap:6px; margin-bottom:18px;"></div>
          <h4 style="font-size:13px; margin-bottom:8px;">Unidades de medida</h4>
          <form id="uni-add" style="display:flex; gap:8px; margin-bottom:10px;">
            <input class="input" id="uni-name" placeholder="Nome (ex.: Quilograma)" maxlength="80" required style="flex:1;" />
            <input class="input" id="uni-symbol" placeholder="Símbolo (ex.: kg)" maxlength="20" required style="max-width:140px;" />
            <button class="btn btn-primary btn-sm" type="submit">Adicionar</button>
          </form>
          <div id="uni-list" style="display:flex; flex-direction:column; gap:6px;"></div>
        </div>
      </div>
    </div>`;

  const $ = (sel) => document.querySelector(sel);

  $('#f-search').addEventListener('input', debounce(() => { state.page = 1; load(); }, 350));
  $('#f-categoria').addEventListener('change', () => { state.page = 1; load(); });
  $('#f-status').addEventListener('change', () => { state.page = 1; load(); });
  $('#btn-refresh').addEventListener('click', load);
  $('#produto-form').addEventListener('submit', onSubmitProduto);
  if (podeGerenciar) {
    $('#btn-new').addEventListener('click', () => openProdutoModal(null));
    $('#btn-catalogo').addEventListener('click', () => { openModal('catalogo-modal'); renderCatalogo(); });
    $('#cat-add').addEventListener('submit', onAddCategoria);
    $('#uni-add').addEventListener('submit', onAddUnidade);
  }

  async function loadCatalogos() {
    const [cats, unis] = await Promise.all([
      api('/api/catalogo/categorias'),
      api('/api/catalogo/unidades'),
    ]);
    state.categorias = cats.rows;
    state.unidades = unis.rows;
    const optCat = ['<option value="">Todas as categorias</option>']
      .concat(state.categorias.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)).join('');
    $('#f-categoria').innerHTML = optCat;
    const selCat = '<option value="">— selecione —</option>'
      + state.categorias.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    $('#p-categoria').innerHTML = selCat;
    const selUni = '<option value="">— selecione —</option>'
      + state.unidades.map((u) => `<option value="${u.id}">${esc(u.name)} (${esc(u.symbol)})</option>`).join('');
    $('#p-unidade').innerHTML = selUni;
  }

  async function load() {
    const box = $('#prod-table');
    box.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando produtos...</div>';
    const qs = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
    if ($('#f-search').value.trim()) qs.set('search', $('#f-search').value.trim());
    if ($('#f-categoria').value) qs.set('category_id', $('#f-categoria').value);
    if ($('#f-status').value) qs.set('status', $('#f-status').value);

    try {
      const data = await api(`/api/produtos?${qs}`);
      state.rows = data.rows;
      state.total = data.total;
      $('#total-info').textContent = `${data.total} produto(s)`;
      renderRows();
    } catch (err) {
      box.innerHTML = `<div class="alert alert-danger" style="margin:16px;">Falha ao carregar: ${esc(err.message)}</div>`;
    }
  }

  function renderRows() {
    const box = $('#prod-table');
    if (!state.rows.length) {
      box.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/></svg>
          <strong>Nenhum produto encontrado</strong>
          <span>${podeGerenciar ? 'Use “+ Novo produto” para começar o estoque.' : 'Produtos aparecerão aqui quando a equipe cadastrá-los.'}</span>
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="table-wrap">
        <table class="table table-stacked">
          <thead>
            <tr><th>Produto</th><th>Categoria</th><th>Estoque atual</th><th>Mínimo</th><th>Situação</th>${podeGerenciar ? '<th style="text-align:right;">Ações</th>' : ''}</tr>
          </thead>
          <tbody>
            ${state.rows.map((p) => {
              const atual = Number(p.current_stock);
              const min = Number(p.min_stock);
              const badge = atual === 0
                ? '<span class="badge badge-danger">Sem estoque</span>'
                : (min > 0 && atual <= min ? '<span class="badge badge-warn">Estoque baixo</span>' : '');
              return `
                <tr data-id="${p.id}">
                  <td data-label="Produto">
                    <div class="cell-strong">${esc(p.name)}</div>
                    <div class="cell-muted">${esc(p.description || '')}</div>
                  </td>
                  <td data-label="Categoria">${esc(p.category_name || '—')}</td>
                  <td data-label="Estoque atual">
                    <div class="cell-strong">${fmtNum(atual)} ${esc(p.unit_symbol || '')}</div>
                    ${badge}
                  </td>
                  <td data-label="Mínimo">${fmtNum(min)}</td>
                  <td data-label="Situação"><span class="badge ${p.status === 'ativo' ? 'badge-ok' : 'badge-neutral'}">${p.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></td>
                  ${podeGerenciar ? `
                    <td data-label="Ações">
                      <div class="actions">
                        <a class="btn btn-outline btn-sm" href="/pages/lotes/?product_id=${p.id}">Lotes</a>
                        <button class="btn btn-outline btn-sm" data-edit="${p.id}">Editar</button>
                      </div>
                    </td>` : ''}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    box.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openProdutoModal(Number(b.dataset.edit))));
  }

  function openProdutoModal(id) {
    const editing = id != null;
    state.editingId = id;
    const p = editing ? state.rows.find((r) => r.id === id) : null;
    $('#pm-title').textContent = editing ? `Editar — ${p.name}` : 'Novo produto';
    $('#p-name').value = p ? p.name : '';
    $('#p-categoria').value = p ? (p.category_id || '') : '';
    $('#p-unidade').value = p ? (p.unit_id || '') : '';
    $('#p-min').value = p ? Number(p.min_stock) : 0;
    $('#p-max').value = p && p.max_stock != null ? Number(p.max_stock) : '';
    $('#p-custo').value = p ? Number(p.reference_cost) : 0;
    $('#p-status').value = p ? p.status : 'ativo';
    $('#p-desc').value = p ? (p.description || '') : '';
    $('#p-notes').value = p ? (p.notes || '') : '';
    $('#pm-errors').style.display = 'none';
    openModal('produto-modal');
    $('#p-name').focus();
  }

  async function onSubmitProduto(e) {
    e.preventDefault();
    const errBox = $('#pm-errors');
    errBox.style.display = 'none';
    const body = {
      name: $('#p-name').value.trim(),
      category_id: $('#p-categoria').value,
      unit_id: $('#p-unidade').value,
      min_stock: $('#p-min').value,
      max_stock: $('#p-max').value,
      reference_cost: $('#p-custo').value,
      status: $('#p-status').value,
      description: $('#p-desc').value.trim(),
      notes: $('#p-notes').value.trim(),
    };
    const btn = $('#p-save');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      if (state.editingId != null) {
        await api(`/api/produtos/${state.editingId}`, { method: 'PUT', body });
        toast('Produto atualizado.');
      } else {
        await api('/api/produtos', { method: 'POST', body });
        toast('Produto cadastrado.');
      }
      closeModal('produto-modal');
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

  async function renderCatalogo() {
    const errBox = $('#cat-errors');
    errBox.style.display = 'none';
    $('#cat-list').innerHTML = state.categorias.map((c) => `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="flex:1;">${esc(c.name)} <span class="cell-muted">(${c.product_count} produto(s))</span></span>
        <button class="btn btn-danger-outline btn-sm" data-del-cat="${c.id}" ${c.product_count > 0 ? 'disabled title="Em uso por produtos"' : ''}>Excluir</button>
      </div>`).join('') || '<div class="cell-muted">Nenhuma categoria.</div>';
    $('#uni-list').innerHTML = state.unidades.map((u) => `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="flex:1;">${esc(u.name)} <span class="cell-muted">(${esc(u.symbol)}) · ${u.product_count} produto(s)</span></span>
        <button class="btn btn-danger-outline btn-sm" data-del-uni="${u.id}" ${u.product_count > 0 ? 'disabled title="Em uso por produtos"' : ''}>Excluir</button>
      </div>`).join('') || '<div class="cell-muted">Nenhuma unidade.</div>';

    $('#cat-list').querySelectorAll('[data-del-cat]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Excluir esta categoria?')) return;
        try { await api(`/api/catalogo/categorias/${b.dataset.delCat}`, { method: 'DELETE' }); toast('Categoria excluída.'); renderCatalogo(); loadCatalogos(); load(); }
        catch (err) { toast(err.message, 'error'); }
      }));
    $('#uni-list').querySelectorAll('[data-del-uni]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Excluir esta unidade?')) return;
        try { await api(`/api/catalogo/unidades/${b.dataset.delUni}`, { method: 'DELETE' }); toast('Unidade excluída.'); renderCatalogo(); loadCatalogos(); load(); }
        catch (err) { toast(err.message, 'error'); }
      }));
  }

  async function onAddCategoria(e) {
    e.preventDefault();
    try {
      await api('/api/catalogo/categorias', { method: 'POST', body: { name: $('#cat-name').value.trim() } });
      toast('Categoria adicionada.');
      $('#cat-name').value = '';
      await loadCatalogos();
      renderCatalogo();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function onAddUnidade(e) {
    e.preventDefault();
    try {
      await api('/api/catalogo/unidades', {
        method: 'POST',
        body: { name: $('#uni-name').value.trim(), symbol: $('#uni-symbol').value.trim() },
      });
      toast('Unidade adicionada.');
      $('#uni-name').value = '';
      $('#uni-symbol').value = '';
      await loadCatalogos();
      renderCatalogo();
    } catch (err) { toast(err.message, 'error'); }
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  await loadCatalogos();
  load();
})();
