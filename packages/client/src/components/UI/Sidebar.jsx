import { Backpack, MapPin, Users, Zap, DoorOpen, MessageCircle, Sword } from "lucide-react";
import { usePlayerStore } from "@/stores/playerStore";
import { useNarrativeStore } from "@/stores/narrativeStore";
import { useGameStore } from "@/stores/gameStore";

const Sidebar = ({ bonfireId, room, npcs, objects }) => {
  const { inventory, remainingEpisodes, turnsUsed, agentId } = usePlayerStore();
  const { startNpcDialogue } = useNarrativeStore();
  const quests = useGameStore((s) => s.quests);

  return (
    <div className="space-y-4">
      {/* Episode Quota */}
      {agentId && (
        <div className="bg-gray-900 rounded-xl p-4 border border-amber-900/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400 flex items-center gap-1">
              <Zap className="w-4 h-4 text-amber-500" />
              Episodes
            </span>
            <span className="text-amber-100 font-mono text-lg">{remainingEpisodes}</span>
          </div>
          <div className="text-xs text-gray-600 mt-1">{turnsUsed} turns taken</div>
        </div>
      )}

      {/* Current Room */}
      {room && (
        <div className="bg-gray-900 rounded-xl p-4 border border-amber-900/20">
          <h4 className="font-semibold text-amber-100 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-500" />
            {room.name || "Unknown"}
          </h4>

          {/* Exits */}
          {room.connections?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1.5">Exits</p>
              <div className="flex flex-wrap gap-1.5">
                {room.connections.map((conn) => (
                  <span
                    key={conn}
                    className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-md flex items-center gap-1 hover:bg-gray-750 cursor-pointer"
                  >
                    <DoorOpen className="w-3 h-3 text-gray-500" />
                    {conn}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* NPCs */}
          {npcs.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1.5">Characters</p>
              <div className="space-y-1.5">
                {npcs.map((npc) => (
                  <button
                    key={npc.npc_id}
                    type="button"
                    onClick={() => startNpcDialogue(npc)}
                    className="w-full text-left bg-gray-800 hover:bg-gray-750 p-2 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 font-medium">{npc.name}</p>
                        {npc.description && (
                          <p className="text-xs text-gray-500 truncate">{npc.description}</p>
                        )}
                      </div>
                      <MessageCircle className="w-3 h-3 text-gray-600 group-hover:text-amber-500" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Room items */}
          {objects.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Items</p>
              <div className="space-y-1">
                {objects.map((obj) => (
                  <div key={obj.object_id} className="text-sm text-gray-300 bg-gray-800 p-2 rounded-lg">
                    <span className="text-amber-200">{obj.name}</span>
                    <span className="text-gray-500 text-xs ml-1">[{obj.obj_type}]</span>
                    {obj.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{obj.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inventory */}
      {agentId && (
        <div className="bg-gray-900 rounded-xl p-4 border border-amber-900/20">
          <h4 className="font-semibold text-amber-100 mb-3 flex items-center gap-2">
            <Backpack className="w-4 h-4 text-amber-500" />
            Inventory
          </h4>
          {inventory.length > 0 ? (
            <div className="space-y-1.5">
              {inventory.map((itemId) => (
                <div key={itemId} className="bg-gray-800 p-2 rounded-lg text-sm text-gray-300">
                  {itemId}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">Empty</p>
          )}
        </div>
      )}

      {/* Quests */}
      {quests.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4 border border-amber-900/20">
          <h4 className="font-semibold text-amber-100 mb-3 flex items-center gap-2">
            <Sword className="w-4 h-4 text-amber-500" />
            Quests
          </h4>
          <div className="space-y-2">
            {quests
              .filter((q) => q.status === "active")
              .map((q) => (
                <div key={q.quest_id} className="bg-gray-800 p-2 rounded-lg">
                  <p className="text-sm text-gray-200">{q.prompt}</p>
                  <p className="text-xs text-amber-500 mt-1">Reward: +{q.reward} episodes</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
