/** Canonical circuit boundary shared by the editor, component catalog and runtime. */
export type PinType =
  | "power"
  | "ground"
  | "digital_in"
  | "digital_out"
  | "digital_io"
  | "analog_in"
  | "pwm_out"
  | "passive";
export type ComponentStatus = "ok" | "unpowered" | "burned";
export type SensorKind = "ultrasonic" | "flame" | "gas" | "infrared" | "temperature";
export type ActuatorKind = "motor" | "servo" | "led" | "buzzer";
export type ComponentCategory =
  "board" | "sensor" | "actuator" | "passive" | "power_source" | "breadboard";
export const RULE_IDS = {
  ledWithoutResistor: "led_without_resistor",
  reversedPolarity: "reversed_polarity",
  missingCommonGround: "missing_common_ground",
  missingPower: "missing_power",
  overvoltageGpio: "overvoltage_gpio",
  floatingPin: "floating_pin",
} as const;
export type RuleId = (typeof RULE_IDS)[keyof typeof RULE_IDS];
export type PinRef = string;
export interface Point {
  x: number;
  y: number;
}
export interface PinSpec {
  pinName: string;
  pinType: PinType;
  svgPosition: Point;
  labelKey: string;
  maxVoltageV?: number;
  physicalPin?: number;
}
export interface ComponentSpec {
  specId: string;
  category: ComponentCategory;
  nameKey: string;
  supplyVoltageV: number;
  maxVoltageV: number;
  svgPath: string;
  modelPath: string;
  pins: readonly PinSpec[];
  behaviorKind: string;
  sensorKind?: SensorKind;
  actuatorKind?: ActuatorKind;
  svgSize?: { width: number; height: number };
}
export interface ComponentInstance {
  instanceId: string;
  specId: string;
  circuitPosition: Point;
  rotationDeg: number;
  mountPointId?: string;
  /** Visual scale relative to the model's catalog size (0.5–1.5). */
  scale?: number;
}
export interface Wire {
  wireId: string;
  fromPin: PinRef;
  toPin: PinRef;
  colorHex: string;
}
export interface IdSequence {
  component: number;
  wire: number;
}
export interface CircuitGraph {
  componentInstances: readonly ComponentInstance[];
  wires: readonly Wire[];
  /** Allocation watermark survives save/load, including deleted IDs. */
  idSequence?: IdSequence;
}
export interface RobotDefinition extends CircuitGraph {
  chassisId: string;
  boardInstanceId: string;
  programSource: string;
}
export type PinSignal =
  | { signalKind: "floating"; voltageV: number }
  | { signalKind: "digital"; voltageV: number; digitalValue: 0 | 1 }
  | { signalKind: "analog"; voltageV: number; analogValue: number }
  | { signalKind: "pwm"; voltageV: number; pwmDuty: number };
export interface Net {
  netId: string;
  pinRefs: string[];
}
export interface RuleViolation {
  ruleId: RuleId;
  instanceId: string;
  pinRef?: PinRef;
  messageKey: string;
}
export interface CircuitState {
  statusByInstance: Record<string, ComponentStatus>;
  signalByPin: Record<PinRef, PinSignal>;
  nets: Net[];
  violations: RuleViolation[];
  netlistIssues: { code: string; pinRef?: string; wireId?: string }[];
}
export type PinDrives = Readonly<Record<PinRef, PinSignal>>;
export interface CircuitCatalog {
  listComponents(): readonly ComponentSpec[];
}
