import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projects, type ProjectId } from "../circuit-projects.js";
import type { PinDrives } from "../src/core";
import { circuitSpecs } from "../src/dev/circuit-fixtures";
import { createCircuitProgramAdapter } from "../src/dev/circuit-program-adapter";
import { EXERCISE_IDS, programForProject } from "../src/dev/exercise-programs";
import { importCircuitWorkbench } from "../src/dev/import-circuit-workbench";
import { createAvoiderProgram } from "../src/dev/world-example";
import { generateInstructions, validateProgram } from "../src/modules/blocks";
import { evaluate } from "../src/modules/circuit";
import { ProgramRunner } from "../src/modules/runtime";

const graphOf = (id: ProjectId) =>
  importCircuitWorkbench(JSON.stringify(projects[id].circuit));

describe("preloaded workbench exercises", () => {
  it("offers the avoider and four basic exercises, each with title and challenge", () => {
    expect(Object.keys(projects)).toEqual([
      "avoider",
      "led-on",
      "led-blink",
      "traffic-light",
      "distance",
    ]);
    expect(EXERCISE_IDS).toEqual(Object.keys(projects));
    for (const project of Object.values(projects)) {
      expect(project.title.length).toBeGreaterThan(3);
      expect(project.challenge.length).toBeGreaterThan(10);
    }
  });

  it("lights the LED through its resistor in the first exercise", () => {
    const state = evaluate(graphOf("led-on"), circuitSpecs);
    expect(state.statusByInstance["led:1"]).toBe("ok");
    expect(
      state.violations.filter(
        (violation) => violation.ruleId !== "floating_pin",
      ),
    ).toEqual([]);
  });

  it("burns the LED when it is wired straight to 5V without the resistor", () => {
    const circuit = structuredClone(projects["led-on"].circuit);
    circuit.components = circuit.components.filter(
      (component) => component.id !== "resistor-1",
    );
    circuit.wires = [
      {
        id: "wire-1",
        from: { component: "uno-1", pin: "5V" },
        to: { component: "led-1", pin: "ANODE" },
        color: "#F16C75",
      },
      circuit.wires.find((wire) => wire.id === "wire-3")!,
    ];
    const state = evaluate(
      importCircuitWorkbench(JSON.stringify(circuit)),
      circuitSpecs,
    );
    expect(state.statusByInstance["led:1"]).toBe("burned");
    expect(state.violations.map((violation) => violation.ruleId)).toContain(
      "led_without_resistor",
    );
  });

  it("gives every exercise a valid program; the avoider keeps its own", () => {
    expect(programForProject("avoider")).toEqual(createAvoiderProgram());
    expect(programForProject("led-on")).toBeUndefined();
    expect(programForProject("unknown")).toBeUndefined();
    expect(programForProject(null)).toBeUndefined();
    for (const id of ["led-blink", "traffic-light", "distance"] as const)
      expect(validateProgram(programForProject(id)!), id).toEqual([]);
  });
});

describe("exercise programs on their circuits (no 3D world)", () => {
  beforeEach(() =>
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }),
  );
  afterEach(() => vi.useRealTimers());

  function runOnCircuit(id: ProjectId) {
    const graph = graphOf(id);
    let drives: PinDrives = {};
    const runner = new ProgramRunner(
      createCircuitProgramAdapter({
        getGraph: () => graph,
        getSpecs: () => circuitSpecs,
        getBoardInstanceId: () => graph.boardInstanceId,
        getDrives: () => drives,
        setDrives: (next) => {
          drives = next;
        },
        getDistanceCm: () => 23.5,
      }),
    );
    runner.run(generateInstructions(programForProject(id)!));
    const ledStatus = (ledId: string) =>
      evaluate(graph, circuitSpecs, drives).statusByInstance[ledId];
    return { runner, ledStatus };
  }

  it("blinks the LED on D13", async () => {
    const { runner, ledStatus } = runOnCircuit("led-blink");
    await vi.advanceTimersByTimeAsync(500);
    expect(ledStatus("led:1")).toBe("ok");
    await vi.advanceTimersByTimeAsync(1000);
    expect(ledStatus("led:1")).toBe("unpowered");
    expect(runner.violations).toEqual([]);
  });

  it("runs the traffic light green, yellow, then red", async () => {
    const { runner, ledStatus } = runOnCircuit("traffic-light");
    const lit = () =>
      ["led:1", "led:2", "led:3"].filter((led) => ledStatus(led) === "ok");
    await vi.advanceTimersByTimeAsync(500);
    expect(lit()).toEqual(["led:3"]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(lit()).toEqual(["led:2"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(lit()).toEqual(["led:1"]);
    expect(runner.violations).toEqual([]);
  });

  it("measures the distance with the ultrasonic sensor", async () => {
    const { runner } = runOnCircuit("distance");
    await vi.advanceTimersByTimeAsync(100);
    expect(runner.readings.distance_cm).toBe(23.5);
    expect(runner.violations).toEqual([]);
  });
});
