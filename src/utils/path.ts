import type { StopPositions } from "../types/stop.type";
import type { Trip, TripPath, SegmentPath } from "../types/trip.type";
import type { Connection, LayoutResult } from "./sugiyama";

/** Minimum horizontal span so the turn does not overlap the stop circle. */
const MIN_HORIZONTAL_SEGMENT = 10;

export interface PathGenerationOptions {
  laneHeight?: number;
  inboundY?: number;
  outboundY?: number;
  endStopIds?: Set<string>;
}

/**
 * Generate a single segment path from prevStop center to nextStop center
 * using octilinear routing (express detours, 90-degree turns, end-stop routing).
 * Cross-lane segments merge directly at destination (no mid-path L-turn).
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
        // Merge directly at destination (no L-turn in the middle)
        path.push([nextPos.x, prevPos.y, 0]);
        path.push([nextPos.x, nextPos.y, 0]);
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
    const inboundSegmentPaths = generateSegmentPaths(
      trip.inboundSegment,
      "inbound",
      trip.id,
      trip.color,
    );
    const outboundSegmentPaths = generateSegmentPaths(
      trip.outboundSegment,
      "outbound",
      trip.id,
      trip.color,
    );

    return {
      ...trip,
      inboundSegmentPaths,
      outboundSegmentPaths,
    };
  });
};
