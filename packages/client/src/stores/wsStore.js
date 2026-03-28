/**
 * WebSocket connection store — manages RoomHub connection lifecycle.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createRoomSocket } from "@/api/ws";

const useWsStore = create(
  devtools(
    (set, get) => ({
      // --- state ---
      socket: null,
      connected: false,
      agentId: null,

      // --- actions ---

      connect: (agentId, apiKey = "", { onEvent } = {}) => {
        const existing = get().socket;
        if (existing) existing.close();

        const socket = createRoomSocket(agentId, apiKey, {
          onEvent: (data) => {
            onEvent?.(data);
          },
          onOpen: () => set({ connected: true }),
          onClose: () => set({ connected: false, socket: null }),
          onError: () => set({ connected: false }),
        });

        set({ socket, agentId });
      },

      disconnect: () => {
        get().socket?.close();
        set({ socket: null, connected: false, agentId: null });
      },
    }),
    { name: "ws-store" },
  ),
);

export { useWsStore };
