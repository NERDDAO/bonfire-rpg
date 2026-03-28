/**
 * WebSocket client for RoomHub real-time events.
 * Auto-reconnects with exponential backoff on disconnect.
 */

const INITIAL_DELAY = 1000;
const MAX_DELAY = 30000;

export function createRoomSocket(agentId, { signature, timestamp, onEvent, onOpen, onClose, onError } = {}) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const params = new URLSearchParams({ agent_id: agentId });
  if (signature) {
    params.set("sig", signature);
    params.set("ts", timestamp);
  }
  const url = `${protocol}//${host}/ws/game?${params}`;

  let ws = null;
  let delay = INITIAL_DELAY;
  let reconnectTimer = null;
  let closed = false;

  function connect() {
    if (closed) return;
    ws = new WebSocket(url);

    ws.onopen = () => {
      delay = INITIAL_DELAY;
      onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        onEvent?.(JSON.parse(event.data));
      } catch (err) {
        console.error("[ws] parse error:", err);
      }
    };

    ws.onclose = (event) => {
      onClose?.(event);
      // Don't reconnect on auth rejection or intentional close
      const noRetry = closed || event.code === 4001 || event.code === 4003 || event.code === 4004;
      if (!noRetry) {
        reconnectTimer = setTimeout(() => {
          delay = Math.min(delay * 2, MAX_DELAY);
          connect();
        }, delay);
      }
    };

    ws.onerror = (err) => {
      onError?.(err);
    };
  }

  connect();

  return {
    send: (data) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(data)),
    close: () => {
      closed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    },
    get readyState() {
      return ws?.readyState ?? WebSocket.CLOSED;
    },
  };
}
