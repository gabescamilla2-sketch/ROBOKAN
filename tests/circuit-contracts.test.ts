import { describe, expect, it } from "vitest";
import { createIdAllocator, createCircuitEventBus } from "../src/core";

describe("shared circuit contracts", () => {
  it("never reuses allocated component or wire IDs", () => {
    const allocator = createIdAllocator(["led:8"], ["wire:3"]);
    expect(allocator.createComponentId("led")).toBe("led:9");
    expect(allocator.createComponentId("led")).toBe("led:10");
    expect(allocator.createWireId()).toBe("wire:4");
    const restored = createIdAllocator([], [], allocator.snapshot());
    expect(restored.createComponentId("led")).toBe("led:11");
    expect(() => allocator.createComponentId("invalid/name")).toThrow();
  });
  it("delivers typed events and removes subscriptions", () => {
    const bus = createCircuitEventBus();
    const received: string[] = [];
    const stop = bus.on("pin:changed", (event) => received.push(event.pinRef));
    bus.emit("pin:changed", { pinRef: "arduino-uno:1/D9", signal: { signalKind: "digital", voltageV: 5, digitalValue: 1 } });
    stop();
    bus.emit("pin:changed", { pinRef: "arduino-uno:1/D9", signal: { signalKind: "floating", voltageV: 0 } });
    expect(received).toEqual(["arduino-uno:1/D9"]);
  });
});
