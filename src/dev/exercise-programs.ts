import type { ProgramBlock } from "../modules/blocks";
import { createAvoiderProgram } from "./world-example";

/** Same ids as the workbench exercises in circuit-projects.js. */
export const EXERCISE_IDS = [
  "avoider",
  "led-on",
  "led-blink",
  "traffic-light",
  "distance",
] as const;
export type ExerciseId = (typeof EXERCISE_IDS)[number];

const LED = (pinName: string, digitalValue: 0 | 1): ProgramBlock => ({
  type: "digital_write",
  pinName,
  digitalValue,
});
const wait = (delayMs: number): ProgramBlock => ({ type: "wait", delayMs });

/**
 * Block program preloaded for a workbench exercise. "led-on" is a pure circuit
 * exercise (no program needed), so it returns undefined like unknown ids.
 */
export function programForProject(
  id: string | null | undefined,
): ProgramBlock[] | undefined {
  switch (id) {
    case "avoider":
      return createAvoiderProgram();
    case "led-blink":
      return [LED("D13", 1), wait(1000), LED("D13", 0), wait(1000)];
    case "traffic-light":
      // D11 green, D12 yellow, D13 red.
      return [
        LED("D11", 1),
        wait(3000),
        LED("D11", 0),
        LED("D12", 1),
        wait(1000),
        LED("D12", 0),
        LED("D13", 1),
        wait(3000),
        LED("D13", 0),
      ];
    case "distance":
      return [
        {
          type: "read_distance",
          trigPinName: "D9",
          echoPinName: "D10",
          resultId: "distance_cm",
        },
        wait(500),
      ];
    default:
      return undefined;
  }
}

type SavedBlock = {
  type?: unknown;
  x?: unknown;
  y?: unknown;
  fields?: Record<string, unknown>;
  next?: { block?: SavedBlock };
};

/** One Blockly JSON block → ProgramBlock (inverse of the editor's field mapping). */
function blockFromSaved(block: SavedBlock): ProgramBlock | null {
  const f = block.fields ?? {};
  const text = (name: string) => String(f[name] ?? "");
  const number = (name: string) => Number(f[name]);
  switch (block.type) {
    case "robokan_wait":
      return { type: "wait", delayMs: number("SECONDS") * 1000 };
    case "robokan_motor_write":
      return {
        type: "motor_write",
        instanceId: text("INSTANCE"),
        speedPct: number("SPEED"),
      };
    case "robokan_drive_until_distance":
      return {
        type: "drive_until_distance",
        leftInstanceId: text("LEFT"),
        rightInstanceId: text("RIGHT"),
        speedPct: number("SPEED"),
        trigPinName: text("TRIG"),
        echoPinName: text("ECHO"),
        thresholdCm: number("THRESHOLD"),
      };
    case "robokan_read_distance":
      return {
        type: "read_distance",
        trigPinName: text("TRIG"),
        echoPinName: text("ECHO"),
        resultId: text("RESULT"),
      };
    case "robokan_sensor_read":
      return {
        type: "sensor_read",
        instanceId: text("INSTANCE"),
        resultId: text("RESULT"),
      };
    case "robokan_digital_write":
      return {
        type: "digital_write",
        pinName: text("PIN"),
        digitalValue: text("VALUE") === "1" ? 1 : 0,
      };
    case "robokan_buzzer_write":
      return {
        type: "buzzer_write",
        instanceId: text("INSTANCE"),
        isOn: text("ON") === "true",
        frequencyHz: number("FREQUENCY"),
      };
    case "robokan_servo_write":
      return {
        type: "servo_write",
        instanceId: text("INSTANCE"),
        angleDeg: number("ANGLE"),
      };
    default:
      return null;
  }
}

/**
 * Reads the program the blocks editor saved in localStorage for an exercise,
 * stacks top to bottom like the editor. Undefined when missing or unreadable.
 */
export function programFromSavedWorkspace(
  source: string | null | undefined,
): ProgramBlock[] | undefined {
  if (!source) return undefined;
  try {
    const envelope = JSON.parse(source);
    const tops: SavedBlock[] =
      envelope?.version === 1 ? envelope.workspace?.blocks?.blocks : undefined;
    if (!Array.isArray(tops) || tops.length === 0) return undefined;
    const position = (block: SavedBlock) => [
      Number(block.y) || 0,
      Number(block.x) || 0,
    ];
    const ordered = [...tops].sort((a, b) => {
      const [ay, ax] = position(a);
      const [by, bx] = position(b);
      return ay - by || ax - bx;
    });
    const program: ProgramBlock[] = [];
    for (const top of ordered)
      for (
        let block: SavedBlock | undefined = top;
        block;
        block = block.next?.block
      ) {
        const parsed = blockFromSaved(block);
        if (!parsed) return undefined;
        program.push(parsed);
      }
    return program;
  } catch {
    return undefined;
  }
}
