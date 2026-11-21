import { expect, it } from "vitest";
import type { PinDrives } from "../src/core";
import { createCircuitProgramAdapter } from "../src/dev/circuit-program-adapter";
import { circuitSpecs, createExample } from "../src/dev/circuit-fixtures";
import { importCircuitWorkbench } from "../src/dev/import-circuit-workbench";

it("reads only a connected and powered ultrasonic sensor and drives the LED circuit", async () => {
  const graph = createExample("avoider").robot;
  let drives: PinDrives = {};
  const adapter = createCircuitProgramAdapter({
    getGraph: () => graph,
    getSpecs: () => circuitSpecs,
    getBoardInstanceId: () => graph.boardInstanceId,
    getDrives: () => drives,
    setDrives: (next) => {
      drives = next;
    },
    getDistanceCm: () => 42,
  });
  const signal = new AbortController().signal;
  await expect(
    adapter(
      {
        op: "read_distance",
        trigPinName: "D9",
        echoPinName: "D10",
        resultId: "distance_cm",
      },
      signal,
    ),
  ).resolves.toEqual({ kind: "reading", resultId: "distance_cm", reading: 42 });
  expect(
    (
      await adapter(
        { op: "digital_write", pinName: "D13", digitalValue: 1 },
        signal,
      )
    ).kind,
  ).toBe("completed");
  expect(drives[`${graph.boardInstanceId}/D13`]).toMatchObject({
    digitalValue: 1,
  });
  graph.wires = graph.wires.filter((wire) => wire.toPin !== "hc-sr04:1/VCC");
  expect(
    (
      await adapter(
        {
          op: "read_distance",
          trigPinName: "D9",
          echoPinName: "D10",
          resultId: "distance_cm",
        },
        signal,
      )
    ).kind,
  ).toBe("electrical_error");
});

it("transfers the static workbench with normalized component and pin identifiers", () => {
  const result = importCircuitWorkbench(
    JSON.stringify({
      components: [
        { id: "uno-1", type: "uno", x: 0, y: 0 },
        { id: "sensor-1", type: "ultrasonic", x: 200, y: 0 },
      ],
      wires: [
        {
          id: "wire-1",
          from: { component: "uno-1", pin: "GND1" },
          to: { component: "sensor-1", pin: "GND" },
          color: "#17243B",
        },
      ],
    }),
  );
  expect(result.wires[0].fromPin).toBe("arduino-uno:1/GND_1");
  expect(result.componentInstances[1].specId).toBe("hc-sr04");
  expect(result.componentInstances[1].instanceId).toBe("hc-sr04:1");
  expect(() =>
    importCircuitWorkbench('{"components":[],"wires":[{}]}'),
  ).toThrow();
});

it("keeps component identities when an unrelated component is removed", () => {
  const board = { id: "uno-7", type: "uno", x: 0, y: 0 };
  const sensor = { id: "sensor-12", type: "ultrasonic", x: 200, y: 0 };
  const before = importCircuitWorkbench(
    JSON.stringify({ components: [board, sensor], wires: [] }),
  );
  const after = importCircuitWorkbench(
    JSON.stringify({ components: [sensor], wires: [] }),
  );
  expect(before.componentInstances[1].instanceId).toBe(
    after.componentInstances[0].instanceId,
  );
  expect(after.componentInstances[0].instanceId).toBe("hc-sr04:12");
});
