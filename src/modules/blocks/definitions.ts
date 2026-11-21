export type WaitBlock = {
  type: "wait";
  delayMs: number;
};

export type MotorBlock = { type: "motor_write"; instanceId: string; speedPct: number };
export type DistanceBlock = { type: "read_distance"; trigPinName: string; echoPinName: string; resultId: string };
export type SensorReadBlock = { type: "sensor_read"; instanceId: string; resultId: string };
export type LedBlock = { type: "digital_write"; pinName: string; digitalValue: 0 | 1 };
export type ServoBlock = { type: "servo_write"; instanceId: string; angleDeg: number };
export type BuzzerBlock = { type: "buzzer_write"; instanceId: string; isOn: boolean; frequencyHz: number };
export type DriveUntilBlock = {
  type: "drive_until_distance";
  leftInstanceId: string;
  rightInstanceId: string;
  speedPct: number;
  trigPinName: string;
  echoPinName: string;
  thresholdCm: number;
};
export type ProgramBlock = WaitBlock | MotorBlock | DistanceBlock | SensorReadBlock | LedBlock | ServoBlock | BuzzerBlock | DriveUntilBlock;

/** The drive-until block always stores its last reading here. */
export const DRIVE_UNTIL_RESULT_ID = "distance_cm";
export const DRIVE_UNTIL_THRESHOLD_CM = { min: 5, max: 400 } as const;

export const DEFAULT_WAIT_BLOCK: WaitBlock = {
  type: "wait",
  delayMs: 1000,
};
