/**
 * WebSocket connection store — manages RoomHub connection lifecycle.
 * Signs a message with the user's wallet to prove ownership on connect.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { BrowserProvider } from "ethers";
import { createRoomSocket } from "@/api/ws";

async function signForAgent(agentId) {
  if (!window.ethereum) return {};
  try {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const message = `bonfire-rpg:${agentId}:${timestamp}`;
    const signature = await signer.signMessage(message);
    return { signature, timestamp };
  } catch {
    return {};
  }
}

const useWsStore = create(
  devtools(
    (set, get) => ({
      socket: null,
      connected: false,
      agentId: null,

      connect: async (agentId, { onEvent } = {}) => {
        const existing = get().socket;
        if (existing) existing.close();

        const { signature, timestamp } = await signForAgent(agentId);

        const socket = createRoomSocket(agentId, {
          signature,
          timestamp,
          onEvent: (data) => onEvent?.(data),
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
