import {
  Application,
  Container,
  Graphics,
  Text,
} from "pixi.js";
import {
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { Stop } from "../../types/stop.type";
import type { TripPath } from "../../types/trip.type";
import type { StopPositions } from "../../types/stop.type";
import { useGraphLayout } from "./useGraphLayout";
import type { LineDiagramPixiProps } from "./LineDiagram.props";

const LINE_WIDTH = 8;
const STATION_RADIUS = 8;
const LABEL_OFFSET_Y = -25;
const LABEL_FONT_SIZE = 12;
const INITIAL_ZOOM = 1.2;
const INITIAL_TARGET: [number, number] = [400, 0];

function rgbToHex([r, g, b]: [number, number, number]): number {
  return (r << 16) | (g << 8) | b;
}

function drawGraph(
  container: Container,
  stationPositions: StopPositions,
  routePaths: TripPath[],
  stops: Stop[],
  visibleTripIds: Set<string>,
) {
  container.removeChildren();

  // Paths layer
  const pathsGraphics = new Graphics();
  const visiblePaths = routePaths.filter((r) => visibleTripIds.has(r.id));
  for (const trip of visiblePaths) {
    const path = [...trip.inboundPath, ...trip.outboundPath];
    if (path.length < 2) continue;
    const color = rgbToHex(trip.color);
    pathsGraphics
      .beginPath()
      .setStrokeStyle({
        width: LINE_WIDTH,
        color,
        cap: "round",
        join: "round",
      })
      .moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) {
      pathsGraphics.lineTo(path[i][0], path[i][1]);
    }
    pathsGraphics.stroke();
  }
  container.addChild(pathsGraphics);

  // Stations layer
  const stationsGraphics = new Graphics();
  const stopsWithPositions = stops.filter((s) => stationPositions[s.id]);
  for (const stop of stopsWithPositions) {
    const pos = stationPositions[stop.id];
    const fillColor =
      pos.tripIds.length > 1 ? rgbToHex([234, 179, 8]) : 0xffffff;
    stationsGraphics
      .circle(pos.x, pos.y, STATION_RADIUS)
      .fill({ color: fillColor })
      .stroke({ width: 3, color: 0x1e293b });
  }
  container.addChild(stationsGraphics);

  // Labels layer
  for (const stop of stopsWithPositions) {
    const pos = stationPositions[stop.id];
    const label = new Text({
      text: stop.name,
      style: {
        fontSize: LABEL_FONT_SIZE,
        fill: 0xffffff,
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(pos.x, pos.y + LABEL_OFFSET_Y);
    // Background: dark rounded rect behind text
    const bg = new Graphics();
    const padding = 6;
    const w = label.width + padding * 2;
    const h = label.height + 3 * 2;
    bg.roundRect(
      pos.x - w / 2,
      pos.y + LABEL_OFFSET_Y - label.height - 3,
      w,
      h,
      4,
    )
      .fill({ color: 0x0f172a, alpha: 200 / 255 });
    container.addChild(bg);
    container.addChild(label);
  }
}

export function LineDiagramPixi({
  routeData,
  visibleTrip,
  containerRef,
}: LineDiagramPixiProps) {
  const { stationPositions, routePaths } = useGraphLayout(routeData);
  const appRef = useRef<Application | null>(null);
  const graphContainerRef = useRef<Container | null>(null);
  const viewStateRef = useRef({ target: [...INITIAL_TARGET], zoom: INITIAL_ZOOM });
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

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
      graphContainerRef.current = graphContainer;
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
      container.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        viewStateRef.current.zoom = Math.max(
          0.3,
          Math.min(3,
            viewStateRef.current.zoom * (1 + delta),
          ),
        );
        updateView();
      }, { passive: false });
    })();

    return () => {
      mounted = false;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      graphContainerRef.current = null;
    };
  }, [containerRef, updateView]);

  // Redraw when layout or visibility changes
  useEffect(() => {
    const graph = graphContainerRef.current;
    if (!graph) return;
    const visibleTripIds = new Set(visibleTrip.map((t) => t.id));
    drawGraph(
      graph,
      stationPositions,
      routePaths,
      routeData.stops,
      visibleTripIds,
    );
  }, [stationPositions, routePaths, routeData.stops, visibleTrip]);

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
