import { expect, it } from "vitest";
import { openWorkbench } from "./helpers/workbench-dom";

// Starter avoider: wire-3 is uno D9 → TRIG, wire-4 is uno D10 → ECHO.
// Arduino header pins are only 14 px apart, closer than a wire-end handle.

it("moves a wire end onto a pin right next to other wired pins", () => {
  const bench = openWorkbench();
  try {
    const handle = bench.document.querySelector(
      '[data-wire-end="from"][data-wire-id="wire-4"]',
    );
    const start = bench.pinPosition("uno-1", "D10");
    const target = bench.pinPosition("uno-1", "D11");
    bench.pointer("pointerdown", handle, start);
    bench.pointer("pointermove", bench.canvas, target);
    bench.pointer("pointerup", bench.canvas, target);
    expect(bench.wireTitle("wire-4")).toMatch(/^D11 → ECHO/);
  } finally {
    bench.window.close();
  }
});

it("lets a click on a free pin win over a neighbouring wire-end handle", () => {
  const bench = openWorkbench();
  try {
    // The D10 wire-end handle overlaps D11, so the browser targets the handle.
    const handle = bench.document.querySelector(
      '[data-wire-end="from"][data-wire-id="wire-4"]',
    );
    const freePin = bench.pinPosition("uno-1", "D11");
    bench.pointer("pointerdown", handle, freePin);
    bench.pointer("pointerup", bench.canvas, freePin);
    expect(
      bench.document
        .querySelector("circle.pin.pending")
        ?.getAttribute("data-pin"),
    ).toBe("D11");
    expect(bench.wireTitle("wire-4")).toMatch(/^D10 → ECHO/);
  } finally {
    bench.window.close();
  }
});

it("starts a new wire when a wired pin is clicked without dragging", () => {
  const bench = openWorkbench();
  try {
    const handle = bench.document.querySelector(
      '[data-wire-end="from"][data-wire-id="wire-4"]',
    );
    const pin = bench.pinPosition("uno-1", "D10");
    bench.pointer("pointerdown", handle, pin);
    bench.pointer("pointerup", bench.canvas, pin);
    expect(
      bench.document
        .querySelector("circle.pin.pending")
        ?.getAttribute("data-pin"),
    ).toBe("D10");
    expect(bench.wireTitle("wire-4")).toMatch(/^D10 → ECHO/);
  } finally {
    bench.window.close();
  }
});

it("keeps the old connection when a wire end is dropped away from any pin", () => {
  const bench = openWorkbench();
  try {
    const handle = bench.document.querySelector(
      '[data-wire-end="from"][data-wire-id="wire-4"]',
    );
    bench.pointer("pointerdown", handle, bench.pinPosition("uno-1", "D10"));
    bench.pointer("pointermove", bench.canvas, { clientX: 600, clientY: 60 });
    bench.pointer("pointerup", bench.canvas, { clientX: 600, clientY: 60 });
    expect(bench.wireTitle("wire-4")).toMatch(/^D10 → ECHO/);
  } finally {
    bench.window.close();
  }
});
