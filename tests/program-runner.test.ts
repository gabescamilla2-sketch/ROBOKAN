import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateInstructions, DEFAULT_WAIT_BLOCK } from "../src/modules/blocks";
import { ProgramRunner } from "../src/modules/runtime";

describe("ProgramRunner", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }));
  afterEach(() => vi.useRealTimers());

  it("preserves the remaining wait across pause and resume", () => {
    const runner = new ProgramRunner();
    runner.run([{ op: "wait", delayMs: 5000 }]);
    vi.advanceTimersByTime(2000);
    runner.pause();
    vi.advanceTimersByTime(10000);
    expect(runner.remainingWaitMs).toBe(3000);
    runner.resume();
    vi.advanceTimersByTime(2999);
    expect(runner.status).toBe("running");
    vi.advanceTimersByTime(1);
    expect(runner.status).toBe("completed");
  });

  it("executes generated instructions and repeats until stopped", () => {
    const runner = new ProgramRunner();
    runner.run(generateInstructions([DEFAULT_WAIT_BLOCK]), { repeat: true });
    vi.advanceTimersByTime(2500);
    expect(runner.status).toBe("running");
    expect(runner.remainingWaitMs).toBe(500);
    runner.stop();
    vi.advanceTimersByTime(5000);
    expect(runner.status).toBe("idle");
    expect(runner.instructionIndex).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("completes an empty repeating program without scheduling timers", () => {
    const runner = new ProgramRunner();
    runner.run([], { repeat: true });
    expect(runner.status).toBe("completed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("yields between zero-duration waits and cancels a replaced program", () => {
    const runner = new ProgramRunner();
    runner.run([{ op: "wait", delayMs: 0 }], { repeat: true });
    expect(runner.status).toBe("running");
    runner.run([{ op: "wait", delayMs: 1000 }]);
    vi.advanceTimersByTime(1000);
    expect(runner.status).toBe("completed");
    expect(vi.getTimerCount()).toBe(0);
  });
});
