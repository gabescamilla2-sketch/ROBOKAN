import type {
  ExecuteHardwareInstruction,
  HardwareInstruction,
  Instruction,
  InstructionResult,
  RuleViolation,
} from "../../core";

export type WaitInstruction = Extract<Instruction, { op: "wait" }>;
export type ProgramStatus =
  "idle" | "running" | "paused" | "completed" | "error";

export class ProgramRunner {
  private instructions: Instruction[] = [];
  private cursor = 0;
  private remainingMs = 0;
  private deadlineMs = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private currentStatus: ProgramStatus = "idle";
  private repeat = false;
  private controller = new AbortController();
  private epoch = 0;
  private motorOrders = new Map<
    string,
    Extract<HardwareInstruction, { op: "motor_write" }>
  >();
  private actuatorOrders = new Map<string, HardwareInstruction>();
  private cleanup: Promise<void> | undefined;
  private resultReadings: Record<string, number> = {};
  private electricalViolations: RuleViolation[] = [];
  private executionError: string | undefined;

  constructor(private readonly executeHardware?: ExecuteHardwareInstruction) {}

  get status(): ProgramStatus {
    return this.currentStatus;
  }
  get instructionIndex(): number {
    return this.cursor;
  }
  get readings(): Readonly<Record<string, number>> {
    return { ...this.resultReadings };
  }
  get violations(): readonly RuleViolation[] {
    return this.electricalViolations.map((violation) => ({ ...violation }));
  }
  get error(): string | undefined {
    return this.executionError;
  }
  get remainingWaitMs(): number {
    if (
      this.currentStatus === "running" &&
      this.timer !== undefined &&
      this.instructions[this.cursor]?.op === "wait"
    ) {
      return Math.max(0, this.deadlineMs - performance.now());
    }
    return this.remainingMs;
  }

  run(
    instructions: readonly Instruction[],
    options: { repeat?: boolean } = {},
  ): void {
    const program = instructions.map((instruction) => {
      if (
        instruction.op === "wait" &&
        (!Number.isFinite(instruction.delayMs) || instruction.delayMs < 0)
      ) {
        throw new RangeError("Wait duration must be finite and non-negative");
      }
      if (instruction.op !== "wait" && !this.executeHardware)
        throw new Error("Hardware adapter required");
      return { ...instruction };
    });
    this.stop();
    this.resultReadings = {};
    this.electricalViolations = [];
    this.executionError = undefined;
    this.instructions = program;
    this.repeat = options.repeat ?? false;
    this.currentStatus = "running";
    const epoch = this.epoch;
    if (this.cleanup)
      void this.cleanup.then(() => {
        if (this.epoch === epoch && this.currentStatus === "running")
          this.startInstruction();
      });
    else this.startInstruction();
  }

  pause(): void {
    if (this.currentStatus !== "running") return;
    this.remainingMs = this.remainingWaitMs;
    this.cancelPending();
    this.currentStatus = "paused";
    this.queueSafety(
      [...this.motorOrders.values()].map((order) => ({
        ...order,
        speedPct: 0,
      })),
    );
  }

  resume(): void {
    if (this.currentStatus !== "paused") return;
    this.currentStatus = "running";
    const epoch = this.epoch;
    const restore = async () => {
      await this.cleanup;
      for (const order of this.motorOrders.values()) {
        if (epoch !== this.epoch || this.currentStatus !== "running") return;
        const result = await this.executeHardware!(
          order,
          this.controller.signal,
        );
        if (epoch !== this.epoch) return;
        if (!this.acceptResult(result)) return;
      }
      if (epoch !== this.epoch || this.currentStatus !== "running") return;
      if (this.instructions[this.cursor]?.op === "wait") this.scheduleWait();
      else this.startInstruction();
    };
    if (this.cleanup || this.motorOrders.size)
      void restore().catch((error) => this.handleError(error, epoch));
    else if (this.instructions[this.cursor]?.op === "wait") this.scheduleWait();
    else this.startInstruction();
  }

  stop(): void {
    this.cancelPending();
    const safety: HardwareInstruction[] = [
      ...[...this.motorOrders.values()].map((order) => ({
        ...order,
        speedPct: 0,
      })),
      ...[...this.actuatorOrders.values()].map((order): HardwareInstruction => {
        if (order.op === "digital_write") return { ...order, digitalValue: 0 };
        if (order.op === "buzzer_write") return { ...order, isOn: false };
        if (order.op === "servo_write") return { ...order, angleDeg: 90 };
        return order;
      }),
    ];
    this.queueSafety(safety);
    this.motorOrders.clear();
    this.actuatorOrders.clear();
    this.instructions = [];
    this.cursor = 0;
    this.remainingMs = 0;
    this.currentStatus = "idle";
    this.repeat = false;
  }

  private cancelPending(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.controller.abort();
    this.controller = new AbortController();
    this.epoch += 1;
  }

  private queueSafety(orders: HardwareInstruction[]): void {
    if (!orders.length || !this.executeHardware) return;
    const pending = (this.cleanup ?? Promise.resolve()).then(async () => {
      const signal = new AbortController().signal;
      for (const order of orders) {
        try {
          const result = await this.executeHardware!(order, signal);
          if (result.kind === "electrical_error")
            this.electricalViolations = result.violations.map((violation) => ({
              ...violation,
            }));
        } catch (error) {
          if (!(error instanceof Error && error.name === "AbortError"))
            this.executionError = String(error);
        }
      }
    });
    this.cleanup = pending;
    void pending.then(() => {
      if (this.cleanup === pending) this.cleanup = undefined;
    });
  }

  private acceptResult(result: InstructionResult): boolean {
    if (result.kind === "electrical_error") {
      this.stop();
      this.electricalViolations = result.violations.map((violation) => ({
        ...violation,
      }));
      this.currentStatus = "error";
      return false;
    }
    return true;
  }

  private handleError(error: unknown, epoch: number): void {
    if (epoch !== this.epoch) return;
    if (error instanceof Error && error.name === "AbortError") {
      this.stop();
      return;
    }
    this.stop();
    this.executionError =
      error instanceof Error ? error.message : String(error);
    this.currentStatus = "error";
  }

  private startInstruction(): void {
    const instruction = this.instructions[this.cursor];
    if (!instruction) {
      const completedCount = this.instructions.length;
      this.stop();
      this.cursor = completedCount;
      this.currentStatus = "completed";
      return;
    }
    if (instruction.op === "wait") {
      this.remainingMs = instruction.delayMs;
      this.scheduleWait();
      return;
    }
    this.remainingMs = 0;
    // Track attempted orders so stop also neutralizes a command still in flight.
    if (instruction.op === "motor_write")
      this.motorOrders.set(instruction.instanceId, instruction);
    if (instruction.op === "digital_write")
      this.actuatorOrders.set(`pin:${instruction.pinName}`, instruction);
    if (instruction.op === "buzzer_write")
      this.actuatorOrders.set(`buzzer:${instruction.instanceId}`, instruction);
    if (instruction.op === "servo_write")
      this.actuatorOrders.set(`servo:${instruction.instanceId}`, instruction);
    const epoch = this.epoch;
    void Promise.resolve()
      .then(async () => {
        if (epoch !== this.epoch) return;
        const result = await this.executeHardware!(
          instruction,
          this.controller.signal,
        );
        if (epoch !== this.epoch || this.currentStatus !== "running") return;
        if (!this.acceptResult(result)) return;
        if (instruction.op === "read_distance" || instruction.op === "sensor_read") {
          if (
            result.kind !== "reading" ||
            result.resultId !== instruction.resultId ||
            !Number.isFinite(result.reading)
          )
            throw new Error("Invalid distance reading result");
          this.resultReadings[result.resultId] = result.reading;
        } else if (result.kind !== "completed")
          throw new Error("Invalid actuator result");
        this.timer = setTimeout(() => {
          this.timer = undefined;
          this.advance();
        }, 0);
      })
      .catch((error) => this.handleError(error, epoch));
  }

  private advance(): void {
    this.cursor += 1;
    if (this.repeat && this.cursor === this.instructions.length)
      this.cursor = 0;
    this.startInstruction();
  }

  private scheduleWait(): void {
    this.deadlineMs = performance.now() + this.remainingMs;
    this.scheduleTimer();
  }

  private scheduleTimer(): void {
    this.timer = setTimeout(
      () => {
        // Read the deadline before clearing the timer marker.
        const remaining = Math.max(0, this.deadlineMs - performance.now());
        this.timer = undefined;
        if (remaining > 0) {
          this.scheduleTimer();
          return;
        }
        this.remainingMs = 0;
        this.advance();
      },
      Math.min(Math.max(0, this.deadlineMs - performance.now()), 2_147_483_647),
    );
  }
}
