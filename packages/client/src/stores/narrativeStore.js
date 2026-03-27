/**
 * Narrative store — chat history, player input, NPC interaction.
 * Core gameplay loop: player types → API call → response displayed.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import * as api from "@/api/client";

const useNarrativeStore = create(
  devtools(
    (set, get) => ({
      // --- state ---
      history: [], // {type, text, timestamp, ?npcName, ?npcId}
      inputValue: "",
      isLoading: false,
      talkingToNpc: null, // {npc_id, name} when in NPC dialogue mode

      // --- actions ---

      setInputValue: (value) => set({ inputValue: value }),

      appendMessage: (type, text, extra = {}) => {
        set((state) => ({
          history: [
            ...state.history,
            { type, text, timestamp: Date.now(), ...extra },
          ],
        }));
      },

      // Main gameplay action — talk to your narrator agent
      sendAction: async (agentId, bonfireId, message, agentApiKey = "") => {
        const state = get();
        if (state.isLoading || !message.trim()) return;

        set({ isLoading: true, inputValue: "" });
        state.appendMessage("player", message);

        try {
          const data = await api.completeChat(
            { agent_id: agentId, bonfire_id: bonfireId, message },
            agentApiKey,
          );

          const reply = data.reply || data.response || data.message || "";
          if (reply) {
            get().appendMessage("narrator", reply);
          }

          // Return data so GamePlay can trigger map refresh if needed
          return data;
        } catch (err) {
          get().appendMessage("system", `Error: ${err.message}`);
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      // Talk to a specific NPC
      talkToNpc: async (agentId, npcId, message) => {
        const state = get();
        if (state.isLoading || !message.trim()) return;

        set({ isLoading: true, inputValue: "" });
        state.appendMessage("player", message);

        try {
          const data = await api.interactNpc({
            agent_id: agentId,
            npc_id: npcId,
            message,
          });

          const npcName = data.npc_name || "NPC";
          const reply = data.reply || "";
          if (reply) {
            get().appendMessage("npc", reply, { npcName, npcId });
          }
          return data;
        } catch (err) {
          get().appendMessage("system", `Error: ${err.message}`);
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      startNpcDialogue: (npc) => set({ talkingToNpc: npc }),
      endNpcDialogue: () => set({ talkingToNpc: null }),

      // Load existing room chat messages
      loadRoomChat: async (roomId) => {
        try {
          const data = await api.getRoomChat(roomId, 30);
          const messages = data.messages || [];
          for (const msg of messages) {
            const role = msg.role || "system";
            const text = msg.text || "";
            const sender = msg.sender_agent_id || "";
            if (role === "npc") {
              get().appendMessage("npc", text, { npcName: sender });
            } else if (role === "player") {
              get().appendMessage("player", text);
            } else {
              get().appendMessage("system", text);
            }
          }
        } catch {
          // Room chat may not exist yet
        }
      },

      // Handle WebSocket room event
      handleRoomEvent: (event) => {
        const eventType = event.type || event.event_type;
        const payload = event.payload || event;

        switch (eventType) {
          case "room_message":
            get().appendMessage("narrator", payload.text || JSON.stringify(payload));
            break;
          case "player_moved":
            get().appendMessage("system", `A traveler enters: ${payload.agent_id?.slice(0, 8)}...`);
            break;
          case "gm_reaction":
            get().appendMessage("gm", payload.reaction || payload.text || "The world shifts...");
            break;
          case "npc_spawned":
            get().appendMessage("system", `A new figure appears: ${payload.name || "someone"}`);
            break;
          case "object_created":
            get().appendMessage("system", `Something new: ${payload.name || "an object"}`);
            break;
          case "room_updated":
            get().appendMessage("system", "The surroundings change...");
            break;
          default:
            console.log("[narrative] unhandled event:", eventType, payload);
        }
      },

      clearHistory: () => set({ history: [], inputValue: "", talkingToNpc: null }),
    }),
    { name: "narrative-store" },
  ),
);

export { useNarrativeStore };
