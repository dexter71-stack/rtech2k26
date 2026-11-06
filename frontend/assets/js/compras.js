// Compras — Etapa 3: pedidos com itens (validade por lote), recebimento que dá
// entrada no estoque em transação, edição e cancelamento de pedidos pendentes.
(async () => {
  const user = await renderLayout({
    page: 'compras',
    title: 'Compras',
    description: 'Pedidos de compra, recebimento no estoque e notas fiscais',
  });
  if (!user) return;
  if (user.role !== 'admin' && user.role !== 'gerente') {
    location.href = '/pages/dashboard/';
    return;
  }

  const state = {
    page: 1, pageSize: 20, total: 0, rows: [],
    fornecedores: [], produtos: [], editingId: null, detailId: null,
  };

  const pageEl = document.querySelector('.page');
  pageEl.innerHTML = `
    <div id="page-actions-host" style="margin-bottom:16px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <select class="input" id="f-status" style="max-width:170px;">
        <option value="">Todos os status</option>
        <option value="pendente">Pendentes</option>
        <option value="recebida">Recebidas</option>
        <option value="cancelada">Canceladas</option>
        <option value="estornada">Estornadas</option>
      </select>
      <select class="input" id="f-forn" style="max-width:240px;"><option value="">Todos os fornecedores</option></select>
      <input class="input" id="f-search" placeholder="Buscar nº, fornecedor ou NF..." style="max-width:240px;" />
      <input class="input" id="f-de" type="date" title="Pedido a partir de" style="max-width:155px;" />
      <input class="input" id="f-ate" type="date" title="Pedido até" style="max-width:155px;" />
      <span style="flex:1;"></span>
      <button class="btn btn-outline btn-sm" id="btn-refresh">Atualizar</button>
      <button class="btn btn-primary" id="btn-new">+ Nova compra</button>
    </div>

    <div class="card">
      <div class="card__head">
        <h2>Pedidos de compra</h2>
        <span class="sub" id="total-info">—</span>
      </div>
      <div class="card__body--flush" id="comp-table"><div class="loading"><div class="spinner"></div> Carregando compras...</div></div>
    </div>

    <div class="alert alert-info">
      <div><strong>Receber = dar entrada no estoque.</strong> Ao receber um pedido, cada item gera um lote com sua validade e uma entrada vinculada à compra. Se a mercadoria voltar ao fornecedor, use <strong>Estornar compra</strong> no detalhe: os lotes são devolvidos e o valor sai dos totais do fornecedor e do dashboard.</div>
    </div>`;

  const $ = (sel) => document.querySelector(sel);
  $('#f-status').addEventListener('change', () => { state.page = 1; load(); });
  $('#f-forn').addEventListener('change', () => { state.page = 1; load(); });
  $('#f-de').addEventListener('change', () => { state.page = 1; load(); });
  $('#f-ate').addEventListener('change', () => { state.page = 1; load(); });
  $('#f-search').addEventListener('input', debounce(() => { state.page = 1; load(); }, 400));
  $('#btn-refresh').addEventListener('click', load);
  $('#btn-new').addEventListener('click', () => abrirFormulario(null));

  const statusBadge = (s) => {
    const map = {
      pendente: ['badge-warn', 'Pendente'],
      recebida: ['badge-ok', 'Recebida'],
      cancelada: ['badge-neutral', 'Cancelada'],
      estornada: ['badge-danger', 'Estornada'],
    };
    const [cls, label] = map[s] || ['badge-neutral', s];
    return `<span class="badge ${cls}">${label}</span>`;
  };
  const brl = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

  async function carregarCadastros() {
    const [forns, prods] = await Promise.all([
      api('/api/fornecedores?pageSize=100&status=ativo'),
      api('/api/produtos?pageSize=100&status=ativo'),
    ]);
    state.fornecedores = forns.rows;
    state.produtos = prods.rows;
    $('#f-forn').innerHTML = '<option value="">Todos os fornecedores</option>'
      + state.fornecedores.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
  }

  async function load() {
    const box = $('#comp-table');
    box.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando compras...</div>';
    const qs = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
    if ($('#f-status').value) qs.set('status', $('#f-status').value);
    if ($('#f-forn').value) qs.set('supplier_id', $('#f-forn').value);
    if ($('#f-de').value) qs.set('dateFrom', $('#f-de').value);
    if ($('#f-ate').value) qs.set('dateTo', $('#f-ate').value);
    if ($('#f-search').value.trim()) qs.set('search', $('#f-search').value.trim());

    try {
      const data = await api(`/api/compras?${qs}`);
      state.rows = data.rows;
      state.total = data.total;
      $('#total-info').textContent = `${data.total} pedido(s)`;
      renderRows();
    } catch (err) {
      box.innerHTML = `<div class="alert alert-danger" style="margin:16px;">Falha ao carregar: ${esc(err.message)}</div>`;
    }
  }

  function renderRows() {
    const box = $('#comp-table');
    if (!state.rows.length) {
      box.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>
          <strong>Nenhuma compra no filtro</strong>
          <span>Registre um pedido em “+ Nova compra” e receba-o quando chegar.</span>
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="table-wrap">
        <table class="table table-stacked">
          <thead>
            <tr><th>Pedido</th><th>Fornecedor</th><th>Datas</th><th>Itens</th><th>Total</th><th>Status</th><th style="text-align:right;">Ações</th></tr>
          </thead>
          <tbody>
            ${state.rows.map((p) => `
              <tr>
                <td data-label="Pedido">
                  <div class="cell-strong">#${p.id}</div>
                  <div class="cell-muted">${esc(p.invoice_number || 'sem NF')}</div>
                </td>
                <td data-label="Fornecedor">${esc(p.supplier_name)}</td>
                <td data-label="Datas">
                  <div class="cell-muted">Pedido: ${fmtDateTime(p.order_date).split(' ')[0]}</div>
                  <div class="cell-muted">${p.received_date ? `Recebido: ${fmtDateTime(p.received_date).split(' ')[0]}` : (p.expected_date ? `Previsto: ${fmtDateTime(p.expected_date).split(' ')[0]}` : '')}</div>
                </td>
                <td data-label="Itens">${p.item_count}</td>
                <td data-label="Total"><div class="cell-strong">${brl(p.total_amount)}</div></td>
                <td data-label="Status">${statusBadge(p.status)}</td>
                <td data-label="Ações">
                  <div class="actions">
                    <button class="btn btn-outline btn-sm" data-view="${p.id}">Detalhes</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    box.querySelectorAll('[data-view]').forEach((b) =>
      b.addEventListener('click', () => abrirDetalhe(Number(b.dataset.view))));
  }

  // ---------- Detalhe do pedido ----------
  async function abrirDetalhe(id) {
    try {
      const { purchase } = await api(`/api/compras/${id}`);
      state.detailId = id;
      const pendente = purchase.status === 'pendente';
      document.getElementById('modal-detalhe')?.remove();

      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-backdrop" id="modal-detalhe">
          <div class="modal modal--wide" role="dialog" aria-modal="true">
            <div class="modal__head">
              <h3>Compra #${purchase.id} — ${esc(purchase.supplier_name)}</h3>
              <button class="close" type="button" onclick="closeModal('modal-detalhe')" aria-label="Fechar">✕</button>
            </div>
            <div class="modal__body">
              <div class="stats-grid" style="margin-bottom:16px;">
                <div class="stat"><div class="label">Status</div><div class="value" style="font-size:15px;">${statusBadge(purchase.status)}</div></div>
                <div class="stat"><div class="label">Total</div><div class="value" style="font-size:20px;">${brl(purchase.total_amount)}</div></div>
                <div class="stat"><div class="label">Pedido em</div><div class="value" style="font-size:15px;">${fmtDateTime(purchase.order_date).split(' ')[0]}</div></div>
                <div class="stat"><div class="label">Recebido em</div><div class="value" style="font-size:15px;">${purchase.received_date ? fmtDateTime(purchase.received_date).split(' ')[0] : '—'}</div></div>
                ${purchase.reversed_at ? `<div class="stat is-danger"><div class="label">Estornada em</div><div class="value" style="font-size:15px;">${fmtDateTime(purchase.reversed_at)}</div></div>` : ''}
              </div>
              ${purchase.notes ? `<div class="alert alert-info" style="margin-bottom:14px;"><div>${esc(purchase.notes)}</div></div>` : ''}
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>Produto</th><th>Qtd.</th><th>Custo unit.</th><th>Validade do lote</th><th>Código</th><th>Subtotal</th></tr></thead>
                  <tbody>
                    ${purchase.items.map((i) => `
                      <tr>
                        <td>${esc(i.product_name)}</td>
                        <td>${fmtNum(i.quantity)} ${esc(i.unit_symbol || '')}</td>
                        <td>${brl(i.unit_cost)}</td>
                        <td>${fmtDateTime(i.expires_date).split(' ')[0]}</td>
                        <td>${esc(i.batch_code || '—')}</td>
                        <td>${brl(i.subtotal)}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal__foot">
              <button type="button" class="btn btn-outline" onclick="closeModal('modal-detalhe')">Fechar</button>
              ${pendente ? `
                <button type="button" class="btn btn-outline" id="btn-edit-compra">Editar</button>
                <button type="button" class="btn btn-danger-outline" id="btn-cancel-compra">Cancelar pedido</button>
                <button type="button" class="btn btn-primary" id="btn-receive-compra">Receber no estoque</button>` : ''}
              ${purchase.status === 'recebida' ? `
                <button type="button" class="btn btn-danger-outline" id="btn-reverse-compra">Estornar compra</button>` : ''}
            </div>
          </div>
        </div>`);

      openModal('modal-detalhe');
      if (pendente) {
        document.getElementById('btn-edit-compra').addEventListener('click', () => {
          closeModal('modal-detalhe');
          abrirFormulario(purchase);
        });
        document.getElementById('btn-cancel-compra').addEventListener('click', () => cancelarPedido(purchase));
        document.getElementById('btn-receive-compra').addEventListener('click', () => abrirRecebimento(purchase));
      }
      if (purchase.status === 'recebida') {
        document.getElementById('btn-reverse-compra').addEventListener('click', () => estornarCompra(purchase));
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function cancelarPedido(purchase) {
    if (!confirm(`Cancelar o pedido #${purchase.id}? Ele não dará entrada no estoque.`)) return;
    try {
      await api(`/api/compras/${purchase.id}/cancelar`, { method: 'POST' });
      toast('Pedido cancelado.');
      closeModal('modal-detalhe');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function estornarCompra(purchase) {
    const ok = confirm(
      `Estornar a compra #${purchase.id} (${brl(purchase.total_amount)})?\n\n`
      + 'Os lotes recebidos serão devolvidos ao fornecedor e o valor deixará de contar nos totais dele e do dashboard. O histórico da compra e o estorno ficam registrados.'
    );
    if (!ok) return;
    try {
      await api(`/api/compras/${purchase.id}/estornar`, { method: 'POST' });
      toast('Compra estornada — estoque, fornecedor e dashboard atualizados.');
      closeModal('modal-detalhe');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function abrirRecebimento(purchase) {
    document.getElementById('modal-receber')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-backdrop" id="modal-receber">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__head">
            <h3>Receber compra #${purchase.id}</h3>
            <button class="close" type="button" onclick="closeModal('modal-receber')" aria-label="Fechar">✕</button>
          </div>
          <form id="receber-form" novalidate>
            <div class="modal__body">
              <div id="rec-errors" class="alert alert-danger" style="display:none;"></div>
              <div class="alert alert-info">
                <div>${purchase.items.length} item(ns) darão entrada no estoque, cada um como lote com a validade informada no pedido. O total recebido será <strong>${brl(purchase.total_amount)}</strong>.</div>
              </div>
              <div class="field">
                <label for="r-date">Data do recebimento *</label>
                <input class="input" id="r-date" type="date" value="${new Date().toISOString().slice(0, 10)}" required />
              </div>
              <div class="field">
                <label for="r-invoice">Nota fiscal</label>
                <input class="input" id="r-invoice" maxlength="60" value="${esc(purchase.invoice_number || '')}" />
              </div>
            </div>
            <div class="modal__foot">
              <button type="button" class="btn btn-outline" onclick="closeModal('modal-receber')">Voltar</button>
              <button type="submit" class="btn btn-primary" id="r-save">Confirmar recebimento</button>
            </div>
          </form>
        </div>
      </div>`);

    openModal('modal-receber');
    document.getElementById('receber-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('rec-errors');
      errBox.style.display = 'none';
      const btn = document.getElementById('r-save');
      btn.disabled = true;
      btn.textContent = 'Recebendo...';
      try {
        await api(`/api/compras/${purchase.id}/receber`, {
          method: 'POST',
          body: {
            received_date: document.getElementById('r-date').value,
            invoice_number: document.getElementById('r-invoice').value.trim(),
          },
        });
        toast('Compra recebida — estoque atualizado.');
        closeModal('modal-receber');
        closeModal('modal-detalhe');
        load();
      } catch (err) {
        const details = Array.isArray(err.details) && err.details.length
          ? '<ul style="margin-left:16px;">' + err.details.map((d) => `<li>${esc(d)}</li>`).join('') + '</ul>' : '';
        errBox.innerHTML = esc(err.message) + details;
        errBox.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar recebimento';
      }
    });
  }

  // ---------- Formulário de pedido ----------
  function abrirFormulario(purchase) {
    state.editingId = purchase ? purchase.id : null;
    document.getElementById('modal-compra')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-backdrop" id="modal-compra">
        <div class="modal modal--wide" role="dialog" aria-modal="true">
          <div class="modal__head">
            <h3>${purchase ? `Editar compra #${purchase.id}` : 'Nova compra'}</h3>
            <button class="close" type="button" onclick="closeModal('modal-compra')" aria-label="Fechar">✕</button>
          </div>
          <form id="compra-form" novalidate>
            <div class="modal__body">
              <div id="comp-errors" class="alert alert-danger" style="display:none;"></div>
              <div class="form-row">
                <div class="field">
                  <label for="c-forn">Fornecedor *</label>
                  <select class="input" id="c-forn" required>
                    <option value="">— selecione —</option>
                    ${state.fornecedores.map((f) => `<option value="${f.id}" ${purchase && purchase.supplier_id === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
                  </select>
                </div>
                <div class="field">
                  <label for="c-invoice">Nota fiscal</label>
                  <input class="input" id="c-invoice" maxlength="60" value="${purchase ? esc(purchase.invoice_number || '') : ''}" />
                </div>
              </div>
              <div class="form-row">
                <div class="field">
                  <label for="c-order">Data do pedido *</label>
                  <input class="input" id="c-order" type="date" value="${purchase ? purchase.order_date.slice(0, 10) : new Date().toISOString().slice(0, 10)}" required />
                </div>
                <div class="field">
                  <label for="c-expected">Entrega prevista</label>
                  <input class="input" id="c-expected" type="date" value="${purchase && purchase.expected_date ? purchase.expected_date.slice(0, 10) : ''}" />
                </div>
              </div>
              <div class="field">
                <label for="c-notes">Observações</label>
                <input class="input" id="c-notes" maxlength="500" value="${purchase ? esc(purchase.notes || '') : ''}" />
              </div>

              <div class="card__head" style="padding:0; margin:14px 0 8px;">
                <h4 style="margin:0; font-size:14px;">Itens da compra *</h4>
                <span class="spacer"></span>
                <button type="button" class="btn btn-outline btn-sm" id="btn-add-item">+ Adicionar item</button>
              </div>
              <datalist id="produtos-datalist">
                ${state.produtos.map((p) => `<option value="${esc(p.name)}">${esc(p.unit_symbol || '')}</option>`).join('')}
              </datalist>
              <div id="itens-box"></div>
              <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                <span class="cell-muted">Total:</span>
                <strong id="comp-total">R$ 0,00</strong>
              </div>
            </div>
            <div class="modal__foot">
              <button type="button" class="btn btn-outline" onclick="closeModal('modal-compra')">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="c-save">${purchase ? 'Salvar alterações' : 'Registrar pedido'}</button>
            </div>
          </form>
        </div>
      </div>`);

    openModal('modal-compra');
    document.getElementById('btn-add-item').addEventListener('click', () => adicionarItem());
    document.getElementById('compra-form').addEventListener('submit', salvarPedido);
    const itensBox = document.getElementById('itens-box');
    const aoEditarItem = (e) => {
      if (e.target.classList.contains('item-produto')) atualizarHint(e.target);
      atualizarTotal();
    };
    itensBox.addEventListener('input', aoEditarItem);
    itensBox.addEventListener('change', aoEditarItem);

    if (purchase && purchase.items.length) purchase.items.forEach((i) => adicionarItem(i));
    else adicionarItem();
  }

  function adicionarItem(item) {
    const box = document.getElementById('itens-box');
    const row = document.createElement('div');
    row.className = 'item-row';
    row.style.cssText = 'display:grid; grid-template-columns: 2fr 0.9fr 0.9fr 1.1fr 0.9fr 32px; gap:8px; margin-bottom:8px; align-items:center;';
    row.innerHTML = `
      <div class="item-produto-cell">
        <input class="input item-produto" list="produtos-datalist" autocomplete="off"
               placeholder="Digite o produto..." value="${item ? esc(item.product_name) : ''}" required />
        <div class="item-produto-hint"></div>
      </div>
      <input class="input item-qtd" type="number" min="0.001" step="0.001" placeholder="Qtd." value="${item ? Number(item.quantity) : ''}" required />
      <input class="input item-custo" type="number" min="0" step="0.01" placeholder="Custo un." value="${item ? Number(item.unit_cost) : ''}" />
      <input class="input item-validade" type="date" title="Validade do lote" value="${item ? item.expires_date.slice(0, 10) : ''}" required />
      <input class="input item-code" maxlength="60" placeholder="Lote (opcional)" value="${item ? esc(item.batch_code || '') : ''}" />
      <button type="button" class="btn btn-danger-outline btn-sm" title="Remover item">✕</button>`;
    row.querySelector('button').addEventListener('click', () => {
      if (document.querySelectorAll('#itens-box .item-row').length > 1) row.remove();
      else toast('A compra precisa de pelo menos um item.', 'error');
      atualizarTotal();
    });
    box.appendChild(row);
    atualizarHint(row.querySelector('.item-produto'));
  }

  // Produto é digitado, não escolhido em lista fixa: o nome digitado é
  // resolvido contra o catálogo (nome exato ou começo único do nome).
  const normalizar = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  function produtoDigitado(valor) {
    const alvo = normalizar(valor);
    if (!alvo) return null;
    const exatos = state.produtos.filter((p) => normalizar(p.name) === alvo);
    if (exatos.length === 1) return exatos[0];
    const inicios = state.produtos.filter((p) => normalizar(p.name).startsWith(alvo));
    return inicios.length === 1 ? inicios[0] : null;
  }

  function atualizarHint(input) {
    if (!input) return;
    const hint = input.closest('.item-row')?.querySelector('.item-produto-hint');
    const produto = produtoDigitado(input.value);
    if (produto) {
      input.dataset.productId = produto.id;
      input.removeAttribute('aria-invalid');
      if (hint) {
        hint.className = 'item-produto-hint';
        hint.textContent = `Unidade: ${produto.unit_symbol || '—'} · em estoque: ${fmtNum(produto.current_stock)}`;
      }
      return;
    }
    delete input.dataset.productId;
    const vazio = !input.value.trim();
    if (vazio) input.removeAttribute('aria-invalid');
    else input.setAttribute('aria-invalid', 'true');
    if (hint) {
      hint.className = vazio ? 'item-produto-hint' : 'item-produto-hint is-danger';
      hint.textContent = vazio
        ? 'Digite o nome do produto — as sugestões do catálogo aparecem ao digitar.'
        : 'Produto não encontrado no catálogo. Escolha uma das sugestões.';
    }
  }

  function lerItens() {
    return [...document.querySelectorAll('#itens-box .item-row')].map((row) => {
      const input = row.querySelector('.item-produto');
      const produto = produtoDigitado(input.value);
      return {
        product_id: produto ? produto.id : '',
        produto_digitado: input.value.trim(),
        quantity: row.querySelector('.item-qtd').value,
        unit_cost: row.querySelector('.item-custo').value || 0,
        expires_date: row.querySelector('.item-validade').value,
        batch_code: row.querySelector('.item-code').value.trim(),
        sem_produto: !produto,
      };
    });
  }

  function atualizarTotal() {
    const total = lerItens().reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0), 0);
    document.getElementById('comp-total').textContent = brl(total);
  }

  async function salvarPedido(e) {
    e.preventDefault();
    const errBox = document.getElementById('comp-errors');
    errBox.style.display = 'none';

    const itensLidos = lerItens();
    const problemas = itensLidos
      .map((i, idx) => (i.sem_produto
        ? `Item ${idx + 1}: ${i.produto_digitado ? `"${i.produto_digitado}" não está no catálogo de produtos.` : 'digite o produto.'}`
        : null))
      .filter(Boolean);
    if (problemas.length) {
      errBox.innerHTML = `Corrija os itens da compra:<ul style="margin-left:16px;">${problemas.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`;
      errBox.style.display = 'block';
      return;
    }

    const body = {
      supplier_id: document.getElementById('c-forn').value,
      order_date: document.getElementById('c-order').value,
      expected_date: document.getElementById('c-expected').value,
      invoice_number: document.getElementById('c-invoice').value.trim(),
      notes: document.getElementById('c-notes').value.trim(),
      items: itensLidos.map(({ product_id, quantity, unit_cost, expires_date, batch_code }) => ({
        product_id, quantity, unit_cost, expires_date, batch_code,
      })),
    };
    const btn = document.getElementById('c-save');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      if (state.editingId != null) {
        await api(`/api/compras/${state.editingId}`, { method: 'PUT', body });
        toast('Pedido atualizado.');
      } else {
        await api('/api/compras', { method: 'POST', body });
        toast('Pedido de compra registrado.');
      }
      closeModal('modal-compra');
      load();
    } catch (err) {
      const details = Array.isArray(err.details) && err.details.length
        ? '<ul style="margin-left:16px;">' + err.details.map((d) => `<li>${esc(d)}</li>`).join('') + '</ul>' : '';
      errBox.innerHTML = esc(err.message) + details;
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = state.editingId != null ? 'Salvar alterações' : 'Registrar pedido';
    }
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  try {
    await carregarCadastros();
    await load();
  } catch (err) {
    pageEl.innerHTML = `<div class="alert alert-danger">Falha ao carregar a página: ${esc(err.message)}</div>`;
  }
})();
