// ── Lógica del juego (renderizado del estado del servidor) ────────────────

const GAME = {
  renderState(gs) {
    // Nombres en scoreboard
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

    // Bloquear tablero si no es mi turno
    const isMyTurn = gs.currentTurnUser?.toLowerCase() === STATE.username?.toLowerCase();
    board.classList.toggle('blocked', !isMyTurn || gs.status !== 'InProgress');

    // Indicador de turno
    const turnEl = document.getElementById('turn-indicator');
    if (gs.status === 'InProgress') {
      const who = isMyTurn ? 'TU TURNO' : `TURNO DE ${gs.currentTurnUser?.toUpperCase()}`;
      const sym = gs.currentTurnSymbol;
      turnEl.innerHTML = `<span class="sym-${sym.toLowerCase()}">${sym}</span> ${who}`;
      turnEl.className = 'turn-indicator active';
    } else {
      turnEl.textContent = '';
      turnEl.className = 'turn-indicator';
    }

    // Highlight scoreboard activo
    document.getElementById('score-x').classList.toggle('active', gs.currentTurnSymbol === 'X' && gs.status === 'InProgress');
    document.getElementById('score-o').classList.toggle('active', gs.currentTurnSymbol === 'O' && gs.status === 'InProgress');

    // Resultado
    if (gs.status === 'Won') {
      const iWon = gs.winner?.toLowerCase() === STATE.username?.toLowerCase();
      STATE.score[gs.winningSymbol]++;
      GAME.showResult(iWon ? '¡GANASTE!' : 'PERDISTE', iWon ? 'win' : 'lose');
    } else if (gs.status === 'Draw') {
      STATE.score.draws++;
      GAME.showResult('EMPATE', 'draw');
    }

    // Actualizar marcador
    document.getElementById('score-x-num').textContent = STATE.score.X;
    document.getElementById('score-o-num').textContent = STATE.score.O;
    document.getElementById('score-draws').textContent = STATE.score.draws;
  },

  showResult(text, type) {
    const banner = document.getElementById('result-banner');
    const el     = document.getElementById('result-text');
    el.textContent = text;
    el.className   = `result-text result-${type}`;
    banner.classList.add('show');
    document.getElementById('board').classList.add('blocked');
    // Efecto de píxeles
    GAME.spawnPixels(type);
  },

  spawnPixels(type) {
    const colors = { win: ['#00ff88','#ffff00','#ff6600'], lose: ['#ff0044','#ff6600'], draw: ['#888','#aaa'] };
    const palette = colors[type] || colors.draw;
    const wrap = document.getElementById('board-wrap');
    for (let i = 0; i < 24; i++) {
      const px = document.createElement('div');
      px.className = 'pixel-burst';
      px.style.cssText = `
        left:${20+Math.random()*60}%;top:${20+Math.random()*60}%;
        background:${palette[Math.floor(Math.random()*palette.length)]};
        animation-delay:${Math.random()*0.5}s;
        width:${4+Math.random()*8}px;height:${4+Math.random()*8}px;
      `;
      wrap.appendChild(px);
      setTimeout(() => px.remove(), 1200);
    }
  },

  async makeMove(pos) {
    const gs = STATE.gameState;
    if (!gs || gs.status !== 'InProgress') return;
    if (gs.currentTurnUser?.toLowerCase() !== STATE.username?.toLowerCase()) return;
    if (gs.board[pos]) return;
    await HUB.sendMove(STATE.opponent, pos);
  },
};