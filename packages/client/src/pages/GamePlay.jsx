import { useRef, useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Map, Backpack, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import AIGameLoader from "../components/AIGameLoader";
import PlayerInterface from "../components/UI/PlayerInterface";
import GameHistory from "../components/UI/GameHistory";
import Sidebar from "../components/UI/Sidebar";
import WorldMap from "../map/WorldMap";
import OOCChat from "../components/UI/OOCChat";
import RoundTimer from "../components/UI/RoundTimer";
import PlayerRoster from "../components/UI/PlayerRoster";
import DeathScreen from "../components/UI/DeathScreen";
import { useGameStore } from "@/stores/gameStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useNarrativeStore, WS_EVENT, MSG } from "@/stores/narrativeStore";
import { useWsStore } from "@/stores/wsStore";

function AgentKeyInput() {
  const { agentId, setAgentApiKey } = usePlayerStore();
  const [key, setKey] = useState("");

  return (
    <div className="text-center py-4 space-y-3">
      <p className="text-sm text-gray-400">Agent found: <span className="font-mono text-amber-300">{agentId?.slice(0, 12)}...</span></p>
      <p className="text-xs text-gray-500">Enter your agent API key to start playing.</p>
      <div className="flex gap-2 max-w-md mx-auto">
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Agent API key"
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-600"
        />
        <button
          type="button"
          onClick={() => { if (key.trim()) setAgentApiKey(key.trim()); }}
          disabled={!key.trim()}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium"
        >
          Enter
        </button>
      </div>
      <p className="text-xs text-gray-600">This is saved locally and sent as X-Agent-Api-Key.</p>
    </div>
  );
}

const WORLD_CHANGING_EVENTS = new Set([
  WS_EVENT.GM_REACTION, WS_EVENT.NPC_SPAWNED, WS_EVENT.ROOM_UPDATED,
  WS_EVENT.OBJECT_CREATED, WS_EVENT.PLAYER_MOVED,
]);

const GamePlay = () => {
  const params = useParams();
  const [, navigate] = useLocation();
  const bonfireId = decodeURIComponent(params.bonfireId);
  const chatEndRef = useRef(null);
  const lastDescribedRoom = useRef(null);

  const [showMap, setShowMap] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [visitedRooms, setVisitedRooms] = useState(new Set());

  const {
    loadGame, refreshMap, rooms, players, npcsByRoom, objectsByRoom,
    isLoading: gameLoading, status, error: gameError, lastGmReaction,
  } = useGameStore();

  const { wallet, agentId, agentApiKey, loadPersistedAgent, findMyAgent, restorePlayer } = usePlayerStore();
  const { history, isLoading: chatLoading, appendMessage, clearHistory, handleRoomEvent } = useNarrativeStore();
  const { connect, disconnect, connected } = useWsStore();

  // Derive current room from game state
  const myPlayer = players.find((p) => p.agent_id === agentId);
  const currentRoom = myPlayer?.current_room || "";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Load game + try to find agent on mount
  useEffect(() => {
    loadPersistedAgent();
    clearHistory();
    lastDescribedRoom.current = null;

    loadGame(bonfireId).then(() => {
      const { initialEpisodeSummary, gamePrompt, worldStateSummary } = useGameStore.getState();
      if (initialEpisodeSummary) appendMessage(MSG.NARRATOR, initialEpisodeSummary);
      else if (gamePrompt) appendMessage(MSG.NARRATOR, gamePrompt);
      if (worldStateSummary) appendMessage(MSG.GM, worldStateSummary);
    });
  }, [bonfireId]);

  // When wallet connects or game loads, try to find/restore agent
  useEffect(() => {
    if (wallet && !agentId && bonfireId && status) {
      findMyAgent(bonfireId).then((found) => {
        if (!found) restorePlayer(bonfireId);
      });
    }
  }, [wallet, bonfireId, status]);

  // Track visited rooms
  useEffect(() => {
    if (currentRoom) setVisitedRooms((prev) => new Set([...prev, currentRoom]));
  }, [currentRoom]);

  // WebSocket — connect when agent is registered, sign with wallet
  useEffect(() => {
    if (!agentId || !myPlayer) return;
    connect(agentId, {
      onEvent: (event) => {
        handleRoomEvent(event);
        const type = event.type || event.event_type;
        if (WORLD_CHANGING_EVENTS.has(type)) refreshMap();
      },
    });
    return () => disconnect();
  }, [agentId, !!myPlayer]);

  // Describe room on entry (deduplicated)
  useEffect(() => {
    if (!currentRoom || rooms.length === 0) return;
    if (lastDescribedRoom.current === currentRoom) return;
    lastDescribedRoom.current = currentRoom;

    const room = rooms.find((r) => r.room_id === currentRoom);
    if (!room) return;

    const exits = (room.connections || []).join(", ") || "none";
    appendMessage(MSG.SYSTEM, `--- ${room.name || "Unknown"} ---\n${room.description || ""}\nExits: ${exits}`);

    const npcs = npcsByRoom[currentRoom] || [];
    if (npcs.length > 0) appendMessage(MSG.SYSTEM, `You see: ${npcs.map((n) => n.name).join(", ")}`);
    const items = objectsByRoom[currentRoom] || [];
    if (items.length > 0) appendMessage(MSG.SYSTEM, `On the ground: ${items.map((o) => `${o.name} [${o.obj_type}]`).join(", ")}`);
  }, [currentRoom, rooms]);

  // Loading state
  if (gameLoading && !status) return <AIGameLoader />;

  // Error state
  if (gameError) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-300 mb-2">{gameError}</p>
        <button type="button" onClick={() => navigate("/")} className="mt-4 text-amber-500 hover:text-amber-400">
          Back to lobby
        </button>
      </div>
    );
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

  const handleOOCSend = (text) => {
    // TODO: Will be wired to WS/API in future
    console.log('[ooc] Send:', text);
  };

  const handlePurchaseLife = () => {
    // TODO: Will be wired to purchase flow
    console.log('[death] Purchase new life');
  };

  return (
    <>
    <DeathScreen onPurchaseLife={handlePurchaseLife} />
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
      <div className="lg:col-span-3 space-y-4">
        {/* Room header */}
        {currentRoomData && (
          <div className="bg-gray-900 rounded-2xl border border-amber-900/20 overflow-hidden">
            {currentRoomData.image_url && (
              <img src={currentRoomData.image_url} alt={currentRoomData.name} className="w-full h-36 sm:h-48 object-cover" />
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
          <button type="button" onClick={() => setShowMap((v) => !v)} className="flex-1 bg-gray-900 border border-amber-900/20 rounded-lg px-3 py-2 text-sm text-gray-300 flex items-center justify-center gap-2">
            <Map className="w-4 h-4 text-amber-500" /> Map
            {showMap ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button type="button" onClick={() => setShowSidebar((v) => !v)} className="flex-1 bg-gray-900 border border-amber-900/20 rounded-lg px-3 py-2 text-sm text-gray-300 flex items-center justify-center gap-2">
            <Backpack className="w-4 h-4 text-amber-500" /> Info
            {showSidebar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showSidebar && (
          <div className="lg:hidden">
            <Sidebar bonfireId={bonfireId} room={currentRoomData} npcs={currentNpcs} objects={currentObjects} />
          </div>
        )}

        {rooms.length > 0 && (
          <div className={`${showMap ? "block" : "hidden"} lg:block`}>
            <WorldMap rooms={rooms} players={players} currentRoom={currentRoom} visitedRooms={visitedRooms} />
          </div>
        )}

        <RoundTimer />

        <GameHistory chatEndRef={chatEndRef} />

        <div className="bg-gray-900 rounded-2xl p-3 sm:p-4 border border-amber-900/20">
          {agentId ? (
            <PlayerInterface bonfireId={bonfireId} />
          ) : wallet ? (
            <div className="text-center py-4 text-gray-500 space-y-2">
              <p className="text-sm">Wallet connected. Looking for your agent...</p>
              <button
                type="button"
                onClick={() => findMyAgent(bonfireId).then((id) => { if (!id) restorePlayer(bonfireId); })}
                className="text-xs text-amber-500 hover:text-amber-400 underline"
              >
                Retry agent lookup
              </button>
              <p className="text-xs text-gray-600">{wallet.slice(0, 10)}... on bonfire {bonfireId.slice(0, 8)}...</p>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <p className="text-sm">Connect your wallet to enter this world.</p>
              <p className="text-xs mt-1 text-gray-600">Spectator mode — viewing only.</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-600 px-1">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : agentId && myPlayer ? "bg-yellow-500" : "bg-gray-600"}`} />
          {connected ? "Connected" : agentId && myPlayer ? "Reconnecting..." : wallet ? "Spectating (no agent)" : "Spectating"}
          {lastGmReaction && (
            <span className="ml-auto text-gray-500 truncate max-w-[200px] sm:max-w-xs">GM: {lastGmReaction.slice(0, 80)}</span>
          )}
        </div>

        <OOCChat onSend={handleOOCSend} />
      </div>

      <div className="hidden lg:block space-y-4">
        <PlayerRoster />
        <Sidebar bonfireId={bonfireId} room={currentRoomData} npcs={currentNpcs} objects={currentObjects} />
      </div>
    </div>
    </>
  );
};

export default GamePlay;
