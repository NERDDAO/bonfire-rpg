/**
 * Narrative store — chat history, player input, loading state.
 * Replaces rpg-ai's gameState/gameHistory/messages with quest-game-backed narrative.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import * as api from "@/api/client";

const useNarrativeStore = create(
  devtools(
    (set, get) => ({
      // --- state ---
      history: [], // {type: "narrator"|"player"|"gm"|"system", text, timestamp}
      inputValue: "",
      isLoading: false,

      // --- actions ---

      setInputValue: (value) => set({ inputValue: value }),

      appendMessage: (type, text) => {
        set((state) => ({
          history: [
            ...state.history,
            { type, text, timestamp: Date.now() },
          ],
        }));
      },

      takeTurn: async (agentId, bonfireId, message, agentApiKey = "") => {
        const state = get();
        if (state.isLoading) return;

        set({ isLoading: true, inputValue: "" });

        // Add player message to history immediately
        state.appendMessage("player", message);

        try {
          const data = await api.completeChat(
            {
              agent_id: agentId,
              bonfire_id: bonfireId,
              message,
              as_game_master: false,
            },
            agentApiKey,
          );

          // Add narrator response
          const reply = data.reply || data.response || data.message || "";
          if (reply) {
            get().appendMessage("narrator", reply);
          }

          // Return full response for graph data, htn status, etc.
          return data;
        } catch (err) {
          get().appendMessage("system", `Error: ${err.message}`);
          throw err;
        } finally {
          set({ isLoading: false });
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
            get().appendMessage("system", `${payload.agent_id?.slice(0, 8)} entered the room.`);
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
          default:
            // Log unknown events for debugging
            console.log("[narrative] unhandled event:", eventType, payload);
        }
      },

      clearHistory: () => set({ history: [], inputValue: "" }),
    }),
    { name: "narrative-store" },
  ),
);

export { useNarrativeStore };
