import { afterEach, expect, it, vi } from "vitest";
import { createWorldExample } from "../src/dev/world-example";
import { circuitSpecs } from "../src/dev/circuit-fixtures";
import {
  generateCppProgram,
  generateInstructions,
  type ProgramBlock,
} from "../src/modules/blocks";
import { createExecuteHardwareInstruction } from "../src/modules/circuit";
import { ProgramRunner } from "../src/modules/runtime";
import { advanceRobot } from "../src/modules/world/motion";

afterEach(() => vi.useRealTimers());

it("drives, pauses, turns, reverses and stops through blocks, runtime and circuit validation", async () => {
  vi.useFakeTimers();
  const { robot } = createWorldExample();
  const speeds = new Map<string, number>();
  let pose = { x: 0, z: 0, headingRad: 0 };
  const adapter = createExecuteHardwareInstruction({
    getCircuitGraph: () => robot,
    getComponentSpecs: () => circuitSpecs,
    getBoardInstanceId: () => robot.boardInstanceId,
    world: {
      query: {
        ultrasonicDistanceCm: () => (4.5 - pose.z) * 100,
        flameIntensityNorm: () => 0,
        gasLevelNorm: () => 0,
        groundReflectanceNorm: () => 1,
      },
      applyActuator(command) {
        if (command.actuatorKind === "motor")
          speeds.set(command.instanceId, command.speedPct);
      },
    },
  });
  const frame = setInterval(() => {
    pose = advanceRobot(
      pose,
      speeds.get("dc-motor:1") ?? 0,
      speeds.get("dc-motor:2") ?? 0,
      0.02,
      [],
    );
  }, 20);
  const blocks: ProgramBlock[] = [
    { type: "motor_write", instanceId: "dc-motor:1", speedPct: 50 },
    { type: "motor_write", instanceId: "dc-motor:2", speedPct: 50 },
    { type: "wait", delayMs: 1000 },
    {
      type: "read_distance",
      trigPinName: "D9",
      echoPinName: "D10",
      resultId: "distance_cm",
    },
    { type: "motor_write", instanceId: "dc-motor:2", speedPct: -50 },
    { type: "wait", delayMs: 1000 },
    { type: "motor_write", instanceId: "dc-motor:1", speedPct: -50 },
    { type: "wait", delayMs: 1000 },
  ];
  const runner = new ProgramRunner(adapter);
  try {
    runner.run(generateInstructions(blocks));
    await vi.advanceTimersByTimeAsync(500);
    expect(pose.z).toBeGreaterThan(0.4);
    runner.pause();
    await vi.advanceTimersByTimeAsync(10);
    const paused = { ...pose };
    const remaining = runner.remainingWaitMs;
    await vi.advanceTimersByTimeAsync(2000);
    expect(pose).toEqual(paused);
    expect(runner.remainingWaitMs).toBe(remaining);
    runner.resume();
    await vi.advanceTimersByTimeAsync(550);
    expect(pose.z).toBeGreaterThan(0.9);
    expect(runner.readings.distance_cm).toBeLessThan(360);
    const beforeTurn = { ...pose };
    await vi.advanceTimersByTimeAsync(900);
    expect(pose.headingRad).toBeGreaterThan(1);
    expect(pose.z).toBeCloseTo(beforeTurn.z, 1);
    await vi.advanceTimersByTimeAsync(200);
    const beforeReverse = { ...pose };
    await vi.advanceTimersByTimeAsync(1000);
    expect(pose.x).toBeLessThan(beforeReverse.x - 0.5);
    expect(runner.status).toBe("completed");
    expect([...speeds.values()]).toEqual([0, 0]);
    const completed = { ...pose };
    await vi.advanceTimersByTimeAsync(1000);
    expect(pose).toEqual(completed);
  } finally {
    runner.stop();
    clearInterval(frame);
  }
});

it("generates the same single execution and actuator shutdown in the C++ preview", () => {
  const cpp = generateCppProgram(
    [
      { type: "motor_write", instanceId: "dc-motor:1", speedPct: 40 },
      { type: "digital_write", pinName: "D13", digitalValue: 1 },
      {
        type: "buzzer_write",
        instanceId: "buzzer:1",
        isOn: true,
        frequencyHz: 440,
      },
      { type: "wait", delayMs: 2000 },
    ],
    { repeat: false },
  );
  expect(cpp).toContain(
    'delay(2000);\n  robokan_motor_write("dc-motor:1", 0);',
  );
  expect(cpp).toContain("digitalWrite(13, LOW);");
  expect(cpp).toContain('robokan_buzzer_write("buzzer:1", false, 440);');
  expect(cpp).toMatch(/void loop\(\) \{\n\}$/);
});
