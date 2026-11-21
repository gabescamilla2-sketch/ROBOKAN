export type Instruction =
  | { op: "wait"; delayMs: number }
  | { op: "motor_write"; instanceId: string; speedPct: number }
  | {
      op: "read_distance";
      trigPinName: string;
      echoPinName: string;
      resultId: string;
    }
  | { op: "digital_write"; pinName: string; digitalValue: 0 | 1 }
  | {
      op: "buzzer_write";
      instanceId: string;
      isOn: boolean;
      frequencyHz: number;
    };
