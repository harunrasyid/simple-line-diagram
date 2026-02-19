import { useMemo } from "react";
import type { RouteData } from "../../types/route.type";
import type { StopPositions } from "../../types/stop.type";
import type { TripPath, TurnaroundConnector } from "../../types/trip.type";
import { generateOctilinearPaths } from "../../utils/path";
import { convertToStopPositions, layoutRouteStops } from "../../utils/sugiyama";
import { getTurnaroundConnectors } from "../../utils/turnaround";

export const LAYOUT_OPTIONS = {
  stopSpacing: 100,
  laneHeight: 60,
  inboundY: -200,
  outboundY: 0,
  endStopY: -100,
} as const;

export interface GraphLayoutResult {
  stationPositions: StopPositions;
  routePaths: TripPath[];
  turnaroundConnectors: TurnaroundConnector[];
}

export function useGraphLayout(routeData: RouteData): GraphLayoutResult {
  const layout = useMemo(
    () => layoutRouteStops(routeData, LAYOUT_OPTIONS),
    [routeData],
  );

  const stationPositions = useMemo(
    () => convertToStopPositions(layout),
    [layout],
  );

  const endStopIds = useMemo(
    () => new Set(routeData.stops.filter((s) => s.endStop).map((s) => s.id)),
    [routeData.stops],
  );

  const routePaths = useMemo(
    () =>
      generateOctilinearPaths(
        routeData.trips,
        stationPositions,
        layout,
        { ...LAYOUT_OPTIONS, endStopIds },
      ),
    [routeData.trips, stationPositions, layout, endStopIds],
  );

  const turnaroundConnectors = useMemo(
    () => getTurnaroundConnectors(routeData.trips, stationPositions),
    [routeData.trips, stationPositions],
  );

  return { stationPositions, routePaths, turnaroundConnectors };
}
