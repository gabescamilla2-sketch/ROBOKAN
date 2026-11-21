import { expect, it, vi } from "vitest";
import { DEFAULT_PROJECT, projects } from "../circuit-projects.js";
import { importCircuitWorkbench } from "../src/dev/import-circuit-workbench";
import { circuitSpecs } from "../src/dev/circuit-fixtures";
import {
  createAvoiderProgram,
  createWorldExample,
  presetProgramFor,
} from "../src/dev/world-example";
import { generateInstructions } from "../src/modules/blocks";
import { ProgramRunner } from "../src/modules/runtime";
import {
  createExecuteHardwareInstruction,
  evaluate,
} from "../src/modules/circuit";

/** The starter project the static workbench opens with. */
const workbenchInitialProject = () => projects[DEFAULT_PROJECT].circuit;

it("opens the workbench with a powered obstacle-avoider robot", () => {
  const robot = importCircuitWorkbench(
    JSON.stringify(workbenchInitialProject()),
  );
  const { statusByInstance } = evaluate(robot, circuitSpecs);
  expect(statusByInstance).toMatchObject({
    "arduino-uno:1": "ok",
    "hc-sr04:1": "ok",
    "dc-motor:1": "ok",
    "dc-motor:2": "ok",
  });
});

it("drives the workbench starter until the obstacle is closer than the threshold, then turns", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  try {
    const robot = importCircuitWorkbench(
      JSON.stringify(workbenchInitialProject()),
    );
    const speeds = new Map<string, number>();
    let distanceCm = 150;
    const adapter = createExecuteHardwareInstruction({
      getCircuitGraph: () => robot,
      getComponentSpecs: () => circuitSpecs,
      getBoardInstanceId: () => robot.boardInstanceId,
      world: {
        query: {
          // The obstacle gets closer while both wheels drive forward.
          ultrasonicDistanceCm: () =>
            (distanceCm -= (speeds.get("dc-motor:1") ?? 0) > 0 ? 10 : 0),
          flameIntensityNorm: () => 0,
          gasLevelNorm: () => 0,
          groundReflectanceNorm: () => 1,
        },
        applyActuator: (command) => {
          if (command.actuatorKind === "motor")
            speeds.set(command.instanceId, command.speedPct);
        },
      },
    });
    const program = createAvoiderProgram();
    expect(program[0]).toMatchObject({
      type: "drive_until_distance",
      thresholdCm: 40,
    });
    const runner = new ProgramRunner(adapter);
    runner.run(generateInstructions(program));
    // Drive ends near 550 ms (150 cm → under 40 cm), it backs up for 400 ms,
    // then turns for 900 ms.
    await vi.advanceTimersByTimeAsync(1300);
    expect(runner.violations).toEqual([]);
    expect(runner.readings.distance_cm).toBeLessThan(40);
    // Past the drive and back-up blocks: the robot is turning in place.
    expect(runner.instructionIndex).toBeGreaterThan(3);
    expect([speeds.get("dc-motor:1"), speeds.get("dc-motor:2")]).toEqual([
      45, -45,
    ]);
    runner.stop();
  } finally {
    vi.useRealTimers();
  }
});

it("preloads the avoider program only when both drive motors exist", () => {
  const withMotors = importCircuitWorkbench(
    JSON.stringify(workbenchInitialProject()),
  );
  expect(presetProgramFor(withMotors)).toEqual(createAvoiderProgram());
  const sensorOnly = {
    ...withMotors,
    componentInstances: withMotors.componentInstances.filter(
      (instance) => instance.specId !== "dc-motor",
    ),
  };
  expect(presetProgramFor(sensorOnly)).toBeUndefined();
  expect(createWorldExample().program).toEqual(createAvoiderProgram());
});
