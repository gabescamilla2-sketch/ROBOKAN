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
