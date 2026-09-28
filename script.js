(() => {
  'use strict';

  /*
   * =========================================================
   * SAFE DOM HELPERS
   * =========================================================
   */

  const $ = (id) => {
    const element = document.getElementById(id);

    if (!element) {
      console.error(`Missing HTML element: #${id}`);
    }

    return element;
  };


  function onClick(id, handler) {
    const element = $(id);

    if (!element) {
      return;
    }

    element.addEventListener('click', handler);
  }


  /*
   * =========================================================
   * DEPENDENCY CHECK
   * =========================================================
   */

  if (typeof Chess === 'undefined') {
    console.error(
      'Chess.js failed to load. Check the Chess.js CDN script.'
    );

    return;
  }


  if (typeof Peer === 'undefined') {
    console.error(
      'PeerJS failed to load. Check the PeerJS CDN script.'
    );
  }


  /*
   * =========================================================
   * CONSTANTS
   * =========================================================
   */

  const files = 'abcdefgh';


  const symbols = {

    w: {
      p: '♙',
      r: '♖',
      n: '♘',
      b: '♗',
      q: '♕',
      k: '♔'
    },

    b: {
      p: '♟',
      r: '♜',
      n: '♞',
      b: '♝',
      q: '♛',
      k: '♚'
    }

  };


  const themes = [

    ['royal', '#ead6b0', '#718e6b'],

    ['classic', '#f0d9b5', '#b58863'],

    ['ocean', '#d7eef2', '#39738a'],

    ['forest', '#e8e0b8', '#557b45'],

    ['neon', '#d8f8ff', '#3656a3']

  ];


  /*
   * =========================================================
   * GAME STATE
   * =========================================================
   */

  const state = {

    name:
      localStorage.getItem('chessName') ||
      'Player',

    theme:
      localStorage.getItem('chessTheme') ||
      'royal',

    chess:
      new Chess(),

    selected:
      null,

    lastMove:
      null,

    flipped:
      false,

    peer:
      null,

    connection:
      null,

    host:
      false,

    room:
      null,

    color:
      null,

    opponentColor:
      null,

    opponentName:
      'Waiting...',

    pendingNewGame:
      false,

    newGameRequester:
      null

  };


  /*
   * =========================================================
   * AUDIO
   * =========================================================
   */

  let audioCtx = null;


  function initAudio() {

    try {

      if (!audioCtx) {

        audioCtx =
          new (
            window.AudioContext ||
            window.webkitAudioContext
          )();

      }

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

    } catch (error) {
      // Audio is optional.
    }
  }


  function playSound(type) {

    try {

      initAudio();

      if (!audioCtx) {
        return;
      }

      const osc =
        audioCtx.createOscillator();

      const gain =
        audioCtx.createGain();

      osc.connect(gain);

      gain.connect(
        audioCtx.destination
      );


      if (type === 'move') {

        osc.frequency.setValueAtTime(
          320,
          audioCtx.currentTime
        );

        gain.gain.setValueAtTime(
          0.15,
          audioCtx.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
          0.01,
          audioCtx.currentTime + 0.08
        );

        osc.start();

        osc.stop(
          audioCtx.currentTime + 0.08
        );

        return;
      }


      if (type === 'capture') {

        osc.frequency.setValueAtTime(
          180,
          audioCtx.currentTime
        );

        gain.gain.setValueAtTime(
          0.25,
          audioCtx.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
          0.01,
          audioCtx.currentTime + 0.12
        );

        osc.start();

        osc.stop(
          audioCtx.currentTime + 0.12
        );

        return;
      }


      if (type === 'notify') {

        osc.frequency.setValueAtTime(
          620,
          audioCtx.currentTime
        );

        gain.gain.setValueAtTime(
          0.14,
          audioCtx.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
          0.01,
          audioCtx.currentTime + 0.18
        );

        osc.start();

        osc.stop(
          audioCtx.currentTime + 0.18
        );
      }

    } catch (error) {
      // Audio is optional.
    }
  }


  /*
   * =========================================================
   * ROOM HELPERS
   * =========================================================
   */

  function randomRoom() {

    let result = '';

    for (let i = 0; i < 6; i++) {

      result += Math.floor(
        Math.random() * 10
      );

    }

    return result;
  }


  function setRoomStatus(
    text,
    online = false
  ) {

    const element =
      $('roomStatus');

    if (!element) {
      return;
    }

    element.innerHTML =
      `<span class="connection-dot ${
        online ? 'online' : ''
      }"></span>${text}`;
  }


  function setStatus(
    text,
    cls = ''
  ) {

    const element =
      $('status');

    if (!element) {
      return;
    }

    element.className =
      `status ${cls}`;

    element.innerHTML =
      `<span class="label">Game</span>
       <span>${text}</span>`;
  }


  /*
   * =========================================================
   * PROFILE
   * =========================================================
   */

  function profile() {

    const playerName =
      $('playerName');

    const nameInput =
      $('nameInput');

    if (playerName) {
      playerName.textContent =
        state.name;
    }

    if (nameInput) {
      nameInput.value =
        state.name;
    }

    applyTheme();

    updateRoomUI();
  }


  /*
   * =========================================================
   * THEMES
   * =========================================================
   */

  function applyTheme() {

    const theme =
      themes.find(
        item => item[0] === state.theme
      ) || themes[0];


    document.documentElement
      .style
      .setProperty(
        '--light',
        theme[1]
      );


    document.documentElement
      .style
      .setProperty(
        '--dark',
        theme[2]
      );


    document
      .querySelectorAll('.theme')
      .forEach(element => {

        const radio =
          element.querySelector(
            'input[type="radio"]'
          );

        const active =
          radio
            ? radio.checked
            : false;

        element.classList.toggle(
          'active',
          active
        );

      });
  }


  function buildThemes() {

    const grid =
      $('themeGrid');

    if (!grid) {
      return;
    }

    grid.innerHTML = '';


    themes.forEach(
      ([key, light, dark]) => {

        const label =
          document.createElement('label');

        label.className =
          `theme ${
            key === state.theme
              ? 'active'
              : ''
          }`;


        label.style.display =
          'flex';

        label.style.alignItems =
          'center';

        label.style.gap =
          '10px';

        label.style.cursor =
          'pointer';


        label.innerHTML = `
          <input
            type="radio"
            name="chessThemeOption"
            value="${key}"
            ${
              key === state.theme
                ? 'checked'
                : ''
            }
            style="width:auto;margin:0;"
          >

          <div style="flex:1;">

            <div
              class="preview"
              style="
                --a:${light};
                --b:${dark};
              "
            ></div>

            <b>
              ${
                key.charAt(0).toUpperCase() +
                key.slice(1)
              }
            </b>

          </div>
        `;


        const radio =
          label.querySelector(
            'input[type="radio"]'
          );


        if (radio) {

          radio.addEventListener(
            'change',
            () => {

              state.theme =
                key;

              applyTheme();

            }
          );

        }


        grid.appendChild(label);

      }
    );
  }


  /*
   * =========================================================
   * PLAYER UI
   * =========================================================
   */

  function updateRoomUI() {

    const room =
      state.room ||
      'Not connected';


    const roomDisplay =
      $('roomDisplay');

    const headerRoom =
      $('headerRoom');


    if (roomDisplay) {
      roomDisplay.textContent =
        room;
    }

    if (headerRoom) {
      headerRoom.textContent =
        room;
    }


    const whiteName =
      $('whitePlayerName');

    const blackName =
      $('blackPlayerName');

    const whiteAvatar =
      $('whiteAvatar');

    const blackAvatar =
      $('blackAvatar');


    /*
     * No color yet.
     */
    if (!state.color) {

      if (whiteName) {
        whiteName.textContent =
          state.host
            ? state.name
            : 'Waiting...';
      }

      if (blackName) {
        blackName.textContent =
          'Waiting...';
      }

      if (whiteAvatar) {
        whiteAvatar.textContent =
          state.host
            ? (
                state.name[0] ||
                'W'
              ).toUpperCase()
            : '♔';
      }

      if (blackAvatar) {
        blackAvatar.textContent =
          '♚';
      }

    }


    /*
     * We are White.
     */
    else if (
      state.color === 'w'
    ) {

      if (whiteName) {
        whiteName.textContent =
          state.name;
      }

      if (blackName) {
        blackName.textContent =
          state.opponentName ||
          'Waiting...';
      }

      if (whiteAvatar) {
        whiteAvatar.textContent =
          (
            state.name[0] ||
            'W'
          ).toUpperCase();
      }

      if (blackAvatar) {

        blackAvatar.textContent =
          state.opponentName &&
          state.opponentName !==
            'Waiting...' &&
          state.opponentName !==
            'Disconnected'
            ? (
                state.opponentName[0] ||
                'B'
              ).toUpperCase()
            : '♚';
      }

    }


    /*
     * We are Black.
     */
    else {

      if (blackName) {
        blackName.textContent =
          state.name;
      }

      if (whiteName) {
        whiteName.textContent =
          state.opponentName ||
          'Waiting...';
      }

      if (blackAvatar) {
        blackAvatar.textContent =
          (
            state.name[0] ||
            'B'
          ).toUpperCase();
      }

      if (whiteAvatar) {

        whiteAvatar.textContent =
          state.opponentName &&
          state.opponentName !==
            'Waiting...' &&
          state.opponentName !==
            'Disconnected'
            ? (
                state.opponentName[0] ||
                'W'
              ).toUpperCase()
            : '♔';
      }

    }


    /*
     * Turn indicators.
     */
    const isMyTurn =
      !!state.color &&
      state.chess.turn() ===
        state.color;


    const whiteTurn =
      $('whiteTurn');

    const blackTurn =
      $('blackTurn');


    if (whiteTurn) {

      whiteTurn.textContent =
        (
          state.color === 'w' &&
          isMyTurn
        ) ||
        (
          state.color === 'b' &&
          !isMyTurn
        )
          ? 'YOUR TURN'
          : '';
    }


    if (blackTurn) {

      blackTurn.textContent =
        (
          state.color === 'b' &&
          isMyTurn
        ) ||
        (
          state.color === 'w' &&
          !isMyTurn
        )
          ? 'YOUR TURN'
          : '';
    }


    const whitePlayer =
      $('whitePlayer');

    const blackPlayer =
      $('blackPlayer');


    if (whitePlayer) {

      whitePlayer.classList.toggle(
        'active-player',
        state.chess.turn() === 'w'
      );

    }


    if (blackPlayer) {

      blackPlayer.classList.toggle(
        'active-player',
        state.chess.turn() === 'b'
      );

    }

  }


  /*
   * =========================================================
   * KING
   * =========================================================
   */

  function getKingSquare(color) {

    const board =
      state.chess.board();


    for (let r = 0; r < 8; r++) {

      for (let c = 0; c < 8; c++) {

        const piece =
          board[r][c];


        if (
          piece &&
          piece.type === 'k' &&
          piece.color === color
        ) {

          return (
            files[c] +
            (8 - r)
          );

        }

      }

    }


    return null;
  }


  /*
   * =========================================================
   * MOVE HISTORY
   * =========================================================
   */

  function updateMovesHistory() {

    const container =
      $('moves');

    if (!container) {
      return;
    }


    const history =
      state.chess.history({
        verbose: true
      });


    container.innerHTML = '';


    for (
      let i = 0;
      i < history.length;
      i += 2
    ) {

      const div =
        document.createElement('div');

      div.className =
        'move';


      const moveNum =
        Math.floor(i / 2) + 1;


      const whiteMove =
        history[i]
          ? history[i].san
          : '';


      const blackMove =
        history[i + 1]
          ? history[i + 1].san
          : '';


      div.innerHTML =
        `<em>${moveNum}.</em>
         <span>${whiteMove}</span>
         <span>${blackMove}</span>`;


      container.appendChild(div);

    }


    container.scrollTop =
      container.scrollHeight;
  }


  /*
   * =========================================================
   * GAME STATUS
   * =========================================================
   */

  function updateStatus() {

    if (state.chess.in_checkmate()) {

      const winner =
        state.chess.turn() === 'w'
          ? 'Black'
          : 'White';


      setStatus(
        `Checkmate — ${winner} wins`,
        'mate'
      );

      return;
    }


    if (state.chess.in_check()) {

      setStatus(
        `Check — ${
          state.chess.turn() === 'w'
            ? 'White'
            : 'Black'
        } is in check`,
        'check'
      );

      return;
    }


    if (state.chess.in_draw()) {

      setStatus('Draw');

      return;
    }


    if (
      !state.connection ||
      !state.connection.open
    ) {

      setStatus(
        'Create or join a room to start'
      );

      return;
    }


    if (!state.color) {

      setStatus(
        'Waiting for opponent to join...'
      );

      return;
    }


    if (state.pendingNewGame) {

      setStatus(
        'Waiting for opponent to respond...'
      );

      return;
    }


    if (
      state.chess.turn() ===
      state.color
    ) {

      setStatus(
        'Your turn'
      );

    } else {

      setStatus(
        `${
          state.chess.turn() === 'w'
            ? 'White'
            : 'Black'
        } to move`
      );

    }
  }


  /*
   * =========================================================
   * MOVE EXECUTION
   * =========================================================
   */

  function executeMove(
    moveObj,
    sendNetwork = false
  ) {

    if (!moveObj) {
      return false;
    }


    const capturedPiece =
      state.chess.get(
        moveObj.to
      );


    const move =
      state.chess.move(
        moveObj
      );


    if (!move) {
      return false;
    }


    state.lastMove = {

      from:
        move.from,

      to:
        move.to

    };


    playSound(
      capturedPiece
        ? 'capture'
        : 'move'
    );


    if (
      sendNetwork &&
      state.connection &&
      state.connection.open
    ) {

      state.connection.send({

        type: 'move',

        move: moveObj

      });

    }


    state.selected =
      null;


    render();


    return true;
  }


  /*
   * =========================================================
   * SQUARE CLICK
   * =========================================================
   */

  function onSquareClick(sq) {

    initAudio();


    if (
      !state.connection ||
      !state.connection.open
    ) {
      return;
    }


    if (
      !state.color ||
      state.chess.turn() !==
        state.color
    ) {
      return;
    }


    if (
      state.chess.game_over()
    ) {
      return;
    }


    if (
      state.pendingNewGame
    ) {
      return;
    }


    const piece =
      state.chess.get(sq);


    if (state.selected) {

      const legalMoves =
        state.chess.moves({

          square:
            state.selected,

          verbose: true

        });


      const targetMove =
        legalMoves.find(
          move => move.to === sq
        );


      if (targetMove) {

        executeMove(

          {
            from:
              state.selected,

            to:
              sq,

            promotion:
              'q'
          },

          true

        );

        return;
      }


      state.selected =
        piece &&
        piece.color ===
          state.color
          ? sq
          : null;

    } else if (
      piece &&
      piece.color ===
        state.color
    ) {

      state.selected =
        sq;

    }


    render();
  }


  /*
   * =========================================================
   * BOARD RENDER
   * =========================================================
   */

  function render() {

    const board =
      $('board');

    if (!board) {
      return;
    }


    board.innerHTML = '';


    board.classList.remove(
      'checkmate-shake'
    );


    if (
      state.chess.in_checkmate()
    ) {

      void board.offsetWidth;

      board.classList.add(
        'checkmate-shake'
      );
    }


    const inCheck =
      state.chess.in_check();


    const inMate =
      state.chess.in_checkmate();


    const activeTurn =
      state.chess.turn();


    const kingSq =
      (
        inCheck ||
        inMate
      )
        ? getKingSquare(
            activeTurn
          )
        : null;


    let legalTargets = [];


    if (
      state.selected &&
      state.color ===
        state.chess.turn()
    ) {

      legalTargets =
        state.chess
          .moves({

            square:
              state.selected,

            verbose:
              true

          })
          .map(
            move => move.to
          );

    }


    const rows =
      state.flipped
        ? [0, 1, 2, 3, 4, 5, 6, 7]
        : [7, 6, 5, 4, 3, 2, 1, 0];


    const cols =
      state.flipped
        ? [7, 6, 5, 4, 3, 2, 1, 0]
        : [0, 1, 2, 3, 4, 5, 6, 7];


    for (const r of rows) {

      for (const c of cols) {

        const sq =
          files[c] +
          (r + 1);


        const isLight =
          (r + c) % 2 !== 0;


        const piece =
          state.chess.get(sq);


        const button =
          document.createElement(
            'button'
          );


        button.type =
          'button';


        button.className =
          `square ${
            isLight
              ? 'light'
              : 'dark'
          }`;


        button.setAttribute(
          'aria-label',
          sq
        );


        if (
          state.selected === sq
        ) {

          button.classList.add(
            'selected'
          );

        }


        if (
          legalTargets.includes(sq)
        ) {

          button.classList.add(
            'legal'
          );

        }


        if (
          state.lastMove &&
          (
            state.lastMove.from === sq ||
            state.lastMove.to === sq
          )
        ) {

          button.classList.add(
            'last'
          );

        }


        if (sq === kingSq) {

          button.classList.add(

            inMate
              ? 'king-mate'
              : 'king-check'

          );

        }


        if (piece) {

          const span =
            document.createElement(
              'span'
            );


          span.className =
            'piece';


          span.textContent =
            symbols[
              piece.color
            ][
              piece.type
            ];


          if (
            state.lastMove &&
            state.lastMove.to === sq
          ) {

            span.classList.add(
              'moving'
            );

          }


          button.appendChild(
            span
          );

        }


        button.addEventListener(
          'click',
          () => onSquareClick(sq)
        );


        board.appendChild(
          button
        );

      }

    }


    updateRoomUI();

    updateMovesHistory();

    updateStatus();

  }


  /*
   * =========================================================
   * PEERJS
   * =========================================================
   */

  const peerConfig = {

    config: {

      iceServers: [

        {
          urls:
            'stun:stun.l.google.com:19302'
        },

        {
          urls:
            'stun:stun1.l.google.com:19302'
        }

      ]

    }

  };


  /*
   * =========================================================
   * DESTROY PEER
   * =========================================================
   */

  function destroyPeer() {

    if (state.connection) {

      try {
        state.connection.close();
      } catch (error) {}

      state.connection =
        null;
    }


    if (state.peer) {

      try {
        state.peer.destroy();
      } catch (error) {}

      state.peer =
        null;
    }


    state.room =
      null;

    state.color =
      null;

    state.opponentColor =
      null;

    state.opponentName =
      'Waiting...';

    state.host =
      false;

    state.selected =
      null;

    state.lastMove =
      null;

    state.pendingNewGame =
      false;

    state.newGameRequester =
      null;

    state.flipped =
      false;


    state.chess.reset();


    setRoomStatus(
      'Disconnected'
    );


    render();
  }


  /*
   * =========================================================
   * INITIALIZE PEER
   * =========================================================
   */

  function initPeer(
    id,
    isHost
  ) {

    if (typeof Peer === 'undefined') {

      setRoomStatus(
        'PeerJS failed to load. Check your internet connection.'
      );

      return;
    }


    destroyPeer();


    state.host =
      isHost;

    state.room =
      id;


    const peerId =
      isHost
        ? `royal-chess-room-${id}`
        : undefined;


    try {

      state.peer =
        new Peer(
          peerId,
          peerConfig
        );

    } catch (error) {

      console.error(
        'PeerJS initialization error:',
        error
      );

      setRoomStatus(
        'Could not initialize online connection.'
      );

      return;
    }


    state.peer.on(
      'open',
      () => {

        if (isHost) {

          setRoomStatus(
            'Room created. Share Room ID with opponent...'
          );


          state.color =
            null;

          state.opponentColor =
            null;


          render();

        } else {

          connectToHost(id);

        }

      }
    );


    state.peer.on(
      'connection',
      conn => {

        if (!isHost) {
          return;
        }


        if (
          state.connection &&
          state.connection.open
        ) {

          conn.close();

          return;
        }


        state.connection =
          conn;


        setupConnection();

      }
    );


    state.peer.on(
      'error',
      err => {

        console.error(
          'PeerJS error:',
          err
        );


        if (
          err.type ===
          'unavailable-id'
        ) {

          setRoomStatus(
            'Room ID already exists! Try creating another.'
          );

        } else if (
          err.type ===
          'peer-unavailable'
        ) {

          setRoomStatus(
            'Room not found! Verify the Room ID.'
          );

        } else {

          setRoomStatus(
            `Network Error: ${err.type || 'unknown'}`
          );

        }

      }
    );


    state.peer.on(
      'disconnected',
      () => {

        setRoomStatus(
          'Connection to PeerJS server lost.'
        );

      }
    );
  }


  /*
   * =========================================================
   * CONNECT TO HOST
   * =========================================================
   */

  function connectToHost(id) {

    if (
      !state.peer
    ) {

      setRoomStatus(
        'Peer is not ready.'
      );

      return;
    }


    setRoomStatus(
      'Connecting to opponent...'
    );


    const conn =
      state.peer.connect(
        `royal-chess-room-${id}`,
        {
          reliable: true
        }
      );


    state.connection =
      conn;


    setupConnection();
  }


  /*
   * =========================================================
   * CONNECTION
   * =========================================================
   */

  function setupConnection() {

    const conn =
      state.connection;


    if (!conn) {
      return;
    }


    conn.on(
      'open',
      () => {

        setRoomStatus(
          'Connected',
          true
        );


        /*
         * HOST
         */
        if (state.host) {

          setRoomStatus(
            'Opponent connected. Waiting for player information...',
            true
          );


          render();

          return;
        }


        /*
         * GUEST
         */
        conn.send({

          type: 'join',

          name:
            state.name

        });


        setRoomStatus(
          'Connected — waiting for color assignment...',
          true
        );


        render();

      }
    );


    conn.on(
      'data',
      data => {

        if (!data || typeof data !== 'object') {
          return;
        }


        /*
         * ===================================================
         * PLAYER JOINED
         * ===================================================
         */

        if (
          data.type === 'join'
        ) {

          if (!state.host) {
            return;
          }


          state.opponentName =
            data.name ||
            'Opponent';


          const hostIsWhite =
            Math.random() < 0.5;


          state.color =
            hostIsWhite
              ? 'w'
              : 'b';


          state.opponentColor =
            hostIsWhite
              ? 'b'
              : 'w';


          state.flipped =
            state.color === 'b';


          conn.send({

            type:
              'color-assignment',

            color:
              state.opponentColor,

            opponentColor:
              state.color,

            opponentName:
              state.name,

            fen:
              state.chess.fen()

          });


          setRoomStatus(
            `Connected — you are ${
              state.color === 'w'
                ? 'White'
                : 'Black'
            }`,
            true
          );


          render();

          return;
        }


        /*
         * ===================================================
         * COLOR ASSIGNMENT
         * ===================================================
         */

        if (
          data.type ===
          'color-assignment'
        ) {

          if (state.host) {
            return;
          }


          state.color =
            data.color;


          state.opponentColor =
            data.opponentColor;


          state.opponentName =
            data.opponentName ||
            'Opponent';


          state.flipped =
            state.color === 'b';


          if (data.fen) {

            try {

              state.chess.load(
                data.fen
              );

            } catch (error) {

              console.error(
                'Invalid FEN:',
                error
              );

            }

          }


          setRoomStatus(
            `Connected — you are ${
              state.color === 'w'
                ? 'White'
                : 'Black'
            }`,
            true
          );


          render();

          return;
        }


        /*
         * ===================================================
         * MOVE
         * ===================================================
         */

        if (
          data.type === 'move'
        ) {

          executeMove(
            data.move,
            false
          );

          return;
        }


        /*
         * ===================================================
         * NAME UPDATE
         * ===================================================
         */

        if (
          data.type ===
          'name-update'
        ) {

          state.opponentName =
            data.name ||
            'Opponent';


          render();

          return;
        }


        /*
         * ===================================================
         * NEW GAME REQUEST
         * ===================================================
         */

        if (
          data.type ===
          'newgame-request'
        ) {

          /*
           * Do not allow multiple requests
           * at the same time.
           */
          if (state.pendingNewGame) {
            return;
          }


          state.newGameRequester =
            data.name ||
            'Opponent';


          state.pendingNewGame =
            true;


          playSound(
            'notify'
          );


          render();


          const accepted =
            window.confirm(
              `${state.newGameRequester} wants to start a new game.\n\n` +
              `Accept and randomly assign White/Black?`
            );


          if (accepted) {

            /*
             * Important:
             *
             * The guest only sends the response.
             * The HOST starts the new game after
             * receiving the response.
             *
             * This prevents the game from starting
             * twice.
             */
            conn.send({

              type:
                'newgame-response',

              accepted:
                true

            });


            if (!state.host) {

              setRoomStatus(
                'New game accepted. Waiting for host...',
                true
              );

            }

          } else {

            conn.send({

              type:
                'newgame-response',

              accepted:
                false

            });


            state.pendingNewGame =
              false;

            state.newGameRequester =
              null;


            setRoomStatus(
              'New game request declined.'
            );


            render();

          }


          return;
        }


        /*
         * ===================================================
         * NEW GAME RESPONSE
         * ===================================================
         */

        if (
          data.type ===
          'newgame-response'
        ) {

          if (!state.host) {
            return;
          }


          state.pendingNewGame =
            false;


          if (!data.accepted) {

            state.newGameRequester =
              null;


            setRoomStatus(
              'Opponent declined the new game request.'
            );


            render();

            return;
          }


          /*
           * Host controls random assignment.
           */
          startNewGameRandomColors();


          return;
        }


        /*
         * ===================================================
         * NEW GAME START
         * ===================================================
         */

        if (
          data.type ===
          'newgame-start'
        ) {

          /*
           * Only guest processes this message.
           */
          if (state.host) {
            return;
          }


          state.color =
            data.guestColor;


          state.opponentColor =
            data.hostColor;


          state.flipped =
            state.color === 'b';


          state.chess.reset();


          state.selected =
            null;

          state.lastMove =
            null;

          state.pendingNewGame =
            false;

          state.newGameRequester =
            null;


          setRoomStatus(
            `New game started — you are ${
              state.color === 'w'
                ? 'White'
                : 'Black'
            }`,
            true
          );


          playSound(
            'notify'
          );


          render();

          return;
        }

      }
    );


    conn.on(
      'close',
      () => {

        state.opponentName =
          'Disconnected';


        state.opponentColor =
          null;


        state.pendingNewGame =
          false;


        state.newGameRequester =
          null;


        setRoomStatus(
          'Opponent disconnected'
        );


        render();

      }
    );


    conn.on(
      'error',
      error => {

        console.error(
          'Connection error:',
          error
        );


        setRoomStatus(
          'Connection error.'
        );

      }
    );
  }


  /*
   * =========================================================
   * RANDOM NEW GAME
   * =========================================================
   */

  function startNewGameRandomColors() {

    if (
      !state.connection ||
      !state.connection.open
    ) {

      return;
    }


    if (!state.host) {

      return;
    }


    const hostIsWhite =
      Math.random() < 0.5;


    const hostColor =
      hostIsWhite
        ? 'w'
        : 'b';


    const guestColor =
      hostIsWhite
        ? 'b'
        : 'w';


    state.color =
      hostColor;


    state.opponentColor =
      guestColor;


    state.flipped =
      state.color === 'b';


    state.chess.reset();


    state.selected =
      null;

    state.lastMove =
      null;


    state.pendingNewGame =
      false;

    state.newGameRequester =
      null;


    state.connection.send({

      type:
        'newgame-start',

      hostColor:
        hostColor,

      guestColor:
        guestColor

    });


    setRoomStatus(
      `New game started — you are ${
        state.color === 'w'
          ? 'White'
          : 'Black'
      }`,
      true
    );


    playSound(
      'notify'
    );


    render();
  }


  /*
   * =========================================================
   * REQUEST NEW GAME
   * =========================================================
   */

  function requestNewGame() {

    if (
      !state.connection ||
      !state.connection.open
    ) {

      setRoomStatus(
        'You must be connected to another player.'
      );

      return;
    }


    if (!state.color) {

      setRoomStatus(
        'Waiting for opponent to join.'
      );

      return;
    }


    if (
      state.pendingNewGame
    ) {

      return;
    }


    state.pendingNewGame =
      true;


    state.connection.send({

      type:
        'newgame-request',

      name:
        state.name

    });


    setRoomStatus(
      'New game request sent. Waiting for opponent...',
      true
    );


    render();
  }


  /*
   * =========================================================
   * CREATE ROOM
   * =========================================================
   */

  onClick(
    'createBtn',
    () => {

      const id =
        randomRoom();


      const input =
        $('roomInput');


      if (input) {

        input.value =
          id;

      }


      initPeer(
        id,
        true
      );

    }
  );


  /*
   * =========================================================
   * JOIN ROOM
   * =========================================================
   */

  onClick(
    'joinBtn',
    () => {

      const input =
        $('roomInput');


      if (!input) {
        return;
      }


      const id =
        input.value.trim();


      if (
        !/^\d{4,6}$/.test(id)
      ) {

        alert(
          'Please enter a valid Room ID'
        );

        return;
      }


      initPeer(
        id,
        false
      );

    }
  );


  /*
   * =========================================================
   * LEAVE ROOM
   * =========================================================
   */

  onClick(
    'leaveBtn',
    () => {

      destroyPeer();


      const input =
        $('roomInput');


      if (input) {

        input.value =
          '';

      }

    }
  );


  /*
   * =========================================================
   * NEW GAME BUTTON
   * =========================================================
   */

  onClick(
    'newGameBtn',
    () => {

      requestNewGame();

    }
  );


  /*
   * =========================================================
   * SETTINGS
   * =========================================================
   */

  const modal =
    $('settingsMenu');


  onClick(
    'settingsBtn',
    () => {

      const nameInput =
        $('nameInput');


      if (nameInput) {

        nameInput.value =
          state.name;

      }


      if (modal) {

        modal.removeAttribute(
          'hidden'
        );

      }

    }
  );


  function closeModal() {

    if (!modal) {
      return;
    }


    modal.setAttribute(
      'hidden',
      ''
    );

  }


  onClick(
    'closeSettingsBtn',
    closeModal
  );


  onClick(
    'cancelSettingsBtn',
    closeModal
  );


  onClick(
    'saveSettings',
    () => {

      const nameInput =
        $('nameInput');


      const newName =
        nameInput
          ? (
              nameInput.value.trim() ||
              'Player'
            )
          : 'Player';


      state.name =
        newName;


      localStorage.setItem(
        'chessName',
        state.name
      );


      localStorage.setItem(
        'chessTheme',
        state.theme
      );


      profile();


      /*
       * Tell opponent about name change.
       */
      if (
        state.connection &&
        state.connection.open
      ) {

        state.connection.send({

          type:
            'name-update',

          name:
            state.name

        });

      }


      render();

      closeModal();

    }
  );


  /*
   * =========================================================
   * ENTER KEY FOR ROOM INPUT
   * =========================================================
   */

  const roomInput =
    $('roomInput');


  if (roomInput) {

    roomInput.addEventListener(
      'keydown',
      event => {

        if (
          event.key === 'Enter'
        ) {

          const joinButton =
            $('joinBtn');


          if (joinButton) {
            joinButton.click();
          }

        }

      }
    );

  }


  /*
   * =========================================================
   * CLOSE MODAL WITH ESC
   * =========================================================
   */

  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Escape' &&
        modal &&
        !modal.hasAttribute('hidden')
      ) {

        closeModal();

      }

    }
  );


  /*
   * =========================================================
   * INITIALIZE APPLICATION
   * =========================================================
   */

  buildThemes();

  profile();

  render();


})();
