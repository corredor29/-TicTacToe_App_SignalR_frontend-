// ── SignalR Hub ───────────────────────────────────────────────────────────

async function connectHub() {
  const conn = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, { accessTokenFactory: () => STATE.accessToken })
    .withAutomaticReconnect()
    .build();

  conn.on('UserConnected', async () => {
    await conn.invoke('AddUserConnectionId', STATE.username);
  });

  conn.on('OnlineUsers', (users) => {
    UI.renderUserListBasic(users);
  });

  conn.on('OnlineUsersPresenceUpdated', (users) => {
    UI.renderUserListFull(users);
  });

  conn.on('RequestPrivateRoom', (msg) => {
    STATE.pendingFrom = msg.from;
    UI.showInviteModal(msg.from);
  });

  conn.on('RejectPrivateRoomRequest', (msg) => {
    UI.closeModal('waiting-modal');
    UI.toast(`${msg.from} rechazó tu reto`);
  });

  conn.on('OpenPrivateRoom', (msg) => {
    UI.closeModal('waiting-modal');
    STATE.opponent = msg.from;
    UI.initGameScreen(msg.from);
  });

  conn.on('GameStateUpdated', (gs) => {
    STATE.gameState = gs;
    STATE.opponent  = gs.playerX === STATE.username ? gs.playerO : gs.playerX;
    GAME.renderState(gs);
  });

  conn.on('GameError', (error, gs) => {
    UI.toast(`⚠ ${error}`);
    if (gs) { STATE.gameState = gs; GAME.renderState(gs); }
  });

  conn.on('ClosePrivateRoom', (msg) => {
    UI.toast(`${msg.from} abandonó la partida`);
    STATE.opponent  = null;
    STATE.gameState = null;
    UI.showScreen('lobby-screen');
  });

  conn.on('RematchRequested', (msg) => {
    STATE.pendingRematchFrom = msg.from;
    UI.showRematchModal(msg.from);
  });

  conn.on('RematchAccepted', () => {
    UI.closeModal('rematch-waiting-modal');
    document.getElementById('result-banner').classList.remove('show');
    UI.toast('¡Revancha aceptada!');
  });

  conn.on('RematchRejected', (decision) => {
    UI.closeModal('rematch-waiting-modal');
    UI.toast(`${decision.from} rechazó la revancha`);
  });

  await conn.start();
  STATE.connection = conn;
}

async function hubInvoke(method, ...args) {
  if (!STATE.connection) return;
  await STATE.connection.invoke(method, ...args);
}

// Acciones del hub
const HUB = {
  addConnectionId: (name)    => hubInvoke('AddUserConnectionId', name),
  requestRoom:     (to)      => hubInvoke('RequestPrivateRoom', { to, content: 'invite' }),
  rejectRoom:      (to)      => hubInvoke('RejectPrivateRoomRequest', { to }),
  createRoom:      (to)      => hubInvoke('CreatePrivateRoom', { to, content: 'accept' }),
  closeRoom:       (to)      => hubInvoke('ClosePrivateRoom', { to, content: 'ClosePrivateRoom' }),
  sendMove:        (to, pos) => hubInvoke('SendPrivateRoomMessage', { to, position: pos }),
  setStatus:       (id)      => hubInvoke('SetAvailabilityStatus', id),
  requestRematch:  (to)      => hubInvoke('RequestRematch', { to }),
  respondRematch:  (to, acc) => hubInvoke('RespondRematch', { to, accepted: acc }),
};