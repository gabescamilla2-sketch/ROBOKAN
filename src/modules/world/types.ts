import type { RobotDefinition } from "../../core";
import type { WorldMap } from "./map";

export type WorldActuatorCommand =
  | { instanceId: string; actuatorKind: "motor"; speedPct: number }
  | { instanceId: string; actuatorKind: "servo"; angleDeg: number }
  | {
      instanceId: string;
      actuatorKind: "led";
      isOn: boolean;
      brightnessNorm: number;
    }
  | {
      instanceId: string;
      actuatorKind: "buzzer";
      isOn: boolean;
      frequencyHz: number;
    };

export interface WorldApi {
  query: {
    ultrasonicDistanceCm(instanceId: string): number;
    flameIntensityNorm(instanceId: string): number;
    gasLevelNorm(instanceId: string): number;
    groundReflectanceNorm(instanceId: string): number;
    temperatureC(instanceId: string): number;
  };
  applyActuator(command: WorldActuatorCommand): void;
  reset(): void;
}

export interface RobotWorld extends WorldApi {
  getSnapshot(): WorldSnapshot;
  setCameraView(view: "orbit" | "top" | "follow"): void;
  setSensorRayVisible(visible: boolean): void;
  setTraceVisible(visible: boolean): void;
  configureRobot(robot: RobotDefinition): Promise<void>;
  /** Editable arena: user obstacles, scenery toggle and ultrasonic range. */
  getMap(): WorldMap;
  setMap(map: WorldMap): void;
  /** Selected obstacle id, "robot" for the robot, or null. */
  getSelectedObstacleId(): string | null;
  /** Mirrors circuit statuses in 3D (e.g. LEDs lit when powered). */
  setComponentStatuses(statuses: Readonly<Record<string, string>>): void;
  /** Marks the program's avoid distance on the ultrasonic ray (null hides it). */
  setAvoidThresholdCm(thresholdCm: number | null): void;
  /** Arena floor point under a page (client) coordinate, or null off the floor. */
  floorPointAt(
    clientX: number,
    clientY: number,
  ): { x: number; z: number } | null;
  selectObstacle(id: string | null): void;
  /** In design mode, clicking selects an obstacle and dragging moves it. */
  setEditMode(enabled: boolean): void;
  /** Called after map edits and selection changes; returns an unsubscribe function. */
  onMapChange(
    listener: (map: WorldMap, selectedId: string | null) => void,
  ): () => void;
  dispose(): void;
}

export interface WorldSnapshot {
  xM: number;
  zM: number;
  headingDeg: number;
  leftSpeedPct: number;
  rightSpeedPct: number;
  isColliding: boolean;
  distanceCm: number | null;
  /** Avoid distance shown on the ray (from the program), or null. */
  avoidThresholdCm: number | null;
  /** Height of the ultrasonic sensor above the floor; lower obstacles are not detected. */
  sensorHeightCm: number | null;
  motorSides: { instanceId: string; side: "left" | "right" }[];
  models: { instanceId: string; label: string }[];
  /** "bench": a non-robot circuit shown as parts and 3D wires. */
  mode: "robot" | "bench";
}
