import type { RobotDefinition } from "../core";
import type { ProgramBlock } from "../modules/blocks";
import { createExample } from "./circuit-fixtures";

/** Distance at which the preloaded avoider turns away from an obstacle. */
export const AVOIDER_THRESHOLD_CM = 40;

/**
 * Demo obstacle-avoider: drive forward until the ultrasonic sensor reads less
 * than AVOIDER_THRESHOLD_CM, back up a little to make room, then turn right in
 * place. With "Repetir programa" it keeps avoiding. dc-motor:1 is the left
 * wheel and dc-motor:2 the right one.
 */
export function createAvoiderProgram(): ProgramBlock[] {
  return [
    {
      type: "drive_until_distance",
      leftInstanceId: "dc-motor:1",
      rightInstanceId: "dc-motor:2",
      speedPct: 45,
      trigPinName: "D9",
      echoPinName: "D10",
      thresholdCm: AVOIDER_THRESHOLD_CM,
    },
    { type: "motor_write", instanceId: "dc-motor:1", speedPct: -45 },
    { type: "motor_write", instanceId: "dc-motor:2", speedPct: -45 },
    { type: "wait", delayMs: 400 },
    { type: "motor_write", instanceId: "dc-motor:1", speedPct: 45 },
    { type: "motor_write", instanceId: "dc-motor:2", speedPct: -45 },
    { type: "wait", delayMs: 900 },
  ];
}

/** Avoid distance the 3D view shows: the first "Avanzar hasta" block's threshold. */
export function avoidThresholdCm(
  blocks: readonly ProgramBlock[],
): number | null {
  const drive = blocks.find((block) => block.type === "drive_until_distance");
  return drive?.type === "drive_until_distance" ? drive.thresholdCm : null;
}

/** Program to preload for a robot: the avoider routine when both drive motors exist. */
export function presetProgramFor(
  robot: Pick<RobotDefinition, "componentInstances">,
): ProgramBlock[] | undefined {
  const ids = new Set(
    robot.componentInstances.map((instance) => instance.instanceId),
  );
  return ids.has("dc-motor:1") && ids.has("dc-motor:2")
    ? createAvoiderProgram()
    : undefined;
}

export function createWorldExample() {
  const robot = createExample("avoider").robot;
  robot.componentInstances = [
    ...robot.componentInstances,
    {
      instanceId: "dc-motor:1",
      specId: "dc-motor",
      circuitPosition: { x: 200, y: 500 },
      rotationDeg: 0,
      mountPointId: "front-left",
    },
    {
      instanceId: "dc-motor:2",
      specId: "dc-motor",
      circuitPosition: { x: 400, y: 500 },
      rotationDeg: 0,
      mountPointId: "front-right",
    },
    {
      instanceId: "buzzer:1",
      specId: "buzzer",
      circuitPosition: { x: 500, y: 600 },
      rotationDeg: 0,
    },
  ];
  const connections: [string, string][] = [
    ["arduino-uno:1/5V", "dc-motor:1/MOTOR_POSITIVE"],
    ["arduino-uno:1/GND_1", "dc-motor:1/MOTOR_NEGATIVE"],
    ["arduino-uno:1/5V", "dc-motor:2/MOTOR_POSITIVE"],
    ["arduino-uno:1/GND_1", "dc-motor:2/MOTOR_NEGATIVE"],
    ["arduino-uno:1/5V", "buzzer:1/POSITIVE"],
    ["arduino-uno:1/GND_1", "buzzer:1/NEGATIVE"],
  ];
  robot.wires = [
    ...robot.wires,
    ...connections.map(([fromPin, toPin], index) => ({
      wireId: `wire:${index + 8}`,
      fromPin,
      toPin,
      colorHex: "#2878F0",
    })),
  ];
  const program = createAvoiderProgram();
  return { robot, program };
}
