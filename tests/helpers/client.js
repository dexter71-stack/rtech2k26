// Cliente HTTP mínimo para os testes de integração: mantém o cookie de sessão
// entre as chamadas e devolve status, headers e corpo já parseado.
class Client {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  async request(method, path, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const cookie = this.cookieHeader();
    if (cookie) headers.Cookie = cookie;

    const res = await fetch(this.base + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      const split = pair.indexOf('=');
      if (split <= 0) continue;
      const name = pair.slice(0, split);
      const value = pair.slice(split + 1);
      if (!value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { /* resposta não JSON */ }
    return { status: res.status, headers: res.headers, data, text };
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  put(path, body) { return this.request('PUT', path, body); }

  login(identifier, password = 'Galeto@2026') {
    return this.post('/api/auth/login', { identifier, password });
  }
}

module.exports = Client;
