import type { CircuitGraph, ComponentSpec, Point } from "../../core";
import { createIdAllocator } from "../../core";
import { resolvePinPosition } from "./pins";
import { wireKey } from "./wiring";
type Allocator = ReturnType<typeof createIdAllocator>;
export function snapPoint(point: Point): Point {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    Math.abs(point.x) > 100000 ||
    Math.abs(point.y) > 100000
  )
    throw new Error("Invalid circuit position");
  return { x: Math.round(point.x / 20) * 20, y: Math.round(point.y / 20) * 20 };
}
export function addComponent(
  graph: CircuitGraph,
  spec: ComponentSpec,
  position: Point,
  ids: Allocator,
): CircuitGraph {
  const circuitPosition = snapPoint(position);
  return {
    ...graph,
    componentInstances: [
      ...graph.componentInstances,
      {
        instanceId: ids.createComponentId(spec.specId),
        specId: spec.specId,
        circuitPosition,
        rotationDeg: 0,
      },
    ],
    idSequence: ids.snapshot(),
  };
}
export function moveComponent(
  graph: CircuitGraph,
  instanceId: string,
  position: Point,
): CircuitGraph {
  const circuitPosition = snapPoint(position);
  return {
    ...graph,
    componentInstances: graph.componentInstances.map((instance) =>
      instance.instanceId === instanceId
        ? { ...instance, circuitPosition }
        : instance,
    ),
  };
}
export function rotateComponent(
  graph: CircuitGraph,
  instanceId: string,
): CircuitGraph {
  return {
    ...graph,
    componentInstances: graph.componentInstances.map((instance) =>
      instance.instanceId === instanceId
        ? { ...instance, rotationDeg: (instance.rotationDeg + 90) % 360 }
        : instance,
    ),
  };
}
export function removeComponent(
  graph: CircuitGraph,
  instanceId: string,
): CircuitGraph {
  return {
    ...graph,
    componentInstances: graph.componentInstances.filter(
      (instance) => instance.instanceId !== instanceId,
    ),
    wires: graph.wires.filter(
      (wire) =>
        !wire.fromPin.startsWith(`${instanceId}/`) &&
        !wire.toPin.startsWith(`${instanceId}/`),
    ),
  };
}
export function connectPins(
  graph: CircuitGraph,
  specs: readonly ComponentSpec[],
  fromPin: string,
  toPin: string,
  colorHex: string,
  ids: Allocator,
): CircuitGraph {
  resolvePinPosition(fromPin, graph, specs);
  resolvePinPosition(toPin, graph, specs);
  if (fromPin === toPin) throw new Error("A wire requires different pins");
  if (!/^#[0-9a-f]{6}$/i.test(colorHex)) throw new Error("Invalid wire color");
  if (
    graph.wires.some(
      (wire) => wireKey(wire.fromPin, wire.toPin) === wireKey(fromPin, toPin),
    )
  )
    return graph;
  return {
    ...graph,
    wires: [
      ...graph.wires,
      { wireId: ids.createWireId(), fromPin, toPin, colorHex },
    ],
    idSequence: ids.snapshot(),
  };
}
export function removeWire(graph: CircuitGraph, wireId: string): CircuitGraph {
  return {
    ...graph,
    wires: graph.wires.filter((wire) => wire.wireId !== wireId),
  };
}
