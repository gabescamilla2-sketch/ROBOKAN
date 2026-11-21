import { useEffect, useRef, useState } from "react";
import type { RobotDefinition } from "../../core";
import type { RobotWorld, WorldSnapshot } from "./types";
import { createRobotWorld } from "./create-world";
import {
  DEFAULT_ROBOT_START,
  MAX_OBSTACLES,
  OBSTACLE_KINDS,
  ULTRASONIC_RANGE_CM,
  WORLD_MAP_STORAGE_KEY,
  addObstacle,
  clearObstacles,
  parseWorldMap,
  removeObstacle,
  serializeWorldMap,
  setRobotStart,
  updateObstacle,
  type ObstacleKind,
  type WorldMap,
} from "./map";
import { SHAPE_DRAG_TYPE, WorldDesigner } from "./WorldDesigner";
import { world as labels } from "../../i18n/es.json";

function loadStoredMap(): WorldMap {
  try {
    return parseWorldMap(localStorage.getItem(WORLD_MAP_STORAGE_KEY));
  } catch {
    return parseWorldMap(null);
  }
}

/** Distance in front of the robot where new obstacles appear. */
const SPAWN_AHEAD_M = 2.5;

export function WorldViewport({
  robot,
  onReady,
}: {
  robot: RobotDefinition;
  onReady(world: RobotWorld | null): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(onReady);
  const worldRef = useRef<RobotWorld | null>(null);
  readyRef.current = onReady;
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [cameraView, setCameraView] = useState<"orbit" | "top" | "follow">(
    "orbit",
  );
  const [showRay, setShowRay] = useState(true);
  const [showTrace, setShowTrace] = useState(true);
  // The arena layout survives reloads; the world mirrors it and reports edits back.
  const [worldMap, setWorldMap] = useState<WorldMap>(loadStoredMap);
  const mapRef = useRef(worldMap);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDesigning, setIsDesigning] = useState(false);
  const designingRef = useRef(isDesigning);
  designingRef.current = isDesigning;
  useEffect(() => {
    const controller = new AbortController();
    let poll: ReturnType<typeof setInterval> | undefined;
    let unsubscribeMap: (() => void) | undefined;
    setIsLoading(true);
    setError("");
    void createRobotWorld(canvasRef.current!, robot, controller.signal)
      .then((world) => {
        if (controller.signal.aborted) {
          world.dispose();
          return;
        }
        unsubscribeMap = world.onMapChange((map, selected) => {
          mapRef.current = map;
          setWorldMap(map);
          setSelectedId(selected);
          try {
            localStorage.setItem(WORLD_MAP_STORAGE_KEY, serializeWorldMap(map));
          } catch {
            // Storage can be unavailable; the map still works for this visit.
          }
        });
        world.setMap(mapRef.current);
        world.setEditMode(designingRef.current);
        readyRef.current(world);
        worldRef.current = world;
        world.setCameraView(cameraView);
        world.setSensorRayVisible(showRay);
        world.setTraceVisible(showTrace);
        setSnapshot(world.getSnapshot());
        poll = setInterval(() => setSnapshot(world.getSnapshot()), 100);
        setIsLoading(false);
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : String(failure));
        setIsLoading(false);
      });
    return () => {
      clearInterval(poll);
      unsubscribeMap?.();
      worldRef.current = null;
      setSnapshot(null);
      controller.abort();
      readyRef.current(null);
    };
  }, [robot, generation]);
  const applyMap = (next: WorldMap) => worldRef.current?.setMap(next);
  const placeShape = (kind: ObstacleKind, at: { x: number; z: number }) => {
    const world = worldRef.current;
    if (!world || worldMap.obstacles.length >= MAX_OBSTACLES) return;
    const added = addObstacle(worldMap, kind, at);
    world.setMap(added.map);
    world.selectObstacle(added.id);
  };
  const addAheadOfRobot = (kind: ObstacleKind) => {
    const world = worldRef.current;
    if (!world) return;
    const pose = world.getSnapshot();
    const headingRad = (pose.headingDeg * Math.PI) / 180;
    placeShape(kind, {
      x: pose.xM + Math.sin(headingRad) * SPAWN_AHEAD_M,
      z: pose.zM + Math.cos(headingRad) * SPAWN_AHEAD_M,
    });
  };
  const draggedShape = (types: readonly string[]) =>
    isDesigning && types.includes(SHAPE_DRAG_TYPE);
  const worldUnavailable = isLoading || Boolean(error);
  return (
    <section className="world-viewport" aria-label={labels.title}>
      <div
        className="world-camera-tools"
        role="group"
        aria-label={labels.camera}
      >
        {(["orbit", "top", "follow"] as const).map((view) => (
          <button
            key={view}
            disabled={isLoading || Boolean(error)}
            aria-pressed={cameraView === view}
            onClick={() => {
              setCameraView(view);
              worldRef.current?.setCameraView(view);
            }}
          >
            {labels[view]}
          </button>
        ))}
      </div>
      <div className="world-display-options">
        <label>
          <input
            type="checkbox"
            checked={showRay}
            onChange={(event) => {
              setShowRay(event.target.checked);
              worldRef.current?.setSensorRayVisible(event.target.checked);
            }}
          />
          {labels.sensorRay}
        </label>
        <label>
          <input
            type="checkbox"
            checked={showTrace}
            onChange={(event) => {
              setShowTrace(event.target.checked);
              worldRef.current?.setTraceVisible(event.target.checked);
            }}
          />
          {labels.trajectory}
        </label>
        <label className="world-range" title={labels.rangeHint}>
          {labels.range}
          <input
            type="range"
            min={ULTRASONIC_RANGE_CM.min}
            max={ULTRASONIC_RANGE_CM.max}
            step={10}
            value={worldMap.ultrasonicRangeCm}
            disabled={worldUnavailable}
            onChange={(event) =>
              applyMap({
                ...worldMap,
                ultrasonicRangeCm: Number(event.target.value),
              })
            }
          />
          <output>{worldMap.ultrasonicRangeCm} cm</output>
        </label>
        <button
          type="button"
          className="world-design-toggle"
          aria-pressed={isDesigning}
          disabled={worldUnavailable}
          onClick={() => {
            const next = !isDesigning;
            setIsDesigning(next);
            worldRef.current?.setEditMode(next);
            if (!next) worldRef.current?.selectObstacle(null);
          }}
        >
          {isDesigning ? labels.designing : labels.design}
        </button>
      </div>
      {isLoading && <p role="status">{labels.loading}</p>}
      {error && (
        <div role="alert">
          <p>
            {labels.loadError} {error}
          </p>
          <button onClick={() => setGeneration((value) => value + 1)}>
            {labels.retry}
          </button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label={labels.canvas}
        className={isDesigning ? "is-designing" : undefined}
        onDragOver={(event) => {
          if (!draggedShape(event.dataTransfer.types)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          const kind = event.dataTransfer.getData(SHAPE_DRAG_TYPE);
          if (
            !isDesigning ||
            !(OBSTACLE_KINDS as readonly string[]).includes(kind)
          )
            return;
          event.preventDefault();
          const point = worldRef.current?.floorPointAt(
            event.clientX,
            event.clientY,
          );
          if (point) placeShape(kind as ObstacleKind, point);
        }}
      />
      {isDesigning && !worldUnavailable && (
        <WorldDesigner
          map={worldMap}
          sensorHeightCm={snapshot?.sensorHeightCm ?? null}
          selectedId={selectedId}
          onAddShape={addAheadOfRobot}
          onUpdateObstacle={(id, patch) =>
            applyMap(updateObstacle(worldMap, id, patch))
          }
          onRemoveObstacle={(id) => applyMap(removeObstacle(worldMap, id))}
          onClear={() => {
            if (window.confirm(labels.confirmClear))
              applyMap(clearObstacles(worldMap));
          }}
          onToggleScenery={(visible) =>
            applyMap({ ...worldMap, showSceneryObstacles: visible })
          }
          onRobotHeading={(headingDeg) =>
            applyMap(setRobotStart(worldMap, { headingDeg }))
          }
          onRobotDefault={() =>
            applyMap(setRobotStart(worldMap, DEFAULT_ROBOT_START))
          }
        />
      )}
      {snapshot && (
        <>
          <dl className="world-telemetry">
            <div>
              <dt>{labels.leftMotor}</dt>
              <dd>{snapshot.leftSpeedPct.toFixed(0)} %</dd>
            </div>
            <div>
              <dt>{labels.rightMotor}</dt>
              <dd>{snapshot.rightSpeedPct.toFixed(0)} %</dd>
            </div>
            <div>
              <dt>{labels.ultrasonic}</dt>
              <dd>
                {snapshot.distanceCm === null
                  ? "—"
                  : `${snapshot.distanceCm.toFixed(1)} cm`}
              </dd>
            </div>
            <div>
              <dt>{labels.heading}</dt>
              <dd>{snapshot.headingDeg.toFixed(0)}°</dd>
            </div>
          </dl>
          <p
            className={snapshot.isColliding ? "world-collision" : "code-note"}
            role="status"
          >
            {snapshot.isColliding ? labels.collision : labels.cameraHint}
          </p>
          <details className="motor-mapping">
            <summary>{labels.motorMapping}</summary>
            {snapshot.motorSides.length === 0 ? (
              <p>{labels.noMotors}</p>
            ) : (
              <ul>
                {snapshot.motorSides.map((motor) => (
                  <li key={motor.instanceId}>
                    {motor.instanceId} —{" "}
                    {motor.side === "left"
                      ? labels.leftMotor
                      : labels.rightMotor}
                  </li>
                ))}
              </ul>
            )}
          </details>
          <details className="motor-mapping">
            <summary>
              {labels.mountedModels} ({snapshot.models.length})
            </summary>
            <ul>
              {snapshot.models.map((model) => (
                <li key={model.instanceId}>
                  {model.label} · {model.instanceId}
                </li>
              ))}
            </ul>
            <p>{labels.modelsHint}</p>
          </details>
        </>
      )}
    </section>
  );
}
