// Movimentações — Etapa 2: registrar entradas (com lote) e saídas (FEFO),
// estornos para admin/gerente, histórico filtrável. Regras validadas no backend.
const TIPOS_MOV = [
  {
    value: 'entrada_compra',
    label: 'Entrada — compra/recebimento',
    grupo: 'entrada',
  },
  { value: 'entrada', label: 'Entrada — doação/uso interno', grupo: 'entrada' },
  { value: 'saida', label: 'Saída — uso na produção', grupo: 'saida' },
  { value: 'saida_desperdicio', label: 'Saída — desperdício/avaria', grupo: 'saida' },
  { value: 'entrada_ajuste', label: 'Entrada — ajuste de inventário', grupo: 'entrada' },
  { value: 'saida_ajuste', label: 'Saída — ajuste de inventário', grupo: 'saida' },
];

(async () => {
  const user = await renderLayout({
    page: 'movimentacoes',
    title: 'Movimentações',
    description: 'Entradas, saídas e estorno de estoque (FEFO automático)',
  });
  if (!user) return;

  const podeGerenciar = user.role === 'admin' || user.role === 'gerente';
  const state = { page: 1, pageSize: 30, total: 0, rows: [], produtos: [], lotesProduto: [] };

  const pageEl = document.querySelector('.page');
  pageEl.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card__head">
        <h2>Registrar movimentação</h2>
        <span class="sub">${podeGerenciar ? 'entradas e saídas' : 'saídas de uso e desperdício (entradas são do gerente/administrador)'}</span>
        <span class="spacer"></span>
        <span class="badge badge-info" id="reg-estoque-info"></span>
      </div>
      <div class="card__body">
        <form id="mov-form" novalidate>
          <div id="mov-errors" class="alert alert-danger" style="display:none;"></div>
          <div class="form-row">
            <div class="field">
              <label for="m-type">Tipo *</label>
              <select class="input" id="m-type" required>
                ${TIPOS_MOV.filter((t) => t.grupo === 'saida' || podeGerenciar).map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="m-produto">Produto *</label>
              <select class="input" id="m-produto" required></select>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="m-qtd">Quantidade *</label>
              <input class="input" id="m-qtd" type="number" min="0.001" step="0.001" required />
              <div class="hint" id="m-qtd-hint">—</div>
            </div>
            <div class="field" id="m-fefo-wrap" style="display:none;">
              <label for="m-lote">Lote de origem</label>
              <select class="input" id="m-lote">
                <option value="">Automático (FEFO: vence primeiro, consome primeiro)</option>
              </select>
              <div class="hint">o sistema sempre sugere o lote com validade mais próxima</div>
            </div>
          </div>
          <div id="lote-fields" style="display:none;">
            <div class="form-row">
              <div class="field">
                <label for="m-recebido">Recebido em *</label>
                <input class="input" id="m-recebido" type="date" required />
              </div>
              <div class="field">
                <label for="m-fabricado">Fabricado em</label>
                <input class="input" id="m-fabricado" type="date" />
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label for="m-validade">Validade *</label>
                <input class="input" id="m-validade" type="date" required />
              </div>
              <div class="field">
                <label for="m-lote-code">Código do lote</label>
                <input class="input" id="m-lote-code" maxlength="60" placeholder="ex.: 24ACH1104" />
              </div>
            </div>
            <div class="form-row" id="compra-fields" style="display:none;">
              <div class="field">
                <label for="m-fornecedor">Fornecedor (compra)</label>
                <input class="input" id="m-fornecedor" maxlength="160" placeholder="ex.: Distribuidora São Luís" />
              </div>
              <div class="field">
                <label for="m-custo">Custo unitário (R$)</label>
                <input class="input" id="m-custo" type="number" min="0" step="0.01" value="0" />
              </div>
            </div>
          </div>
          <div class="field">
            <label for="m-notes">Observações</label>
            <input class="input" id="m-notes" maxlength="500" placeholder="motivo, ocorrência, etc." />
          </div>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="btn btn-primary" type="submit" id="mov-save">Registrar</button>
            <button class="btn btn-outline" type="button" id="mov-clear">Limpar</button>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card__head">
        <h2>Histórico</h2>
        <span class="sub">movimentações auditáveis — estorno gera novo registro (nada é apagado)</span>
      </div>
      <div class="card__body" style="display:flex; gap:8px; flex-wrap:wrap; padding-bottom:0;">
        <input class="input" id="h-search-prod" list="prod-list" placeholder="Produto (digite ou escolha)" style="max-width:280px;" />
        <datalist id="prod-list"></datalist>
        <input class="input" id="h-de" type="date" title="De" style="max-width:160px;" />
        <input class="input" id="h-ate" type="date" title="Até" style="max-width:160px;" />
        <select class="input" id="h-tipo" style="max-width:220px;">
          <option value="">Todos os tipos</option>
          ${TIPOS_MOV.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
          <option value="estorno">Estorno</option>
        </select>
        <button class="btn btn-outline btn-sm" id="h-filter">Filtrar</button>
        <span style="flex:1;"></span>
        <button class="btn btn-outline btn-sm" id="h-refresh">Atualizar</button>
      </div>
      <div class="card__body--flush" id="mov-table"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
    </div>`;

  const $ = (sel) => document.querySelector(sel);
  const fmtBadge = (tipo) => {
    const map = {
      entrada: ['badge-ok', 'Entrada'],
      entrada_compra: ['badge-ok', 'Entrada (compra)'],
      entrada_ajuste: ['badge-info', 'Entrada (ajuste)'],
      saida: ['badge-warn', 'Saída (uso)'],
      saida_desperdicio: ['badge-danger', 'Desperdício'],
      saida_ajuste: ['badge-warn', 'Saída (ajuste)'],
      estorno: ['badge-neutral', 'Estorno'],
    };
    const [cls, label] = map[tipo] || ['badge-neutral', tipo];
    return `<span class="badge ${cls}">${label}</span>`;
  };

  $('#m-type').addEventListener('change', atualizarForm);
  $('#m-produto').addEventListener('change', atualizarProdutoInfo);
  $('#m-qtd').addEventListener('input', atualizarProdutoInfo);
  $('#mov-form').addEventListener('submit', onSubmit);
  $('#mov-clear').addEventListener('click', () => resetForm(false));
  $('#h-filter').addEventListener('click', () => { state.page = 1; loadHistorico(); });
  $('#h-refresh').addEventListener('click', loadHistorico);

  async function loadProdutos() {
    const data = await api('/api/produtos?pageSize=100&status=ativo');
    state.produtos = data.rows;
    $('#m-produto').innerHTML = '<option value="">— selecione —</option>'
      + state.produtos.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    $('#prod-list').innerHTML = state.produtos.map((p) => `<option value="${esc(p.name)}">`).join('');
  }

  // Mostra/oculta campos de lote conforme o tipo selecionado.
  function atualizarForm() {
    const tipo = $('#m-type').value;
    const isEntrada = tipo.startsWith('entrada');
    $('#lote-fields').style.display = isEntrada ? 'block' : 'none';
    $('#compra-fields').style.display = tipo === 'entrada_compra' ? 'flex' : 'none';
    $('#m-fefo-wrap').style.display = !isEntrada ? 'block' : 'none';
    $('#m-qtd-hint').textContent = isEntrada ? 'quantidade recebida do lote' : 'quantidade a dar baixa';
    atualizarProdutoInfo();
  }

  // Consulta lotes do produto escolhido para exibir saldo FEFO e lotes.
  async function atualizarProdutoInfo() {
    const prodId = $('#m-produto').value;
    const sel = $('#m-lote');
    sel.innerHTML = '<option value="">Automático (FEFO)</option>';
    $('#reg-estoque-info').textContent = '';
    if (!prodId) return;

    try {
      const data = await api(`/api/movimentacoes/produto/${prodId}/lotes`);
      state.lotesProduto = data.rows;
      for (const l of data.rows) {
        const dias = Math.ceil((new Date(l.expires_date) - new Date()) / 86400000);
        const info = dias < 0 ? `VENCIDO ${-dias}d atrás` : `vence em ${dias}d`;
        sel.insertAdjacentHTML('beforeend',
          `<option value="${l.id}">Lote ${esc(l.code || `#${l.id}`)} — ${fmtNum(l.remaining_qty)} (${info})</option>`);
      }
      const p = state.produtos.find((x) => x.id === Number(prodId));
      if (p && p.unit_symbol) $('#m-qtd-hint').textContent = `em ${p.unit_symbol}`;

      const disponivel = elegivelFefo(data.rows).reduce((s, l) => s + Number(l.remaining_qty), 0);
      $('#reg-estoque-info').textContent = `Disponível na validade: ${fmtNum(disponivel)}`;
    } catch (err) {
      $('#reg-estoque-info').textContent = '';
    }
  }

  const elegivelFefo = (lotes) => lotes.filter((l) => l.status === 'ativo');

  async function onSubmit(e) {
    e.preventDefault();
    const errBox = $('#mov-errors');
    errBox.style.display = 'none';

    const tipo = $('#m-type').value;
    const body = {
      type: tipo,
      product_id: $('#m-produto').value,
      quantity: $('#m-qtd').value,
      notes: $('#m-notes').value.trim(),
    };
    if (body.product_id === '' || body.quantity === '') {
      mostrarErroNoForm(errBox, 'Selecione o produto e informe a quantidade.');
      return;
    }
    if (tipo.startsWith('entrada')) {
      body.received_date = $('#m-recebido').value;
      body.expires_date = $('#m-validade').value;
      body.manufactured_date = $('#m-fabricado').value || undefined;
      body.code = $('#m-lote-code').value.trim();
      if (tipo === 'entrada_compra') {
        body.supplier_name = $('#m-fornecedor').value.trim();
        body.unit_cost = $('#m-custo').value;
      }
      if (!body.received_date || !body.expires_date) {
        mostrarErroNoForm(errBox, 'Informe as datas de recebimento e validade do lote.');
        return;
      }
    } else if ($('#m-lote').value) {
      body.batch_id = $('#m-lote').value;
    }

    const btn = $('#mov-save');
    btn.disabled = true;
    btn.textContent = 'Registrando...';
    try {
      await api('/api/movimentacoes', { method: 'POST', body });
      toast('Movimentação registrada com sucesso.');
      resetForm(true);
      loadHistorico();
    } catch (err) {
      const details = Array.isArray(err.details) && err.details.length
        ? '<ul style="margin-left:16px;">' + err.details.map((d) => `<li>${esc(d)}</li>`).join('') + '</ul>' : '';
      errBox.innerHTML = esc(err.message) + details;
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Registrar';
    }
  }

  function mostrarErroNoForm(box, msg) {
    box.innerHTML = esc(msg);
    box.style.display = 'block';
  }

  function resetForm(somenteDados) {
    $('#m-qtd').value = '';
    $('#m-notes').value = '';
    $('#m-custo').value = '0';
    $('#m-fornecedor').value = '';
    if (!somenteDados) {
      const hoje = new Date().toISOString().slice(0, 10);
      const mais30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      $('#m-recebido').value = hoje;
      $('#m-validade').value = mais30;
      $('#m-fabricado').value = '';
      $('#m-lote-code').value = '';
      $('#mov-errors').style.display = 'none';
    }
    atualizarProdutoInfo();
  }

  async function loadHistorico() {
    const box = $('#mov-table');
    box.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando histórico...</div>';
    const qs = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
    const nomeProd = $('#h-search-prod').value.trim();
    const prod = state.produtos.find((p) => p.name === nomeProd);
    if (prod) qs.set('product_id', prod.id);
    if ($('#h-de').value) qs.set('dateFrom', $('#h-de').value);
    if ($('#h-ate').value) qs.set('dateTo', $('#h-ate').value);
    if ($('#h-tipo').value) qs.set('type', $('#h-tipo').value);

    try {
      const data = await api(`/api/movimentacoes?${qs}`);
      state.rows = data.rows;
      state.total = data.total;
      renderHistorico();
    } catch (err) {
      box.innerHTML = `<div class="alert alert-danger" style="margin:16px;">Falha ao carregar: ${esc(err.message)}</div>`;
    }
  }

  function renderHistorico() {
    const box = $('#mov-table');
    if (!state.rows.length) {
      box.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/></svg>
          <strong>Nenhuma movimentação no filtro</strong>
          <span>Registre entradas e saídas acima.</span>
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="table-wrap">
        <table class="table table-stacked">
          <thead>
            <tr><th>Quanto</th><th>Produto</th><th>Lote</th><th>Quando · Quem</th><th>Observações</th>${podeGerenciar ? '<th style="text-align:right;">Ações</th>' : ''}</tr>
          </thead>
          <tbody>
            ${state.rows.map((m) => {
      const sinal = m.type.startsWith('entrada') ? '+' : m.type === 'estorno' ? '∓' : '−';
      const estornado = m.type === 'estorno' || (m.reference || '').startsWith('mov:');
      return `
                <tr data-id="${m.id}">
                  <td data-label="Tipo">${fmtBadge(m.type)}</td>
                  <td data-label="Produto">
                    <div class="cell-strong">${sinal} ${fmtNum(m.quantity)} ${esc(m.unit_symbol || '')} · ${esc(m.product_name)}</div>
                  </td>
                  <td data-label="Lote">${esc(m.batch_code || `#${m.batch_id || '—'}`)}</td>
                  <td data-label="Quando · Quem"><div class="cell-muted">${fmtDateTime(m.movement_date)}<br>${esc(m.user_name || '—')}</div></td>
                  <td data-label="Observações">${esc(m.notes || '')}</td>
                  ${podeGerenciar && m.type !== 'estorno' ? `
                    <td data-label="Ações">
                      <div class="actions">
                        <button class="btn btn-danger-outline btn-sm" data-rev="${m.id}">Estornar</button>
                      </div>
                    </td>` : ''}
                </tr>`;
    }).join('')}
          </tbody>
        </table>
      </div>`;
    box.querySelectorAll('[data-rev]').forEach((b) =>
      b.addEventListener('click', () => estornar(Number(b.dataset.rev))));
  }

  async function estornar(id) {
    if (!confirm(`Estornar a movimentação #${id}? O saldo do lote volta ao estado anterior e um registro "Estorno" fica no histórico.`)) return;
    try {
      await api(`/api/movimentacoes/${id}/estorno`, { method: 'POST' });
      toast('Movimentação estornada.');
      loadHistorico();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const mais30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  $('#m-recebido').value = hoje;
  $('#m-validade').value = mais30;

  try {
    await loadProdutos();
    atualizarForm();
    await loadHistorico();
  } catch (err) {
    pageEl.innerHTML = `<div class="alert alert-danger">Falha ao carregar a página: ${esc(err.message)}</div>`;
  }
})();
