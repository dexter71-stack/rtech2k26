// Tela de login do Galeto Gestão.
document.getElementById('login-logo').innerHTML = logoSvg(42);

// Já logado? Vá direto ao dashboard.
api('/api/auth/me')
  .then(() => { location.href = '/pages/dashboard/'; })
  .catch(() => { /* não logado, permanece na tela */ });

const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const btn = document.getElementById('login-btn');

function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = 'flex';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.style.display = 'none';

  const identifier = document.getElementById('identifier').value.trim();
  const password = document.getElementById('password').value;
  if (!identifier || !password) {
    showError('Informe usuário e senha para entrar.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando...';
  try {
    await api('/api/auth/login', { method: 'POST', body: { identifier, password } });
    location.href = '/pages/dashboard/';
  } catch (err) {
    showError(err.message || 'Falha ao entrar. Tente novamente.');
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});
