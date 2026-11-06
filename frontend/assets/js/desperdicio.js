// Desperdício — Etapa 4: registro de perdas com baixa automática do estoque
// (vencidos primeiro, depois FEFO), prejuízo pelo custo do lote e estorno.
// Regras de saldo, custo e permissões são sempre validadas no backend.
const MOTIVOS = [
  { value: 'vencido', label: 'Passou da validade' },
  { value: 'avaria', label: 'Avaria / dano' },
  { value: 'preparo', label: 'Erro de preparo' },
  { value: 'sobra', label: 'Sobra de produção' },
  { value: 'outro', label: 'Outro motivo' },
];

const MOTIVO_LABEL = Object.fromEntries(MOTIVOS.map((m) => [m.value, m.label]));

(async () => {
  const user = await renderLayout({
    page: 'desperdicio',
    title: 'Desperdício',
    description: 'Perdas por motivo, baixa automática no estoque e prejuízo',
  });
  if (!user) return;

  const podeEstornar = user.role === 'admin' || user.role === 'gerente';
  const state = { page: 1, pageSize: 20, total: 0, rows: [], produtos: [], lotes: [] };
  const pageEl = document.querySelector('.page');
  const hoje = new Date().toISOString().slice(0, 10);

  pageEl.innerHTML = `
    <div class="stats-grid">
      <div class="stat is-danger">
        <div class="label">Prejuízo no período</div>
        <div class="value" id="stat-custo">—</div>
        <div class="hint">custo dos lotes perdidos</div>
      </div>
      <div class="stat">
        <div class="label">Registros de perda</div>
        <div class="value" id="stat-count">—</div>
        <div class="hint">estornados não entram na soma</div>
      </div>
      <div class="stat">
        <div class="label">Maior motivo de prejuízo</div>
        <div class="value" id="stat-motivo" style="font-size:19px;">—</div>
        <div class="hint" id="stat-motivo-hint">—</div>
      </div>
    </div>

    <div class="alert alert-info">
      <div><strong>Como a baixa funciona.</strong> A perda sai sempre do lote selecionado. A lista mostra todos os lotes do produto — de compras, movimentações e do cadastro em Lotes e Validades —, inclusive os já encerrados (como histórico). O prejuízo usa o custo do lote; se ele não tiver custo, usa o custo de referência do produto.</div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="card__head">
        <h2>Registrar perda</h2>
        <span class="sub">a quantidade sai do estoque na hora</span>
        <span class="spacer"></span>
        <span class="badge badge-info" id="reg-estoque-info"></span>
      </div>
      <div class="card__body">
        <form id="waste-form" novalidate>
          <div id="waste-errors" class="alert alert-danger" style="display:none;"></div>
          <div class="form-row">
            <div class="field">
              <label for="w-produto">Produto *</label>
              <input class="input" id="w-produto" list="w-prod-list" placeholder="Digite o nome do produto" autocomplete="off" required />
              <datalist id="w-prod-list"></datalist>
              <div class="hint" id="w-prod-hint">digite e escolha o produto na lista</div>
            </div>
            <div class="field">
              <label for="w-motivo">Motivo *</label>
              <select class="input" id="w-motivo" required>
                ${MOTIVOS.map((m) => `<option value="${m.value}">${m.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="w-qtd">Quantidade perdida *</label>
              <input class="input" id="w-qtd" type="number" min="0.001" step="0.001" required />
              <div class="hint" id="w-qtd-hint">—</div>
            </div>
            <div class="field">
              <label for="w-lote">Lote *</label>
              <select class="input" id="w-lote" required>
                <option value="">Selecione o produto para carregar os lotes</option>
              </select>
              <div class="hint">todos os lotes do produto, de compras e de Lotes e Validades</div>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="w-data">Data da perda *</label>
              <input class="input" id="w-data" type="date" max="${hoje}" value="${hoje}" required />
            </div>
            <div class="field">
              <label for="w-notes">Observações</label>
              <input class="input" id="w-notes" maxlength="500" placeholder="o que aconteceu, quem identificou, etc." />
            </div>
          </div>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="btn btn-primary" type="submit" id="w-save">Registrar perda</button>
            <button class="btn btn-outline" type="button" id="w-clear">Limpar</button>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card__head">
        <h2>Histórico de perdas</h2>
        <span class="sub">cada baixa gera movimentação auditável no estoque</span>
      </div>
      <div class="card__body" style="display:flex; gap:8px; flex-wrap:wrap; padding-bottom:0;">
        <input class="input" id="h-produto" list="w-prod-list" placeholder="Produto (digite ou escolha)" autocomplete="off" style="max-width:240px;" />
        <select class="input" id="h-motivo" style="max-width:190px;">
          <option value="">Todos os motivos</option>
          ${MOTIVOS.map((m) => `<option value="${m.value}">${m.label}</option>`).join('')}
        </select>
        <input class="input" id="h-de" type="date" title="De" style="max-width:160px;" />
        <input class="input" id="h-ate" type="date" title="Até" style="max-width:160px;" />
        <button class="btn btn-outline btn-sm" id="h-filter">Filtrar</button>
        <button class="btn btn-outline btn-sm" id="h-today">Hoje</button>
        <span style="flex:1;"></span>
        <button class="btn btn-outline btn-sm" id="h-refresh">Atualizar</button>
      </div>
      <div class="card__body--flush" id="waste-table"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
      <div class="card__body" id="waste-pager" style="display:none; justify-content:space-between; align-items:center;">
        <span class="sub" id="pager-info"></span>
        <span style="display:flex; gap:8px;">
          <button class="btn btn-outline btn-sm" id="pg-prev">Anterior</button>
          <button class="btn btn-outline btn-sm" id="pg-next">Próxima</button>
        </span>
      </div>
    </div>`;

  const $ = (sel) => document.querySelector(sel);

  const fmtData = (v) => {
    if (!v) return '—';
    const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleDateString('pt-BR');
  };
  const motivoBadge = (reason, status) => {
    if (status === 'estornado') return '<span class="badge badge-neutral">Estornado</span>';
    const cls = reason === 'vencido' ? 'badge-danger' : reason === 'avaria' ? 'badge-warn' : 'badge-neutral';
    return `<span class="badge ${cls}">${MOTIVO_LABEL[reason] || esc(reason)}</span>`;
  };

  // O produto é digitado; a busca ignora caixa e acentos e exige nome cadastrado.
  const normalizarNome = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const produtoPorNome = (valor) => {
    const alvo = normalizarNome(valor);
    if (!alvo) return null;
    const exatos = state.produtos.filter((p) => normalizarNome(p.name) === alvo);
    if (exatos.length === 1) return exatos[0];
    const parecidos = state.produtos.filter((p) => normalizarNome(p.name).includes(alvo));
    return parecidos.length === 1 ? parecidos[0] : null;
  };

  let debounceProduto;
  $('#w-produto').addEventListener('change', atualizarLotes);
  $('#w-produto').addEventListener('input', () => {
    clearTimeout(debounceProduto);
    debounceProduto = setTimeout(atualizarLotes, 300);
  });
  $('#waste-form').addEventListener('submit', onSubmit);
  $('#w-clear').addEventListener('click', limparForm);
  $('#h-filter').addEventListener('click', () => { state.page = 1; loadHistorico(); });
  $('#h-today').addEventListener('click', () => {
    $('#h-de').value = hoje;
    $('#h-ate').value = hoje;
    state.page = 1;
    loadHistorico();
  });
  $('#h-refresh').addEventListener('click', () => loadHistorico());
  $('#pg-prev').addEventListener('click', () => { if (state.page > 1) { state.page -= 1; loadHistorico(); } });
  $('#pg-next').addEventListener('click', () => {
    if (state.page * state.pageSize < state.total) { state.page += 1; loadHistorico(); }
  });

  async function loadProdutos() {
    const data = await api('/api/produtos?pageSize=100&status=ativo');
    state.produtos = data.rows;
    $('#w-prod-list').innerHTML = state.produtos.map((p) => `<option value="${esc(p.name)}"></option>`).join('');
    // Se o usuário digitou antes da lista carregar, resolve o lote agora.
    if ($('#w-produto').value.trim()) atualizarLotes();
  }

  // Lotes do produto: TODOS os que existem (compras, movimentações e cadastro
  // em Lotes e Validades), inclusive vencidos e encerrados. Só os que têm
  // saldo (ativo/vencido) podem ser escolhidos.
  async function atualizarLotes() {
    const produto = produtoPorNome($('#w-produto').value);
    const sel = $('#w-lote');
    sel.innerHTML = '<option value="">Selecione o produto para carregar os lotes</option>';
    $('#reg-estoque-info').textContent = '';
    state.lotes = [];
    if (!produto) {
      $('#w-prod-hint').textContent = $('#w-produto').value.trim()
        ? 'produto não encontrado — digite o nome completo'
        : 'digite e escolha o produto na lista';
      $('#w-qtd-hint').textContent = '—';
      return;
    }
    $('#w-prod-hint').textContent = `${produto.category_name || 'sem categoria'} · estoque: ${fmtNum(produto.current_stock)} ${produto.unit_symbol || ''}`;

    const unidade = produto.unit_symbol || '';
    try {
      const data = await api(`/api/movimentacoes/produto/${produto.id}/lotes?incluir_todos=1`);
      state.lotes = data.rows;
      const opcao = (l) => {
        const dias = Math.ceil((new Date(`${l.expires_date}T00:00:00`) - new Date(`${hoje}T00:00:00`)) / 86400000);
        const validade = l.status === 'vencido' || dias < 0
          ? `VENCIDO há ${Math.max(1, -dias)}d`
          : l.status === 'esgotado' ? 'esgotado'
            : l.status === 'cancelado' ? 'cancelado'
              : `vence em ${dias}d`;
        const podeEscolher = l.status === 'ativo' || l.status === 'vencido';
        const fornecedor = l.supplier_name ? ` · ${esc(l.supplier_name)}` : '';
        return `<option value="${l.id}" ${podeEscolher ? '' : 'disabled'}>Lote ${esc(l.code || `#${l.id}`)} — ${fmtNum(l.remaining_qty)} ${esc(unidade)} · ${validade}${fornecedor}</option>`;
      };
      const comSaldo = data.rows.filter((l) => l.status === 'ativo' || l.status === 'vencido');
      const semSaldo = data.rows.filter((l) => l.status !== 'ativo' && l.status !== 'vencido');
      sel.innerHTML = data.rows.length
        ? '<option value="">Selecione o lote</option>'
        : '<option value="">Nenhum lote cadastrado para este produto</option>';
      if (comSaldo.length) {
        sel.insertAdjacentHTML('beforeend', `<optgroup label="Com saldo">${comSaldo.map(opcao).join('')}</optgroup>`);
      }
      if (semSaldo.length) {
        sel.insertAdjacentHTML('beforeend', `<optgroup label="Sem saldo (histórico)">${semSaldo.map(opcao).join('')}</optgroup>`);
      }
      const vencido = comSaldo.filter((l) => l.status === 'vencido').reduce((s, l) => s + Number(l.remaining_qty), 0);
      $('#reg-estoque-info').textContent = `Disponível: ${fmtNum(data.total)} ${unidade}${vencido > 0 ? ` · vencido: ${fmtNum(vencido)}` : ''}`;
      $('#w-qtd-hint').textContent = unidade ? `em ${unidade}` : '—';
    } catch (err) {
      $('#reg-estoque-info').textContent = 'Não foi possível carregar os lotes.';
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errBox = $('#waste-errors');
    errBox.style.display = 'none';

    const produto = produtoPorNome($('#w-produto').value);
    if (!produto) {
      errBox.innerHTML = $('#w-produto').value.trim()
        ? `Produto "${esc($('#w-produto').value.trim())}" não encontrado. Digite o nome completo de um produto cadastrado.`
        : 'Digite o produto e informe a quantidade perdida.';
      errBox.style.display = 'block';
      return;
    }
    if (!$('#w-qtd').value) {
      errBox.innerHTML = 'Informe a quantidade perdida.';
      errBox.style.display = 'block';
      return;
    }
    const loteId = Number($('#w-lote').value);
    if (!loteId) {
      errBox.innerHTML = 'Selecione o lote da perda. A lista mostra todos os lotes do produto.';
      errBox.style.display = 'block';
      return;
    }

    const body = {
      product_id: produto.id,
      batch_id: loteId,
      reason: $('#w-motivo').value,
      quantity: $('#w-qtd').value,
      waste_date: $('#w-data').value || hoje,
      notes: $('#w-notes').value.trim(),
    };

    const btn = $('#w-save');
    btn.disabled = true;
    btn.textContent = 'Registrando...';
    try {
      const data = await api('/api/desperdicios', { method: 'POST', body });
      toast(`Perda registrada — prejuízo de ${fmtMoney(data.waste.total_cost)}.`);
      $('#w-qtd').value = '';
      $('#w-notes').value = '';
      $('#w-lote').value = '';
      await atualizarLotes();
      await loadHistorico();
    } catch (err) {
      const details = Array.isArray(err.details) && err.details.length
        ? '<ul style="margin-left:16px;">' + err.details.map((d) => `<li>${esc(d)}</li>`).join('') + '</ul>'
        : '';
      errBox.innerHTML = esc(err.message) + details;
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Registrar perda';
    }
  }

  function limparForm() {
    $('#w-produto').value = '';
    $('#w-prod-hint').textContent = 'digite e escolha o produto na lista';
    $('#w-motivo').value = 'vencido';
    $('#w-qtd').value = '';
    $('#w-data').value = hoje;
    $('#w-notes').value = '';
    $('#w-lote').value = '';
    $('#waste-errors').style.display = 'none';
    $('#reg-estoque-info').textContent = '';
    $('#w-qtd-hint').textContent = '—';
    state.lotes = [];
    $('#w-lote').innerHTML = '<option value="">Selecione o produto para carregar os lotes</option>';
  }

  async function loadHistorico() {
    const box = $('#waste-table');
    box.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando histórico...</div>';
    const qs = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
    if ($('#h-produto').value.trim()) qs.set('product', $('#h-produto').value.trim());
    if ($('#h-motivo').value) qs.set('reason', $('#h-motivo').value);
    if ($('#h-de').value) qs.set('dateFrom', $('#h-de').value);
    if ($('#h-ate').value) qs.set('dateTo', $('#h-ate').value);

    try {
      const data = await api(`/api/desperdicios?${qs}`);
      state.rows = data.rows;
      state.total = data.total;
      renderResumo(data.resumo);
      renderHistorico();
    } catch (err) {
      box.innerHTML = `<div class="alert alert-danger" style="margin:16px;">Falha ao carregar: ${esc(err.message)}</div>`;
    }
  }

  function renderResumo(resumo) {
    $('#stat-custo').textContent = fmtMoney(resumo.cost);
    $('#stat-count').textContent = fmtNum(resumo.count, 0);
    const maior = resumo.byReason[0];
    $('#stat-motivo').textContent = maior ? MOTIVO_LABEL[maior.reason] || maior.reason : '—';
    $('#stat-motivo-hint').textContent = maior ? fmtMoney(maior.cost) : 'sem perdas no período';
  }

  function renderHistorico() {
    const box = $('#waste-table');
    const pager = $('#waste-pager');

    if (!state.rows.length) {
      pager.style.display = 'none';
      box.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>
          <strong>Nenhuma perda registrada no filtro</strong>
          <span>Registre a perda acima para descontar do estoque e acompanhar o prejuízo.</span>
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="table-wrap">
        <table class="table table-stacked">
          <thead>
            <tr><th>Quando</th><th>Produto</th><th>Motivo</th><th>Quantidade</th><th>Lote(s)</th><th>Prejuízo</th><th>Quem</th>${podeEstornar ? '<th style="text-align:right;">Ações</th>' : ''}</tr>
          </thead>
          <tbody>
            ${state.rows.map((r) => `
              <tr>
                <td data-label="Quando" class="cell-muted">${fmtData(r.waste_date)}</td>
                <td data-label="Produto">
                  <div class="cell-strong">${esc(r.product_name)}</div>
                  ${r.notes ? `<div class="cell-muted">${esc(r.notes)}</div>` : ''}
                </td>
                <td data-label="Motivo">${motivoBadge(r.reason, r.status)}</td>
                <td data-label="Quantidade">${r.status === 'estornado' ? '<s>' : ''}${fmtNum(r.quantity)} ${esc(r.unit_symbol || '')}${r.status === 'estornado' ? '</s>' : ''}</td>
                <td data-label="Lote(s)">${esc(r.batch_codes || '—')}</td>
                <td data-label="Prejuízo"><div class="cell-strong">${fmtMoney(r.total_cost)}</div></td>
                <td data-label="Quem" class="cell-muted">${esc(r.user_name || '—')}</td>
                ${podeEstornar ? `<td data-label="Ações">
                  <div class="actions">
                    ${r.status === 'registrado' ? `<button class="btn btn-danger-outline btn-sm" data-rev="${r.id}">Estornar</button>` : '<span class="cell-muted">—</span>'}
                  </div>
                </td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    pager.style.display = 'flex';
    const inicio = (state.page - 1) * state.pageSize + 1;
    const fim = Math.min(state.page * state.pageSize, state.total);
    $('#pager-info').textContent = `Mostrando ${inicio}–${fim} de ${state.total} registro(s)`;
    $('#pg-prev').disabled = state.page <= 1;
    $('#pg-next').disabled = state.page * state.pageSize >= state.total;

    box.querySelectorAll('[data-rev]').forEach((b) =>
      b.addEventListener('click', () => estornar(Number(b.dataset.rev))));
  }

  async function estornar(id) {
    if (!confirm('Estornar esta perda? A quantidade volta para os lotes de origem e um movimento de estorno fica no histórico.')) return;
    try {
      await api(`/api/desperdicios/${id}/estorno`, { method: 'POST' });
      toast('Perda estornada e estoque devolvido.');
      await atualizarLotes();
      await loadHistorico();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  try {
    await loadProdutos();
    await loadHistorico();
  } catch (err) {
    pageEl.innerHTML = `<div class="alert alert-danger">Falha ao carregar a página: ${esc(err.message)}</div>`;
  }
})();
