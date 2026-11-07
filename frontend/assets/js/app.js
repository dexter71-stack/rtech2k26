// Layout compartilhado: sidebar, topbar, identidade visual e controles gerais.
// Cada página chama renderLayout({ page, title, description }) após carregar /api/auth/me.
const MENU = [
  {
    section: 'Operação',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/pages/dashboard/', icon: 'grid' },
      { id: 'estoque', label: 'Estoque', href: '/pages/estoque/', icon: 'box' },
      { id: 'desperdicio', label: 'Desperdício', href: '/pages/desperdicio/', icon: 'trash' },
      { id: 'validade', label: 'Lotes & Validade', href: '/pages/lotes/', icon: 'calendar' },
    ],
  },
  {
    section: 'Suprimentos',
    items: [
      { id: 'movimentacoes', label: 'Movimentações', href: '/pages/movimentacoes/', icon: 'cart' },
      { id: 'compras', label: 'Compras', href: '/pages/compras/', icon: 'bag', roles: ['admin', 'gerente'] },
      { id: 'fornecedores', label: 'Fornecedores', href: '/pages/fornecedores/', icon: 'truck' },
    ],
  },
  {
    section: 'Equipe & gestão',
    items: [
      { id: 'comunicacao', label: 'Comunicação', href: '/pages/comunicacao/', icon: 'bell' },
      { id: 'relatorios', label: 'Relatórios', href: '/pages/relatorios/', icon: 'chart' },
      { id: 'usuarios', label: 'Funcionários', href: '/pages/usuarios/', icon: 'users', adminOnly: true },
      { id: 'configuracoes', label: 'Configurações', href: '/pages/configuracoes/', icon: 'gear', adminOnly: true },
    ],
  },
];

const ICONS = {
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.5 11h10L20 7H6"/>',
  truck: '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  bell: '<path d="M17 15v-4a5 5 0 1 0-10 0v4l-2 3h14z"/><path d="M10 20h4"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M2 20h20"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19a6.5 6.5 0 0 1 13 0"/><path d="M15 5.5a3 3 0 0 1 0 5.7"/><path d="M17 13.5a6 6 0 0 1 4.5 5.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9L19 19M19 5l-2.1 2.1M7.1 16.9L5 19"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  leaf: '<path d="M4 20c0-8 5-14 16-16-1 11-7 15-12 15"/><path d="M4 20c3-6 7-9 12-11"/>',
};

function iconSvg(name, cls) {
  return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
    stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.box}</svg>`;
}

const ROLE_LABELS = { admin: 'Administrador', gerente: 'Gerente', funcionario: 'Funcionário' };

// Constrói sidebar + topbar e retorna o usuário logado.
async function renderLayout({ page, title, description }) {
  let user;
  let settings = null;
  try {
    // Nome do estabelecimento e janela de alerta vêm das configurações.
    const [me, config] = await Promise.all([
      api('/api/auth/me'),
      api('/api/configuracoes').catch(() => null),
    ]);
    user = me.user;
    settings = config ? config.settings : null;
  } catch (err) {
    return null; // api() já redireciona em caso de 401
  }
  window.APP_SETTINGS = settings || { establishment_name: 'Galeto São Luís', alertDays: 7 };

  const headerActions = document.getElementById('page-actions');
  const menuHtml = MENU.map((group) => {
    const links = group.items
      .filter((it) => (!it.adminOnly || user.role === 'admin') && (!it.roles || it.roles.includes(user.role)))
      .map((it) => `
        <a class="sidebar__link ${it.id === page ? 'is-active' : ''}" href="${it.href}">
          ${iconSvg(it.icon)}
          <span>${it.label}</span>
          ${it.etapa ? `<span class="tag-etapa">Et. ${it.etapa}</span>` : ''}
        </a>`)
      .join('');
    return `<div class="sidebar__section">${group.section}</div>${links}`;
  }).join('');

  const initials = user.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const shell = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar__brand">
        ${logoSvg(34)}
        <div class="brand-name">Galeto Gestão<small>${esc(window.APP_SETTINGS.establishment_name)}</small></div>
      </div>
      <nav class="sidebar__nav">${menuHtml}</nav>
      <div class="sidebar__user">
        <div class="avatar">${esc(initials)}</div>
        <div class="who"><strong>${esc(user.name)}</strong><span>${esc(ROLE_LABELS[user.role])}</span></div>
        <button class="btn-logout" id="btn-logout" title="Sair">${iconSvg('logout')}Sair</button>
      </div>
    </aside>
    <div class="backdrop" id="sidebar-backdrop"></div>
    <div class="app-main">
      <header class="topbar">
        <button class="menu-toggle" id="menu-toggle" aria-label="Abrir menu">${iconSvg('grid')}</button>
        <div>
          <h1>${title}</h1>
          ${description ? `<div class="desc">${description}</div>` : ''}
        </div>
        <div class="topbar__actions" id="topbar-actions">${headerActions ? headerActions.innerHTML : ''}</div>
      </header>
      <main class="page">${document.getElementById('page-content') ? document.getElementById('page-content').innerHTML : ''}</main>
    </div>`;

  document.getElementById('app-shell').innerHTML = shell;
  if (headerActions) headerActions.remove();

  // Menu mobile.
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  document.getElementById('menu-toggle').addEventListener('click', () => {
    sidebar.classList.add('is-open');
    backdrop.classList.add('is-open');
  });
  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-open');
  });

  // Saída do sistema.
  document.getElementById('btn-logout').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { /* segue o logout local */ }
    location.href = '/';
  });

  return user;
}

function requireAdminOrRedirect(user) {
  if (!user || user.role !== 'admin') {
    location.href = '/pages/dashboard/';
    return false;
  }
  return true;
}
