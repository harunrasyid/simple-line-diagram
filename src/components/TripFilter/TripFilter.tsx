import type { Trip } from "../../types/trip.type";
import type { TripFilterProps } from "./TripFilter.props";

export const TripFilter = ({
  routeData,
  visibleTrips,
  onTripChange,
}: TripFilterProps) => {
  const isChecked = (visible: Trip[], tripId: string) => {
    return visible.some((trip) => trip.id === tripId);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        background: "rgba(15, 23, 42, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 8,
        padding: 16,
        color: "white",
        maxWidth: 250,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
        Trips
      </div>
      {routeData.trips.map((trip) => (
        <label
          key={trip.id}
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 8,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={isChecked(visibleTrips, trip.id) ? true : false}
            onChange={() => onTripChange(trip.id)}
            style={{ marginRight: 8 }}
          />
          <div
            style={{
              width: 16,
              height: 16,
              background: `rgb(${trip.color.join(",")})`,
              borderRadius: 3,
              marginRight: 8,
            }}
          />
          <span>{trip.name}</span>
        </label>
      ))}
    </div>
  );
};
