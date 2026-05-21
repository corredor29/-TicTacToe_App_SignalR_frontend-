// ── UI: pantallas, modales, listas, toasts ────────────────────────────────

const UI = {
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  },

  toast(msg, dur = 3000) {
    const el = document.getElementById('toast');
    el.innerHTML = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), dur);
  },

  setError(msg) {
    document.getElementById('auth-error').textContent = msg;
  },

  closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
  },

  showModal(id) {
    document.getElementById(id)?.classList.add('open');
  },

  showInviteModal(from) {
    document.getElementById('invite-from').textContent = from;
    this.showModal('invite-modal');
  },

  showRematchModal(from) {
    document.getElementById('rematch-from').textContent = from;
    this.showModal('rematch-modal');
  },

  initGameScreen(opponent) {
    document.getElementById('result-banner').classList.remove('show');
    document.getElementById('result-text').textContent = '';
    this.showScreen('game-screen');
  },

  switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach((t, i) =>
      t.classList.toggle('active', (i === 0) === (tab === 'login')));
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    this.setError('');
  },

  renderUserListBasic(users) {
    const list = document.getElementById('user-list');
    if (list.children.length > 0) return;
    const mapped = users.map(u => ({
      username: u.key, isInPrivateRoom: u.value, statusId: 1, status: 'Disponible'
    }));
    this._buildList(mapped);
  },

  renderUserListFull(users) {
    this._buildList(users);
  },

  _buildList(users) {
    const list = document.getElementById('user-list');
    list.innerHTML = '';
    users.forEach(user => {
      const username = user.username || user.key;
      const inRoom   = user.isInPrivateRoom ?? user.value;
      const statusId = user.statusId ?? 1;
      const status   = user.status ?? 'Disponible';
      if (username.toLowerCase() === STATE.username?.toLowerCase()) return;

      const dotClass = statusId === 2 ? 'playing' : statusId === 3 ? 'dnd' : 'available';
      const canInvite = !inRoom && statusId === 1;

      const item = document.createElement('div');
      item.className = 'user-item';
      item.innerHTML = `
        <div class="user-info">
          <div class="user-dot ${dotClass}"></div>
          <div>
            <div class="user-name">${esc(username)}</div>
            <div class="user-status">${esc(status)}</div>
          </div>
        </div>
        ${canInvite ? `<button class="invite-btn" onclick="Actions.sendInvite('${esc(username)}')">RETAR</button>` : ''}
      `;
      list.appendChild(item);
    });

    document.getElementById('online-count-text').textContent =
      `${users.length} JUGADOR${users.length !== 1 ? 'ES' : ''} ONLINE`;
  },

  async showRanking() {
    this.showModal('ranking-modal');
    const { ok, data } = await getRanking();
    if (!ok) return;
    const tbody = document.getElementById('ranking-body');
    tbody.innerHTML = '';
    data.forEach((entry, i) => {
      const medal = ['🥇','🥈','🥉'][i] ?? `${i + 1}`;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${medal}</td>
        <td class="rank-name">${esc(entry.username)}</td>
        <td class="rank-w">${entry.wins}</td>
        <td class="rank-l">${entry.losses}</td>
        <td>${entry.draws}</td>
        <td>${entry.gamesPlayed}</td>
        <td>${entry.winRate}%</td>
      `;
      tbody.appendChild(tr);
    });
  },
};

function esc(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}