/**
 * Force-directed layout for room connection graph.
 * Converts rooms + connections into stable x/y positions.
 * Projects to fake lat/lng for Leaflet consumption.
 */

const REPULSION = 120;
const ATTRACTION = 0.05;
const DAMPING = 0.85;
const ITERATIONS = 150;
const SCALE = 0.001; // Convert pixel positions to lat/lng scale

/**
 * Compute positions for rooms using a simple force-directed algorithm.
 * @param {Array} rooms - [{room_id, name, connections: [room_id]}]
 * @returns {Map<string, {lat: number, lng: number}>} - room_id → position
 */
export function computeLayout(rooms) {
  if (!rooms || rooms.length === 0) return new Map();

  // Build adjacency from connections (connections are room names or IDs)
  const nameToId = new Map();
  for (const room of rooms) {
    nameToId.set(room.name?.toLowerCase(), room.room_id);
    nameToId.set(room.room_id, room.room_id);
  }

  // Initialize positions with slight randomness
  const positions = new Map();
  const velocities = new Map();

  for (let i = 0; i < rooms.length; i++) {
    const angle = (2 * Math.PI * i) / rooms.length;
    const radius = 100 + Math.random() * 50;
    positions.set(rooms[i].room_id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
    velocities.set(rooms[i].room_id, { x: 0, y: 0 });
  }

  // Build edge list
  const edges = [];
  for (const room of rooms) {
    for (const conn of room.connections || []) {
      const targetId = nameToId.get(conn?.toLowerCase()) || nameToId.get(conn);
      if (targetId && targetId !== room.room_id) {
        edges.push([room.room_id, targetId]);
      }
    }
  }

  // Run simulation
  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = positions.get(rooms[i].room_id);
        const b = positions.get(rooms[j].room_id);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (REPULSION * REPULSION) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        const va = velocities.get(rooms[i].room_id);
        const vb = velocities.get(rooms[j].room_id);
        va.x += fx;
        va.y += fy;
        vb.x -= fx;
        vb.y -= fy;
      }
    }

    // Attraction along edges
    for (const [srcId, tgtId] of edges) {
      const a = positions.get(srcId);
      const b = positions.get(tgtId);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const fx = dx * ATTRACTION;
      const fy = dy * ATTRACTION;

      velocities.get(srcId).x += fx;
      velocities.get(srcId).y += fy;
      velocities.get(tgtId).x -= fx;
      velocities.get(tgtId).y -= fy;
    }

    // Apply velocities with damping
    for (const room of rooms) {
      const pos = positions.get(room.room_id);
      const vel = velocities.get(room.room_id);
      pos.x += vel.x;
      pos.y += vel.y;
      vel.x *= DAMPING;
      vel.y *= DAMPING;
    }
  }

  // Convert to lat/lng
  const result = new Map();
  for (const room of rooms) {
    const pos = positions.get(room.room_id);
    result.set(room.room_id, {
      lat: pos.y * SCALE,
      lng: pos.x * SCALE,
    });
  }

  return result;
}

/**
 * Get edges as pairs of positions for drawing connections.
 * @param {Array} rooms
 * @param {Map} layout - from computeLayout()
 * @returns {Array<[[lat,lng],[lat,lng]]>}
 */
export function getEdges(rooms, layout) {
  const nameToId = new Map();
  for (const room of rooms) {
    nameToId.set(room.name?.toLowerCase(), room.room_id);
    nameToId.set(room.room_id, room.room_id);
  }

  const edges = [];
  const seen = new Set();

  for (const room of rooms) {
    const fromPos = layout.get(room.room_id);
    if (!fromPos) continue;

    for (const conn of room.connections || []) {
      const targetId = nameToId.get(conn?.toLowerCase()) || nameToId.get(conn);
      if (!targetId) continue;
      const toPos = layout.get(targetId);
      if (!toPos) continue;

      const key = [room.room_id, targetId].sort().join("-");
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push([
        [fromPos.lat, fromPos.lng],
        [toPos.lat, toPos.lng],
      ]);
    }
  }

  return edges;
}
