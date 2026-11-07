// Dashboard: indicadores reais do banco (estoque, validade, compras e
// desperdício do mês) + atividade recente da auditoria.
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

  const alertaValidade = (sum.proximosVencimento > 0 || sum.vencidos > 0)
    ? `<div class="alert alert-info"><div><strong>Atenção à validade.</strong> ${sum.vencidos > 0 ? `Existem ${sum.vencidos} lote(s) vencido(s) e ` : ''}${sum.proximosVencimento} lote(s) vencendo em até 7 dias — baixe os lotes mais próximos (FEFO) ou registre desperdício quando necessário.</div><div class="spacer"></div><a class="btn btn-primary btn-sm" href="/pages/lotes/?vence=7">Ver lotes</a></div>`
    : '';

  const actions = `<a class="btn btn-outline btn-sm" href="/pages/relatorios/">Relatórios</a>`
    + (user.role === 'admin' ? ' <a class="btn btn-primary btn-sm" href="/pages/usuarios/">Gerenciar funcionários</a>' : '');

  const MOTIVO_LABEL = {
    vencido: 'Passou da validade',
    avaria: 'Avaria / dano',
    preparo: 'Erro de preparo',
    sobra: 'Sobra de produção',
    outro: 'Outro motivo',
  };
  const motivos = sum.desperdicioMes.porMotivo || [];
  const maiorMotivo = motivos.reduce((m, x) => Math.max(m, Number(x.cost) || 0), 0);
  const perdasSobreCompras = sum.comprasMes.total > 0
    ? ((sum.desperdicioMes.total / sum.comprasMes.total) * 100).toFixed(1).replace('.', ',')
    : null;

  pageEl.innerHTML = `
    <div class="stats-grid">
      <div class="stat">
        <div class="label">Ingredientes cadastrados</div>
        <div class="value">${sum.ingredientes}</div>
        <div class="hint">Cadastre e consulte em <a href="/pages/estoque/">Estoque</a></div>
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
        <div class="label">Valor em estoque</div>
        <div class="value">${fmtMoney(sum.valorEstoque.valor)}</div>
        <div class="hint">custo dos lotes com saldo</div>
      </div>
      <div class="stat ${sum.comunicados.naoLidos > 0 ? 'is-warn' : 'is-ok'}">
        <div class="label">Comunicados não lidos</div>
        <div class="value">${sum.comunicados.naoLidos}</div>
        <div class="hint">${sum.comunicados.ativos} no mural · <a href="/pages/comunicacao/">abrir mural</a></div>
      </div>
      <div class="stat ${sum.comprasMes.count > 0 ? 'is-ok' : ''}">
        <div class="label">Compras do mês</div>
        <div class="value">${sum.comprasMes.count}</div>
        <div class="hint">${sum.comprasMes.count > 0 ? `R$ ${sum.comprasMes.total.toFixed(2).replace('.', ',')} recebidos` : 'Nenhuma compra recebida no mês'}</div>
      </div>
      <div class="stat ${sum.desperdicioMes.count > 0 ? 'is-danger' : ''}">
        <div class="label">Desperdício do mês</div>
        <div class="value">${fmtMoney(sum.desperdicioMes.total)}</div>
        <div class="hint">${sum.desperdicioMes.count > 0 ? `${sum.desperdicioMes.count} registro(s) em <a href="/pages/desperdicio/">Desperdício</a>` : 'Nenhuma perda registrada no mês'}</div>
      </div>
      <div class="stat is-ok">
        <div class="label">Funcionários ativos</div>
        <div class="value">${sum.funcionariosAtivos}</div>
      </div>
    </div>

    <div class="alert alert-info">
      <div><strong>Etapa 5 concluída.</strong> Mural de comunicados com confirmação de leitura e central de relatórios com exportação em CSV.</div>
      <div class="spacer"></div>
      <a class="btn btn-outline btn-sm" href="/pages/comunicacao/">Comunicação</a>
      <a class="btn btn-outline btn-sm" href="/pages/relatorios/">Relatórios</a>
    </div>
    ${alertaValidade}
    <div class="card" style="margin-bottom:16px;">
      <div class="card__head" style="flex-wrap:wrap; gap:8px;">
        <h2>Resumo do mês</h2>
        <span class="sub">compras recebidas × desperdício registrado</span>
        <span class="spacer"></span>
        ${actions}
      </div>
      <div class="card__body">
        <div style="display:flex; gap:32px; flex-wrap:wrap; margin-bottom:18px;">
          <div>
            <div style="font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.4px;">Compras recebidas</div>
            <div style="font-size:21px; font-weight:700;">${fmtMoney(sum.comprasMes.total)}</div>
            <div class="hint">${sum.comprasMes.count} pedido(s) no mês</div>
          </div>
          <div>
            <div style="font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.4px;">Desperdício</div>
            <div style="font-size:21px; font-weight:700; color:${sum.desperdicioMes.total > 0 ? 'var(--danger)' : 'inherit'};">${fmtMoney(sum.desperdicioMes.total)}</div>
            <div class="hint">${sum.desperdicioMes.count} registro(s) no mês</div>
          </div>
          <div>
            <div style="font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.4px;">Perdas sobre compras</div>
            <div style="font-size:21px; font-weight:700;">${perdasSobreCompras ? `${perdasSobreCompras}%` : '—'}</div>
            <div class="hint">${perdasSobreCompras ? 'quanto do comprado virou perda' : 'sem compras recebidas no mês'}</div>
          </div>
        </div>
        ${motivos.length ? `
          <div style="font-size:13px; font-weight:600; margin-bottom:10px;">Principais motivos de perda</div>
          ${motivos.map((m) => `
            <div style="margin-bottom:9px;">
              <div style="display:flex; justify-content:space-between; font-size:13px;">
                <span>${esc(MOTIVO_LABEL[m.reason] || m.reason)}</span>
                <span><strong>${fmtMoney(m.cost)}</strong> <span class="cell-muted">· ${m.count} registro(s)</span></span>
              </div>
              <div style="height:6px; background:#eef1ef; border-radius:999px; overflow:hidden; margin-top:4px;">
                <div style="height:100%; width:${maiorMotivo > 0 ? Math.max(6, Math.round((m.cost / maiorMotivo) * 100)) : 0}%; background:var(--danger);"></div>
              </div>
            </div>`).join('')}`
          : '<div class="cell-muted" style="font-size:13px;">Nenhuma perda registrada neste mês.</div>'}
      </div>
    </div>
    <div class="card">
      <div class="card__head">
        <h2>Atividade recente</h2>
        <span class="sub">Registros da auditoria do sistema</span>
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
