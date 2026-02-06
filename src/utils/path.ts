import type { StopPositions } from "../types/stop.type";
import type { Trip, TripPath } from "../types/trip.type";
import type { Connection, LayoutResult } from "./sugiyama";

export interface PathGenerationOptions {
  laneHeight?: number;
  inboundY?: number;
  outboundY?: number;
}

/**
 * Generate octilinear paths for trips, routing around stops when necessary
 * Uses the trip's assigned lane from connections for express routes
 */
export const generateOctilinearPaths = (
  trips: Trip[],
  positions: StopPositions,
  layout?: LayoutResult,
  options: PathGenerationOptions = {},
): TripPath[] => {
  const { laneHeight = 60, inboundY = -200, outboundY = 0 } = options;

  // Build a map of trip -> lane for each direction
  const tripLaneMap = new Map<string, { inbound: number; outbound: number }>();

  if (layout) {
    layout.connections.forEach((conn) => {
      const existing = tripLaneMap.get(conn.tripId) || {
        inbound: 0,
        outbound: 0,
      };
      if (conn.direction === "inbound") {
        existing.inbound = Math.max(existing.inbound, conn.lane);
      } else {
        existing.outbound = Math.max(existing.outbound, conn.lane);
      }
      tripLaneMap.set(conn.tripId, existing);
    });
  }

  // Build a map of connections for each trip
  const tripConnections = new Map<
    string,
    { inbound: Connection[]; outbound: Connection[] }
  >();
  if (layout) {
    layout.connections.forEach((conn) => {
      const existing = tripConnections.get(conn.tripId) || {
        inbound: [],
        outbound: [],
      };
      if (conn.direction === "inbound") {
        existing.inbound.push(conn);
      } else {
        existing.outbound.push(conn);
      }
      tripConnections.set(conn.tripId, existing);
    });
  }

  const generatePath = (
    stopIds: string[],
    direction: "inbound" | "outbound",
    tripId: string,
  ): [number, number, number][] => {
    const validStops = stopIds.filter((id) => positions[id]);
    const path: [number, number, number][] = [];

    const tripLane = tripLaneMap.get(tripId);
    const connections = tripConnections.get(tripId);
    const dirConnections =
      direction === "inbound" ? connections?.inbound : connections?.outbound;
    const baseY = direction === "inbound" ? inboundY : outboundY;

    console.log(
      `[Path] Generating ${direction} path for trip ${tripId}:`,
      validStops,
    );
    console.log(`[Path] Trip lane info:`, tripLane);
    console.log(`[Path] Connections:`, dirConnections);

    for (let i = 0; i < validStops.length; i++) {
      const currentId = validStops[i];
      const current = positions[currentId];

      // Start from the stop's actual position
      path.push([current.x, current.y, 0]);

      if (i < validStops.length - 1) {
        const nextId = validStops[i + 1];
        const next = positions[nextId];

        // Find the connection for this segment
        const conn = dirConnections?.find(
          (c) => c.from === currentId && c.to === nextId,
        );

        console.log(
          `[Path] Connection ${currentId}->${nextId}:`,
          conn ? { isExpress: conn.isExpress, lane: conn.lane } : "not found",
        );

        const dx = next.x - current.x;
        const dy = next.y - current.y;

        // Check if this is an express connection that needs to route around stops
        if (conn && conn.isExpress && tripLane) {
          const tripLaneY =
            direction === "inbound"
              ? baseY - conn.lane * laneHeight
              : baseY + conn.lane * laneHeight;

          console.log(
            `[Path] Express connection: tripLaneY=${tripLaneY}, current.y=${current.y}, diff=${Math.abs(tripLaneY - current.y)}`,
          );

          // Only route differently if the trip's lane is different from the stop's y
          if (Math.abs(tripLaneY - current.y) > 1) {
            // Detour to the trip's lane to avoid crossing stops using 90-degree angles
            // 1. Move horizontally a small amount first
            const horizontalOffset = 20; // Small offset before turning
            const detourX1 = current.x + horizontalOffset;
            path.push([detourX1, current.y, 0]);

            // 2. Move vertically to the trip's lane (90-degree turn)
            path.push([detourX1, tripLaneY, 0]);

            // 3. Move horizontally along the trip's lane
            const detourX2 = next.x - horizontalOffset;
            if (detourX2 > detourX1) {
              path.push([detourX2, tripLaneY, 0]);
            }

            // 4. Move vertically to align with next stop's y (90-degree turn)
            path.push([detourX2 > detourX1 ? detourX2 : detourX1, next.y, 0]);

            console.log(
              `[Path] 90-degree detour points: (${detourX1}, ${current.y}), (${detourX1}, ${tripLaneY}), (${detourX2}, ${tripLaneY}), (${detourX2}, ${next.y})`,
            );
          } else if (dy !== 0) {
            // Same lane but different y - use 90-degree routing
            // Go horizontal first, then vertical
            const midX = current.x + dx / 2;
            path.push([midX, current.y, 0]);
            path.push([midX, next.y, 0]);
          }
        } else {
          // Regular connection - use 90-degree routing if lanes differ
          if (dy !== 0 && dx !== 0) {
            // 90-degree routing: horizontal first, then vertical
            // Use midpoint for cleaner appearance
            const midX = current.x + dx / 2;
            path.push([midX, current.y, 0]);
            path.push([midX, next.y, 0]);
          }
          // If only horizontal (dy === 0), no intermediate points needed
          // The line will go straight from current to next
        }
      }
    }

    console.log(`[Path] Final path for ${tripId}:`, path);
    return path;
  };

  return trips.map((trip) => {
    // Inbound: left → right
    const inboundPath = generatePath(trip.inbound, "inbound", trip.id);

    // Outbound: use mirrored positions directly (right → left visually)
    const outboundPath = generatePath(trip.outbound, "outbound", trip.id);

    return {
      ...trip,
      inboundPath,
      outboundPath,
    };
  });
};
