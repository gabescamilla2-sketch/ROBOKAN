import type { ExecuteHardwareInstruction } from "../core";

export function createTestDistanceAdapter(getDistanceCm: () => number): ExecuteHardwareInstruction {
  return async (instruction, signal) => {
    signal.throwIfAborted();
    if (instruction.op !== "read_distance") throw new Error("Distance test adapter only supports sensor reads");
    const reading = getDistanceCm();
    if (!Number.isFinite(reading) || reading < 0) throw new RangeError("Invalid test distance");
    signal.throwIfAborted();
    return { kind: "reading", resultId: instruction.resultId, reading };
  };
}
