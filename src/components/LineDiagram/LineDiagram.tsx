import DeckGL, {
  OrthographicView,
  PathLayer,
  ScatterplotLayer,
  TextLayer,
  type OrthographicViewState,
} from "deck.gl";
import type { LineDiagramProps } from "./LineDiagram.props";
import type { Stop } from "../../types/stop.type";
import type { SegmentPath } from "../../types/trip.type";
import { useGraphLayout } from "./useGraphLayout";

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
  const { stationPositions, routePaths } = useGraphLayout(routeData);

  const allSegments = routePaths
    .filter((r) => visibleTrip.some((v) => r.id === v.id))
    .flatMap((trip) => [
      ...trip.inboundSegmentPaths,
      ...trip.outboundSegmentPaths,
    ]);

  // Create layers
  const layers = [
    // Route paths with octilinear angles (one path per segment)
    new PathLayer({
      id: "route-paths",
      data: allSegments,
      getPath: (d: SegmentPath) => d.path,
      getColor: (d: SegmentPath) => [...d.color],
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
      getRadius: (d: Stop) => (d.endStop ? 10 : 8),
      getFillColor: (d: Stop) => {
        const pos = stationPositions[d.id];
        if (d.endStop) return [100, 149, 237]; // cornflower blue for end stops
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
      getText: (d: Stop) => `${d.name}`,
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
