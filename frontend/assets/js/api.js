// Utilitários compartilhados do frontend: chamadas de API, escape de HTML,
// formatação e toasts. Todas as requisições usam credenciais da mesma origem.
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* resposta sem corpo */ }

  if (!res.ok) {
    const err = new Error((data && data.error && data.error.message) || `Erro ${res.status}`);
    err.status = res.status;
    err.details = data && data.error && data.error.details;
    if (res.status === 401 && !path.includes('/auth/')) {
      redirectToLogin();
    }
    throw err;
  }
  return data;
}

function redirectToLogin() {
  location.href = '/';
}

// Escapa texto antes de inserir via innerHTML (proteção contra XSS).
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Formata valores recebidos de DECIMAL (string) para pt-BR.
function fmtNum(value, maxDecimals = 3) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: maxDecimals });
}

function fmtMoney(value, maxDecimals = 2) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: maxDecimals });
}

function fmtDateTime(value) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return esc(value);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Toast global de sucesso/erro/aviso.
function toast(message, type = 'success') {
  let area = document.getElementById('toast-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'toast-area';
    document.body.appendChild(area);
  }
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast-error' : type === 'warn' ? ' toast-warn' : '');
  el.textContent = message;
  area.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// Modal simples reutilizável.
function openModal(id) { document.getElementById(id).classList.add('is-open'); }
function closeModal(id) { document.getElementById(id).classList.remove('is-open'); }

// Marca/símbolo: folha em gradiente neon dentro de um núcleo escuro.
function logoSvg(size = 36) {
  const uid = `gg-logo-${size}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="${uid}" x1="8" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
        <stop stop-color="#7dffc9"/><stop offset=".55" stop-color="#4cf5a8"/><stop offset="1" stop-color="#22d492"/>
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="38" height="38" rx="11" fill="#07130f" stroke="rgba(76,245,168,.38)"/>
    <path d="M27.5 10.5c-10.7 2-17.2 8.2-17.2 17.9" stroke="rgba(76,245,168,.25)" stroke-width="1" stroke-linecap="round"/>
    <path d="M11.5 28.5c0-9.4 6.7-15.4 17-17.3-1.2 13-8.7 16-14.2 15.5" stroke="url(#${uid})" stroke-width="2.2"
      stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="29.5" cy="10.2" r="1.6" fill="#4cf5a8"/>
  </svg>`;
}
