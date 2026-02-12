import { useState } from "react";
import type { RouteData } from "./types/route.type";
import type { Trip } from "./types/trip.type";
import type { RendererType } from "./types/renderer.type";
import { LineDiagramWrapper } from "./components/LineDiagram/LineDiagramWrapper";
import { RendererSwitch } from "./components/RendererSwitch/RendererSwitch";
import { TripFilter } from "./components/TripFilter/TripFilter";

function App() {
  // Default empty route data
  const [routeData, setRouteData] = useState<RouteData>({
    trips: [],
    stops: [],
  });

  const [visibleTrip, setVisibleTrip] = useState<Trip[]>([]);
  const [rendererType, setRendererType] = useState<RendererType>("deckgl");

  const toggleRoute = (routeId: string): void => {
    setVisibleTrip((prev) => {
      if (prev.some((trip) => trip.id === routeId)) {
        return prev.filter((trip) => trip.id !== routeId);
      }
      const newTrip = routeData.trips.find((trip) => trip.id === routeId);
      return newTrip ? [...prev, newTrip] : prev;
    });
  };

  const handleJsonInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    try {
      const parsed = JSON.parse(e.target.value);
      if (parsed.trips && parsed.stops) {
        setRouteData(parsed);
        setVisibleTrip(parsed.trips); // reset visible trips
      }
    } catch (err) {
      console.error("Invalid JSON:", err);
    }
  };

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
