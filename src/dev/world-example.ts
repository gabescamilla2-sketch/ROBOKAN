import type { ProgramBlock } from "../modules/blocks";
import { createExample } from "./circuit-fixtures";

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
  const program: ProgramBlock[] = [
    { type: "motor_write", instanceId: "dc-motor:1", speedPct: 45 },
    { type: "motor_write", instanceId: "dc-motor:2", speedPct: 45 },
    { type: "wait", delayMs: 2000 },
    {
      type: "read_distance",
      trigPinName: "D9",
      echoPinName: "D10",
      resultId: "distance_cm",
    },
    { type: "motor_write", instanceId: "dc-motor:2", speedPct: -45 },
    { type: "wait", delayMs: 900 },
    { type: "motor_write", instanceId: "dc-motor:1", speedPct: -45 },
    { type: "wait", delayMs: 800 },
    { type: "motor_write", instanceId: "dc-motor:1", speedPct: 0 },
    { type: "motor_write", instanceId: "dc-motor:2", speedPct: 0 },
    { type: "wait", delayMs: 1000 },
  ];
  return { robot, program };
}
