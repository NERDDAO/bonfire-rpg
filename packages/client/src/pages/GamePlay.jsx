import { useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import AIGameLoader from "../components/AIGameLoader";
import PlayerInterface from "../components/UI/PlayerInterface";
import GameHistory from "../components/UI/GameHistory";
import Sidebar from "../components/UI/Sidebar";
import { useGameStore } from "@/stores/gameStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useNarrativeStore } from "@/stores/narrativeStore";
import { useWsStore } from "@/stores/wsStore";

const GamePlay = () => {
  const params = useParams();
  const [, navigate] = useLocation();
  const bonfireId = decodeURIComponent(params.bonfireId);
  const chatEndRef = useRef(null);

  const {
    loadGame, refreshMap, rooms, players, npcsByRoom, objectsByRoom,
    isLoading: gameLoading, status, gamePrompt, worldStateSummary,
    initialEpisodeSummary, lastGmReaction,
  } = useGameStore();

  const { agentId, currentRoom, agentApiKey, loadAgentApiKey, updateFromGameState } = usePlayerStore();
  const { history, isLoading: chatLoading, appendMessage, clearHistory } = useNarrativeStore();
  const { connect, disconnect, connected } = useWsStore();
  const handleRoomEvent = useNarrativeStore((s) => s.handleRoomEvent);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Load game on mount
  useEffect(() => {
    loadAgentApiKey();
    clearHistory();
    loadGame(bonfireId).then(() => {
      // Show initial world description
      const game = useGameStore.getState();
      if (game.initialEpisodeSummary) {
        appendMessage("narrator", game.initialEpisodeSummary);
      } else if (game.gamePrompt) {
        appendMessage("narrator", game.gamePrompt);
      }
      if (game.worldStateSummary) {
        appendMessage("gm", game.worldStateSummary);
      }
    });
  }, [bonfireId]);

  // Update player state from map data
  useEffect(() => {
    if (players.length > 0 && agentId) {
      const self = players.find((p) => p.agent_id === agentId);
      if (self) {
        usePlayerStore.setState({
          currentRoom: self.current_room || "",
        });
      }
    }
  }, [players, agentId]);

  // Connect WebSocket when agent is set
  useEffect(() => {
    if (agentId) {
      connect(agentId, {
        onEvent: (event) => {
          handleRoomEvent(event);
          // Refresh map after world-changing events
          const type = event.type || event.event_type;
          if (["gm_reaction", "npc_spawned", "room_updated", "object_created", "player_moved"].includes(type)) {
            refreshMap();
          }
        },
      });
      return () => disconnect();
    }
  }, [agentId]);

  // Describe room when entering
  useEffect(() => {
    if (!currentRoom || rooms.length === 0) return;
    const room = rooms.find((r) => r.room_id === currentRoom);
    if (room) {
      const exits = (room.connections || []).join(", ") || "none";
      appendMessage("system", `--- ${room.name || "Unknown"} ---\n${room.description || ""}\nExits: ${exits}`);

      // List NPCs
      const npcs = npcsByRoom[currentRoom] || [];
      if (npcs.length > 0) {
        const names = npcs.map((n) => n.name).join(", ");
        appendMessage("system", `You see: ${names}`);
      }

      // List items
      const items = objectsByRoom[currentRoom] || [];
      if (items.length > 0) {
        const names = items.map((o) => `${o.name} [${o.obj_type}]`).join(", ");
        appendMessage("system", `On the ground: ${names}`);
      }
    }
  }, [currentRoom]);

  const isLoading = gameLoading || chatLoading;

  if (gameLoading && !status) {
    return <AIGameLoader />;
  }

  if (!status) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">No active game found for this world.</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-4 text-amber-500 hover:text-amber-400"
        >
          Back to lobby
        </button>
      </div>
    );
  }

  const currentRoomData = rooms.find((r) => r.room_id === currentRoom);
  const currentNpcs = npcsByRoom[currentRoom] || [];
  const currentObjects = objectsByRoom[currentRoom] || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Main — Narrative */}
      <div className="lg:col-span-3 space-y-4">
        {/* Room header with image */}
        {currentRoomData && (
          <div className="bg-gray-900 rounded-2xl border border-amber-900/20 overflow-hidden">
            {currentRoomData.image_url && (
              <img
                src={currentRoomData.image_url}
                alt={currentRoomData.name}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4">
              <h2 className="text-xl font-bold text-amber-100">{currentRoomData.name}</h2>
              {currentRoomData.latest_summary && (
                <p className="text-gray-400 text-sm mt-1">{currentRoomData.latest_summary}</p>
              )}
            </div>
          </div>
        )}

        {/* Narrative log */}
        <GameHistory chatEndRef={chatEndRef} />

        {/* Player input */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-amber-900/20">
          {agentId ? (
            <PlayerInterface bonfireId={bonfireId} />
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p>Connect your wallet and purchase an agent to enter this world.</p>
              <p className="text-sm mt-1 text-gray-600">Spectator mode — viewing only.</p>
            </div>
          )}
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-600"}`} />
          {connected ? "Connected" : agentId ? "Disconnected" : "Spectating"}
          {lastGmReaction && (
            <span className="ml-auto text-gray-500 truncate max-w-xs">
              GM: {lastGmReaction.slice(0, 80)}...
            </span>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar
        bonfireId={bonfireId}
        room={currentRoomData}
        npcs={currentNpcs}
        objects={currentObjects}
      />
    </div>
  );
};

export default GamePlay;
