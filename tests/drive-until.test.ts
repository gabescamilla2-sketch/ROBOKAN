import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HardwareInstruction } from "../src/core";
import {
  generateCppProgram,
  generateInstructions,
  validateProgram,
  type ProgramBlock,
} from "../src/modules/blocks";
import { parseProgramFile } from "../src/modules/blocks/program-file";
import { ProgramRunner } from "../src/modules/runtime";

const driveBlock: ProgramBlock = {
  type: "drive_until_distance",
  leftInstanceId: "dc-motor:1",
  rightInstanceId: "dc-motor:2",
  speedPct: 45,
  trigPinName: "D9",
  echoPinName: "D10",
  thresholdCm: 30,
};

describe("drive until distance block", () => {
  beforeEach(() =>
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }),
  );
  afterEach(() => vi.useRealTimers());

  /** Fake robot: the obstacle gets 10 cm closer on every reading while motors run. */
  function fakeRobot(startCm = 100) {
    const speeds = new Map<string, number>();
    const log: HardwareInstruction[] = [];
    let distanceCm = startCm;
    const adapter = async (instruction: HardwareInstruction) => {
      log.push(instruction);
      if (instruction.op === "motor_write") {
        speeds.set(instruction.instanceId, instruction.speedPct);
        return { kind: "completed" as const };
      }
      if (instruction.op === "read_distance") {
        if ([...speeds.values()].some((speed) => speed !== 0)) distanceCm -= 10;
        return {
          kind: "reading" as const,
          resultId: instruction.resultId,
          reading: distanceCm,
        };
      }
      return { kind: "completed" as const };
    };
    return { adapter, speeds, log, distance: () => distanceCm };
  }

  it("drives both motors until the reading drops below the threshold, then stops them", async () => {
    const robot = fakeRobot();
    const runner = new ProgramRunner(robot.adapter);
    runner.run(
      generateInstructions([
        driveBlock,
        { type: "motor_write", instanceId: "dc-motor:1", speedPct: 45 },
      ]),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(robot.speeds.get("dc-motor:1")).toBe(45);
    expect(robot.speeds.get("dc-motor:2")).toBe(45);
    expect(runner.instructionIndex).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    // 100 → 90 … → 20 cm: the first reading under 30 cm ends the block.
    expect(runner.readings.distance_cm).toBe(20);
    expect(robot.distance()).toBe(20);
    expect(runner.status).toBe("completed");
    // Drive both, stop both at the threshold, then the next block runs
    // (the trailing zeros are the runner's safety stop on completion).
    const motorWrites = robot.log.flatMap((instruction) =>
      instruction.op === "motor_write"
        ? [`${instruction.instanceId}=${instruction.speedPct}`]
        : [],
    );
    expect(motorWrites.slice(0, 5)).toEqual([
      "dc-motor:1=45",
      "dc-motor:2=45",
      "dc-motor:1=0",
      "dc-motor:2=0",
      "dc-motor:1=45",
    ]);
    expect(robot.speeds.get("dc-motor:2")).toBe(0);
  });

  it("finishes at once when the obstacle is already closer than the threshold", async () => {
    const robot = fakeRobot(10);
    const runner = new ProgramRunner(robot.adapter);
    runner.run(generateInstructions([driveBlock]));
    await vi.advanceTimersByTimeAsync(100);
    expect(runner.status).toBe("completed");
    expect(robot.distance()).toBe(0);
  });

  it("stops the motors while paused and keeps driving after resume", async () => {
    const robot = fakeRobot(200);
    const runner = new ProgramRunner(robot.adapter);
    runner.run(generateInstructions([driveBlock]));
    await vi.advanceTimersByTimeAsync(120);
    runner.pause();
    await vi.advanceTimersByTimeAsync(10);
    expect([...robot.speeds.values()]).toEqual([0, 0]);
    const pausedAt = robot.distance();
    await vi.advanceTimersByTimeAsync(1000);
    expect(robot.distance()).toBe(pausedAt);
    runner.resume();
    await vi.advanceTimersByTimeAsync(10);
    expect([...robot.speeds.values()]).toEqual([45, 45]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(runner.status).toBe("completed");
  });

  it("validates motors, speed, pins and threshold", () => {
    expect(validateProgram([driveBlock])).toEqual([]);
    expect(
      validateProgram([
        {
          ...driveBlock,
          rightInstanceId: "dc-motor:1",
          speedPct: 0,
          echoPinName: "D9",
          thresholdCm: 1,
        },
      ]),
    ).toEqual(["invalidMotor", "invalidSpeed", "samePins", "invalidThreshold"]);
    expect(validateProgram([{ ...driveBlock, thresholdCm: 401 }])).toEqual([
      "invalidThreshold",
    ]);
  });

  it("maps to one instruction and to an Arduino while loop", () => {
    expect(generateInstructions([driveBlock])).toEqual([
      {
        op: "drive_until_distance",
        leftInstanceId: "dc-motor:1",
        rightInstanceId: "dc-motor:2",
        speedPct: 45,
        trigPinName: "D9",
        echoPinName: "D10",
        thresholdCm: 30,
      },
    ]);
    const cpp = generateCppProgram([driveBlock]);
    expect(cpp).toContain(
      "double robokan_distance_cm(int trigPin, int echoPin);",
    );
    expect(cpp).toContain("double distance_cm = 0;");
    expect(cpp).toContain("pinMode(9, OUTPUT);");
    expect(cpp).toContain(
      [
        '  robokan_motor_write("dc-motor:1", 45);',
        '  robokan_motor_write("dc-motor:2", 45);',
        "  while ((distance_cm = robokan_distance_cm(9, 10)) >= 30) {",
        "    delay(50);",
        "  }",
        '  robokan_motor_write("dc-motor:1", 0);',
        '  robokan_motor_write("dc-motor:2", 0);',
      ].join("\n"),
    );
  });

  it("is accepted in saved program files", () => {
    expect(() =>
      parseProgramFile(
        JSON.stringify({
          version: 1,
          workspace: {
            blocks: { blocks: [{ type: "robokan_drive_until_distance" }] },
          },
        }),
      ),
    ).not.toThrow();
  });
});
