// import type { Stop, StopPositions } from "../types/stop.type";
// import type { Trip } from "../types/trip.type";

// export const calculateDiagramLayout = (
//   trips: Trip[],
//   stops: Stop[],
//   gridSize = 100,
//   outboundOffset = 500 // shift outbound down
// ): StopPositions => {
//   const GRID_SIZE = gridSize;

//   const positions: StopPositions = {};
//   const stationRoutes: { [stationId: string]: Set<string> } = {};
//   const stationLevels: { [stationId: string]: number } = {};

//   // Initialize route mapping
//   stops.forEach((s) => (stationRoutes[s.id] = new Set()));

//   // Map all trips (both directions)
//   trips.forEach((trip) => {
//     [...trip.outbound, ...trip.inbound].forEach((stId) => {
//       if (!stationRoutes[stId]) stationRoutes[stId] = new Set();
//       stationRoutes[stId].add(trip.id);
//     });
//   });

//   // Calculate horizontal level (sequence index)
//   trips.forEach((trip) => {
//     const processDirection = (stops: string[]) => {
//       stops.forEach((stId, idx) => {
//         if (stationLevels[stId] === undefined) {
//           stationLevels[stId] = idx;
//         } else {
//           stationLevels[stId] = Math.min(stationLevels[stId], idx);
//         }
//       });
//     };
//     processDirection(trip.outbound);
//     processDirection(trip.inbound);
//   });

//   // Group by level
//   const levelGroups: { [level: number]: string[] } = {};
//   Object.entries(stationLevels).forEach(([id, level]) => {
//     if (!levelGroups[level]) levelGroups[level] = [];
//     levelGroups[level].push(id);
//   });

//   // Assign vertical grid position
//   const verticalAssignments: { [stationId: string]: number } = {};
//   Object.entries(levelGroups).forEach(([, stationIds]) => {
//     stationIds.sort((a, b) => {
//       const aRoutes = Array.from(stationRoutes[a]).sort().join(",");
//       const bRoutes = Array.from(stationRoutes[b]).sort().join(",");
//       return aRoutes.localeCompare(bRoutes);
//     });

//     const count = stationIds.length;
//     const center = (count - 1) / 2;

//     stationIds.forEach((id, idx) => {
//       verticalAssignments[id] = Math.round(idx - center);
//     });
//   });

//   // Find maximum level for mirroring outbound direction
//   const maxLevel = Math.max(...Object.values(stationLevels));

//   // Compute base positions
//   stops.forEach((s) => {
//     const level = stationLevels[s.id] ?? 0;
//     const verticalPos = verticalAssignments[s.id] ?? 0;

//     positions[s.id] = {
//       x: level * GRID_SIZE,
//       y: verticalPos * GRID_SIZE,
//       level,
//       tripIds: Array.from(stationRoutes[s.id] || []),
//     };
//   });

//   // Apply outbound inversion and offset
//   trips.forEach((trip) => {
//     trip.outbound.forEach((stId) => {
//       const pos = positions[stId];
//       if (pos) {
//         // Mirror horizontally for outbound: right-to-left
//         pos.x = (maxLevel - pos.level) * GRID_SIZE;
//         // Shift vertically to separate outbound/inbound
//         pos.y += outboundOffset;
//       }
//     });
//   });

//   console.log(positions);

//   return positions;
// };

// import type { Stop, StopPositions } from "../types/stop.type";
// import type { Trip } from "../types/trip.type";

// export const calculateDiagramLayout = (
//   trips: Trip[],
//   stops: Stop[],
//   gridSize = 100,
//   outboundOffset = 300 // vertical offset
// ): StopPositions => {
//   const GRID_SIZE = gridSize;

//   const positions: StopPositions = {};
//   const stationRoutes: Record<string, Set<string>> = {};

//   // Initialize route mapping
//   stops.forEach((s) => (stationRoutes[s.id] = new Set()));

//   // Map all trips
//   trips.forEach((trip) => {
//     [...trip.inbound, ...trip.outbound].forEach((stId) => {
//       if (!stationRoutes[stId]) stationRoutes[stId] = new Set();
//       stationRoutes[stId].add(trip.id);
//     });
//   });

//   // Compute max inbound length
//   const maxInboundLength = Math.max(...trips.map((t) => t.inbound.length));

//   // Assign inbound positions (left to right)
//   trips.forEach((trip) => {
//     trip.inbound.forEach((stId, idx) => {
//       positions[stId] = {
//         x: idx * GRID_SIZE,
//         y: 0, // all aligned
//         level: idx,
//         tripIds: Array.from(stationRoutes[stId]),
//       };
//     });
//   });

//   // Assign outbound positions (right to left)
//   trips.forEach((trip) => {
//     trip.outbound.forEach((stId, idx) => {
//       const mirroredX = (maxInboundLength - 1 - idx) * GRID_SIZE;
//       positions[stId] = {
//         x: mirroredX,
//         y: outboundOffset, // vertical separation
//         level: idx,
//         tripIds: Array.from(stationRoutes[stId]),
//       };
//     });
//   });

//   return positions;
// };

import type { Stop, StopPositions } from "../types/stop.type";
import type { Trip } from "../types/trip.type";

export const calculateDiagramLayout = (
  trips: Trip[],
  stops: Stop[],
  gridSize = 100,
  outboundOffset = 300 // shift outbound below inbound
): StopPositions => {
  const GRID_SIZE = gridSize;
  const positions: StopPositions = {};
  const stationRoutes: Record<string, Set<string>> = {};

  // Build route membership
  stops.forEach((s) => (stationRoutes[s.id] = new Set()));
  trips.forEach((trip) => {
    [...trip.inbound, ...trip.outbound].forEach((stId) => {
      if (!stationRoutes[stId]) stationRoutes[stId] = new Set();
      stationRoutes[stId].add(trip.id);
    });
  });

  // Assign inbound (left → right)
  trips.forEach((trip, tripIndex) => {
    const yOffset = tripIndex * 20; // small vertical spacing between routes
    trip.inbound.forEach((stId, idx) => {
      const existing = positions[stId];
      if (!existing) {
        positions[stId] = {
          x: idx * GRID_SIZE,
          y: yOffset,
          level: idx,
          tripIds: Array.from(stationRoutes[stId]),
        };
      }
    });
  });

  // Assign outbound (right → left)
  trips.forEach((trip, tripIndex) => {
    const yOffset = outboundOffset + tripIndex * 20;
    const inboundLength = trip.inbound.length;

    trip.outbound.forEach((stId, idx) => {
      const mirroredX = (inboundLength - 1 - idx) * GRID_SIZE;

      const existing = positions[stId];
      if (!existing) {
        positions[stId] = {
          x: mirroredX,
          y: yOffset,
          level: idx,
          tripIds: Array.from(stationRoutes[stId]),
        };
      }
    });
  });

  return positions;
};
