import { useRef, useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Map, Backpack, ChevronDown, ChevronUp } from "lucide-react";
import AIGameLoader from "../components/AIGameLoader";
import PlayerInterface from "../components/UI/PlayerInterface";
import GameHistory from "../components/UI/GameHistory";
import Sidebar from "../components/UI/Sidebar";
import WorldMap from "../map/WorldMap";
import { useGameStore } from "@/stores/gameStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useNarrativeStore } from "@/stores/narrativeStore";
import { useWsStore } from "@/stores/wsStore";

const GamePlay = () => {
  const params = useParams();
  const [, navigate] = useLocation();
  const bonfireId = decodeURIComponent(params.bonfireId);
  const chatEndRef = useRef(null);

  // Mobile toggles
  const [showMap, setShowMap] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // Visited rooms tracking
  const [visitedRooms, setVisitedRooms] = useState(new Set());

  const {
    loadGame, refreshMap, rooms, players, npcsByRoom, objectsByRoom,
    isLoading: gameLoading, status, gamePrompt, worldStateSummary,
    initialEpisodeSummary, lastGmReaction,
  } = useGameStore();

  const { agentId, currentRoom, agentApiKey, loadAgentApiKey } = usePlayerStore();
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

  // Update player room from map data
  useEffect(() => {
    if (players.length > 0 && agentId) {
      const self = players.find((p) => p.agent_id === agentId);
      if (self) {
        usePlayerStore.setState({ currentRoom: self.current_room || "" });
      }
    }
  }, [players, agentId]);

  // Track visited rooms
  useEffect(() => {
    if (currentRoom) {
      setVisitedRooms((prev) => new Set([...prev, currentRoom]));
    }
  }, [currentRoom]);

  // Connect WebSocket
  useEffect(() => {
    if (agentId) {
      connect(agentId, {
        onEvent: (event) => {
          handleRoomEvent(event);
          const type = event.type || event.event_type;
          if (["gm_reaction", "npc_spawned", "room_updated", "object_created", "player_moved"].includes(type)) {
            refreshMap();
          }
        },
      });
      return () => disconnect();
    }
  }, [agentId]);

  // Describe room on entry
  useEffect(() => {
    if (!currentRoom || rooms.length === 0) return;
    const room = rooms.find((r) => r.room_id === currentRoom);
    if (room) {
      const exits = (room.connections || []).join(", ") || "none";
      appendMessage("system", `--- ${room.name || "Unknown"} ---\n${room.description || ""}\nExits: ${exits}`);

      const npcs = npcsByRoom[currentRoom] || [];
      if (npcs.length > 0) {
        appendMessage("system", `You see: ${npcs.map((n) => n.name).join(", ")}`);
      }

      const items = objectsByRoom[currentRoom] || [];
      if (items.length > 0) {
        appendMessage("system", `On the ground: ${items.map((o) => `${o.name} [${o.obj_type}]`).join(", ")}`);
      }
    }
  }, [currentRoom]);

  if (gameLoading && !status) {
    return <AIGameLoader />;
  }

  if (!status) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">No active game found for this world.</p>
        <button type="button" onClick={() => navigate("/")} className="mt-4 text-amber-500 hover:text-amber-400">
          Back to lobby
        </button>
      </div>
    );
  }

  const currentRoomData = rooms.find((r) => r.room_id === currentRoom);
  const currentNpcs = npcsByRoom[currentRoom] || [];
  const currentObjects = objectsByRoom[currentRoom] || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
      {/* Main column */}
      <div className="lg:col-span-3 space-y-4">
        {/* Room header */}
        {currentRoomData && (
          <div className="bg-gray-900 rounded-2xl border border-amber-900/20 overflow-hidden">
            {currentRoomData.image_url && (
              <img
                src={currentRoomData.image_url}
                alt={currentRoomData.name}
                className="w-full h-36 sm:h-48 object-cover"
              />
            )}
            <div className="p-3 sm:p-4">
              <h2 className="text-lg sm:text-xl font-bold text-amber-100">{currentRoomData.name}</h2>
              {currentRoomData.latest_summary && (
                <p className="text-gray-400 text-sm mt-1 line-clamp-2">{currentRoomData.latest_summary}</p>
              )}
            </div>
          </div>
        )}

        {/* Mobile toggles */}
        <div className="flex gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="flex-1 bg-gray-900 border border-amber-900/20 rounded-lg px-3 py-2 text-sm text-gray-300 flex items-center justify-center gap-2"
          >
            <Map className="w-4 h-4 text-amber-500" />
            Map
            {showMap ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={() => setShowSidebar((v) => !v)}
            className="flex-1 bg-gray-900 border border-amber-900/20 rounded-lg px-3 py-2 text-sm text-gray-300 flex items-center justify-center gap-2"
          >
            <Backpack className="w-4 h-4 text-amber-500" />
            Info
            {showSidebar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Mobile sidebar (collapsible) */}
        {showSidebar && (
          <div className="lg:hidden">
            <Sidebar bonfireId={bonfireId} room={currentRoomData} npcs={currentNpcs} objects={currentObjects} />
          </div>
        )}

        {/* World Map — always visible on desktop, collapsible on mobile */}
        {rooms.length > 0 && (
          <div className={`${showMap ? "block" : "hidden"} lg:block`}>
            <WorldMap rooms={rooms} players={players} currentRoom={currentRoom} visitedRooms={visitedRooms} />
          </div>
        )}

        {/* Narrative log */}
        <GameHistory chatEndRef={chatEndRef} />

        {/* Player input */}
        <div className="bg-gray-900 rounded-2xl p-3 sm:p-4 border border-amber-900/20">
          {agentId ? (
            <PlayerInterface bonfireId={bonfireId} />
          ) : (
            <div className="text-center py-4 sm:py-6 text-gray-500">
              <p className="text-sm">Connect your wallet and purchase an agent to enter this world.</p>
              <p className="text-xs mt-1 text-gray-600">Spectator mode — viewing only.</p>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-2 text-xs text-gray-600 px-1">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-600"}`} />
          {connected ? "Connected" : agentId ? "Disconnected" : "Spectating"}
          {lastGmReaction && (
            <span className="ml-auto text-gray-500 truncate max-w-[200px] sm:max-w-xs">
              GM: {lastGmReaction.slice(0, 80)}
            </span>
          )}
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar bonfireId={bonfireId} room={currentRoomData} npcs={currentNpcs} objects={currentObjects} />
      </div>
    </div>
  );
};

export default GamePlay;
