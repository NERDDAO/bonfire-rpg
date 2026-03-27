import { useRef, useEffect } from "react";
import { useParams } from "wouter";
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
  const bonfireId = decodeURIComponent(params.bonfireId);
  const chatEndRef = useRef(null);

  const { loadGameState, rooms, isLoading: gameLoading, status } = useGameStore();
  const { agentId, currentRoom, agentApiKey, loadAgentApiKey } = usePlayerStore();
  const { history, isLoading: chatLoading, appendMessage } = useNarrativeStore();
  const { connect, disconnect, connected } = useWsStore();
  const handleRoomEvent = useNarrativeStore((s) => s.handleRoomEvent);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Load game state on mount
  useEffect(() => {
    loadAgentApiKey();
    loadGameState(bonfireId);
  }, [bonfireId]);

  // Connect WebSocket when we have an agent
  useEffect(() => {
    if (agentId) {
      connect(agentId, { onEvent: handleRoomEvent });
      return () => disconnect();
    }
  }, [agentId]);

  // Show room description when entering a room
  useEffect(() => {
    if (currentRoom && rooms.length > 0) {
      const room = rooms.find(
        (r) => r.room_id === currentRoom || r.roomId === currentRoom,
      );
      if (room) {
        const name = room.name || "Unknown";
        const desc = room.description || "";
        appendMessage("system", `You are in ${name}. ${desc}`);
      }
    }
  }, [currentRoom]);

  const isLoading = gameLoading || chatLoading;

  if (gameLoading && !status) {
    return <AIGameLoader />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Main — Narrative */}
      <div className="lg:col-span-3 space-y-4">
        <GameHistory chatEndRef={chatEndRef} />

        <div className="bg-gray-900 rounded-2xl p-6 border border-amber-900/20">
          {/* Room header */}
          {currentRoom && rooms.length > 0 && (() => {
            const room = rooms.find(
              (r) => r.room_id === currentRoom || r.roomId === currentRoom,
            );
            if (!room) return null;
            return (
              <div className="mb-4 pb-4 border-b border-gray-800">
                <h3 className="text-lg font-semibold text-amber-100">
                  {room.name || "Unknown Room"}
                </h3>
                {room.image_url && (
                  <img
                    src={room.image_url}
                    alt={room.name}
                    className="w-full h-48 object-cover rounded-lg mt-2"
                  />
                )}
              </div>
            );
          })()}

          {!isLoading && agentId && (
            <PlayerInterface
              bonfireId={bonfireId}
              agentId={agentId}
              agentApiKey={agentApiKey}
            />
          )}

          {!agentId && (
            <div className="text-center py-8 text-gray-500">
              <p>Connect your wallet and purchase an agent to enter this world.</p>
              <p className="text-sm mt-1 text-gray-600">
                Spectator mode — you can view the world but not interact.
              </p>
            </div>
          )}
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-600"}`}
          />
          {connected ? "Connected" : agentId ? "Disconnected" : "Spectating"}
        </div>
      </div>

      {/* Sidebar — Inventory & Room Info */}
      <Sidebar bonfireId={bonfireId} />
    </div>
  );
};

export default GamePlay;
