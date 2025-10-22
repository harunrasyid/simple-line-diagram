import { useState } from "react";
import type { RouteData } from "./types/route.type";
import { LineDiagram } from "./components/LineDiagram/LineDiagram";
import { TripFilter } from "./components/TripFilter/TripFilter";
import type { Trip } from "./types/trip.type";

function App() {
  // Default empty route data
  const [routeData, setRouteData] = useState<RouteData>({
    trips: [],
    stops: [],
  });

  const [visibleTrip, setVisibleTrip] = useState<Trip[]>([]);

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
        <h3 style={{ marginBottom: "6px" }}>Paste Route JSON</h3>
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
      <div style={{ flex: 1, position: "relative" }}>
        <LineDiagram routeData={routeData} visibleTrip={visibleTrip} />
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
