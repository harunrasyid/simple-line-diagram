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
  layer: number; // Horizontal layer (position in sequence)
  lane: number; // Vertical lane (for branches)
  name: string;
  direction: "inbound" | "outbound" | "shared";
}

export interface Connection {
  from: string;
  to: string;
  tripId: string;
  tripName: string;
  color: [number, number, number];
  direction: "inbound" | "outbound";
  isExpress: boolean; // Skips stops
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
  } = {}
): LayoutResult {
  const {
    stopSpacing = 100,
    laneHeight = 60,
    inboundY = 200,
    outboundY = 0,
  } = options;

  const stopNameMap = new Map(routeData.stops.map((s) => [s.id, s.name]));

  // Process inbound and outbound separately
  const inboundResult = layoutDirection(
    routeData.trips,
    "inbound",
    stopNameMap,
    stopSpacing,
    laneHeight,
    inboundY
  );

  const outboundResult = layoutDirection(
    routeData.trips,
    "outbound",
    stopNameMap,
    stopSpacing,
    laneHeight,
    outboundY
  );

  // Merge results and handle shared stops
  const allStops = [...inboundResult.stops, ...outboundResult.stops];
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
  baseY: number
): { stops: StopLayout[]; connections: Connection[] } {
  // Step 1: Build graph from all trips
  const graph = buildGraph(trips, direction);

  // Step 2: Layer assignment (topological sort to determine horizontal position)
  const layers = assignLayers(graph);

  // Step 3: Lane assignment (determine vertical position for branches)
  const lanes = assignLanes(trips, direction, layers);

  // Step 4: Position assignment
  const stops = positionStops(
    layers,
    lanes,
    stopNameMap,
    direction,
    stopSpacing,
    laneHeight,
    baseY
  );

  // Step 5: Build connections
  const connections = buildConnections(trips, direction, layers);

  return { stops, connections };
}

/**
 * Build directed graph from trips
 */
function buildGraph(trips: Trip[], direction: "inbound" | "outbound") {
  const adjacency = new Map<string, Set<string>>();
  const nodes = new Set<string>();

  trips.forEach((trip) => {
    const stops = direction === "inbound" ? trip.inbound : trip.outbound;

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
 */
function assignLanes(
  trips: Trip[],
  direction: "inbound" | "outbound",
  layers: Map<string, number>
): Map<string, number> {
  const lanes = new Map<string, number>();

  // Group nodes by layer
  const layerGroups = new Map<number, string[]>();
  layers.forEach((layer, node) => {
    if (!layerGroups.has(layer)) {
      layerGroups.set(layer, []);
    }
    layerGroups.get(layer)!.push(node);
  });

  // For each trip, assign a consistent lane
  const tripLanes = new Map<string, number>();
  let nextLane = 0;

  trips.forEach((trip) => {
    const stops = direction === "inbound" ? trip.inbound : trip.outbound;

    // Try to find an existing lane that doesn't conflict
    let assignedLane = -1;
    for (let lane = 0; lane < nextLane; lane++) {
      let hasConflict = false;

      // Check if this lane is already used by stops in this trip's layers
      for (const stopId of stops) {
        const layer = layers.get(stopId);
        if (layer !== undefined) {
          const otherStopsInLayer = layerGroups.get(layer) || [];
          for (const otherStop of otherStopsInLayer) {
            if (otherStop !== stopId && lanes.get(otherStop) === lane) {
              // Check if they're in different trips
              const otherInSameTrip = stops.includes(otherStop);
              if (!otherInSameTrip) {
                hasConflict = true;
                break;
              }
            }
          }
        }
        if (hasConflict) break;
      }

      if (!hasConflict) {
        assignedLane = lane;
        break;
      }
    }

    if (assignedLane === -1) {
      assignedLane = nextLane++;
    }

    tripLanes.set(trip.id, assignedLane);

    // Assign lane to all stops in this trip
    stops.forEach((stopId) => {
      const existingLane = lanes.get(stopId);
      if (existingLane === undefined) {
        lanes.set(stopId, assignedLane);
      } else {
        // Keep minimum lane for shared stops (prefer main line)
        lanes.set(stopId, Math.min(existingLane, assignedLane));
      }
    });
  });

  return lanes;
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
  baseY: number
): StopLayout[] {
  const stops: StopLayout[] = [];

  layers.forEach((layer, stopId) => {
    const lane = lanes.get(stopId) || 0;

    // For outbound, reverse the X direction
    const x =
      direction === "inbound"
        ? layer * stopSpacing
        : (getMaxLayer(layers) - layer) * stopSpacing;

    const y =
      direction === "inbound"
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
 * Build connections with express detection
 */
function buildConnections(
  trips: Trip[],
  direction: "inbound" | "outbound",
  layers: Map<string, number>
): Connection[] {
  const connections: Connection[] = [];

  trips.forEach((trip) => {
    const stops = direction === "inbound" ? trip.inbound : trip.outbound;

    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];

      const fromLayer = layers.get(from);
      const toLayer = layers.get(to);

      // Check if connection skips layers (express)
      const isExpress =
        fromLayer !== undefined &&
        toLayer !== undefined &&
        Math.abs(toLayer - fromLayer) > 1;

      connections.push({
        from,
        to,
        tripId: trip.id,
        tripName: trip.name,
        color: trip.color,
        direction,
        isExpress,
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

  console.log("position", positions);

  return positions;
}
