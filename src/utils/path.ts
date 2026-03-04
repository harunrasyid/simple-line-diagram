import type { StopPositions } from "../types/stop.type";
import type { Trip, TripPath, SegmentPath } from "../types/trip.type";
import type { Connection, LayoutResult } from "./sugiyama";

/** Bias vertical merge turn toward destination (1 = at destination, 0.5 = midpoint). Used when no obstacles. */
const MERGE_BIAS = 0.5;
/** Minimum horizontal span so the turn does not overlap the stop circle. */
const MIN_HORIZONTAL_SEGMENT = 10;
/** Margin around obstacle stop centers to avoid (e.g. stop circle radius). */
const OBSTACLE_MARGIN = 15;

export interface PathGenerationOptions {
  laneHeight?: number;
  inboundY?: number;
  outboundY?: number;
  endStopIds?: Set<string>;
}

function clampBiasedX(biasedX: number, prevX: number, nextX: number): number {
  const minX = Math.min(prevX, nextX);
  const maxX = Math.max(prevX, nextX);
  const left = minX + MIN_HORIZONTAL_SEGMENT;
  const right = maxX - MIN_HORIZONTAL_SEGMENT;
  if (left >= right) return (minX + maxX) / 2;
  return Math.max(left, Math.min(right, biasedX));
}

const Y_LINE_TOLERANCE = 1;

/**
 * Find a safe X position for the vertical turn so the path does not cross through unrelated stops.
 * Accounts for obstacles on both horizontal segments (prevY and nextY) and the vertical segment.
 * Returns the default biased X if no obstacles, else the center of a safe gap (prefer closest to biased X).
 * Returns null if no safe position exists (caller should use express-style bypass).
 */
function findSafeTurnX(
  prevX: number,
  nextX: number,
  prevY: number,
  nextY: number,
  allPositions: StopPositions,
  tripStopIds: Set<string>,
  prevStopId: string,
  nextStopId: string,
  defaultBiasedX: number,
): number | null {
  const minY = Math.min(prevY, nextY);
  const maxY = Math.max(prevY, nextY);
  const xMin = Math.min(prevX, nextX);
  const xMax = Math.max(prevX, nextX);
  const goingRight = prevX < nextX;
  const validLeft = xMin + MIN_HORIZONTAL_SEGMENT;
  const validRight = xMax - MIN_HORIZONTAL_SEGMENT;
  if (validLeft >= validRight) return defaultBiasedX;

  const prevYObstacleXs: number[] = [];
  const nextYObstacleXs: number[] = [];
  const verticalObstacleXs: number[] = [];

  for (const [id, pos] of Object.entries(allPositions)) {
    if (id === prevStopId || id === nextStopId) continue;
    if (tripStopIds.has(id)) continue;
    if (pos.x <= xMin || pos.x >= xMax) continue;

    if (Math.abs(pos.y - prevY) <= Y_LINE_TOLERANCE) {
      prevYObstacleXs.push(pos.x);
    } else if (Math.abs(pos.y - nextY) <= Y_LINE_TOLERANCE) {
      nextYObstacleXs.push(pos.x);
    } else if (pos.y >= minY && pos.y <= maxY) {
      verticalObstacleXs.push(pos.x);
    }
  }

  // Horizontal constraints: narrow the valid turnX range so L-shape segments don't cross obstacles
  let horizLeft = validLeft;
  let horizRight = validRight;

  if (goingRight) {
    // Segment 1: prevX -> turnX at prevY. Avoid crossing prevY obstacles: turnX must be left of them.
    if (prevYObstacleXs.length > 0) {
      horizRight = Math.min(horizRight, Math.min(...prevYObstacleXs) - OBSTACLE_MARGIN);
    }
    // Segment 2: turnX -> nextX at nextY. Avoid crossing nextY obstacles: turnX must be right of them.
    if (nextYObstacleXs.length > 0) {
      horizLeft = Math.max(horizLeft, Math.max(...nextYObstacleXs) + OBSTACLE_MARGIN);
    }
  } else {
    // Going left: segment 1 is prevX -> turnX (right to left), segment 2 is turnX -> nextX
    if (prevYObstacleXs.length > 0) {
      horizLeft = Math.max(horizLeft, Math.max(...prevYObstacleXs) + OBSTACLE_MARGIN);
    }
    if (nextYObstacleXs.length > 0) {
      horizRight = Math.min(horizRight, Math.min(...nextYObstacleXs) - OBSTACLE_MARGIN);
    }
  }

  if (horizLeft > horizRight) return null;

  // No vertical obstacles and no horizontal constraints that forced a narrow range: use default
  if (verticalObstacleXs.length === 0) {
    const clamped = Math.max(horizLeft, Math.min(horizRight, defaultBiasedX));
    return clamped;
  }

  // Forbidden intervals for vertical segment: [x - margin, x + margin], merged if overlapping
  const forbidden: Array<{ lo: number; hi: number }> = [];
  const sorted = [...verticalObstacleXs].sort((a, b) => a - b);
  for (const x of sorted) {
    const lo = x - OBSTACLE_MARGIN;
    const hi = x + OBSTACLE_MARGIN;
    const last = forbidden[forbidden.length - 1];
    if (last && lo <= last.hi) {
      last.hi = Math.max(last.hi, hi);
    } else {
      forbidden.push({ lo, hi });
    }
  }

  // Safe gaps inside [horizLeft, horizRight]
  const gaps: Array<{ lo: number; hi: number }> = [];
  let cur = horizLeft;
  for (const { lo, hi } of forbidden) {
    if (lo > cur) {
      gaps.push({ lo: cur, hi: Math.min(lo, horizRight) });
    }
    cur = Math.max(cur, hi);
    if (cur >= horizRight) break;
  }
  if (cur < horizRight) {
    gaps.push({ lo: cur, hi: horizRight });
  }

  const validGaps = gaps.filter((g) => g.hi - g.lo >= MIN_HORIZONTAL_SEGMENT);
  if (validGaps.length === 0) return null;

  // Is default biased X already inside a safe gap?
  const clampedDefault = Math.max(horizLeft, Math.min(horizRight, defaultBiasedX));
  for (const g of validGaps) {
    if (clampedDefault >= g.lo && clampedDefault <= g.hi) return clampedDefault;
  }

  // Pick the gap whose center is closest to defaultBiasedX; if tie, prefer larger gap
  let best: { center: number; width: number } | null = null;
  for (const g of validGaps) {
    const center = (g.lo + g.hi) / 2;
    const width = g.hi - g.lo;
    const dist = Math.abs(center - defaultBiasedX);
    if (
      !best ||
      dist < Math.abs(best.center - defaultBiasedX) ||
      (dist === Math.abs(best.center - defaultBiasedX) && width > best.width)
    ) {
      best = { center, width };
    }
  }
  return best ? best.center : null;
}

/**
 * Generate a single segment path from prevStop center to nextStop center
 * using octilinear routing (express detours, 90-degree turns, end-stop routing).
 * Cross-lane turns use obstacle-aware turn-X selection so the path does not cross unrelated stops.
 */
const generateSegmentPathPoints = (
  prevPos: { x: number; y: number },
  nextPos: { x: number; y: number },
  prevStopId: string,
  nextStopId: string,
  conn: Connection | undefined,
  tripLane: { inbound: number; outbound: number } | undefined,
  direction: "inbound" | "outbound",
  laneHeight: number,
  baseY: number,
  endStopIds: Set<string>,
  allPositions: StopPositions,
  tripStopIds: Set<string>,
): [number, number, number][] => {
  const path: [number, number, number][] = [];
  path.push([prevPos.x, prevPos.y, 0]);

  const dx = nextPos.x - prevPos.x;
  const dy = nextPos.y - prevPos.y;

  // Express segments: bypass on express lane and merge back exactly at destination X.
  if (conn && conn.isExpress && tripLane) {
    const tripLaneY =
      direction === "outbound"
        ? baseY - conn.lane * laneHeight
        : baseY + conn.lane * laneHeight;

    const horizontalOffset = Math.max(MIN_HORIZONTAL_SEGMENT, 20);
    const goingRight = dx >= 0;
    const detourX = goingRight
      ? prevPos.x + horizontalOffset
      : prevPos.x - horizontalOffset;

    path.push([detourX, prevPos.y, 0]);
    path.push([detourX, tripLaneY, 0]);
    path.push([nextPos.x, tripLaneY, 0]);
    path.push([nextPos.x, nextPos.y, 0]);
  } else {
    if (dy !== 0 && dx !== 0) {
      const prevIsEndStop = endStopIds.has(prevStopId);
      const nextIsEndStop = endStopIds.has(nextStopId);

      if (prevIsEndStop || nextIsEndStop) {
        const endStopX = prevIsEndStop ? prevPos.x : nextPos.x;
        path.push([endStopX, prevPos.y, 0]);
        path.push([endStopX, nextPos.y, 0]);
      } else {
        const defaultBiasedX = prevPos.x + dx * MERGE_BIAS;
        const turnX = findSafeTurnX(
          prevPos.x,
          nextPos.x,
          prevPos.y,
          nextPos.y,
          allPositions,
          tripStopIds,
          prevStopId,
          nextStopId,
          clampBiasedX(defaultBiasedX, prevPos.x, nextPos.x),
        );
        if (turnX !== null) {
          path.push([turnX, prevPos.y, 0]);
          path.push([turnX, nextPos.y, 0]);
        } else {
          // No safe turn position: express-style bypass (horizontal at prevY, vertical at nextX)
          path.push([nextPos.x, prevPos.y, 0]);
          path.push([nextPos.x, nextPos.y, 0]);
        }
      }
    }
  }

  path.push([nextPos.x, nextPos.y, 0]);
  return path;
};

/**
 * Generate octilinear paths per segment for trips.
 * Each segment path runs from the center of prevStop to the center of nextStop.
 */
export const generateOctilinearPaths = (
  trips: Trip[],
  positions: StopPositions,
  layout?: LayoutResult,
  options: PathGenerationOptions = {},
): TripPath[] => {
  const {
    laneHeight = 60,
    inboundY = -200,
    outboundY = 0,
    endStopIds = new Set<string>(),
  } = options;

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

  const generateSegmentPaths = (
    segments: { id: string; prevStop: string; nextStop: string }[],
    direction: "inbound" | "outbound",
    tripId: string,
    color: [number, number, number],
    tripStopIds: Set<string>,
  ): SegmentPath[] => {
    const baseY = direction === "inbound" ? inboundY : outboundY;
    const tripLane = tripLaneMap.get(tripId);
    const dirConnections =
      direction === "inbound"
        ? tripConnections.get(tripId)?.inbound
        : tripConnections.get(tripId)?.outbound;

    return segments
      .filter((seg) => positions[seg.prevStop] && positions[seg.nextStop])
      .map((seg) => {
        const prevPos = positions[seg.prevStop];
        const nextPos = positions[seg.nextStop];
        const conn = dirConnections?.find(
          (c) => c.from === seg.prevStop && c.to === seg.nextStop,
        );

        const path = generateSegmentPathPoints(
          prevPos,
          nextPos,
          seg.prevStop,
          seg.nextStop,
          conn,
          tripLane,
          direction,
          laneHeight,
          baseY,
          endStopIds,
          positions,
          tripStopIds,
        );

        return {
          id: seg.id,
          tripId,
          color,
          path,
          prevStop: seg.prevStop,
          nextStop: seg.nextStop,
          direction,
          isDashed: (conn?.lane ?? 0) !== 0,
        };
      });
  };

  return trips.map((trip) => {
    const tripStopIds = new Set([
      ...trip.inboundStop,
      ...trip.outboundStop,
    ]);
    const inboundSegmentPaths = generateSegmentPaths(
      trip.inboundSegment,
      "inbound",
      trip.id,
      trip.color,
      tripStopIds,
    );
    const outboundSegmentPaths = generateSegmentPaths(
      trip.outboundSegment,
      "outbound",
      trip.id,
      trip.color,
      tripStopIds,
    );

    return {
      ...trip,
      inboundSegmentPaths,
      outboundSegmentPaths,
    };
  });
};
