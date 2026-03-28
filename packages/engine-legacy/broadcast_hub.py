"""Real-time WebSocket hub for broadcasting events to all connected players."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from starlette.websockets import WebSocket, WebSocketState

log = logging.getLogger(__name__)


class BroadcastHub:
    """Manages per-player WebSocket connections and broadcasts.

    All events go to all connected clients — there is no room-scoping.
    Thread-safety: public methods that touch internal state use an asyncio.Lock
    so they are safe to call from any async context.  The synchronous helper
    ``fire`` is provided for non-async callers (HTTP handlers, background
    threads) that need to push events into the hub.
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._connections: dict[str, WebSocket] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, agent_id: str, ws: WebSocket) -> None:
        if self._loop is None:
            try:
                self._loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
        async with self._lock:
            old_ws = self._connections.get(agent_id)
            if old_ws is not None:
                await self._safe_close(old_ws)
            self._connections[agent_id] = ws

    async def disconnect(self, agent_id: str) -> None:
        async with self._lock:
            self._connections.pop(agent_id, None)

    async def send_to_player(self, agent_id: str, event: dict[str, Any]) -> None:
        ws = self._connections.get(agent_id)
        if ws is None or ws.client_state != WebSocketState.CONNECTED:
            return
        try:
            await ws.send_json(event)
        except Exception:
            log.debug("Failed to send to player %s", agent_id)

    async def broadcast_all(self, event: dict[str, Any]) -> None:
        """Send an event to every connected player."""
        async with self._lock:
            agents = list(self._connections.keys())
        for aid in agents:
            ws = self._connections.get(aid)
            if ws is None or ws.client_state != WebSocketState.CONNECTED:
                continue
            try:
                await ws.send_json(event)
            except Exception:
                pass

    def fire(self, event: dict[str, Any]) -> None:
        """Schedule a broadcast from a synchronous (non-async) context.

        Safe to call from sync HTTP handlers and background threads.
        Uses the event loop captured during the first ``connect`` call.
        """
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        loop.call_soon_threadsafe(loop.create_task, self.broadcast_all(event))

    @staticmethod
    async def _safe_close(ws: WebSocket) -> None:
        try:
            await ws.close()
        except Exception:
            pass
