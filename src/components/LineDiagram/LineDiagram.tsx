import DeckGL, {
  OrthographicView,
  PathLayer,
  ScatterplotLayer,
  TextLayer,
  type OrthographicViewState,
} from "deck.gl";
import type { LineDiagramProps } from "./LineDiagram.props";
import type { Stop } from "../../types/stop.type";
import { useMemo } from "react";
import type { TripPath } from "../../types/trip.type";
import { generateOctilinearPaths } from "../../utils/path";
import { convertToStopPositions, layoutRouteStops } from "../../utils/sugiyama";
import { straightenPath } from "../../utils/smooth-path";

const INITIAL_VIEW_STATE: OrthographicViewState = {
  target: [400, 0, 0],
  zoom: 1.2,
};

export const LineDiagram = ({
  routeData,
  visibleTrip,
  initialViewState = INITIAL_VIEW_STATE,
  controller = true,
  ...props
}: LineDiagramProps) => {
  const stationPositions = useMemo(
    () =>
      convertToStopPositions(
        layoutRouteStops(routeData, {
          stopSpacing: 100, // Horizontal spacing
          laneHeight: 60, // Vertical offset for branches
          inboundY: -200, // Y position for inbound line
          outboundY: 0, // Y position for outbound line
        })
      ),
    [routeData]
  );

  const routePaths = useMemo(
    () => generateOctilinearPaths(routeData.trips, stationPositions),
    [routeData.trips, stationPositions]
  );

  console.log(stationPositions);
  console.log(routePaths);

  // Create layers
  const layers = [
    // Route paths with octilinear angles
    new PathLayer({
      id: "route-paths",
      data: routePaths.filter((r) =>
        visibleTrip.some((visibleTrip) => r.id === visibleTrip.id)
      ),
      getPath: (d: TripPath) => [...d.inboundPath, ...d.outboundPath],
      getColor: (d: TripPath) => [...d.color],
      getWidth: 8,
      widthMinPixels: 4,
      jointRounded: true,
      capRounded: true,
    }),

    // Stations
    new ScatterplotLayer({
      id: "stations",
      data: routeData.stops.filter((s) => stationPositions[s.id]),
      getPosition: (d: Stop) => {
        const pos = stationPositions[d.id];
        return [pos.x, pos.y, 0];
      },
      getRadius: 8,
      getFillColor: (d: Stop) => {
        const pos = stationPositions[d.id];
        return pos.tripIds.length > 1 ? [234, 179, 8] : [255, 255, 255];
      },
      stroked: true,
      lineWidthMinPixels: 3,
      getLineColor: [30, 41, 59],
    }),

    // Station labels
    new TextLayer({
      id: "station-labels",
      data: routeData.stops.filter((s) => stationPositions[s.id]),
      getPosition: (d: Stop) => {
        const pos = stationPositions[d.id];
        return [pos.x, pos.y - 25, 0];
      },
      getText: (d: Stop) => `${d.name} - ${d.id}`,
      getSize: 12,
      getColor: [255, 255, 255],
      getAlignmentBaseline: "bottom",
      getTextAnchor: "middle",
      background: true,
      getBackgroundColor: [15, 23, 42, 200],
      backgroundPadding: [6, 3],
    }),
  ];

  return (
    <DeckGL
      views={new OrthographicView()}
      initialViewState={initialViewState}
      layers={layers}
      controller={controller}
      {...props}
    />
  );
};
