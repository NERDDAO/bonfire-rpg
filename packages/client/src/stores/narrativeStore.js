/**
 * Narrative store — chat history, player input, NPC interaction.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import * as api from "@/api/client";

const MAX_HISTORY = 300;

export const MSG = {
  NARRATOR: "narrator",
  PLAYER: "player",
  GM: "gm",
  NPC: "npc",
  SYSTEM: "system",
};

export const WS_EVENT = {
  ROOM_MESSAGE: "room_message",
  PLAYER_MOVED: "player_moved",
  GM_REACTION: "gm_reaction",
  NPC_SPAWNED: "npc_spawned",
  OBJECT_CREATED: "object_created",
  ROOM_UPDATED: "room_updated",
};

let _msgId = 0;

const useNarrativeStore = create(
  devtools(
    (set, get) => ({
      history: [],
      inputValue: "",
      isLoading: false,
      talkingToNpc: null,

      setInputValue: (value) => set({ inputValue: value }),

      appendMessage: (type, text, extra = {}) => {
        set((state) => {
          const entry = { id: ++_msgId, type, text, timestamp: Date.now(), ...extra };
          const next = [...state.history, entry];
          return { history: next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next };
        });
      },

      _submit: async (message, apiCall, responseType, extras = {}) => {
        if (get().isLoading || !message) return;

        set({ isLoading: true, inputValue: "" });
        get().appendMessage(MSG.PLAYER, message);

        try {
          const data = await apiCall(message);
          const reply = data.reply || data.response || data.message || "";
          if (reply) get().appendMessage(responseType, reply, extras(data));
          return data;
        } catch (err) {
          get().appendMessage(MSG.SYSTEM, `Error: ${err.message}`);
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      sendAction: (message, agentId, bonfireId, agentApiKey = "") => {
        return get()._submit(
          message,
          (text) => api.completeChat({ agent_id: agentId, bonfire_id: bonfireId, message: text }, agentApiKey),
          MSG.NARRATOR,
          () => ({}),
        );
      },

      talkToNpc: (message, agentId, npcId) => {
        return get()._submit(
          message,
          (text) => api.interactNpc({ agent_id: agentId, npc_id: npcId, message: text }),
          MSG.NPC,
          (data) => ({ npcName: data.npc_name || "NPC", npcId }),
        );
      },

      startNpcDialogue: (npc) => set({ talkingToNpc: npc }),
      endNpcDialogue: () => set({ talkingToNpc: null }),

      handleRoomEvent: (event) => {
        const eventType = event.type || event.event_type;
        const payload = event.payload || event;
        const append = get().appendMessage;

        switch (eventType) {
          case WS_EVENT.ROOM_MESSAGE:
            append(MSG.NARRATOR, payload.text || JSON.stringify(payload));
            break;
          case WS_EVENT.PLAYER_MOVED:
            append(MSG.SYSTEM, `A traveler enters: ${payload.agent_id?.slice(0, 8)}...`);
            break;
          case WS_EVENT.GM_REACTION:
            append(MSG.GM, payload.reaction || payload.text || "The world shifts...");
            break;
          case WS_EVENT.NPC_SPAWNED:
            append(MSG.SYSTEM, `A new figure appears: ${payload.name || "someone"}`);
            break;
          case WS_EVENT.OBJECT_CREATED:
            append(MSG.SYSTEM, `Something new: ${payload.name || "an object"}`);
            break;
          case WS_EVENT.ROOM_UPDATED:
            append(MSG.SYSTEM, "The surroundings change...");
            break;
          default:
            break;
        }
      },

      clearHistory: () => set({ history: [], inputValue: "", talkingToNpc: null }),
    }),
    { name: "narrative-store" },
  ),
);

export { useNarrativeStore };
