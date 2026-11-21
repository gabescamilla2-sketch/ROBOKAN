import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProgramRunner } from "../src/modules/runtime";
import type {
  ExecuteHardwareInstruction,
  InstructionResult,
} from "../src/core";

beforeEach(() =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }),
);
afterEach(() => vi.useRealTimers());
const flush = async () => {
  for (let index = 0; index < 20; index++) await Promise.resolve();
};

it("stores distance readings and executes subsequent writes", async () => {
  const adapter = vi.fn<ExecuteHardwareInstruction>(async (instruction) =>
    instruction.op === "read_distance"
      ? { kind: "reading", resultId: instruction.resultId, reading: 23.5 }
      : { kind: "completed" },
  );
  const runner = new ProgramRunner(adapter);
  runner.run([
    {
      op: "read_distance",
      trigPinName: "D9",
      echoPinName: "D10",
      resultId: "distance_cm",
    },
    { op: "digital_write", pinName: "D3", digitalValue: 1 },
  ]);
  await vi.runAllTimersAsync();
  expect(runner.readings).toEqual({ distance_cm: 23.5 });
  expect(runner.status).toBe("completed");
  expect(adapter).toHaveBeenCalledTimes(2);
});

it("zeros and restores motors while preserving the remaining wait, then shuts down actuators", async () => {
  const adapter = vi.fn<ExecuteHardwareInstruction>(async () => ({
    kind: "completed",
  }));
  const runner = new ProgramRunner(adapter);
  runner.run([
    { op: "motor_write", instanceId: "dc-motor:1", speedPct: 50 },
    {
      op: "buzzer_write",
      instanceId: "buzzer:1",
      isOn: true,
      frequencyHz: 440,
    },
    { op: "digital_write", pinName: "D3", digitalValue: 1 },
    { op: "wait", delayMs: 5000 },
  ]);
  await vi.advanceTimersByTimeAsync(1000);
  const remaining = runner.remainingWaitMs;
  runner.pause();
  await flush();
  expect(adapter).toHaveBeenLastCalledWith(
    { op: "motor_write", instanceId: "dc-motor:1", speedPct: 0 },
    expect.any(AbortSignal),
  );
  await vi.advanceTimersByTimeAsync(10000);
  expect(runner.remainingWaitMs).toBe(remaining);
  runner.resume();
  await flush();
  expect(adapter).toHaveBeenLastCalledWith(
    { op: "motor_write", instanceId: "dc-motor:1", speedPct: 50 },
    expect.any(AbortSignal),
  );
  runner.stop();
  await flush();
  expect(
    adapter.mock.calls.slice(-3).map(([instruction]) => instruction),
  ).toEqual([
    { op: "motor_write", instanceId: "dc-motor:1", speedPct: 0 },
    {
      op: "buzzer_write",
      instanceId: "buzzer:1",
      isOn: false,
      frequencyHz: 440,
    },
    { op: "digital_write", pinName: "D3", digitalValue: 0 },
  ]);
  expect(runner.status).toBe("idle");
});

it("aborts pending reads and ignores late results after stop", async () => {
  let resolve!: (result: InstructionResult) => void;
  let signal!: AbortSignal;
  const runner = new ProgramRunner(async (_instruction, operationSignal) => {
    signal = operationSignal;
    return new Promise((complete) => {
      resolve = complete;
    });
  });
  runner.run([
    {
      op: "read_distance",
      trigPinName: "D9",
      echoPinName: "D10",
      resultId: "distance_cm",
    },
  ]);
  await flush();
  runner.stop();
  expect(signal.aborted).toBe(true);
  resolve({ kind: "reading", resultId: "distance_cm", reading: 5 });
  await flush();
  expect(runner.readings).toEqual({});
  expect(runner.status).toBe("idle");
});

it("reports electrical violations and treats AbortError as cancellation", async () => {
  const violation = {
    ruleId: "missing_power",
    instanceId: "hc-sr04:1",
    messageKey: "errors.missing_power",
  } as const;
  const runner = new ProgramRunner(async () => ({
    kind: "electrical_error",
    violations: [violation],
  }));
  runner.run([
    {
      op: "read_distance",
      trigPinName: "D9",
      echoPinName: "D10",
      resultId: "distance_cm",
    },
  ]);
  await flush();
  expect(runner.status).toBe("error");
  expect(runner.violations).toEqual([violation]);
  const cancelled = new ProgramRunner(async () => {
    throw new DOMException("Cancelled", "AbortError");
  });
  cancelled.run([{ op: "digital_write", pinName: "D3", digitalValue: 1 }]);
  await flush();
  expect(cancelled.status).toBe("idle");
  expect(cancelled.violations).toEqual([]);
});
