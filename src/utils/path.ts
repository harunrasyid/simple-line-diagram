import type { StopPositions } from "../types/stop.type";
import type { Trip, TripPath } from "../types/trip.type";

export const generateOctilinearPaths = (
  trips: Trip[],
  positions: StopPositions
): TripPath[] => {
  const generatePath = (stopIds: string[]): [number, number, number][] => {
    const validStops = stopIds.filter((id) => positions[id]);
    const path: [number, number, number][] = [];

    for (let i = 0; i < validStops.length; i++) {
      const current = positions[validStops[i]];
      path.push([current.x, current.y, 0]);

      if (i < validStops.length - 1) {
        const next = positions[validStops[i + 1]];
        const dx = next.x - current.x;
        const dy = next.y - current.y;

        // Add diagonal smoothing (45°)
        if (dx !== 0 && dy !== 0) {
          const steps = Math.max(Math.abs(dx), Math.abs(dy)) / 100;
          const stepX = dx / steps;
          const stepY = dy / steps;
          for (let step = 1; step < steps; step++) {
            path.push([current.x + stepX * step, current.y + stepY * step, 0]);
          }
        }
      }
    }
    return path;
  };

  return trips.map((trip) => {
    // Inbound: left → right
    const inboundPath = generatePath(trip.inbound);

    // Outbound: use mirrored positions directly (right → left visually)
    const outboundPath = generatePath(trip.outbound);

    return {
      ...trip,
      inboundPath,
      outboundPath,
    };
  });
};
