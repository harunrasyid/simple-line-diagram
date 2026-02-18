import { useRef } from "react";
import type { RouteData } from "../../types/route.type";
import type { Trip } from "../../types/trip.type";
import type { Vehicle } from "../../types/vehicle.type";
import type { RendererType } from "../../types/renderer.type";
import { LineDiagram } from "./LineDiagram";
import { LineDiagramPixi } from "./LineDiagramPixi";

export interface LineDiagramWrapperProps {
  routeData: RouteData;
  visibleTrip: Trip[];
  vehicles?: Vehicle[];
  rendererType: RendererType;
}

export function LineDiagramWrapper({
  routeData,
  visibleTrip,
  vehicles = [],
  rendererType,
}: LineDiagramWrapperProps) {
  const pixiContainerRef = useRef<HTMLDivElement | null>(null);

  if (rendererType === "pixijs") {
    return (
      <div
        ref={pixiContainerRef}
        style={{ flex: 1, position: "relative", minHeight: 0 }}
      >
        <LineDiagramPixi
          routeData={routeData}
          visibleTrip={visibleTrip}
          vehicles={vehicles}
          containerRef={pixiContainerRef}
        />
      </div>
    );
  }

  return (
    <LineDiagram
      routeData={routeData}
      visibleTrip={visibleTrip}
      vehicles={vehicles}
    />
  );
}
