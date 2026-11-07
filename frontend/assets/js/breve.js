// Página dos módulos ainda não habilitados nas próximas etapas.
// Aviso honesto: sem dados fictícios, apenas o planejamento da etapa.
(async () => {
  const MODULES = {
    configuracoes: {
      title: 'Configurações',
      stage: 'Etapa 6',
      desc: 'Ajustes do sistema, auditoria completa e parâmetros da galeteria.',
      icon: 'gear',
    },
  };

  const params = new URLSearchParams(location.search);
  const key = params.get('m') || 'configuracoes';
  const mod = MODULES[key] || MODULES.configuracoes;

  const user = await renderLayout({
    page: key,
    title: mod.title,
    description: `Módulo planejado para a ${mod.stage.toLowerCase()} do projeto.`,
  });
  if (!user) return;

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
      Já estão prontos: autenticação com permissões, funcionários, auditoria, estoque e lotes,
      fornecedores e compras, movimentações, desperdício, comunicação interna e relatórios.
    </div>`;
})();
