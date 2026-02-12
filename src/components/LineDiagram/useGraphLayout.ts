import { useMemo } from "react";
import type { RouteData } from "../../types/route.type";
import type { StopPositions } from "../../types/stop.type";
import type { TripPath } from "../../types/trip.type";
import { generateOctilinearPaths } from "../../utils/path";
import { convertToStopPositions, layoutRouteStops } from "../../utils/sugiyama";

export const LAYOUT_OPTIONS = {
  stopSpacing: 100,
  laneHeight: 60,
  inboundY: -200,
  outboundY: 0,
} as const;

export interface GraphLayoutResult {
  stationPositions: StopPositions;
  routePaths: TripPath[];
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

  const routePaths = useMemo(
    () =>
      generateOctilinearPaths(
        routeData.trips,
        stationPositions,
        layout,
        LAYOUT_OPTIONS,
      ),
    [routeData.trips, stationPositions, layout],
  );

  return { stationPositions, routePaths };
}
