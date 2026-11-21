import type { Instruction } from "../../core";

export type WaitInstruction = Extract<Instruction, { op: "wait" }>;
export type ProgramStatus = "idle" | "running" | "paused" | "completed";

export class ProgramRunner {
  private instructions: WaitInstruction[] = [];
  private cursor = 0;
  private remainingMs = 0;
  private deadlineMs = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private currentStatus: ProgramStatus = "idle";
  private repeat = false;

  get status(): ProgramStatus {
    return this.currentStatus;
  }

  get instructionIndex(): number {
    return this.cursor;
  }

  get remainingWaitMs(): number {
    if (this.currentStatus === "running") {
      return Math.max(0, this.deadlineMs - performance.now());
    }
    return this.remainingMs;
  }

  run(instructions: readonly WaitInstruction[], options: { repeat?: boolean } = {}): void {
    const program = instructions.map((instruction) => {
      if (instruction.op !== "wait") {
        throw new Error("Unsupported instruction");
      }
      if (!Number.isFinite(instruction.delayMs) || instruction.delayMs < 0) {
        throw new RangeError("Wait duration must be finite and non-negative");
      }
      return { ...instruction };
    });

    this.stop();
    this.instructions = program;
    this.repeat = options.repeat ?? false;
    this.currentStatus = "running";
    this.startInstruction();
  }

  pause(): void {
    if (this.currentStatus !== "running") return;
    this.remainingMs = this.remainingWaitMs;
    this.clearTimer();
    this.currentStatus = "paused";
  }

  resume(): void {
    if (this.currentStatus !== "paused") return;
    this.currentStatus = "running";
    this.scheduleWait();
  }

  stop(): void {
    this.clearTimer();
    this.instructions = [];
    this.cursor = 0;
    this.remainingMs = 0;
    this.deadlineMs = 0;
    this.currentStatus = "idle";
    this.repeat = false;
  }

  private startInstruction(): void {
    const instruction = this.instructions[this.cursor];
    if (!instruction) {
      this.remainingMs = 0;
      this.currentStatus = "completed";
      return;
    }
    this.remainingMs = instruction.delayMs;
    this.scheduleWait();
  }

  private scheduleWait(): void {
    this.deadlineMs = performance.now() + this.remainingMs;
    this.scheduleTimer();
  }

  private scheduleTimer(): void {
    // Browser timers are limited to a signed 32-bit duration.
    const timeoutMs = Math.min(this.remainingWaitMs, 2_147_483_647);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.remainingWaitMs > 0) {
        this.scheduleTimer();
        return;
      }
      this.cursor += 1;
      if (this.repeat && this.cursor === this.instructions.length) {
        this.cursor = 0;
      }
      this.startInstruction();
    }, timeoutMs);
  }

  private clearTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
