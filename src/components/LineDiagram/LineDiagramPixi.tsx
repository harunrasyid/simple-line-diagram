import { Application, Container, Graphics, Text } from "pixi.js";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Stop } from "../../types/stop.type";
import type { StopPositions } from "../../types/stop.type";
import type { TripPath, TurnaroundConnector } from "../../types/trip.type";
import { generatePathFollowingHatchLines } from "../../utils/turnaround";
import {
  resolveVehiclePosition,
  getVehicleTriangleVertices,
} from "../../utils/vehicle";
import type { ResolvedVehiclePosition } from "../../types/vehicle.type";
import type { LineDiagramPixiProps } from "./LineDiagram.props";
import { useGraphLayout } from "./hooks/useGraphLayout";
import {
  ROUTE_LINE_WIDTH,
  DASH_LENGTH,
  GAP_LENGTH,
} from "./pathStyleConstants";

const STATION_RADIUS = 8;
const LABEL_OFFSET_Y = 15;
const LABEL_FONT_SIZE = 12;
const LABEL_ROTATION_DEG = 25;
const LABEL_ROTATION_RAD = (LABEL_ROTATION_DEG * Math.PI) / 180;
const VEHICLE_TRIANGLE_SIZE = 18;
const VEHICLE_LABEL_FONT_SIZE = 10;
const INITIAL_ZOOM = 1.2;
const INITIAL_TARGET: [number, number] = [400, 0];

function rgbToHex([r, g, b]: [number, number, number]): number {
  return (r << 16) | (g << 8) | b;
}

/**
 * Draw a polyline as dashed segments (dashLength then gapLength) along the path.
 */
function drawDashedPath(
  graphics: Graphics,
  pathPoints: [number, number, number][],
  color: number,
  lineWidth: number,
  dashLength: number,
  gapLength: number,
): void {
  if (pathPoints.length < 2) return;
  const n = pathPoints.length;
  const cumulative: number[] = [0];
  for (let i = 1; i < n; i++) {
    const a = pathPoints[i - 1];
    const b = pathPoints[i];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    cumulative[i] = cumulative[i - 1] + segLen;
  }
  const totalLen = cumulative[n - 1];

  function pointAt(t: number): [number, number] {
    if (t <= 0) return [pathPoints[0][0], pathPoints[0][1]];
    if (t >= totalLen) return [pathPoints[n - 1][0], pathPoints[n - 1][1]];
    let i = 0;
    while (i < n - 1 && cumulative[i + 1] < t) i++;
    const t0 = cumulative[i];
    const t1 = cumulative[i + 1];
    const frac = (t - t0) / (t1 - t0 || 1);
    const x =
      pathPoints[i][0] + frac * (pathPoints[i + 1][0] - pathPoints[i][0]);
    const y =
      pathPoints[i][1] + frac * (pathPoints[i + 1][1] - pathPoints[i][1]);
    return [x, y];
  }

  graphics.setStrokeStyle({
    width: lineWidth,
    color,
    cap: "round",
    join: "round",
  });
  graphics.beginPath();
  let t = 0;
  while (t < totalLen) {
    const dashEnd = Math.min(t + dashLength, totalLen);
    const p0 = pointAt(t);
    const p1 = pointAt(dashEnd);
    graphics.moveTo(p0[0], p0[1]).lineTo(p1[0], p1[1]);
    t = dashEnd + gapLength;
  }
  graphics.stroke();
}

function drawGraph(
  container: Container,
  stationPositions: StopPositions,
  routePaths: TripPath[],
  turnaroundConnectors: TurnaroundConnector[],
  stops: Stop[],
  visibleTripIds: Set<string>,
) {
  container.removeChildren();

  // Turnaround hatched connectors (behind paths)
  const turnaroundGraphics = new Graphics();
  const visibleConnectors = turnaroundConnectors.filter((c) =>
    visibleTripIds.has(c.tripId),
  );
  for (const connector of visibleConnectors) {
    const lines = generatePathFollowingHatchLines(connector.path);
    const color = rgbToHex(connector.color);

    turnaroundGraphics.setStrokeStyle({
      width: 2.5,
      color,
      alpha: 0.4,
    });
    for (const [x1, y1, x2, y2] of lines) {
      turnaroundGraphics.beginPath().moveTo(x1, y1).lineTo(x2, y2).stroke();
    }
  }
  container.addChild(turnaroundGraphics);

  // Paths layer (one path per segment)
  const pathsGraphics = new Graphics();
  const visiblePaths = routePaths.filter((r) => visibleTripIds.has(r.id));
  for (const trip of visiblePaths) {
    const allSegments = [
      ...trip.inboundSegmentPaths,
      ...trip.outboundSegmentPaths,
    ];
    for (const segment of allSegments) {
      if (segment.path.length < 2) continue;
      const color = rgbToHex(segment.color);
      if (segment.isDashed) {
        drawDashedPath(
          pathsGraphics,
          segment.path,
          color,
          ROUTE_LINE_WIDTH,
          DASH_LENGTH,
          GAP_LENGTH,
        );
      } else {
        pathsGraphics
          .beginPath()
          .setStrokeStyle({
            width: ROUTE_LINE_WIDTH,
            color,
            cap: "round",
            join: "round",
          })
          .moveTo(segment.path[0][0], segment.path[0][1]);
        for (let i = 1; i < segment.path.length; i++) {
          pathsGraphics.lineTo(segment.path[i][0], segment.path[i][1]);
        }
        pathsGraphics.stroke();
      }
    }
  }
  container.addChild(pathsGraphics);

  // Stations layer
  const stationsGraphics = new Graphics();
  const stopsWithPositions = stops.filter((s) => stationPositions[s.id]);
  for (const stop of stopsWithPositions) {
    const pos = stationPositions[stop.id];
    const isEndStop = Boolean(stop.endStop);
    const radius = isEndStop ? STATION_RADIUS * 1.25 : STATION_RADIUS;
    const fillColor = isEndStop
      ? rgbToHex([100, 149, 237])
      : pos.tripIds.length > 1
        ? rgbToHex([234, 179, 8])
        : 0xffffff;
    stationsGraphics
      .circle(pos.x, pos.y, radius)
      .fill({ color: fillColor })
      .stroke({ width: 3, color: 0x1e293b });
  }
  container.addChild(stationsGraphics);

  // Labels layer (below stop, 25° rotation, anchor at text start)
  for (const stop of stopsWithPositions) {
    const pos = stationPositions[stop.id];
    const labelGroup = new Container();
    labelGroup.position.set(pos.x, pos.y + LABEL_OFFSET_Y);
    labelGroup.rotation = LABEL_ROTATION_RAD;

    const label = new Text({
      text: stop.name,
      style: {
        fontSize: LABEL_FONT_SIZE,
        fill: 0xffffff,
        fontFamily: "sans-serif",
      },
    });
    label.anchor.set(0, 0);
    label.position.set(0, 0);

    const padding = 6;
    const vPad = 3;
    const w = label.width + padding * 2;
    const h = label.height + vPad * 2;
    const bg = new Graphics();
    bg.roundRect(-padding, -vPad, w, h, 4).fill({
      color: 0x0f172a,
      alpha: 200 / 255,
    });
    labelGroup.addChild(bg);
    labelGroup.addChild(label);
    container.addChild(labelGroup);
  }
}

export function LineDiagramPixi({
  routeData,
  visibleTrip,
  vehicles = [],
  containerRef,
}: LineDiagramPixiProps) {
  const { stationPositions, routePaths, turnaroundConnectors } =
    useGraphLayout(routeData);
  const appRef = useRef<Application | null>(null);
  const graphContainerRef = useRef<Container | null>(null);
  const graphContentRef = useRef<Container | null>(null);
  const vehiclesContainerRef = useRef<Container | null>(null);
  const viewStateRef = useRef({
    target: [...INITIAL_TARGET],
    zoom: INITIAL_ZOOM,
  });
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  const tripPathMap = useMemo(
    () => new Map(routePaths.map((t) => [t.id, t])),
    [routePaths],
  );

  const resolvedVehicles = useMemo(() => {
    if (vehicles.length === 0) return [];
    return vehicles
      .map((v) => {
        const tripPath = tripPathMap.get(v.tripId);
        return tripPath ? resolveVehiclePosition(v, tripPath) : null;
      })
      .filter((r): r is ResolvedVehiclePosition => r !== null);
  }, [vehicles, tripPathMap]);

  const updateView = useCallback(() => {
    const app = appRef.current;
    const graph = graphContainerRef.current;
    if (!app || !graph) return;
    const { target, zoom } = viewStateRef.current;
    graph.pivot.set(target[0], target[1]);
    graph.position.set(app.screen.width / 2, app.screen.height / 2);
    graph.scale.set(zoom);
  }, []);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const app = new Application();
    let mounted = true;

    (async () => {
      await app.init({
        resizeTo: container,
        background: 0x0f172a,
        antialias: true,
        autoDensity: true,
      });
      if (!mounted) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;

      const graphContainer = new Container();
      const graphContent = new Container();
      const vehiclesContainer = new Container();
      graphContainer.addChild(graphContent);
      graphContainer.addChild(vehiclesContainer);
      graphContainerRef.current = graphContainer;
      graphContentRef.current = graphContent;
      vehiclesContainerRef.current = vehiclesContainer;
      app.stage.addChild(graphContainer);

      viewStateRef.current = {
        target: [...INITIAL_TARGET],
        zoom: INITIAL_ZOOM,
      };
      updateView();

      // Pan
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      app.stage.on("pointerdown", (e: { global: { x: number; y: number } }) => {
        isDraggingRef.current = true;
        lastPointerRef.current = { x: e.global.x, y: e.global.y };
      });
      app.stage.on("pointermove", (e: { global: { x: number; y: number } }) => {
        if (!isDraggingRef.current) return;
        const dx = e.global.x - lastPointerRef.current.x;
        const dy = e.global.y - lastPointerRef.current.y;
        lastPointerRef.current = { x: e.global.x, y: e.global.y };
        const g = graphContainerRef.current;
        if (!g) return;
        viewStateRef.current.target[0] -= dx / viewStateRef.current.zoom;
        viewStateRef.current.target[1] -= dy / viewStateRef.current.zoom;
        updateView();
      });
      app.stage.on("pointerup", () => {
        isDraggingRef.current = false;
      });
      app.stage.on("pointerupoutside", () => {
        isDraggingRef.current = false;
      });

      // Zoom (wheel)
      container.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          viewStateRef.current.zoom = Math.max(
            0.3,
            Math.min(3, viewStateRef.current.zoom * (1 + delta)),
          );
          updateView();
        },
        { passive: false },
      );
    })();

    return () => {
      mounted = false;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      graphContainerRef.current = null;
      graphContentRef.current = null;
      vehiclesContainerRef.current = null;
    };
  }, [containerRef, updateView]);

  // Redraw when layout or visibility changes (static graph only)
  useEffect(() => {
    const graphContent = graphContentRef.current;
    if (!graphContent) return;
    const visibleTripIds = new Set(visibleTrip.map((t) => t.id));
    drawGraph(
      graphContent,
      stationPositions,
      routePaths,
      turnaroundConnectors,
      routeData.stops,
      visibleTripIds,
    );
  }, [
    stationPositions,
    routePaths,
    turnaroundConnectors,
    routeData.stops,
    visibleTrip,
  ]);

  // Draw vehicles (separate layer, updates every tick)
  useEffect(() => {
    const vehiclesContainer = vehiclesContainerRef.current;
    if (!vehiclesContainer) return;
    vehiclesContainer.removeChildren();

    for (const d of resolvedVehicles) {
      const [nose, left, right] = getVehicleTriangleVertices(
        d.x,
        d.y,
        d.angle,
        VEHICLE_TRIANGLE_SIZE,
      );
      const fillColor = rgbToHex([255, 255, 255]);
      const tri = new Graphics();
      tri
        .moveTo(nose[0], nose[1])
        .lineTo(left[0], left[1])
        .lineTo(right[0], right[1])
        .closePath()
        .fill({ color: fillColor })
        .stroke({ width: 1, color: 0x1e293b });
      vehiclesContainer.addChild(tri);

      const labelGroup = new Container();
      labelGroup.position.set(d.x, d.y - VEHICLE_TRIANGLE_SIZE - 4);
      labelGroup.rotation = -LABEL_ROTATION_RAD;

      const label = new Text({
        text: d.vehicleId,
        style: {
          fontSize: VEHICLE_LABEL_FONT_SIZE,
          fill: 0xffffff,
        },
      });
      label.anchor.set(0, 0);
      label.position.set(0, 0);

      const padding = 4;
      const hPad = 2;
      const w = label.width + padding * 2;
      const h = label.height + hPad * 2;
      const bg = new Graphics();
      bg.roundRect(-padding, -hPad, w, h, 4).fill({
        color: 0x0f172a,
        alpha: 220 / 255,
      });
      labelGroup.addChild(bg);
      labelGroup.addChild(label);
      vehiclesContainer.addChild(labelGroup);
    }
  }, [resolvedVehicles]);

  // Sync view after first paint (in case resizeTo changed size)
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const ticker = app.ticker;
    const onTick = () => updateView();
    ticker.add(onTick);
    return () => {
      ticker.remove(onTick);
    };
  }, [updateView]);

  return null;
}
