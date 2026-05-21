// ── Llamadas HTTP al backend ──────────────────────────────────────────────

async function apiFetch(path, body, method = 'POST') {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${STATE.accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

async function login(username, password) {
  return apiFetch('/user/login', { username, password });
}

async function register(username, password) {
  return apiFetch('/user/register', { username, password });
}

async function googleAuth(idToken) {
  return apiFetch('/auth/google', { idToken });
}

async function getRanking() {
  return apiGet('/user/ranking');
}