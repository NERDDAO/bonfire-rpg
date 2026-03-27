/**
 * Game state store — world, rooms, active game info.
 * Mirrors bonfire-quest-game GameState + RoomState models.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import * as api from "@/api/client";

const useGameStore = create(
  devtools(
    (set, get) => ({
      // --- state ---
      bonfireId: null,
      gamePrompt: "",
      status: null, // "active" | null
      worldStateSummary: "",
      lastGmReaction: "",
      rooms: [], // RoomState[]
      npcs: [], // NpcState[]
      objects: [], // ObjectState[]
      quests: [], // QuestState[]
      feed: [], // activity feed
      activeGames: [], // from list-active
      isLoading: false,
      error: null,

      // --- actions ---

      loadActiveGames: async () => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.listActiveGames();
          set({ activeGames: data.games || data || [] });
        } catch (err) {
          set({ error: err.message });
        }
        set({ isLoading: false });
      },

      loadGameState: async (bonfireId) => {
        set({ isLoading: true, error: null, bonfireId });
        try {
          const data = await api.getGameState(bonfireId);
          set({
            gamePrompt: data.game_prompt || "",
            status: data.status || "active",
            worldStateSummary: data.world_state_summary || "",
            lastGmReaction: data.last_gm_reaction || "",
            rooms: data.rooms || [],
            npcs: data.npcs || [],
            objects: data.objects || [],
            quests: data.quests || [],
          });
        } catch (err) {
          set({ error: err.message });
        }
        set({ isLoading: false });
      },

      loadFeed: async (bonfireId) => {
        try {
          const data = await api.getGameFeed(bonfireId || get().bonfireId);
          set({ feed: data.feed || data.events || [] });
        } catch (err) {
          console.error("Failed to load feed:", err);
        }
      },

      createGame: async (body) => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.createGame(body);
          set({ bonfireId: body.bonfire_id, status: "active" });
          return data;
        } catch (err) {
          set({ error: err.message });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      // Apply a GM decision delta to local state (from WS event)
      applyGmDelta: (delta) => {
        const state = get();
        const newRooms = delta.new_rooms_created || [];
        const updatedRooms = delta.rooms_updated || [];
        const newNpcs = delta.npcs_created || [];

        if (newRooms.length || updatedRooms.length) {
          // Re-fetch full state for simplicity — room data is complex
          state.loadGameState(state.bonfireId);
        }
        if (newNpcs.length) {
          state.loadGameState(state.bonfireId);
        }
      },

      clearGame: () =>
        set({
          bonfireId: null,
          gamePrompt: "",
          status: null,
          worldStateSummary: "",
          lastGmReaction: "",
          rooms: [],
          npcs: [],
          objects: [],
          quests: [],
          feed: [],
          error: null,
        }),
    }),
    { name: "game-store" },
  ),
);

export { useGameStore };
