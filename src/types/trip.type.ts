export interface Trip {
  id: string;
  name: string;
  color: [number, number, number];
  outbound: string[];
  inbound: string[];
}

export interface TripPath extends Trip {
  outboundPath: [number, number, number][];
  inboundPath: [number, number, number][];
}
