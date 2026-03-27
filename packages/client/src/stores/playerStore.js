/**
 * Player state store — identity, inventory, episode quota.
 * Mirrors bonfire-quest-game PlayerState model.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import * as api from "@/api/client";

const usePlayerStore = create(
  devtools(
    (set, get) => ({
      // --- state ---
      agentId: null,
      wallet: null,
      bonfireId: null,
      currentRoom: "",
      inventory: [], // object_ids
      remainingEpisodes: 0,
      turnsUsed: 0,
      isActive: false,
      agentApiKey: "", // stored in localStorage for persistence

      // --- actions ---

      setWallet: (wallet) => set({ wallet }),

      setAgentApiKey: (key) => {
        localStorage.setItem("bonfire-rpg-agent-key", key);
        set({ agentApiKey: key });
      },

      loadAgentApiKey: () => {
        const key = localStorage.getItem("bonfire-rpg-agent-key") || "";
        set({ agentApiKey: key });
      },

      updateFromGameState: (players, agentId) => {
        const self = players?.find((p) => p.agent_id === agentId);
        if (!self) return;
        set({
          agentId: self.agent_id,
          bonfireId: self.bonfire_id,
          currentRoom: self.current_room || "",
          inventory: self.inventory || [],
          remainingEpisodes: self.remaining_episodes ?? 0,
          turnsUsed: self.turns_used ?? 0,
          isActive: self.is_active ?? true,
        });
      },

      registerPurchase: async (body) => {
        const data = await api.registerPurchase(body);
        set({
          agentId: body.agent_id,
          bonfireId: body.bonfire_id,
          isActive: true,
        });
        return data;
      },

      restorePlayer: async (wallet, bonfireId) => {
        const data = await api.restorePlayer({
          wallet_address: wallet,
          bonfire_id: bonfireId,
        });
        if (data.agent_id) {
          set({ agentId: data.agent_id, bonfireId, isActive: true });
        }
        return data;
      },

      clearPlayer: () =>
        set({
          agentId: null,
          wallet: null,
          bonfireId: null,
          currentRoom: "",
          inventory: [],
          remainingEpisodes: 0,
          turnsUsed: 0,
          isActive: false,
        }),
    }),
    { name: "player-store" },
  ),
);

export { usePlayerStore };
