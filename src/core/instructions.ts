import type { RuleViolation } from "./contract";

export type Instruction =
  | { op: "wait"; delayMs: number }
  | { op: "motor_write"; instanceId: string; speedPct: number }
  | {
      op: "read_distance";
      trigPinName: string;
      echoPinName: string;
      resultId: string;
    }
  | { op: "sensor_read"; instanceId: string; resultId: string }
  | { op: "digital_write"; pinName: string; digitalValue: 0 | 1 }
  | { op: "servo_write"; instanceId: string; angleDeg: number }
  | {
      op: "buzzer_write";
      instanceId: string;
      isOn: boolean;
      frequencyHz: number;
    }
  | {
      /**
       * Runner-level composite: drives both motors forward, polls the
       * ultrasonic sensor and stops them once the reading is below thresholdCm.
       */
      op: "drive_until_distance";
      leftInstanceId: string;
      rightInstanceId: string;
      speedPct: number;
      trigPinName: string;
      echoPinName: string;
      thresholdCm: number;
    };

/** Instructions an adapter executes directly; the runner owns wait and drive_until_distance. */
export type HardwareInstruction = Exclude<
  Instruction,
  { op: "wait" } | { op: "drive_until_distance" }
>;
export type InstructionResult =
  | { kind: "completed" }
  | { kind: "reading"; resultId: string; reading: number }
  | { kind: "electrical_error"; violations: RuleViolation[] };
export type ExecuteHardwareInstruction = (
  instruction: HardwareInstruction,
  signal: AbortSignal,
) => Promise<InstructionResult>;
