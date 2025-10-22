import type { OrthographicViewState } from "deck.gl";
import type { RouteData } from "../../types/route.type";
import type { Trip } from "../../types/trip.type";

export interface LineDiagramProps {
  routeData: RouteData;
  visibleTrip: Trip[];
  initialViewState?: OrthographicViewState;
  controller?: boolean;
}
