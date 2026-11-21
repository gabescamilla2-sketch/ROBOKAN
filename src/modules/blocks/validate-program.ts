import type { ProgramBlock } from "./definitions";

export function validateProgram(blocks: readonly ProgramBlock[]): string[] {
  const issues = new Set<string>();
  const pinUses = new Map<string, Set<string>>();
  const claimPin = (pin: string, use: string) => {
    const uses = pinUses.get(pin) ?? new Set<string>();
    uses.add(use);
    pinUses.set(pin, uses);
    if (uses.size > 1) issues.add("pinConflict");
  };
  const validPin = (pin: string) => /^(D([0-9]|1[0-3])|A[0-5])$/.test(pin);
  const validNumber = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;
  for (const block of blocks) {
    switch (block.type) {
      case "wait":
        if (!validNumber(block.delayMs, 0, 86400000)) issues.add("invalidWait");
        break;
      case "motor_write":
        if (!/^dc-motor:[1-9]\d*$/.test(block.instanceId)) issues.add("invalidMotor");
        if (!validNumber(block.speedPct, -100, 100)) issues.add("invalidSpeed");
        break;
      case "read_distance":
        if (block.trigPinName !== block.echoPinName) {
          claimPin(block.trigPinName, `trig:${block.echoPinName}`);
          claimPin(block.echoPinName, `echo:${block.trigPinName}`);
        }
        if (!validPin(block.trigPinName) || !validPin(block.echoPinName)) issues.add("invalidPin");
        if (block.trigPinName === block.echoPinName) issues.add("samePins");
        if (!/^distance_cm(?:_[1-9]\d*)?$/.test(block.resultId)) issues.add("invalidResult");
        break;
      case "digital_write":
        claimPin(block.pinName, "digital_write");
        if (!validPin(block.pinName)) issues.add("invalidPin");
        if (block.digitalValue !== 0 && block.digitalValue !== 1) issues.add("invalidDigital");
        break;
      case "buzzer_write":
        if (!/^buzzer:[1-9]\d*$/.test(block.instanceId)) issues.add("invalidBuzzer");
        if (typeof block.isOn !== "boolean" || !validNumber(block.frequencyHz, 1, 20000)) issues.add("invalidFrequency");
        break;
    }
  }
  return [...issues];
}
