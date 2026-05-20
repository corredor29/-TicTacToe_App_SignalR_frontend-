const API = 'http://localhost:5177/api';
const HUB = 'http://localhost:5177/hubs/connectionuser';

let state = {
  accessToken: null, refreshToken: null, username: null, connection: null,
  opponent: null,
  score: { X: 0, O: 0, draws: 0 },
  pendingFrom: null,
  gameState: null,   // GameStateDto del servidor
};

/* ── utils ── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function toast(msg, dur=3000) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove('show'), dur);
}
function setError(msg) { document.getElementById('auth-error').textContent = msg; }
function escHtml(str) {
  return str.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ── tabs ── */
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i)=>
    t.classList.toggle('active',(i===0)===(tab==='login')));
  document.getElementById('login-form').classList.toggle('hidden', tab!=='login');
  document.getElementById('register-form').classList.toggle('hidden', tab!=='register');
  setError('');
}

/* ── api ── */
async function apiFetch(path, body) {
  const res = await fetch(`${API}${path}`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
  });
  const data = await res.json().catch(()=>({}));
  return { ok: res.ok, data };
}

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  if (!username || !password) return setError('Completa todos los campos');
  const { ok, data } = await apiFetch('/user/login', { username, password });
  if (!ok) return setError(data.message || 'Error al iniciar sesión');
  state.accessToken  = data.accessToken;
  state.refreshToken = data.refreshToken;
  state.username     = username;
  setError('');
  showScreen('lobby-screen');
  document.getElementById('me-badge').textContent = username;
  await connectHub();
}

async function doRegister() {
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value;
  if (!username || !password) return setError('Completa todos los campos');
  const { ok, data } = await apiFetch('/user/register', { username, password });
  if (!ok) return setError(data.message || 'Error al registrarse');
  toast('Cuenta creada. Ahora inicia sesión.');
  switchTab('login');
  document.getElementById('login-user').value = username;
}

function doLogout() {
  if (state.connection) state.connection.stop();
  state = { ...state, accessToken:null, refreshToken:null, username:null, connection:null };
  showScreen('auth-screen');
}

/* ── hub ── */
async function connectHub() {
  const conn = new signalR.HubConnectionBuilder()
    .withUrl(HUB, { accessTokenFactory: () => state.accessToken })
    .withAutomaticReconnect()
    .build();

  conn.on('UserConnected', async () => {
    await conn.invoke('AddUserConnectionId', state.username);
  });

  conn.on('OnlineUsers', (users) => {
    renderUserList(users);
  });

  conn.on('RequestPrivateRoom', (msg) => {
    state.pendingFrom = msg.from;
    document.getElementById('invite-from').textContent = msg.from;
    document.getElementById('invite-modal').classList.add('open');
  });

  conn.on('RejectPrivateRoomRequest', (msg) => {
    closeModal('waiting-modal');
    toast(`${msg.from} rechazó tu invitación`);
  });

  conn.on('OpenPrivateRoom', (msg) => {
    // El invitador recibe esto — el servidor ya creó la sala y enviará GameStateUpdated
    closeModal('waiting-modal');
    state.opponent = msg.from;
    initGameScreen(msg.from);
  });

  // El servidor es la fuente de verdad del tablero
  conn.on('GameStateUpdated', (gameState) => {
    state.gameState = gameState;
    state.opponent  = gameState.playerX === state.username ? gameState.playerO : gameState.playerX;
    renderGameState(gameState);
  });

  conn.on('GameError', (error, gameState) => {
    toast(`Error: ${error}`);
    if (gameState) { state.gameState = gameState; renderGameState(gameState); }
  });

  conn.on('ClosePrivateRoom', (msg) => {
    toast(`${msg.from} abandonó la partida`);
    state.opponent  = null;
    state.gameState = null;
    showScreen('lobby-screen');
  });

  await conn.start();
  state.connection = conn;
}

/* ── lobby ── */
function renderUserList(users) {
  const list = document.getElementById('user-list');
  list.innerHTML = '';
  users.forEach((user) => {
    const username = user.key;
    const inRoom   = user.value;
    if (username.toLowerCase() === state.username?.toLowerCase()) return;
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <div class="user-info">
        <div class="user-dot ${inRoom?'busy':''}"></div>
        <div>
          <div class="user-name">${escHtml(username)}</div>
          <div class="user-status">${inRoom?'En partida':'Disponible'}</div>
        </div>
      </div>
      ${!inRoom?`<button class="invite-btn" onclick="sendInvite('${escHtml(username)}')">Retar</button>`:''}
    `;
    list.appendChild(item);
  });
  document.getElementById('online-count-text').textContent =
    `${users.length} jugador${users.length!==1?'es':''} en línea`;
}

/* ── invite ── */
async function sendInvite(to) {
  state.opponent = to;
  document.getElementById('waiting-to').textContent = to;
  document.getElementById('waiting-modal').classList.add('open');
  await state.connection.invoke('RequestPrivateRoom', { to, content:'invite' });
}

function cancelInvite() { closeModal('waiting-modal'); state.opponent = null; }

async function acceptInvite() {
  const from = state.pendingFrom;
  closeModal('invite-modal');
  state.opponent = from;
  initGameScreen(from);
  // CreatePrivateRoom dispara GameStateUpdated en ambos lados
  await state.connection.invoke('CreatePrivateRoom', { to: from, content:'accept' });
}

async function rejectInvite() {
  closeModal('invite-modal');
  await state.connection.invoke('RejectPrivateRoomRequest', { to: state.pendingFrom });
  state.pendingFrom = null;
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

/* ── game screen ── */
function initGameScreen(opponent) {
  document.getElementById('result-banner').classList.remove('show');
  document.getElementById('result-text').textContent = '—';
  showScreen('game-screen');
}

function renderGameState(gs) {
  // Scoreboard
  document.getElementById('score-x-name').textContent = gs.playerX;
  document.getElementById('score-o-name').textContent = gs.playerO;

  // Tablero
  const cells = document.querySelectorAll('.cell');
  const board  = document.getElementById('board');

  cells.forEach((cell, i) => {
    const val = gs.board[i];
    cell.className = 'cell' + (val ? ` taken ${val.toLowerCase()}-mark` : '');
    cell.innerHTML = val ? `<span class="cell-mark">${val}</span>` : '';
  });

  // Celdas ganadoras
  if (gs.winningPositions?.length) {
    gs.winningPositions.forEach(i => cells[i].classList.add('win-cell'));
  }

  // Turno
  const isMyTurn = gs.currentTurnUser?.toLowerCase() === state.username?.toLowerCase();
  board.classList.toggle('blocked', !isMyTurn || gs.status !== 'InProgress');

  const turnEl = document.getElementById('turn-indicator');
  if (gs.status === 'InProgress') {
    const cls = gs.currentTurnSymbol === 'X' ? 'x-turn' : 'o-turn';
    const who = isMyTurn ? 'Tu turno' : `Turno de ${gs.currentTurnUser}`;
    turnEl.innerHTML = `<span class="${cls}">${who} (${gs.currentTurnSymbol})</span>`;
  } else {
    turnEl.innerHTML = '';
  }

  // Active scoreboard highlight
  document.getElementById('score-x').classList.toggle('active', gs.currentTurnSymbol==='X' && gs.status==='InProgress');
  document.getElementById('score-o').classList.toggle('active', gs.currentTurnSymbol==='O' && gs.status==='InProgress');

  // Resultado
  if (gs.status === 'Won') {
    const iWon = gs.winner?.toLowerCase() === state.username?.toLowerCase();
    const text = iWon ? '¡Ganaste! 🎉' : `Ganó ${gs.winner}`;
    const color = iWon ? 'var(--accent)' : 'var(--accent2)';
    if (iWon) state.score[gs.winningSymbol]++;
    else state.score[gs.winningSymbol === 'X' ? 'X' : 'O']++;
    showResult(text, color);
  } else if (gs.status === 'Draw') {
    state.score.draws++;
    showResult('Empate', 'var(--muted)');
  }

  document.getElementById('score-x-num').textContent = state.score.X;
  document.getElementById('score-o-num').textContent = state.score.O;
  document.getElementById('score-draws').textContent = state.score.draws;
}

function showResult(text, color) {
  const el = document.getElementById('result-text');
  el.textContent = text;
  el.style.color = color;
  document.getElementById('result-banner').classList.add('show');
  document.getElementById('board').classList.add('blocked');
}

async function makeMove(pos) {
  const gs = state.gameState;
  if (!gs || gs.status !== 'InProgress') return;
  if (gs.currentTurnUser?.toLowerCase() !== state.username?.toLowerCase()) return;
  if (gs.board[pos]) return;

  await state.connection.invoke('SendPrivateRoomMessage', {
    to: state.opponent,
    position: pos
  });
}

async function resetBoard() {
  // Nueva partida: cerrar y volver al lobby (el backend no tiene reset de partida)
  document.getElementById('result-banner').classList.remove('show');
  await leaveGame();
}

async function leaveGame() {
  if (state.connection && state.opponent) {
    await state.connection.invoke('ClosePrivateRoom', {
      to: state.opponent,
      content: 'ClosePrivateRoom'
    });
  }
  state.opponent  = null;
  state.gameState = null;
  state.score     = { X:0, O:0, draws:0 };
  showScreen('lobby-screen');
}

/* ── enter key ── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const loginVisible = !document.getElementById('login-form').classList.contains('hidden');
  const authActive   = document.getElementById('auth-screen').classList.contains('active');
  if (authActive && loginVisible) doLogin();
  if (authActive && !loginVisible) doRegister();
});
