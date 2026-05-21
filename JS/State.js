// ── Estado global compartido ──────────────────────────────────────────────
const STATE = {
  accessToken:        null,
  refreshToken:       null,
  username:           null,
  connection:         null,
  opponent:           null,
  pendingFrom:        null,
  pendingRematchFrom: null,
  gameState:          null,
  score:              { X: 0, O: 0, draws: 0 },
};

const API_BASE = 'https://tictactoe-app-signalr.onrender.com/api';
const HUB_URL  = 'https://tictactoe-app-signalr.onrender.com/hubs/connectionuser';