import type { RobotDefinition } from "../core";
import { deserializeCircuit } from "../modules/circuit";
import { circuitSpecs } from "./circuit-fixtures";

export function importCircuitWorkbench(source: string): RobotDefinition {
  if (source.length > 2000000) throw new Error("Circuit too large");
  const input = JSON.parse(source) as { components: { id: string; type: string; x: number; y: number }[]; wires: { id: string; from: { component: string; pin: string }; to: { component: string; pin: string }; color: string }[] };
  const specs: Record<string, string> = { uno: "arduino-uno", ultrasonic: "hc-sr04", breadboard: "breadboard", led: "led", resistor: "resistor", servo: "servo-sg90", motor: "dc-motor", buzzer: "buzzer" };
  const ids = new Map<string, string>();
  const componentInstances = input.components.map((component) => {
    if (!specs[component.type] || ids.has(component.id)) throw new Error("Invalid component");
    const suffix = /-([1-9]\d*)$/.exec(component.id)?.[1];
    if (!suffix || !Number.isSafeInteger(Number(suffix))) throw new Error("Invalid component identity");
    const instanceId = `${specs[component.type]}:${suffix}`;
    ids.set(component.id, instanceId);
    return { instanceId, specId: specs[component.type], circuitPosition: { x: component.x, y: component.y }, rotationDeg: 0 };
  });
  const pinRef = (endpoint: { component: string; pin: string }) => {
    const component = input.components.find((component) => component.id === endpoint.component);
    if (!component) throw new Error("Unknown component");
    const pinMaps: Record<string, Record<string, string>> = {
      uno: { GND: "GND_3", GND1: "GND_1", GND2: "GND_2" },
      led: { "Ánodo (+)": "ANODE", "Cátodo (−)": "CATHODE" },
      resistor: { "1": "PIN_A", "2": "PIN_B" },
      servo: { "Señal": "SIGNAL" },
    };
    return `${ids.get(endpoint.component)}/${pinMaps[component.type]?.[endpoint.pin] ?? endpoint.pin}`;
  };
  const wires = input.wires.map((wire) => {
    const suffix = /-([1-9]\d*)$/.exec(wire.id)?.[1];
    if (!suffix) throw new Error("Invalid wire identity");
    return { wireId: `wire:${suffix}`, fromPin: pinRef(wire.from), toPin: pinRef(wire.to), colorHex: wire.color };
  });
  const graph = deserializeCircuit(JSON.stringify({ version: 1, graph: { componentInstances, wires } }), circuitSpecs);
  return { ...graph, chassisId: "chassis-2wd", boardInstanceId: componentInstances.find((instance) => instance.specId === "arduino-uno")?.instanceId ?? "", programSource: "" };
}
