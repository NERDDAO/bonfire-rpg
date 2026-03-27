/**
 * WebSocket client for RoomHub real-time events.
 */

export function createRoomSocket(agentId, { onEvent, onOpen, onClose, onError } = {}) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const url = `${protocol}//${host}/ws/room/${agentId}`;

  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log(`[ws] connected as ${agentId}`);
    onOpen?.();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent?.(data);
    } catch (err) {
      console.error("[ws] failed to parse message:", err);
    }
  };

  ws.onclose = (event) => {
    console.log(`[ws] disconnected (code=${event.code})`);
    onClose?.(event);
  };

  ws.onerror = (err) => {
    console.error("[ws] error:", err);
    onError?.(err);
  };

  return {
    send: (data) => ws.send(JSON.stringify(data)),
    close: () => ws.close(),
    get readyState() {
      return ws.readyState;
    },
  };
}
