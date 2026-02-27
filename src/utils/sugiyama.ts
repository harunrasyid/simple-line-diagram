export interface RouteData {
  trips: Trip[];
  stops: Stop[];
}

export interface Trip {
  id: string;
  name: string;
  color: [number, number, number];
  outboundStop: string[];
  inboundStop: string[];
}

export interface Stop {
  id: string;
  name: string;
  endStop?: string;
}

export interface StopLayout {
  stopId: string;
  x: number;
  y: number;
  layer: number; // Horizontal layer (position in sequence)
  lane: number; // Vertical lane (for branches)
  name: string;
  direction: "inbound" | "outbound" | "shared" | "endStop";
}

export interface Connection {
  from: string;
  to: string;
  tripId: string;
  tripName: string;
  color: [number, number, number];
  direction: "inbound" | "outbound";
  isExpress: boolean; // Skips stops
  lane: number; // The lane this connection should be drawn at (for express lines that bypass stops)
}

export interface LayoutResult {
  stops: StopLayout[];
  connections: Connection[];
}

/**
 * Layout route stops using Sugiyama-inspired layered graph approach
 */
export function layoutRouteStops(
  routeData: RouteData,
  options: {
    stopSpacing?: number;
    laneHeight?: number;
    inboundY?: number;
    outboundY?: number;
    endStopY?: number;
  } = {},
): LayoutResult {
  const {
    stopSpacing = 100,
    laneHeight = 60,
    inboundY = 200,
    outboundY = 0,
    endStopY: endStopYOption,
  } = options;
  const endStopY =
    endStopYOption !== undefined
      ? endStopYOption
      : (inboundY + outboundY) / 2;

  const stopNameMap = new Map(routeData.stops.map((s) => [s.id, s.name]));

  // Process inbound and outbound separately
  const inboundResult = layoutDirection(
    routeData.trips,
    "inbound",
    stopNameMap,
    stopSpacing,
    laneHeight,
    inboundY,
  );

  const outboundResult = layoutDirection(
    routeData.trips,
    "outbound",
    stopNameMap,
    stopSpacing,
    laneHeight,
    outboundY,
  );

  // EndStop post-processing: place terminal stops on middle layer at left/right
  const endStopIds = new Set(
    routeData.stops.filter((s) => s.endStop).map((s) => s.id),
  );

  const inboundMaxX = Math.max(
    ...inboundResult.stops.map((s) => s.x),
    0,
  );
  const outboundMaxX = Math.max(
    ...outboundResult.stops.map((s) => s.x),
    0,
  );
  const globalMaxX = Math.max(inboundMaxX, outboundMaxX);

  const inboundMaxLayer = Math.max(
    ...inboundResult.stops.map((s) => s.layer),
    0,
  );
  const outboundMaxLayer = Math.max(
    ...outboundResult.stops.map((s) => s.layer),
    0,
  );

  const endStopEntries: StopLayout[] = [];
  for (const stop of routeData.stops) {
    if (!endStopIds.has(stop.id)) continue;
    const outboundStop = outboundResult.stops.find(
      (s) => s.stopId === stop.id,
    );
    const inboundStop = inboundResult.stops.find((s) => s.stopId === stop.id);

    // Left/right from top row (outbound): layer 0 = left, max = right
    const placementLayer =
      outboundStop !== undefined
        ? outboundStop.layer
        : inboundStop !== undefined
          ? inboundMaxLayer - inboundStop.layer
          : 0;

    const isLeftTerminus = placementLayer === 0;
    const x = isLeftTerminus ? 0 : globalMaxX;
    const layer = isLeftTerminus
      ? 0
      : Math.max(inboundMaxLayer, outboundMaxLayer);

    endStopEntries.push({
      stopId: stop.id,
      x,
      y: endStopY,
      layer,
      lane: 0,
      name: stopNameMap.get(stop.id) ?? stop.id,
      direction: "endStop",
    });
  }

  const inboundFiltered = inboundResult.stops.filter(
    (s) => !endStopIds.has(s.stopId),
  );
  const outboundFiltered = outboundResult.stops.filter(
    (s) => !endStopIds.has(s.stopId),
  );
  const allStops = [
    ...inboundFiltered,
    ...outboundFiltered,
    ...endStopEntries,
  ];
  const allConnections = [
    ...inboundResult.connections,
    ...outboundResult.connections,
  ];

  return {
    stops: allStops,
    connections: allConnections,
  };
}

/**
 * Layout stops for one direction using Sugiyama layered approach
 */
function layoutDirection(
  trips: Trip[],
  direction: "inbound" | "outbound",
  stopNameMap: Map<string, string>,
  stopSpacing: number,
  laneHeight: number,
  baseY: number,
): { stops: StopLayout[]; connections: Connection[] } {
  // Step 1: Build graph from all trips
  const graph = buildGraph(trips, direction);

  // Step 2: Layer assignment (topological sort to determine horizontal position)
  const layers = assignLayers(graph);

  // Step 3: Lane assignment (determine vertical position for branches)
  const { stopLanes, tripLanes } = assignLanes(trips, direction, layers);

  // Step 4: Position assignment
  const stops = positionStops(
    layers,
    stopLanes,
    stopNameMap,
    direction,
    stopSpacing,
    laneHeight,
    baseY,
  );

  // Step 5: Build connections (with trip lanes for proper routing)
  const connections = buildConnections(
    trips,
    direction,
    layers,
    tripLanes,
    stopLanes,
  );

  return { stops, connections };
}

/**
 * Build directed graph from trips
 */
function buildGraph(trips: Trip[], direction: "inbound" | "outbound") {
  const adjacency = new Map<string, Set<string>>();
  const nodes = new Set<string>();

  trips.forEach((trip) => {
    const stops = direction === "inbound" ? trip.inboundStop : trip.outboundStop;

    stops.forEach((stop) => nodes.add(stop));

    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];

      if (!adjacency.has(from)) {
        adjacency.set(from, new Set());
      }
      adjacency.get(from)!.add(to);
    }
  });

  return { adjacency, nodes };
}

/**
 * Step 2: Assign layers (horizontal positions) using longest path layering
 */
function assignLayers(graph: {
  adjacency: Map<string, Set<string>>;
  nodes: Set<string>;
}): Map<string, number> {
  const { adjacency, nodes } = graph;
  const layers = new Map<string, number>();
  const inDegree = new Map<string, number>();

  // Calculate in-degrees
  nodes.forEach((node) => inDegree.set(node, 0));
  adjacency.forEach((targets) => {
    targets.forEach((target) => {
      inDegree.set(target, (inDegree.get(target) || 0) + 1);
    });
  });

  // Topological sort with layer assignment (Coffman-Graham)
  const queue: string[] = [];
  nodes.forEach((node) => {
    if ((inDegree.get(node) || 0) === 0) {
      queue.push(node);
      layers.set(node, 0);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current)!;

    const targets = adjacency.get(current);
    if (targets) {
      targets.forEach((target) => {
        const newInDegree = (inDegree.get(target) || 0) - 1;
        inDegree.set(target, newInDegree);

        // Assign layer as max of predecessors + 1
        const newLayer = currentLayer + 1;
        const existingLayer = layers.get(target);
        if (existingLayer === undefined || newLayer > existingLayer) {
          layers.set(target, newLayer);
        }

        if (newInDegree === 0) {
          queue.push(target);
        }
      });
    }
  }

  return layers;
}

/**
 * Step 3: Assign lanes (vertical positions) for crossing reduction
 * Uses a "blocked ranges" approach to prevent lines from crossing stops
 * Returns both stop lanes and trip lanes (for drawing connections at correct y-position)
 */
function assignLanes(
  trips: Trip[],
  direction: "inbound" | "outbound",
  layers: Map<string, number>,
): { stopLanes: Map<string, number>; tripLanes: Map<string, number> } {
  const lanes = new Map<string, number>();

  // Group nodes by layer
  const layerGroups = new Map<number, string[]>();
  layers.forEach((layer, node) => {
    if (!layerGroups.has(layer)) {
      layerGroups.set(layer, []);
    }
    layerGroups.get(layer)!.push(node);
  });

  // Build a map of which stops each trip uses
  const tripStopsMap = new Map<string, string[]>();
  trips.forEach((trip) => {
    const stops = direction === "inbound" ? trip.inboundStop : trip.outboundStop;
    tripStopsMap.set(trip.id, stops);
  });

  // Track blocked layer ranges for each lane
  // blockedRanges[lane] = array of {minLayer, maxLayer, tripId}
  // meaning layers minLayer < x < maxLayer are blocked on this lane by tripId's express connection
  const blockedRanges = new Map<
    number,
    Array<{ minLayer: number; maxLayer: number; tripId: string }>
  >();

  // Track which stops are assigned to which lane by which trip
  // This helps with the "stop already placed" conflict check
  const stopLaneAssignments = new Map<
    string,
    { lane: number; tripId: string }
  >();

  // For each trip, assign a consistent lane
  const tripLanes = new Map<string, number>();
  let nextLane = 0;

  // Pre-compute all express connections for each trip (connections that span multiple layers)
  const tripExpressConnections = new Map<
    string,
    Array<{ from: string; to: string; minLayer: number; maxLayer: number }>
  >();
  trips.forEach((trip) => {
    const stops = tripStopsMap.get(trip.id) || [];
    const expressConns: Array<{
      from: string;
      to: string;
      minLayer: number;
      maxLayer: number;
    }> = [];

    for (let i = 0; i < stops.length - 1; i++) {
      const fromStop = stops[i];
      const toStop = stops[i + 1];
      const fromLayer = layers.get(fromStop);
      const toLayer = layers.get(toStop);

      if (fromLayer !== undefined && toLayer !== undefined) {
        const minLayer = Math.min(fromLayer, toLayer);
        const maxLayer = Math.max(fromLayer, toLayer);
        if (maxLayer - minLayer > 1) {
          // This is an express connection
          expressConns.push({ from: fromStop, to: toStop, minLayer, maxLayer });
        }
      }
    }
    tripExpressConnections.set(trip.id, expressConns);
  });

  // Process local (non-express, longer) trips first so they get lane 0; express trips get higher lanes
  // so shared stops sit on the main line and express bypass is visible.
  const sortedTrips = [...trips].sort((a, b) => {
    const aStops = tripStopsMap.get(a.id) || [];
    const bStops = tripStopsMap.get(b.id) || [];
    const aHasExpress = (tripExpressConnections.get(a.id) || []).length > 0;
    const bHasExpress = (tripExpressConnections.get(b.id) || []).length > 0;
    if (aHasExpress !== bHasExpress) return aHasExpress ? 1 : -1;
    return bStops.length - aStops.length;
  });

  sortedTrips.forEach((trip) => {
    const stops = tripStopsMap.get(trip.id) || [];
    const expressConns = tripExpressConnections.get(trip.id) || [];

    // Try to find an existing lane that doesn't conflict
    let assignedLane = -1;

    for (let lane = 0; lane <= nextLane; lane++) {
      let hasConflict = false;
      const isNewLane = lane === nextLane;

      // Check 1: Would any of our stops conflict with existing stops in the same layer?
      for (const stopId of stops) {
        const layer = layers.get(stopId);
        if (layer !== undefined) {
          const otherStopsInLayer = layerGroups.get(layer) || [];
          for (const otherStop of otherStopsInLayer) {
            if (otherStop !== stopId) {
              const existingAssignment = stopLaneAssignments.get(otherStop);
              if (
                existingAssignment &&
                existingAssignment.lane === lane &&
                !stops.includes(otherStop)
              ) {
                hasConflict = true;
                break;
              }
            }
          }
        }
        if (hasConflict) break;
      }

      // Check 2: Would our express connections cross any existing stops?
      if (!hasConflict) {
        for (const conn of expressConns) {
          // Check all intermediate layers
          for (
            let checkLayer = conn.minLayer + 1;
            checkLayer < conn.maxLayer;
            checkLayer++
          ) {
            const stopsInLayer = layerGroups.get(checkLayer) || [];
            for (const stopInLayer of stopsInLayer) {
              // If this stop is already assigned to this lane AND is not part of our trip
              const existingAssignment = stopLaneAssignments.get(stopInLayer);
              if (
                existingAssignment &&
                existingAssignment.lane === lane &&
                !stops.includes(stopInLayer)
              ) {
                hasConflict = true;
                break;
              }
            }
            if (hasConflict) break;
          }
          if (hasConflict) break;
        }
      }

      // Check 3: Would any of our stops be in a blocked range on this lane?
      if (!hasConflict) {
        const laneBlockedRanges = blockedRanges.get(lane) || [];
        for (const stopId of stops) {
          const stopLayer = layers.get(stopId);
          if (stopLayer !== undefined) {
            for (const range of laneBlockedRanges) {
              // Check if this stop falls within a blocked range (exclusive of endpoints)
              if (stopLayer > range.minLayer && stopLayer < range.maxLayer) {
                // Our stop would be crossed by another trip's express connection
                const blockingTripStops = tripStopsMap.get(range.tripId) || [];
                if (!blockingTripStops.includes(stopId)) {
                  hasConflict = true;
                  break;
                }
              }
            }
            if (hasConflict) break;
          }
        }
      }

      // Check 4: Would existing trips' express connections on this lane cross our stops?
      // (This is similar to Check 3 but from the perspective of stops we're about to place)
      if (!hasConflict) {
        const laneBlockedRanges = blockedRanges.get(lane) || [];
        for (const range of laneBlockedRanges) {
          const blockingTripStops = tripStopsMap.get(range.tripId) || [];
          for (const stopId of stops) {
            const stopLayer = layers.get(stopId);
            if (
              stopLayer !== undefined &&
              stopLayer > range.minLayer &&
              stopLayer < range.maxLayer &&
              !blockingTripStops.includes(stopId)
            ) {
              hasConflict = true;
              break;
            }
          }
          if (hasConflict) break;
        }
      }

      if (!hasConflict) {
        assignedLane = lane;
        if (isNewLane) nextLane++;
        break;
      }
    }

    // This shouldn't happen, but just in case
    if (assignedLane === -1) {
      assignedLane = nextLane++;
    }

    tripLanes.set(trip.id, assignedLane);

    // Register blocked ranges for this trip's express connections
    if (!blockedRanges.has(assignedLane)) {
      blockedRanges.set(assignedLane, []);
    }
    for (const conn of expressConns) {
      blockedRanges.get(assignedLane)!.push({
        minLayer: conn.minLayer,
        maxLayer: conn.maxLayer,
        tripId: trip.id,
      });
    }

    // Assign lane to all stops in this trip
    stops.forEach((stopId) => {
      const existingAssignment = stopLaneAssignments.get(stopId);
      if (!existingAssignment) {
        stopLaneAssignments.set(stopId, {
          lane: assignedLane,
          tripId: trip.id,
        });
        lanes.set(stopId, assignedLane);
      } else {
        // Stop already assigned - keep the lower lane (prefer main line)
        // but only update if the new lane is lower
        if (assignedLane < existingAssignment.lane) {
          stopLaneAssignments.set(stopId, {
            lane: assignedLane,
            tripId: trip.id,
          });
          lanes.set(stopId, assignedLane);
        }
      }
    });
  });

  return { stopLanes: lanes, tripLanes };
}

/**
 * Step 4: Convert layers and lanes to actual positions
 */
function positionStops(
  layers: Map<string, number>,
  lanes: Map<string, number>,
  stopNameMap: Map<string, string>,
  direction: "inbound" | "outbound",
  stopSpacing: number,
  laneHeight: number,
  baseY: number,
): StopLayout[] {
  const stops: StopLayout[] = [];

  layers.forEach((layer, stopId) => {
    const lane = lanes.get(stopId) || 0;

    // For inbound, reverse the X direction (outbound flows right, inbound flows left)
    const x =
      direction === "outbound"
        ? layer * stopSpacing
        : (getMaxLayer(layers) - layer) * stopSpacing;

    const y =
      direction === "outbound"
        ? baseY - lane * laneHeight
        : baseY + lane * laneHeight;

    stops.push({
      stopId,
      x,
      y,
      layer,
      lane,
      name: stopNameMap.get(stopId) || stopId,
      direction,
    });
  });

  return stops;
}

/**
 * Get maximum layer number
 */
function getMaxLayer(layers: Map<string, number>): number {
  let max = 0;
  layers.forEach((layer) => {
    if (layer > max) max = layer;
  });
  return max;
}

/**
 * Build connections with express detection and lane information
 */
function buildConnections(
  trips: Trip[],
  direction: "inbound" | "outbound",
  layers: Map<string, number>,
  tripLanes: Map<string, number>,
  stopLanes: Map<string, number>,
): Connection[] {
  const connections: Connection[] = [];

  const layerStops = new Map<number, string[]>();
  layers.forEach((layer, stopId) => {
    if (!layerStops.has(layer)) layerStops.set(layer, []);
    layerStops.get(layer)!.push(stopId);
  });

  trips.forEach((trip) => {
    const stops = direction === "inbound" ? trip.inboundStop : trip.outboundStop;
    const tripLane = tripLanes.get(trip.id) || 0;

    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];

      const fromLayer = layers.get(from);
      const toLayer = layers.get(to);

      const layerGap =
        fromLayer !== undefined && toLayer !== undefined
          ? Math.abs(toLayer - fromLayer)
          : 0;

      let isExpress = false;
      if (layerGap > 1 && fromLayer !== undefined && toLayer !== undefined) {
        const fromLane = stopLanes.get(from) ?? 0;
        const minLayer = Math.min(fromLayer, toLayer);
        const maxLayer = Math.max(fromLayer, toLayer);

        for (let l = minLayer + 1; l < maxLayer; l++) {
          const stopsAtLayer = layerStops.get(l) || [];
          for (const sid of stopsAtLayer) {
            if (!stops.includes(sid) && (stopLanes.get(sid) ?? 0) === fromLane) {
              isExpress = true;
              break;
            }
          }
          if (isExpress) break;
        }
      }

      connections.push({
        from,
        to,
        tripId: trip.id,
        tripName: trip.name,
        color: trip.color,
        direction,
        isExpress,
        lane: tripLane, // Use the trip's assigned lane for drawing
      });
    }
  });

  return connections;
}

/**
 * Output interface for orthographic stop positions
 */
export interface StopPosition {
  x: number;
  y: number;
  level: number;
  tripIds: string[]; // List of all trips that use this stop
}

export interface StopPositions {
  [stopId: string]: StopPosition;
}

/**
 * Convert LayoutResult to simplified StopPositions format
 */
export function convertToStopPositions(layout: LayoutResult): StopPositions {
  const positions: StopPositions = {};

  // Build a map of which trips use each stop
  const stopToTrips = new Map<string, Set<string>>();

  layout.connections.forEach((conn) => {
    // Add trip to 'from' stop
    if (!stopToTrips.has(conn.from)) {
      stopToTrips.set(conn.from, new Set());
    }
    stopToTrips.get(conn.from)!.add(conn.tripId);

    // Add trip to 'to' stop
    if (!stopToTrips.has(conn.to)) {
      stopToTrips.set(conn.to, new Set());
    }
    stopToTrips.get(conn.to)!.add(conn.tripId);
  });

  // Convert each stop layout to position
  layout.stops.forEach((stop) => {
    const tripIds = Array.from(stopToTrips.get(stop.stopId) || []);

    positions[stop.stopId] = {
      x: stop.x,
      y: stop.y,
      level: stop.layer, // Map layer to level
      tripIds: tripIds,
    };
  });

  return positions;
}
