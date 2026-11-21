import type {
  CircuitGraph,
  ComponentInstance,
  ComponentSpec,
  Wire,
} from "../../core";
import { createIdAllocator } from "../../core";
import { resolvePinPosition } from "./pins";
import { wireKey } from "./wiring";
export const MAX_CIRCUIT_BYTES = 2_000_000;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid circuit data");
  return value as Record<string, unknown>;
};
const text = (value: unknown) => {
  if (typeof value !== "string") throw new Error("Invalid text field");
  return value;
};
const coordinate = (value: unknown) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > 100000
  )
    throw new Error("Invalid circuit position");
  return value;
};
const sequence = (value: unknown) => {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new Error("Invalid ID watermark");
  return Number(value);
};
export function deserializeCircuit(
  source: string,
  specs: readonly ComponentSpec[],
): CircuitGraph {
  if (source.length > MAX_CIRCUIT_BYTES)
    throw new Error("Circuit file too large");
  const document = object(JSON.parse(source));
  if (document.version !== 1) throw new Error("Unsupported circuit version");
  const input = object(document.graph);
  if (
    !Array.isArray(input.componentInstances) ||
    !Array.isArray(input.wires) ||
    input.componentInstances.length > 200 ||
    input.wires.length > 2000
  )
    throw new Error("Invalid circuit collections");
  const instanceIds = new Set<string>();
  const wireIds = new Set<string>();
  const connections = new Set<string>();
  const componentInstances: ComponentInstance[] = input.componentInstances.map(
    (value) => {
      const instance = object(value),
        position = object(instance.circuitPosition);
      const specId = text(instance.specId),
        instanceId = text(instance.instanceId);
      if (
        !specs.some((spec) => spec.specId === specId) ||
        !new RegExp(`^${specId}:[1-9]\\d*$`).test(instanceId) ||
        instanceIds.has(instanceId) ||
        !Number.isSafeInteger(Number(instanceId.split(":").at(-1)))
      )
        throw new Error("Unknown or duplicate component");
      instanceIds.add(instanceId);
      const rotationDeg = coordinate(instance.rotationDeg);
      if (![0, 90, 180, 270].includes(rotationDeg))
        throw new Error("Invalid rotation");
      const mountPointId =
        instance.mountPointId === undefined
          ? undefined
          : text(instance.mountPointId);
      return {
        instanceId,
        specId,
        circuitPosition: {
          x: coordinate(position.x),
          y: coordinate(position.y),
        },
        rotationDeg,
        ...(mountPointId === undefined ? {} : { mountPointId }),
      };
    },
  );
  const graph: CircuitGraph = { componentInstances, wires: [] };
  const wires: Wire[] = input.wires.map((value) => {
    const wire = object(value);
    const wireId = text(wire.wireId),
      fromPin = text(wire.fromPin),
      toPin = text(wire.toPin),
      colorHex = text(wire.colorHex);
    const key = wireKey(fromPin, toPin);
    if (
      !/^wire:[1-9]\d*$/.test(wireId) ||
      wireIds.has(wireId) ||
      !Number.isSafeInteger(Number(wireId.split(":").at(-1))) ||
      fromPin === toPin ||
      connections.has(key) ||
      !/^#[0-9a-f]{6}$/i.test(colorHex)
    )
      throw new Error("Invalid or duplicate wire");
    resolvePinPosition(fromPin, graph, specs);
    resolvePinPosition(toPin, graph, specs);
    wireIds.add(wireId);
    connections.add(key);
    return { wireId, fromPin, toPin, colorHex };
  });
  const saved =
    input.idSequence === undefined ? undefined : object(input.idSequence);
  const watermark = saved
    ? { component: sequence(saved.component), wire: sequence(saved.wire) }
    : undefined;
  const ids = createIdAllocator([...instanceIds], [...wireIds], watermark);
  return { ...graph, wires, idSequence: ids.snapshot() };
}
export function serializeCircuit(
  graph: CircuitGraph,
  specs: readonly ComponentSpec[],
): string {
  return JSON.stringify(
    {
      version: 1,
      graph: deserializeCircuit(JSON.stringify({ version: 1, graph }), specs),
    },
    null,
    2,
  );
}
