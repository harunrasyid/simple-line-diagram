import DeckGL, {
  OrthographicView,
  PathLayer,
  PolygonLayer,
  ScatterplotLayer,
  TextLayer,
  type OrthographicViewState,
} from "deck.gl";
import { useMemo } from "react";
import type { LineDiagramProps } from "./LineDiagram.props";
import type { Stop } from "../../types/stop.type";
import type { SegmentPath } from "../../types/trip.type";
import type { ResolvedVehiclePosition } from "../../types/vehicle.type";
import { useGraphLayout } from "./useGraphLayout";
import { resolveVehiclePosition, getVehicleTriangleVertices } from "../../utils/vehicle";

const INITIAL_VIEW_STATE: OrthographicViewState = {
  target: [400, 0, 0],
  zoom: 1.2,
};

const VEHICLE_TRIANGLE_SIZE = 12;

export const LineDiagram = ({
  routeData,
  visibleTrip,
  vehicles = [],
  initialViewState = INITIAL_VIEW_STATE,
  controller = true,
  ...props
}: LineDiagramProps) => {
  const { stationPositions, routePaths } = useGraphLayout(routeData);

  const allSegments = routePaths
    .filter((r) => visibleTrip.some((t) => r.id === t.id))
    .flatMap((trip) => [
      ...trip.inboundSegmentPaths,
      ...trip.outboundSegmentPaths,
    ]);

  const tripPathMap = useMemo(
    () => new Map(routePaths.map((t) => [t.id, t])),
    [routePaths],
  );

  const resolvedVehicles = useMemo((): ResolvedVehiclePosition[] => {
    if (vehicles.length === 0) return [];
    return vehicles
      .map((v) => {
        const tripPath = tripPathMap.get(v.tripId);
        return tripPath ? resolveVehiclePosition(v, tripPath) : null;
      })
      .filter((r): r is ResolvedVehiclePosition => r !== null);
  }, [vehicles, tripPathMap]);

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

    // Vehicles (triangles)
    ...(resolvedVehicles.length > 0
      ? [
          new PolygonLayer({
            id: "vehicles",
            data: resolvedVehicles,
            getPolygon: (d) =>
              getVehicleTriangleVertices(d.x, d.y, d.angle, VEHICLE_TRIANGLE_SIZE),
            getFillColor: (d: ResolvedVehiclePosition): [number, number, number, number] => [...d.color, 255],
            getLineColor: [30, 41, 59],
            lineWidthMinPixels: 1,
          }),
          new TextLayer({
            id: "vehicle-labels",
            data: resolvedVehicles,
            getPosition: (d) => [d.x, d.y - VEHICLE_TRIANGLE_SIZE - 4, 0],
            getText: (d) => d.vehicleId,
            getSize: 10,
            getColor: [255, 255, 255],
            getAlignmentBaseline: "bottom",
            getTextAnchor: "middle",
            background: true,
            getBackgroundColor: [15, 23, 42, 220],
            backgroundPadding: [4, 2],
          }),
        ]
      : []),
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
