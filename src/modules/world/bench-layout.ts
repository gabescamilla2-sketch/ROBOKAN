import type { ComponentInstance, RobotDefinition } from "../../core";

/**
 * Pure geometry for the 3D circuit bench: non-robot circuits (LED, traffic
 * light, distance…) are shown as their parts on the floor, laid out like the
 * 2D workbench and joined by 3D wires.
 */

/** 2D workbench pixels per 3D meter (an Arduino: 340 px ≈ 0.8 m model). */
export const BENCH_PIXELS_PER_METER = 400;

export interface BenchPoint {
  x: number;
  y: number;
  z: number;
}

/** A circuit is a robot when it has the two drive motors; anything else is a bench. */
export function isRobotCircuit(
  definition: Pick<RobotDefinition, "componentInstances">,
): boolean {
  return (
    definition.componentInstances.filter(
      (instance) => instance.specId === "dc-motor",
    ).length >= 2
  );
}

/**
 * Floor position (x, z) of every part, from its 2D workbench position:
 * the layout is centred on the origin, 2D right is +x and 2D up is +z.
 */
export function benchLayout(
  instances: readonly Pick<
    ComponentInstance,
    "instanceId" | "circuitPosition"
  >[],
): Map<string, { x: number; z: number }> {
  const layout = new Map<string, { x: number; z: number }>();
  if (!instances.length) return layout;
  const xs = instances.map((instance) => instance.circuitPosition.x);
  const ys = instances.map((instance) => instance.circuitPosition.y);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  for (const instance of instances)
    layout.set(instance.instanceId, {
      x: (instance.circuitPosition.x - centerX) / BENCH_PIXELS_PER_METER,
      z: (centerY - instance.circuitPosition.y) / BENCH_PIXELS_PER_METER,
    });
  return layout;
}

/**
 * Where each used pin sits along a part's width (x offset from its centre).
 * Pins are sorted by name so a part's wires always land in the same places.
 */
export function pinAnchorOffsets(
  pinNames: readonly string[],
  widthM: number,
): Map<string, number> {
  const pins = [...new Set(pinNames)].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const span = widthM * 0.8;
  const step = pins.length > 1 ? span / (pins.length - 1) : 0;
  return new Map(
    pins.map((pin, index) => [
      pin,
      pins.length > 1 ? -span / 2 + index * step : 0,
    ]),
  );
}

/**
 * Control points of a wire: straight up from the first pin, an arch over both
 * parts (higher for later lanes, so parallel wires stay apart), down into the
 * second pin.
 */
export function wireRoute(
  from: BenchPoint,
  to: BenchPoint,
  lane: number,
): BenchPoint[] {
  const top = Math.max(from.y, to.y) + 0.12 + lane * 0.035;
  const lift = (point: BenchPoint) => ({ x: point.x, y: top, z: point.z });
  const middle = {
    x: (from.x + to.x) / 2,
    y: top + 0.08,
    z: (from.z + to.z) / 2,
  };
  return [from, lift(from), middle, lift(to), to];
}
