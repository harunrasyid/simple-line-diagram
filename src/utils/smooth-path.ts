type Point3D = [number, number, number];

function calculatePathLength(path: Point3D[]): number {
  let totalLength = 0;

  for (let i = 1; i < path.length; i++) {
    const [x1, y1] = path[i - 1];
    const [x2, y2] = path[i];

    // Calculate 2D distance between consecutive points
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    totalLength += distance;
  }

  return totalLength;
}

export function extendPathToMatchLength(
  inboundPath: Point3D[],
  outboundPath: Point3D[]
): {
  inboundPath: Point3D[];
  outboundPath: Point3D[];
} {
  const inboundLength = calculatePathLength(inboundPath);
  const outboundLength = calculatePathLength(outboundPath);

  // Make copies to avoid mutating original arrays
  const newInbound = [...inboundPath];
  const newOutbound = [...outboundPath];

  if (Math.abs(inboundLength - outboundLength) < 0.001) {
    return { inboundPath: newInbound, outboundPath: newOutbound };
  }

  // Determine which path is shorter
  const shorterPath = inboundLength < outboundLength ? "inbound" : "outbound";
  const lengthDifference = Math.abs(inboundLength - outboundLength);

  if (shorterPath === "inbound") {
    // Extend inbound path at the beginning
    const firstPoint = newInbound[0];
    const secondPoint = newInbound[1];

    // Calculate the direction vector and normalize it
    const dx = secondPoint[0] - firstPoint[0];
    const dy = secondPoint[1] - firstPoint[1];
    const dz = secondPoint[2] - firstPoint[2];

    const segmentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Normalize direction
    const dirX = dx / segmentLength;
    const dirY = dy / segmentLength;
    const dirZ = dz / segmentLength;

    // Add a new point at the beginning extending by the length difference
    const newPoint: Point3D = [
      firstPoint[0] - dirX * lengthDifference,
      firstPoint[1] - dirY * lengthDifference,
      firstPoint[2] - dirZ * lengthDifference,
    ];
    newInbound.unshift(newPoint);
  } else {
    // Extend outbound path at the end
    const lastPoint = newOutbound[newOutbound.length - 1];
    const secondLastPoint = newOutbound[newOutbound.length - 2];

    // Calculate the direction vector and normalize it
    const dx = lastPoint[0] - secondLastPoint[0];
    const dy = lastPoint[1] - secondLastPoint[1];
    const dz = lastPoint[2] - secondLastPoint[2];

    const segmentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Normalize direction
    const dirX = dx / segmentLength;
    const dirY = dy / segmentLength;
    const dirZ = dz / segmentLength;

    // Add a new point at the end extending by the length difference
    const newPoint: Point3D = [
      lastPoint[0] + dirX * lengthDifference,
      lastPoint[1] + dirY * lengthDifference,
      lastPoint[2] + dirZ * lengthDifference,
    ];
    newOutbound.push(newPoint);
  }

  console.log({
    inboundPath: newInbound,
    outboundPath: newOutbound,
  });

  return {
    inboundPath: newInbound,
    outboundPath: newOutbound,
  };
}

export function straightenPath(
  path: [number, number, number][]
): [number, number, number][] {
  const straightened: [number, number, number][] = [path[0]];

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];

    const dx = curr[0] - prev[0];
    const dy = curr[1] - prev[1];

    if (dx !== 0 && dy !== 0) {
      straightened.push([curr[0], prev[1], prev[2]]);
    }

    straightened.push(curr);
  }

  return straightened;
}
