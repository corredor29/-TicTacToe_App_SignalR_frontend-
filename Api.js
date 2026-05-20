/* ═══════════════════════════════════════════════════════════════════════════
   CONFIG — apunta a tu API local o desplegada
   ══════════════════════════════════════════════════════════════════════════ */
const API = 'http://localhost:5177/api';
const HUB = 'http://localhost:5177/hubs/connectionuser';/* ═══════════════════════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════════════════════ */
let state = {
  accessToken:  null,
  refreshToken: null,
  username:     null,
  connection:   null,
  // game
  opponent:     null,
  mySymbol:     null,   
  board:        Array(9).fill(null),
  currentTurn:  'X',
  gameActive:   false,
  score:        { X: 0, O: 0, draws: 0 },
  // invite
  pendingFrom:  null,
};

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

/* ═══════════════════════════════════════════════════════════════════════════
   UTILS
   ══════════════════════════════════════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function toast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

function setError(msg) {
  document.getElementById('auth-error').textContent = msg;
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUTH TAB
   ══════════════════════════════════════════════════════════════════════════ */
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) =>
    t.classList.toggle('active', (i === 0) === (tab === 'login'))
  );
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  setError('');
}

/* ═══════════════════════════════════════════════════════════════════════════
   API CALLS
   ══════════════════════════════════════════════════════════════════════════ */
async function apiFetch(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data, status: res.status };
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
  await connectHub();
  showScreen('lobby-screen');
  document.getElementById('me-badge').textContent = username;
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
  state = { ...state, accessToken: null, refreshToken: null, username: null, connection: null };
  showScreen('auth-screen');
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIGNALR HUB
   ══════════════════════════════════════════════════════════════════════════ */
async function connectHub() {
  const conn = new signalR.HubConnectionBuilder()
    .withUrl(HUB, {
      accessTokenFactory: () => state.accessToken,
    })
    .withAutomaticReconnect()
    .build();

  /* ── Eventos del servidor ── */

    conn.on('UserConnected', async () => {
        await conn.invoke('AddUserConnectionId', state.username);
    });

    conn.on('OnlineUsers', (users) => {
        console.log('OnlineUsers recibido:', JSON.stringify(users));
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
        // Este evento lo recibe el invitador (quien hizo sendInvite)
        closeModal('invite-modal');
        closeModal('waiting-modal');
        startGame(msg.from, 'X'); // el invitador es X y va primero
    });;

  conn.on('NewPrivateMessage', (msg) => {
    receiveMove(msg.position);
  });

  conn.on('ClosePrivateRoom', (msg) => {
    if (state.gameActive) {
      endGameForcibly(msg.from);
    }
  });

  await conn.start();
  state.connection = conn;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOBBY — USERS LIST
   ══════════════════════════════════════════════════════════════════════════ */
function renderUserList(users) {
  const list = document.getElementById('user-list');
  list.innerHTML = '';

  let onlineCount = 0;
  users.forEach((user) => {
    const username = user.key;
    const inRoom = user.value;

    if (username === state.username) return;
    onlineCount++;

    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <div class="user-info">
        <div class="user-dot ${inRoom ? 'busy' : ''}"></div>
        <div>
          <div class="user-name">${escHtml(username)}</div>
          <div class="user-status">${inRoom ? 'En partida' : 'Disponible'}</div>
        </div>
      </div>
      ${!inRoom ? `<button class="invite-btn" onclick="sendInvite('${escHtml(username)}')">Retar</button>` : ''}
    `;
    list.appendChild(item);
  });

  const total = users.length;
  document.getElementById('online-count-text').textContent =
    `${total} jugador${total !== 1 ? 'es' : ''} en línea`;
}
/* ═══════════════════════════════════════════════════════════════════════════
   INVITE FLOW
   ══════════════════════════════════════════════════════════════════════════ */
async function sendInvite(to) {
  state.opponent = to;
  document.getElementById('waiting-to').textContent = to;
  document.getElementById('waiting-modal').classList.add('open');

  await state.connection.invoke('RequestPrivateRoom', {
    from: state.username,
    to,
    content: 'invite',
  });
}

function cancelInvite() {
  closeModal('waiting-modal');
  state.opponent = null;
}

async function acceptInvite() {
    const from = state.pendingFrom;
    closeModal('invite-modal');

    await state.connection.invoke('CreatePrivateRoom', {
        from: state.username,
        to: from,
        content: 'accept',
    });

    startGame(from, 'O'); 
}

async function rejectInvite() {
  closeModal('invite-modal');
  await state.connection.invoke('RejectPrivateRoomRequest', {
    from: state.username,
    to: state.pendingFrom,
  });
  state.pendingFrom = null;
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

/* ═══════════════════════════════════════════════════════════════════════════
   GAME LOGIC
   ══════════════════════════════════════════════════════════════════════════ */
function startGame(opponent, mySymbol) {
  state.opponent   = opponent;
  state.mySymbol   = mySymbol;
  state.board      = Array(9).fill(null);
  state.currentTurn = 'X';
  state.gameActive = true;

  // El que invitó (X) va primero
  if (mySymbol === 'X') {
    state.opponent = opponent;
  }

  // Configurar scoreboard
  const xName = mySymbol === 'X' ? state.username : opponent;
  const oName = mySymbol === 'O' ? state.username : opponent;
  document.getElementById('score-x-name').textContent = xName;
  document.getElementById('score-o-name').textContent = oName;
  updateScore();

  renderBoard();
  showScreen('game-screen');
  updateTurnIndicator();
}

function renderBoard() {
  const cells = document.querySelectorAll('.cell');
  const board  = document.getElementById('board');

  cells.forEach((cell, i) => {
    const val = state.board[i];
    cell.className = 'cell' + (val ? ` taken ${val.toLowerCase()}-mark` : '');
    cell.innerHTML = val
      ? `<span class="cell-mark">${val}</span>`
      : '';
  });

  // Block if not my turn
  const myTurn = state.currentTurn === state.mySymbol;
  board.classList.toggle('blocked', !myTurn || !state.gameActive);
}

function updateTurnIndicator() {
  const el = document.getElementById('turn-indicator');
  if (!state.gameActive) { el.innerHTML = ''; return; }

  const isMyTurn = state.currentTurn === state.mySymbol;
  const name = isMyTurn ? 'Tu turno' : `Turno de ${state.opponent}`;
  const cls  = state.currentTurn === 'X' ? 'x-turn' : 'o-turn';
  el.innerHTML = `<span class="${cls}">${name} (${state.currentTurn})</span>`;
}

async function makeMove(pos) {
  if (!state.gameActive) return;
  if (state.currentTurn !== state.mySymbol) return;
  if (state.board[pos]) return;

  applyMove(pos, state.mySymbol);

  // Enviar al oponente
  const to = state.opponent;
  await state.connection.invoke('SendPrivateRoomMessage', {
    from: state.username,
    to,
    position: pos,
  });
}

function receiveMove(pos) {
  const opponentSymbol = state.mySymbol === 'X' ? 'O' : 'X';
  applyMove(pos, opponentSymbol);
}

function applyMove(pos, symbol) {
  state.board[pos] = symbol;
  state.currentTurn = symbol === 'X' ? 'O' : 'X';
  renderBoard();
  updateTurnIndicator();

  const result = checkResult();
  if (result) setTimeout(() => showResult(result), 200);
}

function checkResult() {
  const b = state.board;
  for (const [a, c, d] of WIN_LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return { winner: b[a], line: [a, c, d] };
    }
  }
  if (b.every(v => v)) return { winner: null };
  return null;
}

function showResult(result) {
  state.gameActive = false;
  const banner = document.getElementById('result-banner');
  const text   = document.getElementById('result-text');

  if (result.winner) {
    // Highlight winning cells
    result.line.forEach(i => {
      document.querySelectorAll('.cell')[i].classList.add('win-cell');
    });

    const iWon = result.winner === state.mySymbol;
    text.textContent = iWon ? '¡Ganaste! 🎉' : `Ganó ${state.opponent}`;
    text.style.color = iWon ? 'var(--accent)' : 'var(--accent2)';
    state.score[result.winner]++;
  } else {
    text.textContent = 'Empate';
    text.style.color = 'var(--muted)';
    state.score.draws++;
  }

  updateScore();
  banner.classList.add('show');
  document.getElementById('board').classList.add('blocked');
}

function updateScore() {
  const xName = document.getElementById('score-x-name').textContent;
  const isXMe = xName === state.username;
  document.getElementById('score-x-num').textContent = state.score.X;
  document.getElementById('score-o-num').textContent = state.score.O;
  document.getElementById('score-draws').textContent = state.score.draws;

  // Active player highlight
  document.getElementById('score-x').classList.toggle('active', state.currentTurn === 'X');
  document.getElementById('score-o').classList.toggle('active', state.currentTurn === 'O');
}

function resetBoard() {
  state.board       = Array(9).fill(null);
  state.currentTurn = 'X';
  state.gameActive  = true;

  document.getElementById('result-banner').classList.remove('show');
  renderBoard();
  updateTurnIndicator();
  updateScore();
}

async function leaveGame() {
  if (state.connection && state.opponent) {
    await state.connection.invoke('ClosePrivateRoom', {
      from: state.username,
      to: state.opponent,
      content: 'ClosePrivateRoom',
    });
  }
  state.opponent  = null;
  state.gameActive = false;
  state.score     = { X: 0, O: 0, draws: 0 };
  showScreen('lobby-screen');
}

function endGameForcibly(whoLeft) {
  state.gameActive = false;
  const banner = document.getElementById('result-banner');
  const text   = document.getElementById('result-text');
  text.textContent = `${whoLeft} abandonó`;
  text.style.color = 'var(--muted)';
  banner.classList.add('show');
}

/* ─── Enter key support ─ */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const loginVisible = !document.getElementById('login-form').classList.contains('hidden');
    const authActive   = document.getElementById('auth-screen').classList.contains('active');
    if (authActive && loginVisible) doLogin();
    if (authActive && !loginVisible) doRegister();
  }
});
