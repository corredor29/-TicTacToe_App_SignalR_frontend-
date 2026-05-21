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

const API_BASE = 'http://localhost:5177/api';
const HUB_URL  = 'http://localhost:5177/hubs/connectionuser';