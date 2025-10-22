import type { Stop } from "./stop.type";
import type { Trip } from "./trip.type";

// Route data
export interface RouteData {
  // List of this route trips
  trips: Trip[];
  // List of all station that used by this route, compile all trip stops
  stops: Stop[];
}
