import type { CircuitGraph, ComponentSpec, CircuitState, Net, PinDrives, PinSignal } from "../../core";
import { createPinRef, parsePinRef } from "./netlist";
export const floatingSignal = (): PinSignal => ({ signalKind: "floating", voltageV: 0 });
export function validateDrives(drives: PinDrives, nets: readonly Net[]): void {
  const pins = new Set(nets.flatMap((net) => net.pinRefs));
  for (const [pinRef, signal] of Object.entries(drives)) {
    if (!pins.has(pinRef)) throw new Error(`Unknown driven pin: ${pinRef}`);
    if (!Number.isFinite(signal.voltageV) || signal.voltageV < 0) throw new Error("Invalid signal voltage");
    if (signal.signalKind === "floating" && signal.voltageV !== 0) throw new Error("Invalid floating signal");
    if (signal.signalKind === "digital" && (![0,1].includes(signal.digitalValue) || (signal.digitalValue === 0) !== (signal.voltageV === 0))) throw new Error("Invalid digital signal");
    if (signal.signalKind === "analog" && (!Number.isInteger(signal.analogValue) || signal.analogValue < 0 || signal.analogValue > 1023)) throw new Error("Invalid analog signal");
    if (signal.signalKind === "pwm" && (!Number.isInteger(signal.pwmDuty) || signal.pwmDuty < 0 || signal.pwmDuty > 255)) throw new Error("Invalid PWM signal");
  }
}
export function propagateSignals(graph: CircuitGraph, specs: readonly ComponentSpec[], nets: Net[], drives: PinDrives, statuses: CircuitState["statusByInstance"]) {
  const netByPin = new Map(nets.flatMap((net) => net.pinRefs.map((pinRef) => [pinRef,net.netId] as const)));
  const specById = new Map(specs.map((spec) => [spec.specId,spec]));
  const instances = new Map(graph.componentInstances.map((instance) => [instance.instanceId,instance]));
  const fixed = new Map<string, PinSignal[]>();
  const neighbors = new Map<string, string[]>();
  const add = (pinRef: string, signal: PinSignal) => {
    const netId = netByPin.get(pinRef); if (!netId || signal.signalKind === "floating") return;
    const signals = fixed.get(netId) ?? []; signals.push(signal); fixed.set(netId,signals);
  };
  for (const instance of graph.componentInstances) {
    const spec = specById.get(instance.specId); if (!spec) continue;
    if (spec.specId === "resistor") {
      const a = netByPin.get(createPinRef(instance.instanceId,"PIN_A"));
      const b = netByPin.get(createPinRef(instance.instanceId,"PIN_B"));
      if (a && b && a !== b) for (const [from,to] of [[a,b],[b,a]]) neighbors.set(from,[...neighbors.get(from) ?? [],to]);
    }
    if (spec.category !== "board" && spec.category !== "power_source") continue;
    for (const pin of spec.pins) {
      const pinRef = createPinRef(instance.instanceId,pin.pinName);
      if (pin.pinType === "ground") add(pinRef,{signalKind:"digital",voltageV:0,digitalValue:0});
      else if (pin.pinType === "power" && pin.pinName !== "VIN") {
        const rail = /^(\d+)V(\d*)(?:_\d+)?$/.exec(pin.pinName);
        const voltageV = rail ? Number(`${rail[1]}.${rail[2] || "0"}`) : spec.supplyVoltageV;
        add(pinRef,{signalKind:"analog",voltageV,analogValue:1023});
      }
    }
  }
  for (const [pinRef,signal] of Object.entries(drives)) {
    const address = parsePinRef(pinRef); const instance = address && instances.get(address.instanceId);
    const spec = instance && specById.get(instance.specId);
    const pin = spec?.pins.find((candidate) => candidate.pinName === address?.pinName);
    if (!instance || !pin || ["power","ground","passive"].includes(pin.pinType)) continue;
    if (statuses[instance.instanceId] === "ok") add(pinRef,signal);
  }
  const signalByPin: Record<string,PinSignal> = {};
  const issues: CircuitState["netlistIssues"] = [];
  for (const net of nets) {
    const pending = [net.netId]; const visited = new Set<string>(); const signals: PinSignal[] = [];
    while (pending.length) {
      const netId = pending.pop()!; if (visited.has(netId)) continue; visited.add(netId);
      const sources = fixed.get(netId);
      if (sources?.length) { signals.push(...sources); continue; }
      pending.push(...neighbors.get(netId) ?? []);
    }
    const conflict = signals.some((signal) => signal.voltageV !== signals[0]?.voltageV);
    if (conflict) issues.push({code:"conflicting_drivers",pinRef:net.pinRefs[0]});
    const signal = conflict || !signals.length ? floatingSignal() : signals.find((candidate) => candidate.signalKind === "digital") ?? signals[0];
    for (const pinRef of net.pinRefs) signalByPin[pinRef] = {...signal};
  }
  return {signalByPin,issues};
}
