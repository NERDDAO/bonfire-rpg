// Multiplayer UI Controller
(function() {
  'use strict';

  const BONFIRE_ID = 'default'; // TODO: make configurable
  let playerId = null;
  let playerName = null;
  let oocUnread = 0;
  let roundTimerInterval = null;
  let matrixChat = null;
  let matrixOOCRoomId = null;

  // --- Roster ---
  function updateRoster(roster) {
    const el = document.getElementById('mpRosterList');
    const container = document.getElementById('mpRoster');
    if (!el || !roster.length) {
      if (container) container.hidden = true;
      return;
    }
    container.hidden = false;
    el.innerHTML = roster.map(p => `
      <div class="mp-roster-player">
        <div class="mp-roster-dot ${p.isAlive === false ? 'mp-roster-dot--dead' : ''}"></div>
        <span class="mp-roster-name">${esc(p.name)}</span>
        ${p.locationName ? `<span class="mp-roster-location">${esc(p.locationName)}</span>` : ''}
        ${p.isAlive === false ? '<span class="mp-roster-location" style="font-style:italic">dead</span>' : ''}
      </div>
    `).join('');
  }

  // --- OOC Chat ---
  function addOOCMessage(from, text) {
    const el = document.getElementById('mpOOCMessages');
    if (!el) return;
    const div = document.createElement('div');
    div.className = 'mp-ooc-msg';
    div.innerHTML = `<span class="mp-ooc-msg-name">${esc(from)}</span> <span class="mp-ooc-msg-text">${esc(text)}</span>`;
    el.appendChild(div);

    // Scroll the OOC log container
    const oocLog = document.getElementById('chatLogOOC');
    if (oocLog) oocLog.scrollTop = oocLog.scrollHeight;
  }

  function initOOCPanel() {
    const input = document.getElementById('oocInput');
    const sendBtn = document.getElementById('oocSendBtn');
    if (!input || !sendBtn) return;

    function sendOOC() {
      const text = input.value.trim();
      if (!text) return;

      addOOCMessage('You', text);

      if (matrixChat && matrixOOCRoomId) {
        matrixChat.sendMessage(matrixOOCRoomId, text).catch(err => {
          console.warn('[ooc] Matrix send failed:', err.message);
        });
      } else {
        fetch(`/api/mp/${BONFIRE_ID}/ooc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: playerId || 'anon', playerName: playerName || 'Player', text }),
        });
      }
      input.value = '';
      input.focus();
    }

    sendBtn.addEventListener('click', sendOOC);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendOOC();
      }
    });
  }

  // --- Round Timer ---
  function showRoundTimer(startedAt, windowMs) {
    const el = document.getElementById('mpRoundTimer');
    if (!el) return;
    el.hidden = false;

    if (roundTimerInterval) clearInterval(roundTimerInterval);
    roundTimerInterval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, windowMs - elapsed);
      const progress = 1 - remaining / windowMs;
      const seconds = Math.ceil(remaining / 1000);

      const fill = document.getElementById('mpRoundBarFill');
      const time = document.getElementById('mpRoundTime');
      if (fill) fill.style.width = (progress * 100) + '%';
      if (time) time.textContent = seconds + 's';

      if (remaining <= 0) {
        clearInterval(roundTimerInterval);
        el.hidden = true;
      }
    }, 100);
  }

  function hideRoundTimer() {
    const el = document.getElementById('mpRoundTimer');
    if (el) el.hidden = true;
    if (roundTimerInterval) clearInterval(roundTimerInterval);
  }

  // --- Death Screen ---
  function showDeathScreen(cause, legend, locationName) {
    const overlay = document.getElementById('mpDeathOverlay');
    if (!overlay) return;
    const causeEl = document.getElementById('mpDeathCause');
    const legendEl = document.getElementById('mpDeathLegend');
    const locEl = document.getElementById('mpDeathLocation');
    if (causeEl) causeEl.textContent = cause;
    if (legendEl) legendEl.textContent = legend;
    if (locEl) locEl.textContent = 'Your story has been etched into the world\'s memory. Future adventurers may find your remains at ' + locationName + '.';
    overlay.hidden = false;
  }

  // --- WebSocket event handler ---
  function handleMultiplayerEvent(data) {
    if (data.type === 'ooc_chat') {
      addOOCMessage(data.fromName || data.from, data.text);
    } else if (data.type === 'roster_update') {
      updateRoster(data.roster);
    } else if (data.type === 'round_started') {
      showRoundTimer(data.startedAt || Date.now(), data.windowMs || 20000);
    } else if (data.type === 'round_closed') {
      hideRoundTimer();
    } else if (data.type === 'player_death') {
      showDeathScreen(data.cause, data.legend, data.locationName);
    }
  }

  // --- Utility ---
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // --- Matrix Connection ---
  async function connectMatrix({ homeserver, accessToken, userId, oocRoomId }) {
    if (!window.MatrixChat) {
      console.warn('[matrix] MatrixChat not loaded — include matrix-client.js before multiplayer.js');
      return false;
    }

    matrixOOCRoomId = oocRoomId;
    matrixChat = new window.MatrixChat({
      homeserver,
      accessToken,
      userId,
      onMessage: (roomId, sender, text, meta) => {
        if (roomId === oocRoomId) {
          addOOCMessage(meta.displayName || sender, text);
        }
        // Location room messages from the narrator bot show as narration
        // (handled by the game's existing chat rendering)
      },
    });

    try {
      await matrixChat.startSync();
      console.log('[matrix] Connected as', userId);
      return true;
    } catch (err) {
      console.error('[matrix] Failed to connect:', err.message);
      matrixChat = null;
      return false;
    }
  }

  function disconnectMatrix() {
    if (matrixChat) {
      matrixChat.stopSync();
      matrixChat = null;
      matrixOOCRoomId = null;
    }
  }

  // --- Init ---
  function init() {
    initOOCPanel();
    // Expose to global for WS integration + Matrix
    window.multiplayerUI = {
      handleEvent: handleMultiplayerEvent,
      updateRoster,
      addOOCMessage,
      showRoundTimer,
      hideRoundTimer,
      showDeathScreen,
      setPlayerId: (id) => { playerId = id; },
      setPlayerName: (name) => { playerName = name; },
      connectMatrix,
      disconnectMatrix,
      getMatrixChat: () => matrixChat,
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
