import { useState, useEffect, useRef } from "react";
import type { RouteData } from "../types/route.type";
import type { Vehicle } from "../types/vehicle.type";
import { getMaxDistance } from "../utils/vehicle";

const DEFAULT_SPEED = 1; // meters per tick
const DEFAULT_TICK_MS = 100;

export interface UseVehicleSimulationOptions {
  speed?: number;
  tickMs?: number;
}

/**
 * Dummy vehicle simulation: updates each vehicle's distance every tick.
 * When distance reaches the end of the current direction, flip to the other direction and reset distance to 0.
 */
export function useVehicleSimulation(
  routeData: RouteData,
  options: UseVehicleSimulationOptions = {},
): Vehicle[] {
  const { speed = DEFAULT_SPEED, tickMs = DEFAULT_TICK_MS } = options;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const tripsRef = useRef(routeData.trips);

  // Initialize dummy vehicles when trips become available; re-init when route changes
  useEffect(() => {
    const trips = routeData.trips;
    if (trips.length === 0) return;
    tripsRef.current = trips;

    const initial: Vehicle[] = [];
    trips.forEach((trip, i) => {
      initial.push({
        id: `vehicle-${i + 1}`,
        tripId: trip.id,
        distance: i * 100,
        direction: i % 2 === 0 ? "outbound" : "inbound",
      });
    });
    setVehicles(initial);
  }, [routeData.trips]);

  // Tick: advance distance and flip direction at end
  useEffect(() => {
    if (vehicles.length === 0) return;
    const trips = tripsRef.current;
    const tripMap = new Map(trips.map((t) => [t.id, t]));

    const intervalId = setInterval(() => {
      setVehicles((prev) =>
        prev.map((v) => {
          const trip = tripMap.get(v.tripId);
          if (!trip) return v;
          const segments =
            v.direction === "inbound"
              ? trip.inboundSegment
              : trip.outboundSegment;
          const maxDist = getMaxDistance(segments);
          let nextDistance = v.distance + speed;
          let nextDirection = v.direction;

          if (nextDistance >= maxDist) {
            nextDirection = v.direction === "inbound" ? "outbound" : "inbound";
            nextDistance = 0;
          }

          return {
            ...v,
            distance: nextDistance,
            direction: nextDirection,
          };
        }),
      );
    }, tickMs);
    return () => clearInterval(intervalId);
  }, [vehicles.length, speed, tickMs]);

  return vehicles;
}
