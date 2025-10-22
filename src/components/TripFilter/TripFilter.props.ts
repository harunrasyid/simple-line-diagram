import type { RouteData } from "../../types/route.type";
import type { Trip } from "../../types/trip.type";

export interface TripFilterProps {
  routeData: RouteData;
  visibleTrips: Trip[];
  onTripChange: (tripId: string) => void;
}
