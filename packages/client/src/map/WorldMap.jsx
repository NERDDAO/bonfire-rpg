import { useMemo } from "react";
import { MapContainer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import { computeLayout, getEdges } from "./layout";
import "leaflet/dist/leaflet.css";

/**
 * Fantasy world map — force-directed room graph rendered on Leaflet.
 * No tile layer — dark background with room nodes and connection edges.
 */

const ROOM_COLORS = {
  current: "#f59e0b",    // amber-500 — player is here
  visited: "#78716c",    // stone-500 — been here
  discovered: "#44403c", // stone-700 — visible but not visited
  hasPlayers: "#22c55e", // green-500 — other players here
};

function FitBounds({ positions }) {
  const map = useMap();

  useMemo(() => {
    if (positions.length === 0) return;
    const lats = positions.map((p) => p[0]);
    const lngs = positions.map((p) => p[1]);
    const bounds = [
      [Math.min(...lats) - 0.02, Math.min(...lngs) - 0.02],
      [Math.max(...lats) + 0.02, Math.max(...lngs) + 0.02],
    ];
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  }, [positions.length]);

  return null;
}

const WorldMap = ({ rooms, players, currentRoom, visitedRooms = new Set() }) => {
  // Compute layout
  const layout = useMemo(() => computeLayout(rooms), [rooms]);
  const edges = useMemo(() => getEdges(rooms, layout), [rooms, layout]);

  // Track which rooms have other players
  const playerRooms = useMemo(() => {
    const map = new Map();
    for (const p of players || []) {
      if (p.current_room) {
        const count = map.get(p.current_room) || 0;
        map.set(p.current_room, count + 1);
      }
    }
    return map;
  }, [players]);

  // Collect all positions for bounds fitting
  const allPositions = useMemo(
    () => Array.from(layout.values()).map((p) => [p.lat, p.lng]),
    [layout],
  );

  if (rooms.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-amber-900/20 p-8 text-center text-gray-600">
        No rooms discovered yet.
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-amber-900/20 overflow-hidden">
      <MapContainer
        center={[0, 0]}
        zoom={14}
        style={{ height: "300px", width: "100%", background: "#0a0a0a" }}
        zoomControl={false}
        attributionControl={false}
      >
        <FitBounds positions={allPositions} />

        {/* Connection edges */}
        {edges.map((positions, i) => (
          <Polyline
            key={`edge-${i}`}
            positions={positions}
            color="#292524"
            weight={2}
            opacity={0.6}
          />
        ))}

        {/* Room nodes */}
        {rooms.map((room) => {
          const pos = layout.get(room.room_id);
          if (!pos) return null;

          const isCurrent = room.room_id === currentRoom;
          const hasOtherPlayers = playerRooms.has(room.room_id) && !isCurrent;
          const isVisited = visitedRooms.has(room.room_id);

          let color = ROOM_COLORS.discovered;
          if (isCurrent) color = ROOM_COLORS.current;
          else if (hasOtherPlayers) color = ROOM_COLORS.hasPlayers;
          else if (isVisited) color = ROOM_COLORS.visited;

          const radius = isCurrent ? 10 : 7;

          return (
            <CircleMarker
              key={room.room_id}
              center={[pos.lat, pos.lng]}
              radius={radius}
              pathOptions={{
                color: isCurrent ? "#fbbf24" : "#1c1917",
                fillColor: color,
                fillOpacity: 0.9,
                weight: isCurrent ? 3 : 1,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -10]}
                className="!bg-gray-900 !text-amber-100 !border-amber-900/30 !rounded-lg !px-2 !py-1 !text-xs"
              >
                <span className="font-medium">{room.name || room.room_id}</span>
                {isCurrent && <span className="text-amber-400 ml-1">(you)</span>}
                {hasOtherPlayers && (
                  <span className="text-green-400 ml-1">
                    ({playerRooms.get(room.room_id)} here)
                  </span>
                )}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default WorldMap;
