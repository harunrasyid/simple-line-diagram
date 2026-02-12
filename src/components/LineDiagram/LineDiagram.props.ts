import type { RefObject } from "react";
import type { OrthographicViewState } from "deck.gl";
import type { RouteData } from "../../types/route.type";
import type { Trip } from "../../types/trip.type";

export interface LineDiagramProps {
  routeData: RouteData;
  visibleTrip: Trip[];
  initialViewState?: OrthographicViewState;
  controller?: boolean;
}

export interface LineDiagramPixiProps {
  routeData: RouteData;
  visibleTrip: Trip[];
  containerRef: RefObject<HTMLDivElement | null>;
}
