import type { CircuitGraph, ComponentSpec, CircuitState, PinDrives, PinSignal, CircuitEventBus, RuleId, ComponentStatus } from "../../core";
import { buildNetlist, createPinRef } from "./netlist";
import { evaluateCircuitRules } from "./rules";
import { floatingSignal, propagateSignals, validateDrives } from "./voltage";
/** Pure runtime evaluation; the legacy rules entry keeps its potential-HIGH defaults. */
export function evaluate(graph: CircuitGraph, specs: readonly ComponentSpec[], drives: PinDrives = {}): CircuitState {
  const pins = Object.fromEntries(specs.map((spec) => [spec.specId,spec.pins.map((pin) => pin.pinName)]));
  const {nets} = buildNetlist(graph,pins); validateDrives(drives,nets);
  const overrides = Object.fromEntries(Object.entries(drives).filter(([,signal]) => signal.signalKind !== "floating").map(([pinRef,signal]) => [pinRef,signal.voltageV]));
  const result = evaluateCircuitRules(graph,specs,overrides);
  const statusByInstance = result.statusByInstance as Record<string,ComponentStatus>;
  for (const instance of graph.componentInstances) if (!specs.some((spec) => spec.specId === instance.specId)) statusByInstance[instance.instanceId] = "unpowered";
  const signals = propagateSignals(graph,specs,result.nets,drives,statusByInstance);
  return {...result,statusByInstance,signalByPin:signals.signalByPin,
    violations:result.violations.map((violation) => ({...violation,ruleId:violation.ruleId as RuleId})),
    netlistIssues:[...result.netlistIssues,...signals.issues]};
}
export function resolvePin(pinName: string, graph: CircuitGraph, state: CircuitState, boardInstanceId: string): PinSignal {
  if (!graph.componentInstances.some((instance) => instance.instanceId === boardInstanceId)) throw new Error("Board instance not found");
  const pinRef = pinName.includes("/") ? pinName : createPinRef(boardInstanceId,pinName);
  const signal = state.signalByPin[pinRef]; if (!signal) throw new Error(`Unknown pin: ${pinName}`);
  return {...signal};
}
export function publishCircuitChanges(previous: CircuitState | undefined, next: CircuitState, events: CircuitEventBus): void {
  events.emit("circuit:changed",{circuitState:next});
  for (const [pinRef,signal] of Object.entries(next.signalByPin)) if (JSON.stringify(previous?.signalByPin[pinRef]) !== JSON.stringify(signal)) events.emit("pin:changed",{pinRef,signal});
  for (const pinRef of Object.keys(previous?.signalByPin ?? {})) if (!(pinRef in next.signalByPin)) events.emit("pin:changed",{pinRef,signal:floatingSignal()});
  for (const [instanceId,status] of Object.entries(next.statusByInstance)) {
    if (status !== "burned" || previous?.statusByInstance[instanceId] === "burned") continue;
    const violation = next.violations.find((candidate) => candidate.instanceId === instanceId && ["led_without_resistor","reversed_polarity","overvoltage_gpio"].includes(candidate.ruleId));
    if (violation) events.emit("component:burned",{instanceId,ruleId:violation.ruleId});
  }
}
export function createCircuitApi(context: { getGraph(): CircuitGraph; getSpecs(): readonly ComponentSpec[]; getBoardInstanceId(): string; getDrives?(): PinDrives }) {
  const current = () => evaluate(context.getGraph(),context.getSpecs(),context.getDrives?.() ?? {});
  return {
    evaluate: current,
    resolvePin: (pinName: string) => resolvePin(pinName,context.getGraph(),current(),context.getBoardInstanceId()),
    connections(pinName: string) {
      const state = current(); const pinRef = pinName.includes("/") ? pinName : createPinRef(context.getBoardInstanceId(),pinName);
      resolvePin(pinName,context.getGraph(),state,context.getBoardInstanceId());
      return state.nets.find((net) => net.pinRefs.includes(pinRef))!.pinRefs.filter((ref) => ref !== pinRef);
    },
  };
}
