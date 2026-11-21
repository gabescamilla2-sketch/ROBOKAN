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
export type { CircuitRuleResult, CircuitRuleSpec, RuleViolation } from "./rules";

export { evaluate, resolvePin, createCircuitApi, publishCircuitChanges } from "./api";
export { breadboardConnections } from "./breadboard";
