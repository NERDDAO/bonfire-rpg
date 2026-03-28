/**
 * Player identity store — wallet, agent, API key.
 * Game-derived state (currentRoom, inventory, episodes) comes from gameStore.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { BrowserProvider } from "ethers";
import * as api from "@/api/client";

const usePlayerStore = create(
  devtools(
    (set, get) => ({
      wallet: null,
      agentId: null,
      agentApiKey: "",
      isConnecting: false,
      error: null,

      connectWallet: async () => {
        if (!window.ethereum) {
          set({ error: "No wallet found. Install MetaMask or a compatible wallet." });
          return null;
        }
        set({ isConnecting: true, error: null });
        try {
          const provider = new BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          set({ wallet: address.toLowerCase() });
          get().loadPersistedAgent();
          return address.toLowerCase();
        } catch (err) {
          set({ error: err.message });
          return null;
        } finally {
          set({ isConnecting: false });
        }
      },

      disconnectWallet: () => {
        set({ wallet: null, agentId: null, agentApiKey: "", error: null });
        localStorage.removeItem("bonfire-rpg-agent-key");
        localStorage.removeItem("bonfire-rpg-agent-id");
      },

      setAgentId: (id) => {
        localStorage.setItem("bonfire-rpg-agent-id", id || "");
        set({ agentId: id });
      },

      setAgentApiKey: (key) => {
        localStorage.setItem("bonfire-rpg-agent-key", key || "");
        set({ agentApiKey: key });
      },

      loadPersistedAgent: () => {
        const key = localStorage.getItem("bonfire-rpg-agent-key") || "";
        const id = localStorage.getItem("bonfire-rpg-agent-id") || "";
        set({ agentApiKey: key, agentId: id || null });
      },

      findMyAgent: async (bonfireId) => {
        const { wallet } = get();
        if (!wallet) return null;
        try {
          const data = await api.getWalletPurchasedAgents(wallet, bonfireId);
          const agents = data.agents || data.records || data || [];
          if (Array.isArray(agents) && agents.length > 0) {
            const agent = agents[0];
            const agentId = agent.agent_id || agent.agentId;
            if (agentId) {
              get().setAgentId(agentId);
              return agentId;
            }
          }
          return null;
        } catch {
          return null;
        }
      },

      restorePlayer: async (bonfireId) => {
        const { wallet } = get();
        if (!wallet) return null;
        try {
          const data = await api.restorePlayer({ wallet_address: wallet, bonfire_id: bonfireId });
          if (data.agent_id) {
            get().setAgentId(data.agent_id);
            return data.agent_id;
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
    { name: "player-store" },
  ),
);

export { usePlayerStore };
