// Modulo: circuit
// Responsable: Rol 4
// Editor de circuito 2D y motor de reglas electricas.
// API publica: solo se exporta desde este archivo.
export { buildNetlist, createPinRef, parsePinRef } from "./netlist";
export { evaluateCircuitRules } from "./rules";
export type {
  CircuitComponentRef,
  CircuitGraphInput,
  CircuitNet,
  CircuitWireRef,
  NetlistIssue,
  NetlistIssueCode,
  NetlistResult,
} from "./netlist";
export type {
  CircuitRuleResult,
  CircuitRuleSpec,
  RuleViolation,
} from "./rules";

export {
  evaluate,
  resolvePin,
  createCircuitApi,
  publishCircuitChanges,
} from "./api";
export {
  createExecuteHardwareInstruction,
  type CircuitWorldApi,
  type ExecuteHardwareDependencies,
  type WorldActuatorCommand,
} from "./hardware-adapter";
export { breadboardConnections } from "./breadboard";
export {
  addComponent,
  moveComponent,
  rotateComponent,
  removeComponent,
  connectPins,
  removeWire,
} from "./interactions";
export {
  pinPosition,
  resolvePinPosition,
  hitTestPin,
  componentSize,
} from "./pins";
export { orthogonalPath, missingGhostWires } from "./wiring";
export {
  serializeCircuit,
  deserializeCircuit,
  MAX_CIRCUIT_BYTES,
} from "./serialize";
export { CircuitEditor } from "./CircuitEditor";
export type { CircuitEditorProps } from "./CircuitEditor";
export { t as circuitText } from "./i18n";
