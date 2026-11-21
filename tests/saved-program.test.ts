import { expect, it } from "vitest";
import { programFromSavedWorkspace } from "../src/dev/exercise-programs";

/** Envelope the blocks editor stores in localStorage (Blockly JSON serialization). */
const saved = (blocks: unknown[]) =>
  JSON.stringify({
    version: 1,
    workspace: { blocks: { languageVersion: 0, blocks } },
  });

it("reads a saved Blockly program as the block list the runner executes", () => {
  const source = saved([
    {
      type: "robokan_digital_write",
      x: 40,
      y: 40,
      fields: { PIN: "D13", VALUE: "1" },
      next: {
        block: {
          type: "robokan_wait",
          fields: { SECONDS: 0.5 },
          next: {
            block: {
              type: "robokan_read_distance",
              fields: { TRIG: "D9", ECHO: "D10", RESULT: "distance_cm" },
            },
          },
        },
      },
    },
  ]);
  expect(programFromSavedWorkspace(source)).toEqual([
    { type: "digital_write", pinName: "D13", digitalValue: 1 },
    { type: "wait", delayMs: 500 },
    {
      type: "read_distance",
      trigPinName: "D9",
      echoPinName: "D10",
      resultId: "distance_cm",
    },
  ]);
});

it("orders separate block stacks top to bottom, like the editor", () => {
  const source = saved([
    { type: "robokan_wait", x: 40, y: 300, fields: { SECONDS: 2 } },
    {
      type: "robokan_digital_write",
      x: 40,
      y: 20,
      fields: { PIN: "D12", VALUE: "0" },
    },
  ]);
  expect(programFromSavedWorkspace(source)).toEqual([
    { type: "digital_write", pinName: "D12", digitalValue: 0 },
    { type: "wait", delayMs: 2000 },
  ]);
});

it("maps every block type and rejects anything it cannot read", () => {
  const source = saved([
    {
      type: "robokan_drive_until_distance",
      x: 0,
      y: 0,
      fields: {
        LEFT: "dc-motor:1",
        RIGHT: "dc-motor:2",
        SPEED: 45,
        TRIG: "D9",
        ECHO: "D10",
        THRESHOLD: 40,
      },
      next: {
        block: {
          type: "robokan_motor_write",
          fields: { INSTANCE: "dc-motor:1", SPEED: -45 },
          next: {
            block: {
              type: "robokan_buzzer_write",
              fields: { INSTANCE: "buzzer:1", ON: "true", FREQUENCY: 440 },
              next: {
                block: {
                  type: "robokan_servo_write",
                  fields: { INSTANCE: "servo-sg90:1", ANGLE: 90 },
                  next: {
                    block: {
                      type: "robokan_sensor_read",
                      fields: { INSTANCE: "lm35:1", RESULT: "reading_temp" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  ]);
  expect(programFromSavedWorkspace(source)?.map((block) => block.type)).toEqual(
    [
      "drive_until_distance",
      "motor_write",
      "buzzer_write",
      "servo_write",
      "sensor_read",
    ],
  );
  for (const broken of [
    null,
    "",
    "{",
    JSON.stringify({ version: 2 }),
    saved([{ type: "robokan_rocket", x: 0, y: 0 }]),
    saved([]),
  ])
    expect(programFromSavedWorkspace(broken)).toBeUndefined();
});
