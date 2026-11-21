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

it("lets a small robot drive up to the arena walls instead of stopping at a fixed 8 m line", () => {
  let pose = { x: 0, z: 0, headingRad: 0 };
  for (let step = 0; step < 100; step++)
    pose = advanceRobot(pose, 100, 100, 0.25, [], 0.4);
  // Arena walls stand at ±8.8 m: the robot body (0.4 m radius) stops at the wall.
  expect(pose.z).toBeGreaterThan(8.3);
  expect(pose.z).toBeLessThanOrEqual(8.4);
});

it("slides along an obstacle it touches at an angle instead of freezing", () => {
  const wall = { minX: -5, maxX: 5, minZ: 2, maxZ: 2.5 };
  // Heading 45°: moving +x and +z toward the wall.
  let pose = { x: 0, z: 0, headingRad: Math.PI / 4 };
  for (let step = 0; step < 40; step++)
    pose = advanceRobot(pose, 60, 60, 0.1, [wall], 0.4);
  expect(pose.z).toBeLessThanOrEqual(2 - 0.4 + 1e-9);
  expect(pose.x).toBeGreaterThan(2.5);
  // Head-on contact still stops the robot completely.
  let headOn = { x: 0, z: 0, headingRad: 0 };
  for (let step = 0; step < 40; step++)
    headOn = advanceRobot(headOn, 60, 60, 0.1, [wall], 0.4);
  const stopped = advanceRobot(headOn, 60, 60, 0.1, [wall], 0.4);
  expect(stopped).toEqual(headOn);
});

it("slides around the corner of an obstacle it touches at an angle", () => {
  const box = { minX: -0.5, maxX: 0.5, minZ: -0.5, maxZ: 0.5 };
  // Heading 58° with the box's corner ahead-left: moving along x or z alone
  // both push into the corner, so only sliding along the contact tangent works.
  let pose = { x: -1.155, z: -1.313, headingRad: (58 * Math.PI) / 180 };
  for (let step = 0; step < 60; step++)
    pose = advanceRobot(pose, 60, 60, 0.1, [box], 0.95);
  expect(pose.x).toBeGreaterThan(2.5);
});
