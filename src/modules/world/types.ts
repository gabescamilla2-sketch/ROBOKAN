import type { RobotDefinition } from "../../core";

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
  motorSides: { instanceId: string; side: "left" | "right" }[];
  models: { instanceId: string; label: string }[];
}
