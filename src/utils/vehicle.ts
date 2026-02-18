import type { Segment, TripPath } from "../types/trip.type";
import type { Vehicle, ResolvedVehiclePosition } from "../types/vehicle.type";

/**
 * Max cumulative distance for a direction = last segment start + last segment length.
 */
export function getMaxDistance(segments: Segment[]): number {
  if (segments.length === 0) return 0;
  const last = segments[segments.length - 1];
  return last.cumulativeDistance + last.distance;
}

/**
 * Find segment index and progress (0..1) for a given distance along segments.
 */
function findSegmentAndProgress(
  segments: Segment[],
  distance: number,
): { segmentIndex: number; progress: number } | null {
  if (segments.length === 0) return null;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segmentEnd = seg.cumulativeDistance + seg.distance;
    if (distance < segmentEnd) {
      const progress =
        seg.distance > 0
          ? (distance - seg.cumulativeDistance) / seg.distance
          : 0;
      return { segmentIndex: i, progress };
    }
  }
  // Clamp to end of last segment
  return {
    segmentIndex: segments.length - 1,
    progress: 1,
  };
}

/**
 * Given a polyline path and progress (0..1), return exact (x, y) and angle (radians).
 */
export function positionOnPath(
  path: [number, number, number][],
  progress: number,
): { x: number; y: number; angle: number } {
  if (path.length === 0) return { x: 0, y: 0, angle: 0 };
  if (path.length === 1) return { x: path[0][0], y: path[0][1], angle: 0 };

  const clamped = Math.max(0, Math.min(1, progress));
  let acc = 0;
  const lengths: number[] = [];
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i - 1][0];
    const dy = path[i][1] - path[i - 1][1];
    const len = Math.hypot(dx, dy);
    lengths.push(len);
    acc += len;
  }
  const totalLength = acc;
  if (totalLength === 0) return { x: path[0][0], y: path[0][1], angle: 0 };

  const target = clamped * totalLength;
  acc = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (acc + lengths[i] >= target) {
      const t = lengths[i] > 0 ? (target - acc) / lengths[i] : 0;
      const x = path[i][0] + t * (path[i + 1][0] - path[i][0]);
      const y = path[i][1] + t * (path[i + 1][1] - path[i][1]);
      const angle = Math.atan2(
        path[i + 1][1] - path[i][1],
        path[i + 1][0] - path[i][0],
      );
      return { x, y, angle };
    }
    acc += lengths[i];
  }
  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
  return { x: last[0], y: last[1], angle };
}

/**
 * Resolve vehicle (distance + direction) to exact position on the trip path.
 */
export function resolveVehiclePosition(
  vehicle: Vehicle,
  tripPath: TripPath,
): ResolvedVehiclePosition | null {
  const segments =
    vehicle.direction === "inbound"
      ? tripPath.inboundSegment
      : tripPath.outboundSegment;
  const segmentPaths =
    vehicle.direction === "inbound"
      ? tripPath.inboundSegmentPaths
      : tripPath.outboundSegmentPaths;

  const found = findSegmentAndProgress(segments, vehicle.distance);
  if (!found || found.segmentIndex >= segmentPaths.length) return null;

  const segment = segments[found.segmentIndex];
  const segmentPath = segmentPaths[found.segmentIndex];
  if (!segmentPath || !segmentPath.path.length) return null;

  const { x, y, angle } = positionOnPath(segmentPath.path, found.progress);

  return {
    vehicleId: vehicle.id,
    tripId: vehicle.tripId,
    x,
    y,
    angle,
    segmentId: segment.id,
    progress: found.progress,
    direction: vehicle.direction,
    color: segmentPath.color,
  };
}

/**
 * Build triangle polygon (3 vertices) for a vehicle at (x, y) with given angle and size.
 * Triangle points in direction of travel (angle).
 */
export function getVehicleTriangleVertices(
  x: number,
  y: number,
  angle: number,
  size: number = 10,
): [number, number][] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Nose at (x + size, y) in local; back corners at (-size/2, ±size/2) in local
  const nose = [x + size * cos, y + size * sin] as [number, number];
  const left = [
    x - size * 0.5 * cos + size * 0.5 * sin,
    y - size * 0.5 * sin - size * 0.5 * cos,
  ] as [number, number];
  const right = [
    x - size * 0.5 * cos - size * 0.5 * sin,
    y - size * 0.5 * sin + size * 0.5 * cos,
  ] as [number, number];
  return [nose, left, right];
}
