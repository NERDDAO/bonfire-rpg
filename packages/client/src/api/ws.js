/**
 * WebSocket client for RoomHub real-time events.
 * Auto-reconnects with exponential backoff on disconnect.
 */

const INITIAL_DELAY = 1000;
const MAX_DELAY = 30000;

export function createRoomSocket(agentId, { onEvent, onOpen, onClose, onError } = {}) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const url = `${protocol}//${host}/ws/room/${agentId}`;

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
      if (!closed) {
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
