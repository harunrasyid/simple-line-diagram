// Data types for stop
export interface Stop {
  id: string;
  name: string;
  lat?: number;
  lon?: number;
}

// Data type for stop in orthographic coordinates
export interface StopPosition {
  x: number;
  y: number;
  level: number;
  tripIds: string[]; // List of all trip that use this stop
}

// List of all stops in orthographic coordinates
export interface StopPositions {
  [stopId: string]: StopPosition;
}
