/**
 * WebSocket bridge to the GM server.
 * Receives world-level events (other players' actions, GM decisions,
 * new rooms/NPCs) and injects them into the local ai_rpg game state.
 */

const WebSocket = require('ws');

class WSBridge {
  constructor(config, { onWorldEvent, onConnect, onDisconnect } = {}) {
    this.url = config.gm_server_url.replace(/^http/, 'ws');
    this.agentId = config.agent_id;
    this.onWorldEvent = onWorldEvent;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
    this.ws = null;
    this.reconnectDelay = 1000;
    this.maxDelay = 30000;
    this.closed = false;
  }

  connect() {
    if (this.closed) return;

    const params = new URLSearchParams({ agent_id: this.agentId });
    const wsUrl = `${this.url}/ws/game?${params}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('[bonfires-gm] WS connected to GM server');
      this.reconnectDelay = 1000;
      this.onConnect?.();
    });

    this.ws.on('message', (raw) => {
      try {
        const event = JSON.parse(raw.toString());
        this.onWorldEvent?.(event);
      } catch (err) {
        console.error('[bonfires-gm] WS parse error:', err.message);
      }
    });

    this.ws.on('close', (code) => {
      this.onDisconnect?.();
      if (!this.closed && code !== 4001 && code !== 4003 && code !== 4004) {
        setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
          this.connect();
        }, this.reconnectDelay);
      }
    });

    this.ws.on('error', (err) => {
      console.error('[bonfires-gm] WS error:', err.message);
    });
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  close() {
    this.closed = true;
    this.ws?.close();
  }
}

module.exports = { WSBridge };
