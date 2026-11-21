import { describe, expect, it } from "vitest";
import {
  BENCH_PIXELS_PER_METER,
  benchLayout,
  isRobotCircuit,
  pinAnchorOffsets,
  wireRoute,
} from "../src/modules/world/bench-layout";

const instance = (
  instanceId: string,
  specId: string,
  x: number,
  y: number,
) => ({
  instanceId,
  specId,
  circuitPosition: { x, y },
  rotationDeg: 0,
});

describe("3D circuit bench layout", () => {
  it("treats a circuit as a robot only when it has two drive motors", () => {
    const motors = [
      instance("dc-motor:1", "dc-motor", 0, 0),
      instance("dc-motor:2", "dc-motor", 0, 0),
    ];
    expect(isRobotCircuit({ componentInstances: motors })).toBe(true);
    expect(isRobotCircuit({ componentInstances: motors.slice(0, 1) })).toBe(
      false,
    );
    expect(
      isRobotCircuit({
        componentInstances: [instance("led:1", "led", 0, 0)],
      }),
    ).toBe(false);
  });

  it("keeps the 2D workbench arrangement: centred, right is +x, up is +z", () => {
    const layout = benchLayout([
      instance("arduino-uno:1", "arduino-uno", 100, 400),
      instance("led:1", "led", 900, 100),
    ]);
    const board = layout.get("arduino-uno:1")!;
    const led = layout.get("led:1")!;
    expect(board.x + led.x).toBeCloseTo(0);
    expect(board.z + led.z).toBeCloseTo(0);
    expect(led.x - board.x).toBeCloseTo(800 / BENCH_PIXELS_PER_METER);
    expect(led.z - board.z).toBeCloseTo(300 / BENCH_PIXELS_PER_METER);
  });

  it("spreads the pins a component uses across its width, in a stable order", () => {
    const offsets = pinAnchorOffsets(["D13", "GND", "5V"], 0.8);
    expect([...offsets.keys()]).toEqual(["5V", "D13", "GND"]);
    const xs = [...offsets.values()];
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
    expect(Math.abs(xs[0] + xs[2])).toBeLessThan(1e-9);
    expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(0.4);
    expect(pinAnchorOffsets(["ANODE"], 0.3).get("ANODE")).toBe(0);
  });

  it("routes a wire up from one pin, over the pieces, and down into the other", () => {
    const from = { x: 0, y: 0.1, z: 0 };
    const to = { x: 2, y: 0.4, z: 1 };
    const points = wireRoute(from, to, 1);
    expect(points[0]).toEqual(from);
    expect(points.at(-1)).toEqual(to);
    const peak = Math.max(...points.map((point) => point.y));
    expect(peak).toBeGreaterThan(0.4 + 0.1);
    // Different lanes keep parallel wires apart.
    expect(Math.max(...wireRoute(from, to, 3).map((p) => p.y))).toBeGreaterThan(
      peak,
    );
  });
});
