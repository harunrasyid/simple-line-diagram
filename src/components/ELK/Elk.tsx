import React, { useEffect, useState } from "react";
import ELK from "elkjs/lib/elk.bundled.js";
import type { RouteData } from "../../types/route.type";

async function generateSugiyamaLayout(route: RouteData) {
  const elk = new ELK();

  // Determine order (left→right) based on first outbound trip
  const baseOrder = route.trips[0]?.outbound || route.stops.map((s) => s.id);
  const orderMap = new Map(baseOrder.map((id, i) => [id, i]));

  // 1️⃣ Build nodes with layer order
  const nodes = route.stops.map((s) => ({
    id: s.id,
    width: 80,
    height: 40,
    labels: [{ text: s.name }],
    layoutOptions: {
      // Assign the layer index to control x-position (Sugiyama layer)
      "elk.layered.layer": orderMap.get(s.id)?.toString() ?? "0",
    },
  }));

  // 2️⃣ Build edges from all trips
  const edges: any[] = [];
  for (const trip of route.trips) {
    const addEdges = (stops: string[], type: "in" | "out") => {
      for (let i = 0; i < stops.length - 1; i++) {
        edges.push({
          id: `${trip.id}-${type}-${i}`,
          sources: [stops[i]],
          targets: [stops[i + 1]],
          color: `rgb(${trip.color.join(",")})`,
        });
      }
    };
    addEdges(trip.outbound, "out");
    addEdges(trip.inbound, "in");
  }

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNodeBetweenLayers": "80",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.edgeRouting": "POLYLINE",
    },
    children: nodes,
    edges,
  };

  return await elk.layout(graph);
}

export function SugiyamaRouteDiagram({ route }: { route: RouteData }) {
  const [layout, setLayout] = useState<any | null>(null);

  useEffect(() => {
    generateSugiyamaLayout(route).then(setLayout);
  }, [route]);

  if (!layout) return <div>Computing layout...</div>;

  return (
    <svg width={10000} height={600} style={{ border: "1px solid #ccc" }}>
      {/* Edges */}
      {layout.edges.map((e: any) =>
        e.sections.map((s: any, i: number) => {
          const path = [
            `M${s.startPoint.x},${s.startPoint.y}`,
            ...(s.bendPoints?.map((b: any) => `L${b.x},${b.y}`) ?? []),
            `L${s.endPoint.x},${s.endPoint.y}`,
          ].join(" ");
          return (
            <path
              key={`${e.id}-${i}`}
              d={path}
              stroke={e.color || "gray"}
              fill="none"
              strokeWidth={2}
            />
          );
        })
      )}

      {/* Stops */}
      {layout.children.map((n: any) => (
        <g key={n.id}>
          <rect
            x={n.x}
            y={n.y}
            width={n.width}
            height={n.height}
            rx={6}
            fill="#3b82f6"
          />
          <text
            x={n.x + n.width / 2}
            y={n.y + n.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={12}
          >
            {n.labels?.[0]?.text ?? n.id}
          </text>
        </g>
      ))}
    </svg>
  );
}
