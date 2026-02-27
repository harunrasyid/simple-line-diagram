import type { StopPositions } from "../types/stop.type";
import type { Trip, TurnaroundConnector } from "../types/trip.type";

const VERTICAL_ALIGN_THRESHOLD = 1;

/**
 * Check if a segment already exists that connects fromStop to toStop for this trip.
 * (e.g. an explicit turnaround segment in the route data)
 */
export function hasExistingConnection(
  trip: Trip,
  fromStopId: string,
  toStopId: string,
): boolean {
  const check = (prev: string, next: string) =>
    prev === fromStopId && next === toStopId;

  const inOutbound = trip.outboundSegment.some((seg) =>
    check(seg.prevStop, seg.nextStop),
  );
  if (inOutbound) return true;

  const inInbound = trip.inboundSegment.some((seg) =>
    check(seg.prevStop, seg.nextStop),
  );
  return inInbound;
}

/**
 * Generate path points for the turnaround connector.
 * - If stops are vertically aligned (same X): direct vertical line.
 * - If not: S-shape with horizontal segment at midY (between inbound/outbound layers).
 */
export function generateTurnaroundPath(
  fromPos: { x: number; y: number },
  toPos: { x: number; y: number },
): [number, number, number][] {
  const z = 0;
  const path: [number, number, number][] = [[fromPos.x, fromPos.y, z]];

  const aligned =
    Math.abs(fromPos.x - toPos.x) <= VERTICAL_ALIGN_THRESHOLD;

  if (aligned) {
    path.push([toPos.x, toPos.y, z]);
  } else {
    const midY = (fromPos.y + toPos.y) / 2;
    path.push([fromPos.x, midY, z]);
    path.push([toPos.x, midY, z]);
    path.push([toPos.x, toPos.y, z]);
  }

  return path;
}

const DEFAULT_HATCH_SPACING = 12;
const HATCH_VERTICAL_WIDTH = 32;

/**
 * Generate parallel diagonal (45-degree) line segments for hatching the area
 * between two positions. Lines run top-left to bottom-right.
 * Returns array of [x1, y1, x2, y2] for each segment.
 */
export function generateDiagonalHatchLines(
  fromPos: { x: number; y: number },
  toPos: { x: number; y: number },
  spacing: number = DEFAULT_HATCH_SPACING,
): [number, number, number, number][] {
  let minX = Math.min(fromPos.x, toPos.x);
  let maxX = Math.max(fromPos.x, toPos.x);
  const minY = Math.min(fromPos.y, toPos.y);
  const maxY = Math.max(fromPos.y, toPos.y);

  if (Math.abs(maxX - minX) < 1) {
    minX -= HATCH_VERTICAL_WIDTH / 2;
    maxX += HATCH_VERTICAL_WIDTH / 2;
  }

  const lines: [number, number, number, number][] = [];
  const step = spacing * Math.SQRT2;
  const bMin = minY - maxX;
  const bMax = maxY - minX;

  for (let b = bMin; b <= bMax; b += step) {
    const t0 = Math.max(minX, minY - b);
    const t1 = Math.min(maxX, maxY - b);
    if (t0 < t1) {
      lines.push([t0, t0 + b, t1, t1 + b]);
    }
  }

  return lines;
}

/**
 * Generate diagonal hatch lines that follow a polyline path by creating
 * a narrow corridor around each segment and hatching that rectangle.
 */
export function generatePathFollowingHatchLines(
  path: [number, number, number][],
  corridorWidth: number = HATCH_VERTICAL_WIDTH,
  spacing: number = DEFAULT_HATCH_SPACING,
): [number, number, number, number][] {
  if (path.length < 2) return [];

  const allLines: [number, number, number, number][] = [];
  const halfWidth = corridorWidth / 2;

  for (let i = 0; i < path.length - 1; i++) {
    const [x0, y0] = path[i];
    const [x1, y1] = path[i + 1];

    const dx = x1 - x0;
    const dy = y1 - y0;

    // Skip zero-length segments
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

    let minX: number;
    let maxX: number;
    let minY: number;
    let maxY: number;

    if (Math.abs(dx) >= Math.abs(dy)) {
      // Treat as horizontal-dominant segment
      minX = Math.min(x0, x1);
      maxX = Math.max(x0, x1);
      minY = Math.min(y0 - halfWidth, y0 + halfWidth);
      maxY = Math.max(y0 - halfWidth, y0 + halfWidth);
    } else {
      // Treat as vertical-dominant segment
      minX = Math.min(x0 - halfWidth, x0 + halfWidth);
      maxX = Math.max(x0 - halfWidth, x0 + halfWidth);
      minY = Math.min(y0, y1);
      maxY = Math.max(y0, y1);
    }

    const segmentLines = generateDiagonalHatchLines(
      { x: minX, y: minY },
      { x: maxX, y: maxY },
      spacing,
    );
    allLines.push(...segmentLines);
  }

  return allLines;
}

/**
 * Detect turnaround points for trips that have both inbound and outbound.
 * Checks both directions:
 * - Right: last outbound stop -> first inbound stop
 * - Left: last inbound stop -> first outbound start
 * Returns connectors only when there is no existing segment connecting them.
 */
export function getTurnaroundConnectors(
  trips: Trip[],
  positions: StopPositions,
): TurnaroundConnector[] {
  const connectors: TurnaroundConnector[] = [];

  for (const trip of trips) {
    const outboundStops = trip.outboundStop;
    const inboundStops = trip.inboundStop;

    if (outboundStops.length === 0 || inboundStops.length === 0) {
      continue;
    }

    const pairs: [string, string][] = [
      [outboundStops[outboundStops.length - 1], inboundStops[0]],
      [inboundStops[inboundStops.length - 1], outboundStops[0]],
    ];

    for (const [fromStopId, toStopId] of pairs) {
      if (fromStopId === toStopId) {
        continue;
      }
      if (hasExistingConnection(trip, fromStopId, toStopId)) {
        continue;
      }

      const fromPos = positions[fromStopId];
      const toPos = positions[toStopId];

      if (!fromPos || !toPos) {
        continue;
      }

      const path = generateTurnaroundPath(fromPos, toPos);

      connectors.push({
        tripId: trip.id,
        fromStopId,
        toStopId,
        path,
        color: [...trip.color],
      });
    }
  }

  return connectors;
}
