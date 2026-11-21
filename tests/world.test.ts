import { expect, it, vi } from "vitest";
import { advanceRobot } from "../src/modules/world/motion";
import { createWorldExample } from "../src/dev/world-example";
import { createExecuteHardwareInstruction } from "../src/modules/circuit";
import { circuitSpecs } from "../src/dev/circuit-fixtures";

it("moves forward, turns and remains stopped with zero motors", () => {
  const pose = { x: 0, z: 0, headingRad: 0 };
  expect(advanceRobot(pose, 50, 50, 0.05, []).z).toBeCloseTo(0.055);
  expect(advanceRobot(pose, 50, -50, 0.05, []).headingRad).toBeGreaterThan(0);
  expect(advanceRobot(pose, 0, 0, 0.05, [])).toEqual(pose);
});

it("blocks obstacle penetration and caps elapsed time after a suspended frame", () => {
  const pose = { x: 0, z: 0, headingRad: 0 };
  expect(advanceRobot(pose, 100, 100, 50, []).z).toBeCloseTo(0.55);
  const stopped = advanceRobot(pose, 100, 100, 0.25, [
    { minX: -1, maxX: 1, minZ: 0.95, maxZ: 2 },
  ]);
  expect(stopped.z).toBeGreaterThanOrEqual(0);
  expect(stopped.z + 0.9).toBeLessThanOrEqual(0.95);
  expect(
    advanceRobot(stopped, 100, 100, 0.25, [
      { minX: -1, maxX: 1, minZ: 0.95, maxZ: 2 },
    ]),
  ).toEqual(stopped);
});

it("runs the powered motor/sensor example through the circuit adapter", async () => {
  const { robot } = createWorldExample();
  const applyActuator = vi.fn();
  const adapter = createExecuteHardwareInstruction({
    getCircuitGraph: () => robot,
    getComponentSpecs: () => circuitSpecs,
    getBoardInstanceId: () => robot.boardInstanceId,
    world: {
      query: {
        ultrasonicDistanceCm: () => 125,
        flameIntensityNorm: () => 0,
        gasLevelNorm: () => 0,
        groundReflectanceNorm: () => 1,
      },
      applyActuator,
    },
  });
  const signal = new AbortController().signal;
  expect(
    (
      await adapter(
        { op: "motor_write", instanceId: "dc-motor:1", speedPct: 50 },
        signal,
      )
    ).kind,
  ).toBe("completed");
  expect(applyActuator).toHaveBeenLastCalledWith({
    instanceId: "dc-motor:1",
    actuatorKind: "motor",
    speedPct: 50,
  });
  expect(
    await adapter(
      {
        op: "read_distance",
        trigPinName: "D9",
        echoPinName: "D10",
        resultId: "distance_cm",
      },
      signal,
    ),
  ).toEqual({ kind: "reading", resultId: "distance_cm", reading: 125 });
  expect(
    (
      await adapter(
        { op: "digital_write", pinName: "D13", digitalValue: 1 },
        signal,
      )
    ).kind,
  ).toBe("completed");
  expect(
    (
      await adapter(
        { op: "digital_write", pinName: "D13", digitalValue: 0 },
        signal,
      )
    ).kind,
  ).toBe("completed");
});

it("rejects unpowered motors, permits their stop and respects cancellation", async () => {
  const { robot } = createWorldExample();
  robot.wires = robot.wires.filter(
    (wire) => wire.toPin !== "dc-motor:1/MOTOR_POSITIVE",
  );
  const applyActuator = vi.fn();
  const adapter = createExecuteHardwareInstruction({
    getCircuitGraph: () => robot,
    getComponentSpecs: () => circuitSpecs,
    getBoardInstanceId: () => robot.boardInstanceId,
    world: {
      query: {
        ultrasonicDistanceCm: () => 125,
        flameIntensityNorm: () => 0,
        gasLevelNorm: () => 0,
        groundReflectanceNorm: () => 1,
      },
      applyActuator,
    },
  });
  const signal = new AbortController().signal;
  expect(
    (
      await adapter(
        { op: "motor_write", instanceId: "dc-motor:1", speedPct: 50 },
        signal,
      )
    ).kind,
  ).toBe("electrical_error");
  expect(applyActuator).not.toHaveBeenCalled();
  expect(
    (
      await adapter(
        { op: "motor_write", instanceId: "dc-motor:1", speedPct: 0 },
        signal,
      )
    ).kind,
  ).toBe("completed");
  const controller = new AbortController();
  controller.abort();
  await expect(
    adapter(
      { op: "motor_write", instanceId: "dc-motor:1", speedPct: 50 },
      controller.signal,
    ),
  ).rejects.toHaveProperty("name", "AbortError");
});
