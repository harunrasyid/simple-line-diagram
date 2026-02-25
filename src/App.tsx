import { useMemo, useState } from "react";
import type { RendererType } from "./types/renderer.type";
import { LineDiagramWrapper } from "./components/LineDiagram/LineDiagramWrapper";
import { RendererSwitch } from "./components/RendererSwitch/RendererSwitch";
import { TripFilter } from "./components/TripFilter/TripFilter";
import { useVehicleSimulation } from "./hooks/useVehicleSimulation";
import { useInput } from "./hooks/useInput";

function App() {
  // Handle route input
  const { routeData, visibleTrip, toggleRoute, handleJsonInput } = useInput();

  const [rendererType, setRendererType] = useState<RendererType>("deckgl");
  // Omit options to use hook defaults (DEFAULT_SPEED, DEFAULT_TICK_MS), or pass e.g. { speed: 500, tickMs: 50 } for faster movement
  const vehicles = useVehicleSimulation(routeData);

  const visibleVehicles = useMemo(
    () => vehicles.filter((v) => visibleTrip.some((t) => t.id === v.tripId)),
    [vehicles, visibleTrip],
  );

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#0f172a",
        position: "relative",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* JSON Input Area */}
      <div style={{ padding: "10px", background: "#1e293b" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "6px",
          }}
        >
          <h3 style={{ margin: 0 }}>Paste Route JSON</h3>
          <RendererSwitch value={rendererType} onChange={setRendererType} />
        </div>
        <textarea
          placeholder="Paste route JSON here..."
          onChange={handleJsonInput}
          style={{
            width: "100%",
            height: "150px",
            fontFamily: "monospace",
            fontSize: "14px",
            borderRadius: "8px",
            padding: "8px",
            border: "1px solid #334155",
            background: "#0f172a",
            color: "white",
            resize: "vertical",
          }}
        />
      </div>

      {/* Line Diagram */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <LineDiagramWrapper
          routeData={routeData}
          visibleTrip={visibleTrip}
          vehicles={visibleVehicles}
          rendererType={rendererType}
        />
      </div>

      {/* Trip Filter */}
      <TripFilter
        routeData={routeData}
        visibleTrips={visibleTrip}
        onTripChange={toggleRoute}
      />
    </div>
  );
}

export default App;
