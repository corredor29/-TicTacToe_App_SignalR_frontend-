// ── Acciones del usuario (conectan UI → Hub → API) ────────────────────────

const Actions = {

  // AUTH
  async login() {
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;
    if (!username || !password) return UI.setError('COMPLETA TODOS LOS CAMPOS');
    const { ok, data } = await login(username, password);
    if (!ok) return UI.setError(data.message || 'ERROR AL INICIAR SESIÓN');
    await Actions._enterApp(data, username);
  },

  async register() {
    const username = document.getElementById('reg-user').value.trim();
    const password = document.getElementById('reg-pass').value;
    if (!username || !password) return UI.setError('COMPLETA TODOS LOS CAMPOS');
    const { ok, data } = await register(username, password);
    if (!ok) return UI.setError(data.message || 'ERROR AL REGISTRARSE');
    UI.toast('✓ CUENTA CREADA — INICIA SESIÓN');
    UI.switchTab('login');
    document.getElementById('login-user').value = username;
  },

  async googleLogin(response) {
    const { ok, data } = await googleAuth(response.credential);
    if (!ok) return UI.setError(data.message || 'ERROR CON GOOGLE');
    const payload  = JSON.parse(atob(data.accessToken.split('.')[1]));
    const username = payload.unique_name || payload.name || payload.sub;
    await Actions._enterApp(data, username);
  },

  async _enterApp(tokenData, username) {
    STATE.accessToken  = tokenData.accessToken;
    STATE.refreshToken = tokenData.refreshToken;
    STATE.username     = username;
    UI.setError('');
    UI.showScreen('lobby-screen');
    document.getElementById('me-badge').textContent = username.toUpperCase();
    await connectHub();
  },

  logout() {
    if (STATE.connection) STATE.connection.stop();
    Object.assign(STATE, { accessToken: null, refreshToken: null, username: null, connection: null });
    UI.showScreen('auth-screen');
  },

  // INVITE
  async sendInvite(to) {
    STATE.opponent = to;
    document.getElementById('waiting-to').textContent = to.toUpperCase();
    UI.showModal('waiting-modal');
    await HUB.requestRoom(to);
  },

  cancelInvite() {
    UI.closeModal('waiting-modal');
    STATE.opponent = null;
  },

  async acceptInvite() {
    const from = STATE.pendingFrom;
    UI.closeModal('invite-modal');
    STATE.opponent = from;
    UI.initGameScreen(from);
    await HUB.createRoom(from);
  },

  async rejectInvite() {
    UI.closeModal('invite-modal');
    await HUB.rejectRoom(STATE.pendingFrom);
    STATE.pendingFrom = null;
  },

  // GAME
  async leaveGame() {
    if (STATE.connection && STATE.opponent) await HUB.closeRoom(STATE.opponent);
    STATE.opponent  = null;
    STATE.gameState = null;
    STATE.score     = { X: 0, O: 0, draws: 0 };
    UI.showScreen('lobby-screen');
  },

  // REMATCH
  async requestRematch() {
    if (!STATE.opponent) return;
    document.getElementById('rematch-waiting-to').textContent = STATE.opponent.toUpperCase();
    UI.showModal('rematch-waiting-modal');
    document.getElementById('result-banner').classList.remove('show');
    await HUB.requestRematch(STATE.opponent);
  },

  async acceptRematch() {
    UI.closeModal('rematch-modal');
    await HUB.respondRematch(STATE.pendingRematchFrom, true);
    STATE.pendingRematchFrom = null;
  },

  async rejectRematch() {
    UI.closeModal('rematch-modal');
    await HUB.respondRematch(STATE.pendingRematchFrom, false);
    STATE.pendingRematchFrom = null;
  },

  cancelRematch() {
    UI.closeModal('rematch-waiting-modal');
  },

  // STATUS
  async setStatus(id) {
    await HUB.setStatus(id);
    document.querySelectorAll('.status-btn').forEach((b, i) =>
      b.classList.toggle('active', i + 1 === id));
    const labels = { 1: 'DISPONIBLE', 2: 'JUGANDO', 3: 'NO MOLESTAR' };
    UI.toast(`◉ ${labels[id]}`);
  },
};

// Enter key en auth
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const authActive   = document.getElementById('auth-screen').classList.contains('active');
  const loginVisible = !document.getElementById('login-form').classList.contains('hidden');
  if (authActive && loginVisible)  Actions.login();
  if (authActive && !loginVisible) Actions.register();
});

// Google callback global
function handleGoogleLogin(response) { Actions.googleLogin(response); }
