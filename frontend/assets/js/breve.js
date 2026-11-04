// Página dos módulos ainda não habilitados nas próximas etapas.
// Aviso honesto: sem dados fictícios, apenas o planejamento da etapa.
(async () => {
  const MODULES = {
    estoque: { title: 'Estoque', stage: 'Etapa 2', desc: 'Cadastro de produtos, categorias, unidades, lotes, movimentações e alertas de estoque mínimo.', icon: 'box' },
    validade: { title: 'Validade', stage: 'Etapa 2', desc: 'Controle de lotes por validade, estados de vencimento e método FEFO (vence primeiro, sai primeiro).', icon: 'calendar' },
    compras: { title: 'Compras', stage: 'Etapa 3', desc: 'Lista de compras com sugestão automática, registro de compras e recebimento com lotes.', icon: 'cart' },
    fornecedores: { title: 'Fornecedores', stage: 'Etapa 3', desc: 'Cadastro de fornecedores, vínculo com ingredientes e histórico de preços.', icon: 'truck' },
    desperdicio: { title: 'Desperdício', stage: 'Etapa 4', desc: 'Registro de perdas por motivo, desconto automático do estoque e cálculo do prejuízo.', icon: 'trash' },
    comunicacao: { title: 'Comunicação', stage: 'Etapa 5', desc: 'Mural de comunicados internos com prioridade e marcação de lidos.', icon: 'bell' },
    relatorios: { title: 'Relatórios', stage: 'Etapa 5', desc: 'Central de relatórios de estoque, compras, desperdício e validade, com exportação.', icon: 'chart' },
    configuracoes: { title: 'Configurações', stage: 'Etapa 6', desc: 'Ajustes do sistema, auditoria completa e parâmetros da galeteria.', icon: 'gear' },
  };

  const params = new URLSearchParams(location.search);
  const key = params.get('m') || 'estoque';
  const mod = MODULES[key] || MODULES.estoque;

  const user = await renderLayout({ page: key, title: mod.title, description: `Módulo planejado para a ${mod.stage.toLowerCase()} do projeto.` });
  if (!user) return;
  if (mod.adminOnly) requireAdminOrRedirect(user);

  document.querySelector('.page').innerHTML = `
    <div class="card">
      <div class="card__body empty-state" style="padding: 46px 20px;">
        ${iconSvg(mod.icon)}
        <strong>Módulo “${mod.title}” em desenvolvimento</strong>
        <span>${mod.desc}</span>
        <span class="badge badge-info" style="margin-top:12px;">Disponível na ${mod.stage}</span>
      </div>
    </div>
    <div class="alert alert-info">
      <strong style="font-weight:700;">Sistema em construção por etapas.</strong>&nbsp;
      Na Etapa 1 (fundação) estão prontos: autenticação com permissões, gestão de funcionários,
      auditoria e a base do banco de dados (produtos, lotes e movimentações).
    </div>`;
})();
