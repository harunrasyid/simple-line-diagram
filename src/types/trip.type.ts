export interface Segment {
  id: string;
  distance: number;
  nextStop: string;
  prevStop: string;
  cumulativeDistance: number;
}

export interface Trip {
  id: string;
  name: string;
  color: [number, number, number];
  outboundStop: string[];
  inboundStop: string[];
  outboundSegment: Segment[];
  inboundSegment: Segment[];
}

export interface SegmentPath {
  id: string;
  tripId: string;
  color: [number, number, number];
  path: [number, number, number][];
  prevStop: string;
  nextStop: string;
  direction: "inbound" | "outbound";
}

export interface TripPath extends Trip {
  outboundSegmentPaths: SegmentPath[];
  inboundSegmentPaths: SegmentPath[];
}

export interface TurnaroundConnector {
  tripId: string;
  fromStopId: string;
  toStopId: string;
  path: [number, number, number][];
  color: [number, number, number];
}
