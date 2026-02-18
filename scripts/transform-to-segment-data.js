/**
 * Transforms route JSON from old format (outbound/inbound) to new format
 * (outboundStop/inboundStop + outboundSegment/inboundSegment) with dummy
 * distance and cumulativeDistance (incrementing from 0 per direction).
 *
 * Usage: node scripts/transform-to-segment-data.js < input.json > output.json
 *    or: node scripts/transform-to-segment-data.js input.json
 */

import fs from "fs";

const DUMMY_DISTANCE = 100;

function buildSegments(stopIds) {
  if (!stopIds || stopIds.length < 2) return [];
  const segments = [];
  let cumulative = 0;
  for (let i = 0; i < stopIds.length - 1; i++) {
    const prevStop = stopIds[i];
    const nextStop = stopIds[i + 1];
    const id = `${prevStop}-${nextStop}`;
    segments.push({
      id,
      distance: DUMMY_DISTANCE,
      nextStop,
      prevStop,
      cumulativeDistance: cumulative,
    });
    cumulative += DUMMY_DISTANCE;
  }
  return segments;
}

function transformTrip(trip) {
  const outboundStop = trip.outbound || trip.outboundStop || [];
  const inboundStop = trip.inbound || trip.inboundStop || [];
  return {
    id: trip.id,
    name: trip.name,
    color: trip.color,
    outboundStop,
    inboundStop,
    outboundSegment: buildSegments(outboundStop),
    inboundSegment: buildSegments(inboundStop),
  };
}

function transform(data) {
  return {
    trips: data.trips.map(transformTrip),
    stops: data.stops,
  };
}

const inputRaw =
  process.argv[2] !== undefined
    ? fs.readFileSync(process.argv[2], "utf8")
    : fs.readFileSync(0, "utf8");
const input = JSON.parse(inputRaw);
const output = transform(input);
console.log(JSON.stringify(output, null, 2));
