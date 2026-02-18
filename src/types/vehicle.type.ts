export interface Vehicle {
  id: string;
  tripId: string;
  distance: number; // meters from start of current direction
  direction: "inbound" | "outbound";
}

export interface ResolvedVehiclePosition {
  vehicleId: string;
  tripId: string;
  x: number;
  y: number;
  angle: number; // radians, for orienting the triangle
  segmentId: string;
  progress: number; // 0..1 within segment
  direction: "inbound" | "outbound";
  color: [number, number, number];
}
