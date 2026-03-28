/**
 * Game state store — world, rooms, NPCs, objects, quests.
 * Uses GET /game/details for metadata + GET /game/map for spatial data.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import * as api from "@/api/client";

let _refreshTimer = null;
function debouncedRefresh(fn, delay = 400) {
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(fn, delay);
}

const useGameStore = create(
  devtools(
    (set, get) => ({
      // --- state ---
      bonfireId: null,
      gamePrompt: "",
      status: null,
      worldStateSummary: "",
      lastGmReaction: "",
      initialEpisodeSummary: "",
      gmAgentId: null,

      // Spatial data (from /game/map)
      rooms: [],           // [{room_id, name, description, connections, image_url, ...}]
      players: [],         // [{agent_id, wallet, current_room}]
      npcsByRoom: {},      // {room_id: [{npc_id, name, description, personality}]}
      objectsByRoom: {},   // {room_id: [{object_id, name, obj_type, description}]}

      // Game state (from /game/state)
      quests: [],
      agentContext: [],

      // Feed
      feed: [],

      // Active games list
      activeGames: [],

      isLoading: false,
      error: null,

      // --- actions ---

      loadActiveGames: async () => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.listActiveGames();
          set({ activeGames: data.games || [] });
        } catch (err) {
          set({ error: err.message });
        }
        set({ isLoading: false });
      },

      loadGame: async (bonfireId) => {
        set({ isLoading: true, error: null, bonfireId });
        try {
          const [details, map, state] = await Promise.all([
            api.getGameDetails(bonfireId).catch(() => null),
            api.getMap(bonfireId).catch(() => null),
            api.getGameState(bonfireId).catch(() => null),
          ]);

          // Distinguish backend unreachable from no game
          if (!details && !map && !state) {
            set({ error: "Cannot reach game server. Is the engine running?" });
            set({ isLoading: false });
            return;
          }

          const updates = {};

          if (details?.game) {
            const g = details.game;
            updates.gamePrompt = g.game_prompt || "";
            updates.status = g.status || "active";
            updates.worldStateSummary = g.world_state_summary || "";
            updates.lastGmReaction = g.last_gm_reaction || "";
            updates.initialEpisodeSummary = g.initial_episode_summary || "";
            updates.gmAgentId = g.gm_agent_id || null;
          }

          if (map) {
            updates.rooms = map.rooms || [];
            updates.players = map.players || [];
            updates.npcsByRoom = map.npcs_by_room || {};
            updates.objectsByRoom = map.objects_by_room || {};
          }

          if (state) {
            updates.quests = state.quests || [];
            updates.agentContext = state.agent_context || [];
          }

          set(updates);
        } catch (err) {
          set({ error: err.message });
        }
        set({ isLoading: false });
      },

      refreshMap: () => {
        debouncedRefresh(async () => {
          const { bonfireId } = get();
          if (!bonfireId) return;
          try {
            const map = await api.getMap(bonfireId);
            set({
              rooms: map.rooms || [],
              players: map.players || [],
              npcsByRoom: map.npcs_by_room || {},
              objectsByRoom: map.objects_by_room || {},
            });
          } catch (err) {
            console.error("Failed to refresh map:", err);
          }
        });
      },

      loadFeed: async (bonfireId) => {
        try {
          const data = await api.getGameFeed(bonfireId || get().bonfireId);
          set({ feed: data.events || [] });
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

      claimQuest: async (questId, agentId, submission, agentApiKey = "") => {
        const result = await api.claimQuest({ quest_id: questId, agent_id: agentId, submission }, agentApiKey);
        get().refreshMap();
        return result;
      },

      getRoom: (roomId) => {
        return get().rooms.find((r) => r.room_id === roomId);
      },

      clearGame: () =>
        set({
          bonfireId: null,
          gamePrompt: "",
          status: null,
          worldStateSummary: "",
          lastGmReaction: "",
          initialEpisodeSummary: "",
          gmAgentId: null,
          rooms: [],
          players: [],
          npcsByRoom: {},
          objectsByRoom: {},
          quests: [],
          agentContext: [],
          feed: [],
          error: null,
        }),
    }),
    { name: "game-store" },
  ),
);

export { useGameStore };
