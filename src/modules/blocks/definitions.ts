export type WaitBlock = {
  type: "wait";
  delayMs: number;
};

export type MotorBlock = { type: "motor_write"; instanceId: string; speedPct: number };
export type DistanceBlock = { type: "read_distance"; trigPinName: string; echoPinName: string; resultId: string };
export type LedBlock = { type: "digital_write"; pinName: string; digitalValue: 0 | 1 };
export type BuzzerBlock = { type: "buzzer_write"; instanceId: string; isOn: boolean; frequencyHz: number };
export type ProgramBlock = WaitBlock | MotorBlock | DistanceBlock | LedBlock | BuzzerBlock;

export const DEFAULT_WAIT_BLOCK: WaitBlock = {
  type: "wait",
  delayMs: 1000,
};
