import ELK from 'elkjs/lib/elk.bundled.js'
import type { Stop } from "../types/stop.type";
import type { Trip } from '../types/trip.type';

const elk = new ELK();

export const calculateDiagramLayoutWithELK = async (
  trips: Trip[],
  stops: Stop[],
  directionSeparation = 200 // distance between inbound/outbound
) => {
  // --- Build graph nodes ---
  const nodes = stops.map((stop) => ({
    id: stop.id,
    width: 40,
    height: 20,
    labels: [{ text: stop.name }],
  }));

  // --- Build edges (inbound and outbound trips) ---
  const edges: { id: string; sources: string[]; targets: string[] }[] = [];

  trips.forEach((trip, idx) => {
    // inbound: left → right
    for (let i = 0; i < trip.inbound.length - 1; i++) {
      edges.push({
        id: `in_${trip.id}_${i}`,
        sources: [trip.inbound[i]],
        targets: [trip.inbound[i + 1]],
      });
    }
    // outbound: right → left
    for (let i = 0; i < trip.outbound.length - 1; i++) {
      edges.push({
        id: `out_${trip.id}_${i}`,
        sources: [trip.outbound[i]],
        targets: [trip.outbound[i + 1]],
      });
    }
  });

  // --- Create ELK graph ---
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered", // topological-like (Sugiyama)
      "elk.direction": "RIGHT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "100",
      "elk.spacing.nodeNode": "50",
      "elk.edgeRouting": "ORTHOGONAL", // keeps clean lines
    },
    children: nodes,
    edges: edges,
  };

  // --- Run layout computation ---
  const layout = await elk.layout(graph);

  // --- Map back stop positions ---
  const positions: Record<string, { x: number; y: number }> = {};
  layout.children?.forEach((node) => {
    positions[node.id] = { x: node.x || 0, y: node.y || 0 };
  });

  // --- Separate inbound/outbound vertically ---
  trips.forEach((trip) => {
    trip.outbound.forEach((stopId) => {
      if (positions[stopId]) {
        positions[stopId].y += directionSeparation; // shift outbound lower
      }
    });
  });

  return positions;
};
