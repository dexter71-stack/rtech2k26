// Dashboard — Etapa 1: indicadores reais do banco + atividade recente.
// Os módulos de estoque/compras/desperdício alimentarão os demais
// indicadores nas próximas etapas, sem alterar esta página.
(async () => {
  const user = await renderLayout({
    page: 'dashboard',
    title: 'Dashboard',
    description: 'Visão geral da operação da Galeto São Luís',
  });
  if (!user) return;

  const pageEl = document.querySelector('.page');
  pageEl.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando indicadores...</div>';

  let sum;
  try {
    sum = await api('/api/dashboard/summary');
  } catch (err) {
    pageEl.innerHTML = `<div class="alert alert-danger">Não foi possível carregar o dashboard: ${esc(err.message)}</div>`;
    return;
  }

  const actions = user.role === 'admin'
    ? `<a class="btn btn-primary btn-sm" href="/pages/usuarios/">Gerenciar funcionários</a>`
    : '';

  pageEl.innerHTML = `
    <div class="stats-grid">
      <div class="stat">
        <div class="label">Ingredientes cadastrados</div>
        <div class="value">${sum.ingredientes}</div>
        <div class="hint">Módulo de estoque — Etapa 2</div>
      </div>
      <div class="stat ${sum.baixoEstoque > 0 ? 'is-warn' : ''}">
        <div class="label">Produtos com estoque baixo</div>
        <div class="value">${sum.baixoEstoque}</div>
        <div class="hint">Compara estoque atual × mínimo</div>
      </div>
      <div class="stat ${sum.semEstoque > 0 ? 'is-danger' : ''}">
        <div class="label">Produtos sem estoque</div>
        <div class="value">${sum.semEstoque}</div>
      </div>
      <div class="stat ${sum.proximosVencimento > 0 ? 'is-warn' : ''}">
        <div class="label">Próximos do vencimento</div>
        <div class="value">${sum.proximosVencimento}</div>
        <div class="hint">Lotes ativos vencendo em até 7 dias</div>
      </div>
      <div class="stat">
        <div class="label">Lotes vencidos</div>
        <div class="value">${sum.vencidos}</div>
      </div>
      <div class="stat">
        <div class="label">Compras do mês</div>
        <div class="value">—</div>
        <div class="hint">Módulo de compras — Etapa 3</div>
      </div>
      <div class="stat">
        <div class="label">Desperdício do mês</div>
        <div class="value">—</div>
        <div class="hint">Módulo de desperdício — Etapa 4</div>
      </div>
      <div class="stat is-ok">
        <div class="label">Funcionários ativos</div>
        <div class="value">${sum.funcionariosAtivos}</div>
      </div>
    </div>

    ${actions ? `<div class="alert alert-info"><div><strong>Etapa 1 quase concluída.</strong> Próximo passo do projeto: módulo de estoque (produtos, lotes e movimentações).</div>${actions.toUpperCase ? `<div class="spacer"></div>` : ''}</div>` : ''}

    <div class="card">
      <div class="card__head">
        <h2>Atividade recente</h2>
        <span class="sub">Registros da auditoria do sistema${user.role === 'admin' ? ' — histórico completo em Relatórios (Etapa 5)' : ''}</span>
        <span class="spacer"></span>
        <button class="btn btn-outline btn-sm" onclick="location.reload()">Atualizar</button>
      </div>
      <div class="card__body--flush" id="activity">
        <div class="loading"><div class="spinner"></div> Carregando...</div>
      </div>
    </div>`;

  renderActivity(sum.atividade);

  function renderActivity(rows) {
    const target = document.getElementById('activity');
    if (!rows || !rows.length) {
      target.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/></svg>
          <strong>Nenhuma atividade registrada</strong>
          <span>As operações do sistema aparecerão aqui automaticamente.</span>
        </div>`;
      return;
    }
    target.innerHTML = `
      <div class="table-wrap">
        <table class="table table-stacked">
          <thead>
            <tr><th>Quando</th><th>Usuário</th><th>Evento</th></tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td class="cell-muted">${fmtDateTime(r.created_at)}</td>
                <td>${esc(r.user_name || '—')}</td>
                <td><span class="badge badge-neutral">${esc(r.module)}</span> ${esc(r.description || r.action)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
})();
