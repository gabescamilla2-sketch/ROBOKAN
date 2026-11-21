import { world as labels } from "../../i18n/es.json";
import {
  MAX_OBSTACLES,
  OBSTACLE_KINDS,
  OBSTACLE_PRESETS,
  OBSTACLE_SIZE_M,
  ROBOT_SELECTION_ID,
  type ObstacleKind,
  type ObstaclePatch,
  type WorldMap,
} from "./map";
import { ShapeIcon } from "./ShapeIcon";

/** MIME type used to drag a palette shape onto the 3D canvas. */
export const SHAPE_DRAG_TYPE = "application/x-robokan-shape";

const SIZE_FIELDS = [
  [
    "widthM",
    labels.width,
    OBSTACLE_SIZE_M.minFootprint,
    OBSTACLE_SIZE_M.maxFootprint,
  ],
  [
    "depthM",
    labels.depth,
    OBSTACLE_SIZE_M.minFootprint,
    OBSTACLE_SIZE_M.maxFootprint,
  ],
  [
    "heightM",
    labels.height,
    OBSTACLE_SIZE_M.minHeight,
    OBSTACLE_SIZE_M.maxHeight,
  ],
] as const;

/**
 * Presentational map designer: a shape library (click to place in front of the
 * robot, or drag onto the arena) and an inspector for the selected obstacle or
 * the robot. All state lives in the world; this only reports intents.
 */
export function WorldDesigner({
  map,
  selectedId,
  onAddShape,
  onUpdateObstacle,
  onRemoveObstacle,
  onClear,
  onToggleScenery,
  onRobotHeading,
  onRobotDefault,
  sensorHeightCm,
}: {
  map: WorldMap;
  /** Height of the robot's ultrasonic sensor, when the robot has one. */
  sensorHeightCm: number | null;
  selectedId: string | null;
  onAddShape(kind: ObstacleKind): void;
  onUpdateObstacle(id: string, patch: ObstaclePatch): void;
  onRemoveObstacle(id: string): void;
  onClear(): void;
  onToggleScenery(visible: boolean): void;
  onRobotHeading(headingDeg: number): void;
  onRobotDefault(): void;
}) {
  const isFull = map.obstacles.length >= MAX_OBSTACLES;
  const selected = map.obstacles.find((obstacle) => obstacle.id === selectedId);
  return (
    <div className="world-designer" aria-label={labels.design}>
      <div className="world-designer-heading">
        <h3>{labels.shapes}</h3>
        <span>
          {map.obstacles.length} / {MAX_OBSTACLES}
        </span>
      </div>
      <p className="code-note">{labels.shapesHint}</p>
      <div className="shape-library" role="list">
        {OBSTACLE_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="listitem"
            className="shape-tile"
            draggable={!isFull}
            disabled={isFull}
            title={labels.kinds[kind]}
            onClick={() => onAddShape(kind)}
            onDragStart={(event) => {
              event.dataTransfer.setData(SHAPE_DRAG_TYPE, kind);
              event.dataTransfer.effectAllowed = "copy";
            }}
          >
            <ShapeIcon kind={kind} color={OBSTACLE_PRESETS[kind].colorHex} />
            <span>{labels.kinds[kind]}</span>
          </button>
        ))}
      </div>
      {isFull && <p className="code-note">{labels.limitReached}</p>}
      <div className="world-designer-row">
        <label>
          <input
            type="checkbox"
            checked={map.showSceneryObstacles}
            onChange={(event) => onToggleScenery(event.target.checked)}
          />
          {labels.scenery}
        </label>
        <button
          type="button"
          disabled={map.obstacles.length === 0}
          onClick={onClear}
        >
          {labels.clearMap}
        </button>
      </div>
      {selectedId === ROBOT_SELECTION_ID ? (
        <fieldset className="world-obstacle-editor">
          <legend>{labels.robotStart}</legend>
          <p className="code-note">{labels.robotHint}</p>
          <label>
            {labels.robotHeading}
            <input
              type="range"
              min={0}
              max={355}
              step={5}
              value={map.robotStart.headingDeg}
              onChange={(event) => onRobotHeading(Number(event.target.value))}
            />
            <output>{map.robotStart.headingDeg}°</output>
          </label>
          <p className="world-robot-position">
            X {map.robotStart.x.toFixed(1)} m · Z {map.robotStart.z.toFixed(1)}{" "}
            m
          </p>
          <button type="button" onClick={onRobotDefault}>
            {labels.robotDefault}
          </button>
        </fieldset>
      ) : selected ? (
        <fieldset className="world-obstacle-editor">
          <legend>
            <ShapeIcon kind={selected.kind} color={selected.colorHex} />
            {labels.kinds[selected.kind]} · {selected.id}
          </legend>
          {SIZE_FIELDS.map(([field, label, min, max]) => (
            <label key={field}>
              {label}
              <input
                type="range"
                min={min}
                max={max}
                step={0.1}
                value={selected[field]}
                onChange={(event) =>
                  onUpdateObstacle(selected.id, {
                    [field]: Number(event.target.value),
                  })
                }
              />
              <output>{selected[field].toFixed(1)} m</output>
            </label>
          ))}
          {sensorHeightCm !== null &&
            selected.heightM * 100 < sensorHeightCm && (
              <p className="world-obstacle-warning" role="status">
                {labels.belowSensor.replace("{height}", String(sensorHeightCm))}
              </p>
            )}
          <button type="button" onClick={() => onRemoveObstacle(selected.id)}>
            {labels.deleteObstacle}
          </button>
        </fieldset>
      ) : (
        <p className="code-note">{labels.noSelection}</p>
      )}
    </div>
  );
}
