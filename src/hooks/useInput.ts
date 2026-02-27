import { useState } from "react";
import type { RouteData } from "../types/route.type";
import type { Trip, Segment } from "../types/trip.type";
import type { Stop } from "../types/stop.type";

// API response wrapper (headway monitoring route)
interface RouteApiResponse {
  success?: boolean;
  message?: string;
  data?: {
    trips?: RawTrip[];
    stops?: RawStop[];
  };
}

interface RawSegment {
  id: string;
  distance: number;
  next_stop: string;
  prev_stop: string;
  cumulative_distance: number;
}

interface RawTrip {
  id: string;
  name: string;
  color: [number, number, number];
  inbound_stop: string[];
  outbound_stop: string[];
  inbound_segment: RawSegment[];
  outbound_segment: RawSegment[];
}

interface RawStop {
  id: string;
  halte_id?: string;
  name: string;
  is_end_stop?: boolean;
}

function mapSegment(seg: RawSegment): Segment {
  return {
    id: seg.id,
    distance: seg.distance,
    nextStop: seg.next_stop,
    prevStop: seg.prev_stop,
    cumulativeDistance: seg.cumulative_distance,
  };
}

function mapTrip(raw: RawTrip): Trip {
  return {
    id: raw.id,
    name: raw.name,
    color: raw.color,
    inboundStop: raw.inbound_stop ?? [],
    outboundStop: raw.outbound_stop ?? [],
    inboundSegment: (raw.inbound_segment ?? []).map(mapSegment),
    outboundSegment: (raw.outbound_segment ?? []).map(mapSegment),
  };
}

function mapStop(raw: RawStop): Stop {
  return {
    id: raw.id,
    name: raw.name,
    ...(raw.is_end_stop && { endStop: "true" }),
  };
}

function normalizeToRouteData(parsed: unknown): RouteData | null {
  // Support API wrapper: { success, message, data: { trips, stops } }
  const withData = parsed as RouteApiResponse;
  if (withData?.data?.trips && withData?.data?.stops) {
    return {
      trips: withData.data.trips.map(mapTrip),
      stops: withData.data.stops.map(mapStop),
    };
  }
  // Support raw RouteData (camelCase) for backwards compatibility
  const raw = parsed as RouteData;
  if (raw?.trips && raw?.stops) {
    return raw;
  }
  // Support raw snake_case at top level
  const snake = parsed as {
    trips?: RawTrip[];
    stops?: RawStop[];
  };
  if (snake?.trips && snake?.stops) {
    return {
      trips: snake.trips.map(mapTrip),
      stops: snake.stops.map(mapStop),
    };
  }
  return null;
}

export const useInput = () => {
  // Default empty route data
  const [routeData, setRouteData] = useState<RouteData>({
    trips: [],
    stops: [],
  });

  // Hold visible trips
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

  const showAllTrips = (): void => {
    setVisibleTrip(routeData.trips);
  };

  const hideAllTrips = (): void => {
    setVisibleTrip([]);
  };

  const handleJsonInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    try {
      const parsed = JSON.parse(e.target.value || "{}");
      const normalized = normalizeToRouteData(parsed);
      if (normalized) {
        setRouteData(normalized);
        setVisibleTrip(normalized.trips);
      }
    } catch (err) {
      console.error("Invalid JSON:", err);
    }
  };

  return {
    routeData,
    visibleTrip,
    toggleRoute,
    showAllTrips,
    hideAllTrips,
    handleJsonInput,
  };
};
