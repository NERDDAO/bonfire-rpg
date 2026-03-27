import { Backpack, MapPin, Users, Zap, DoorOpen } from "lucide-react";
import { usePlayerStore } from "@/stores/playerStore";
import { useGameStore } from "@/stores/gameStore";

const Sidebar = ({ bonfireId }) => {
  const { inventory, remainingEpisodes, turnsUsed, currentRoom } = usePlayerStore();
  const { rooms, npcs, objects } = useGameStore();

  // Get current room data
  const room = rooms.find(
    (r) => r.room_id === currentRoom || r.roomId === currentRoom,
  );

  // NPCs in current room
  const roomNpcs = npcs.filter(
    (n) => n.room_id === currentRoom || n.roomId === currentRoom,
  );

  // Objects in current room (not in player inventory)
  const roomObjects = objects.filter((o) => {
    const props = o.properties || {};
    return (
      props.location_type === "room" &&
      (props.location_id === currentRoom) &&
      !o.is_consumed
    );
  });

  // Player inventory items (resolve object_ids to ObjectState)
  const inventoryItems = inventory
    .map((id) => objects.find((o) => o.object_id === id || o.objectId === id))
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Episode Quota */}
      <div className="bg-gray-900 rounded-xl p-4 border border-amber-900/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400 flex items-center gap-1">
            <Zap className="w-4 h-4 text-amber-500" />
            Episodes
          </span>
          <span className="text-amber-100 font-mono">
            {remainingEpisodes}
          </span>
        </div>
        <div className="text-xs text-gray-500">{turnsUsed} turns taken</div>
      </div>

      {/* Current Room */}
      {room && (
        <div className="bg-gray-900 rounded-xl p-4 border border-amber-900/20">
          <h4 className="font-semibold text-amber-100 mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-500" />
            {room.name || "Unknown Room"}
          </h4>

          {/* Exits */}
          {room.connections && room.connections.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">Exits:</p>
              <div className="flex flex-wrap gap-1">
                {room.connections.map((conn) => (
                  <span
                    key={conn}
                    className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded flex items-center gap-1"
                  >
                    <DoorOpen className="w-3 h-3" />
                    {conn}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* NPCs */}
          {roomNpcs.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">NPCs:</p>
              {roomNpcs.map((npc) => (
                <div key={npc.npc_id || npc.npcId} className="text-sm text-gray-300">
                  <Users className="w-3 h-3 inline mr-1" />
                  {npc.name}
                </div>
              ))}
            </div>
          )}

          {/* Room items */}
          {roomObjects.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">Items here:</p>
              {roomObjects.map((obj) => (
                <div key={obj.object_id || obj.objectId} className="text-sm text-gray-300">
                  {obj.name} [{obj.obj_type || obj.objType}]
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inventory */}
      <div className="bg-gray-900 rounded-xl p-4 border border-amber-900/20">
        <h4 className="font-semibold text-amber-100 mb-2 flex items-center gap-2">
          <Backpack className="w-4 h-4 text-amber-500" />
          Inventory
        </h4>
        {inventoryItems.length > 0 ? (
          <div className="space-y-2">
            {inventoryItems.map((item) => (
              <div
                key={item.object_id || item.objectId}
                className="bg-gray-800 p-2 rounded-lg"
              >
                <p className="text-sm font-medium text-gray-100">{item.name}</p>
                <p className="text-xs text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No items yet.</p>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
