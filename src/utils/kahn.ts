export interface RouteData {
  trips: Trip[];
  stops: Stop[];
}

export interface Trip {
  id: string;
  name: string;
  color: [number, number, number];
  outbound: string[];
  inbound: string[];
}

export interface Stop {
  id: string;
  name: string;
}

export interface StopLayout {
  stopId: string;
  x: number;
  y: number;
  lane: number;
  name: string;
  isShared: boolean; // Appears in both inbound and outbound
}

export interface Connection {
  from: string;
  to: string;
  tripId: string;
  tripName: string;
  color: [number, number, number];
  direction: "inbound" | "outbound";
  isBranch: boolean;
}

export interface LayoutResult {
  stops: StopLayout[];
  connections: Connection[];
  inboundSequence: string[];
  outboundSequence: string[];
}

/**
 * Main layout function that processes route data and returns positioned stops
 */
export function layoutRouteStops(
  routeData: RouteData,
  options: {
    stopSpacing?: number;
    laneHeight?: number;
    inboundY?: number;
    outboundY?: number;
  } = {}
): LayoutResult {
  const {
    stopSpacing = 100,
    laneHeight = 60,
    inboundY = 0,
    outboundY = -200,
  } = options;

  // Step 1: Build canonical sequences
  const inboundSequence = buildConsensusSequence(
    routeData.trips.map((t) => t.inbound)
  );
  const outboundSequence = buildConsensusSequence(
    routeData.trips.map((t) => t.outbound)
  );

  // Step 2: Detect branches for lane assignment
  const inboundLanes = detectLanes(routeData.trips, "inbound", inboundSequence);
  const outboundLanes = detectLanes(
    routeData.trips,
    "outbound",
    outboundSequence
  );

  // Step 3: Create stop name lookup
  const stopNameMap = new Map(routeData.stops.map((s) => [s.id, s.name]));

  // Step 4: Layout stops
  const stops: StopLayout[] = [];
  const layoutedStops = new Set<string>();
  const sharedStops = new Set(
    inboundSequence.filter((id) => outboundSequence.includes(id))
  );

  // Layout inbound stops (left to right)
  inboundSequence.forEach((stopId, index) => {
    const lane = inboundLanes.get(stopId) || 0;
    stops.push({
      stopId: stopId,
      x: index * stopSpacing,
      y: inboundY - lane * laneHeight,
      lane,
      name: stopNameMap.get(stopId) || stopId,
      isShared: sharedStops.has(stopId),
    });
    layoutedStops.add(stopId);
  });

  // Layout outbound stops (right to left)
  outboundSequence.forEach((stopId, index) => {
    // Skip if already laid out in inbound (will be connected)
    if (layoutedStops.has(stopId)) return;

    const lane = outboundLanes.get(stopId) || 0;
    const x = (outboundSequence.length - 1 - index) * stopSpacing;

    stops.push({
      stopId: stopId,
      x,
      y: outboundY - lane * laneHeight,
      lane,
      name: stopNameMap.get(stopId) || stopId,
      isShared: false,
    });
  });

  // Step 5: Build connections
  const connections = buildConnections(
    routeData.trips,
    inboundSequence,
    outboundSequence
  );

  return {
    stops,
    connections,
    inboundSequence,
    outboundSequence,
  };
}

/**
 * Build a consensus sequence from multiple stop sequences using topological sort
 */
function buildConsensusSequence(sequences: string[][]): string[] {
  if (sequences.length === 0) return [];
  if (sequences.length === 1) return sequences[0];

  // Build directed graph of stop precedences
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  const allStops = new Set<string>();

  // Track how often each edge appears for tie-breaking
  const edgeFrequency = new Map<string, number>();

  sequences.forEach((seq) => {
    seq.forEach((stop) => allStops.add(stop));

    for (let i = 0; i < seq.length - 1; i++) {
      const from = seq[i];
      const to = seq[i + 1];
      const edgeKey = `${from}->${to}`;

      if (!graph.has(from)) graph.set(from, new Set());
      graph.get(from)!.add(to);

      edgeFrequency.set(edgeKey, (edgeFrequency.get(edgeKey) || 0) + 1);

      if (!inDegree.has(from)) inDegree.set(from, 0);
      inDegree.set(to, (inDegree.get(to) || 0) + 1);
    }
  });

  // Kahn's algorithm with frequency-based tie-breaking
  const queue: string[] = [];
  for (const stop of allStops) {
    if ((inDegree.get(stop) || 0) === 0) {
      queue.push(stop);
    }
  }

  const result: string[] = [];

  while (queue.length > 0) {
    // Sort by position in original sequences (use first sequence as reference)
    queue.sort((a, b) => {
      const aIdx = sequences[0].indexOf(a);
      const bIdx = sequences[0].indexOf(b);
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });

    const current = queue.shift()!;
    result.push(current);

    const neighbors = graph.get(current) || new Set();
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return result;
}

/**
 * Detect which stops should be on different lanes (branches)
 */
function detectLanes(
  trips: Trip[],
  direction: "inbound" | "outbound",
  sequence: string[]
): Map<string, number> {
  const lanes = new Map<string, number>();

  // Create sequence position map for quick lookup
  const sequencePos = new Map<string, number>();
  sequence.forEach((stopId, index) => {
    sequencePos.set(stopId, index);
  });

  // Build graph to find divergence/convergence
  const graph = new Map<string, Set<string>>();

  trips.forEach((trip) => {
    const stops = direction === "inbound" ? trip.inbound : trip.outbound;
    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];
      if (!graph.has(from)) graph.set(from, new Set());
      graph.get(from)!.add(to);
    }
  });

  // Find stops with multiple outgoing connections (branch points)
  const branchPoints = new Set<string>();
  graph.forEach((connections, stop) => {
    if (connections.size > 1) {
      branchPoints.add(stop);
    }
  });

  // Assign lanes based on trip variations and sequence position
  let currentLane = 0;
  const tripLanes = new Map<string, number>();

  trips.forEach((trip) => {
    const stops = direction === "inbound" ? trip.inbound : trip.outbound;

    // Determine if this is a main-line trip (follows sequence closely)
    const isMainLine = isFollowingMainSequence(stops, sequence, sequencePos);

    // Check if this trip takes a different path
    let isDifferent = false;
    for (const [tripId, lane] of tripLanes) {
      const otherTrip = trips.find((t) => t.id === tripId);
      if (!otherTrip) continue;

      const otherStops =
        direction === "inbound" ? otherTrip.inbound : otherTrip.outbound;
      if (hasSignificantDifference(stops, otherStops)) {
        isDifferent = true;
        break;
      }
    }

    // Main-line trips get lane 0, branches get higher lanes
    const assignedLane = isMainLine
      ? 0
      : isDifferent
      ? ++currentLane
      : currentLane;
    tripLanes.set(trip.id, assignedLane);

    // Assign lane to stops based on trip
    stops.forEach((stopId) => {
      const existingLane = lanes.get(stopId);
      if (existingLane === undefined) {
        lanes.set(stopId, assignedLane);
      } else {
        // Use minimum lane for shared stops (prefer main line)
        lanes.set(stopId, Math.min(existingLane, assignedLane));
      }
    });
  });

  return lanes;
}

/**
 * Check if a trip closely follows the main sequence
 */
function isFollowingMainSequence(
  tripStops: string[],
  sequence: string[],
  sequencePos: Map<string, number>
): boolean {
  let inSequenceCount = 0;
  let lastPos = -1;

  for (const stopId of tripStops) {
    const pos = sequencePos.get(stopId);
    if (pos !== undefined && pos > lastPos) {
      inSequenceCount++;
      lastPos = pos;
    }
  }

  // Consider it main line if >80% of stops follow sequence order
  return inSequenceCount / tripStops.length > 0.8;
}

/**
 * Check if two stop sequences have significant differences
 */
function hasSignificantDifference(seq1: string[], seq2: string[]): boolean {
  const set1 = new Set(seq1);
  const set2 = new Set(seq2);

  // Count different stops
  let different = 0;
  for (const stop of set1) {
    if (!set2.has(stop)) different++;
  }
  for (const stop of set2) {
    if (!set1.has(stop)) different++;
  }

  // Consider different if more than 20% stops differ
  return different > Math.max(seq1.length, seq2.length) * 0.2;
}

/**
 * Build connection list from trips
 */
function buildConnections(
  trips: Trip[],
  inboundSequence: string[],
  outboundSequence: string[]
): Connection[] {
  const connections: Connection[] = [];

  trips.forEach((trip) => {
    // Inbound connections
    for (let i = 0; i < trip.inbound.length - 1; i++) {
      const from = trip.inbound[i];
      const to = trip.inbound[i + 1];

      connections.push({
        from,
        to,
        tripId: trip.id,
        tripName: trip.name,
        color: trip.color,
        direction: "inbound",
        isBranch: detectIfBranch(from, to, trips, "inbound"),
      });
    }

    // Outbound connections
    for (let i = 0; i < trip.outbound.length - 1; i++) {
      const from = trip.outbound[i];
      const to = trip.outbound[i + 1];

      connections.push({
        from,
        to,
        tripId: trip.id,
        tripName: trip.name,
        color: trip.color,
        direction: "outbound",
        isBranch: detectIfBranch(from, to, trips, "outbound"),
      });
    }
  });

  return connections;
}

/**
 * Detect if a connection is part of a branch (not all trips use it)
 */
function detectIfBranch(
  from: string,
  to: string,
  trips: Trip[],
  direction: "inbound" | "outbound"
): boolean {
  let usageCount = 0;

  trips.forEach((trip) => {
    const stops = direction === "inbound" ? trip.inbound : trip.outbound;
    for (let i = 0; i < stops.length - 1; i++) {
      if (stops[i] === from && stops[i + 1] === to) {
        usageCount++;
        break;
      }
    }
  });

  // It's a branch if not all trips use this connection
  return usageCount < trips.length;
}
