import type { Trip } from "../../types/trip.type";
import type { TripFilterProps } from "./TripFilter.props";

export const TripFilter = ({
  routeData,
  visibleTrips,
  onTripChange,
  onCheckAll,
  onUncheckAll,
}: TripFilterProps) => {
  const isChecked = (visible: Trip[], tripId: string) => {
    return visible.some((trip) => trip.id === tripId);
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        background: "rgba(15, 23, 42, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 8,
        padding: 16,
        color: "white",
        maxWidth: 250,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>Trips</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onCheckAll}
            style={{
              padding: "4px 8px",
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid rgba(148, 163, 184, 0.8)",
              background: "rgba(15, 23, 42, 0.9)",
              color: "white",
              cursor: "pointer",
            }}
          >
            Check all
          </button>
          <button
            type="button"
            onClick={onUncheckAll}
            style={{
              padding: "4px 8px",
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid rgba(148, 163, 184, 0.5)",
              background: "rgba(15, 23, 42, 0.6)",
              color: "white",
              cursor: "pointer",
            }}
          >
            Uncheck all
          </button>
        </div>
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
