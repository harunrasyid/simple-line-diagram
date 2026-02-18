import type { RefObject } from "react";
import type { OrthographicViewState } from "deck.gl";
import type { RouteData } from "../../types/route.type";
import type { Trip } from "../../types/trip.type";
import type { Vehicle } from "../../types/vehicle.type";

export interface LineDiagramProps {
  routeData: RouteData;
  visibleTrip: Trip[];
  vehicles?: Vehicle[];
  initialViewState?: OrthographicViewState;
  controller?: boolean;
}

export interface LineDiagramPixiProps {
  routeData: RouteData;
  visibleTrip: Trip[];
  vehicles?: Vehicle[];
  containerRef: RefObject<HTMLDivElement | null>;
}
