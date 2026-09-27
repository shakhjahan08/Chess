(() => {
'use strict';

const $ = id => document.getElementById(id);
const files = 'abcdefgh';

const symbols = {
  w: { p: '♙', r: '♖', n: '♘', b: '♗', q: '♕', k: '♔' },
  b: { p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚' }
};

const themes = [
  ['royal', '#ead6b0', '#718e6b'],
  ['classic', '#f0d9b5', '#b58863'],
  ['ocean', '#d7eef2', '#39738a'],
  ['forest', '#e8e0b8', '#557b45'],
  ['neon', '#d8f8ff', '#3656a3']
];

const state = {
  name: localStorage.getItem('chessName') || 'Player',
  theme: localStorage.getItem('chessTheme') || 'royal',
  chess: new Chess(),
  selected: null,
  lastMove: null,
  flipped: false,
  peer: null,
  connection: null,
  host: false,
  room: null,
  color: null,
  opponentName: 'Waiting...'
};

/* Web Audio Synthesizer */
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'move') {
      osc.frequency.setValueAtTime(320, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.start(); osc.stop(audioCtx.currentTime + 0.08);
    } else if (type === 'capture') {
      osc.frequency.setValueAtTime(180, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.start(); osc.stop(audioCtx.currentTime + 0.12);
    }
  } catch(e) {}
}

function randomRoom() {
  let res = '';
  for (let i = 0; i < 6; i++) res += Math.floor(Math.random() * 10);
  return res;
}

function setRoomStatus(text, online = false) {
  $('roomStatus').innerHTML =
    `<span class="connection-dot ${online ? 'online' : ''}"></span>${text}`;
}

function setStatus(text, cls = '') {
  $('status').className = 'status ' + cls;
  $('status').innerHTML = `<span class="label">Game</span><span>${text}</span>`;
}

function applyTheme() {
  const theme = themes.find(t => t[0] === state.theme) || themes[0];
  document.documentElement.style.setProperty('--light', theme[1]);
  document.documentElement.style.setProperty('--dark', theme[2]);

  document.querySelectorAll('.theme').forEach(el => {
    const radio = el.querySelector('input[type="radio"]');
    const isActive = radio ? radio.checked : false;
    el.classList.toggle('active', isActive);
  });
}

function profile() {
  $('playerName').textContent = state.name;
  $('myName').textContent = state.name;
  $('myAvatar').textContent = (state.name[0] \vert{}\vert{} 'P').toUpperCase();$('nameInput').value = state.name;
  applyTheme();
  updatePlayerLabels();
}

function updatePlayerLabels() {
  if (state.color === 'b') {
    $('myColorLabel').textContent = 'Black';$('opponentColorLabel').textContent = 'White';
  } else {
    $('myColorLabel').textContent = 'White';$('opponentColorLabel').textContent = 'Black';
  }
}

function buildThemes() {
  const grid = $('themeGrid');
  grid.innerHTML = '';
  themes.forEach(([key, a, b]) => {
    const label = document.createElement('label');
    label.className = `theme ${key === state.theme ? 'active' : ''}`;
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '10px';
    label.style.cursor = 'pointer';

    label.innerHTML = `
      <input type="radio" name="chessThemeOption" value="${key}" ${key === state.theme ? 'checked' : ''} style="width:auto;margin:0;">
      <div style="flex:1;">
        <div class="preview" style="--a:${a};--b:${b}"></div>
        <b>${key.charAt(0).toUpperCase() + key.slice(1)}</b>
      </div>
    `;

    const radio = label.querySelector('input');
    radio.addEventListener('change', () => {
      state.theme = key;
      applyTheme();
    });

    grid.appendChild(label);
  });
}

function updateRoomUI() {
  const room = state.room || 'Not connected';
  $('roomDisplay').textContent = room;
  $('headerRoom').textContent = room;
  $('opponentName').textContent = state.opponentName;

  const isMyTurn = state.color && state.chess.turn() === state.color;
  $('whiteTurn').textContent = (state.color === 'w' && isMyTurn) \vert{}\vert{} (state.color === 'b' && !isMyTurn) ? 'TURN' : '';$('blackTurn').textContent = (state.color === 'b' && isMyTurn) || (state.color === 'w' && !isMyTurn) ? 'TURN' : '';

  updatePlayerLabels();
}

function getKingSquare(color) {
  const board = state.chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === color) {
        return files[c] + (8 - r);
      }
    }
  }
  return null;
}

function updateMovesHistory() {
  const history = state.chess.history({ verbose: true });
  const container = $('moves');
  container.innerHTML = '';

  for (let i = 0; i < history.length; i += 2) {
    const div = document.createElement('div');
    div.className = 'move';
    const moveNum = Math.floor(i / 2) + 1;
    const whiteMove = history[i] ? history[i].san : '';
    const blackMove = history[i + 1] ? history[i + 1].san : '';

    div.innerHTML = `<em>${moveNum}.</em><span>${whiteMove}</span><span>${blackMove}</span>`;
    container.appendChild(div);
  }
  container.scrollTop = container.scrollHeight;
}

function updateStatus() {
  if (state.chess.in_checkmate()) {
    const winner = state.chess.turn() === 'w' ? 'Black' : 'White';
    setStatus(`Checkmate — ${winner} wins`, 'mate');
    return;
  }
  if (state.chess.in_check()) {
    setStatus(`Check — ${state.chess.turn() === 'w' ? 'White' : 'Black'} is in check`, 'check');
    return;
  }
  if (state.chess.in_draw()) {
    setStatus('Draw');
    return;
  }
  if (!state.connection) {
    setStatus('Create or join a room to start');
    return;
  }
  if (!state.color) {
    setStatus('Waiting for opponent to join...');
    return;
  }

  if (state.chess.turn() === state.color) {
    setStatus('Your turn');
  } else {
    setStatus(`${state.chess.turn() === 'w' ? 'White' : 'Black'} to move`);
  }
}

function executeMove(moveObj, sendNetwork = false) {
  const destPiece = state.chess.get(moveObj.to);
  const move = state.chess.move(moveObj);
  if (!move) return false;

  state.lastMove = { from: move.from, to: move.to };
  playSound(destPiece ? 'capture' : 'move');

  if (sendNetwork && state.connection && state.connection.open) {
    state.connection.send({ type: 'move', move: moveObj });
  }

  state.selected = null;
  render();
  return true;
}

function onSquareClick(sq) {
  initAudio();
  if (!state.connection || !state.connection.open) return;
  if (!state.color || state.chess.turn() !== state.color) return;
  if (state.chess.game_over()) return;

  const piece = state.chess.get(sq);

  if (state.selected) {
    const legalMoves = state.chess.moves({ square: state.selected, verbose: true });
    const targetMove = legalMoves.find(m => m.to === sq);

    if (targetMove) {
      executeMove({ from: state.selected, to: sq, promotion: 'q' }, true);
      return;
    }
    state.selected = (piece && piece.color === state.color) ? sq : null;
  } else if (piece && piece.color === state.color) {
    state.selected = sq;
  }
  render();
}

function render() {
  const board = $('board');
  board.innerHTML = '';
  board.classList.remove('checkmate-shake');

  if (state.chess.in_checkmate()) {
    void board.offsetWidth;
    board.classList.add('checkmate-shake');
  }

  const inCheck = state.chess.in_check();
  const inMate = state.chess.in_checkmate();
  const activeTurn = state.chess.turn();
  const kingSq = (inCheck || inMate) ? getKingSquare(activeTurn) : null;

  let legalTargets = [];
  if (state.selected && state.color === state.chess.turn()) {
    legalTargets = state.chess.moves({ square: state.selected, verbose: true }).map(m => m.to);
  }

  const rows = state.flipped ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const cols = state.flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  for (let r of rows) {
    for (let c of cols) {
      const sq = files[c] + (r + 1);
      const isLight = (r + c) % 2 !== 0;
      const piece = state.chess.get(sq);

      const button = document.createElement('button');
      button.className = `square ${isLight ? 'light' : 'dark'}`;

      if (state.selected === sq) button.classList.add('selected');
      if (legalTargets.includes(sq)) button.classList.add('legal');
      if (state.lastMove && (state.lastMove.from === sq || state.lastMove.to === sq)) {
        button.classList.add('last');
      }

      if (sq === kingSq) {
        button.classList.add(inMate ? 'king-mate' : 'king-check');
      }

      if (piece) {
        const span = document.createElement('span');
        span.className = 'piece';
        span.textContent = symbols[piece.color][piece.type];
        button.appendChild(span);
      }

      button.addEventListener('click', () => onSquareClick(sq));
      board.appendChild(button);
    }
  }

  updateRoomUI();
  updateMovesHistory();
  updateStatus();
}

/* PeerJS Networking via WebRTC */
function destroyPeer() {
  if (state.connection) {
    state.connection.close();
    state.connection = null;
  }
  if (state.peer) {
    state.peer.destroy();
    state.peer = null;
  }
  state.room = null;
  state.color = null;
  state.opponentName = 'Waiting...';
  state.host = false;
  state.selected = null;
  state.lastMove = null;
  state.chess.reset();
  setRoomStatus('Disconnected');
  render();
}

const peerConfig = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19020' },
      { urls: 'stun:stun1.l.google.com:19020' }
    ]
  }
};

function initPeer(id, isHost) {
  destroyPeer();
  state.host = isHost;
  state.room = id;

  const peerId = isHost ? `royal-chess-room-${id}` : undefined;
  state.peer = new Peer(peerId, peerConfig);

  state.peer.on('open', () => {
    if (isHost) {
      setRoomStatus('Room created. Share Room ID with opponent...');
      state.color = 'w';
      state.flipped = false;
      render();
    } else {
      connectToHost(id);
    }
  });

  state.peer.on('connection', conn => {
    if (isHost) {
      state.connection = conn;
      setupConnection();
    }
  });

  state.peer.on('error', err => {
    if (err.type === 'unavailable-id') {
      setRoomStatus('Room ID already exists! Try creating another.');
    } else if (err.type === 'peer-unavailable') {
      setRoomStatus('Room not found! Verify the Room ID.');
    } else {
      setRoomStatus(`Network Error: ${err.type}`);
    }
  });
}

function connectToHost(id) {
  setRoomStatus('Connecting to opponent...');
  const conn = state.peer.connect(`royal-chess-room-${id}`, { reliable: true });
  state.connection = conn;
  setupConnection();
}

function setupConnection() {
  const conn = state.connection;

  conn.on('open', () => {
    setRoomStatus('Connected', true);
    if (!state.host) {
      state.color = 'b';
      state.flipped = true;
    }
    conn.send({ type: 'handshake', name: state.name });
  });

  conn.on('data', data => {
    if (data.type === 'handshake') {
      state.opponentName = data.name || 'Opponent';
      if (state.host) {
        conn.send({ type: 'handshake-ack', name: state.name, fen: state.chess.fen() });
      }
      render();
    } else if (data.type === 'handshake-ack') {
      state.opponentName = data.name || 'Opponent';
      if (data.fen) state.chess.load(data.fen);
      render();
    } else if (data.type === 'move') {
      executeMove(data.move, false);
    } else if (data.type === 'newgame') {
      state.chess.reset();
      state.lastMove = null;
      state.selected = null;
      render();
    } else if (data.type === 'name-update') {
      state.opponentName = data.name;
      render();
    }
  });

  conn.on('close', () => {
    setRoomStatus('Opponent disconnected');
    state.opponentName = 'Disconnected';
    render();
  });
}

/* Event Handlers */
$('createBtn').addEventListener('click', () => {
  const id = randomRoom();
  $('roomInput').value = id;
  initPeer(id, true);
});

$('joinBtn').addEventListener('click', () => {
  const id = $('roomInput').value.trim();
  if (id.length < 4) {
    alert('Please enter a valid Room ID');
    return;
  }
  initPeer(id, false);
});

$('leaveBtn').addEventListener('click', () => {
  destroyPeer();
  $('roomInput').value = '';
});

$('flipBtn').addEventListener('click', () => {
  state.flipped = !state.flipped;
  render();
});

$('newGameBtn').addEventListener('click', () => {
  if (!state.connection || !state.connection.open) return;
  state.chess.reset();
  state.lastMove = null;
  state.selected = null;
  state.connection.send({ type: 'newgame' });
  render();
});

/* Settings Modal */
const modal = $('settingsMenu');
$('settingsBtn').addEventListener('click', () => {$('nameInput').value = state.name;
  modal.removeAttribute('hidden');
});

const closeModal = () => modal.setAttribute('hidden', '');
$('closeSettingsBtn').addEventListener('click', closeModal);$('cancelSettingsBtn').addEventListener('click', closeModal);

$('saveSettings').addEventListener('click', () => {
  const newName = $('nameInput').value.trim() || 'Player';
  state.name = newName;
  localStorage.setItem('chessName', state.name);
  localStorage.setItem('chessTheme', state.theme);

  profile();
  if (state.connection && state.connection.open) {
    state.connection.send({ type: 'name-update', name: state.name });
  }
  closeModal();
});

/* Init */
buildThemes();
profile();
render();

})();
