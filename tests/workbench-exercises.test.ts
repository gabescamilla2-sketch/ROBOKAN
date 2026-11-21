import { expect, it } from "vitest";
import { openWorkbench } from "./helpers/workbench-dom";

const select = (bench: ReturnType<typeof openWorkbench>, value: string) => {
  const element = bench.document.querySelector("#project-select");
  element.value = value;
  element.dispatchEvent(new bench.window.Event("change", { bubbles: true }));
};
const statusText = (bench: ReturnType<typeof openWorkbench>) =>
  bench.document.querySelector("#status-message").textContent;

it("loads an exercise from the selector, undoably", () => {
  const bench = openWorkbench();
  try {
    const options = [
      ...bench.document.querySelectorAll("#project-select option"),
    ].map((option: { value: string }) => option.value);
    expect(options).toEqual([
      "avoider",
      "led-on",
      "led-blink",
      "traffic-light",
      "distance",
    ]);
    select(bench, "led-on");
    expect(bench.componentIds()).toEqual(["uno-1", "resistor-1", "led-1"]);
    expect(bench.document.querySelector("#project-title").textContent).toBe(
      "Encender un LED",
    );
    expect(
      bench.document.querySelector("#project-challenge").textContent,
    ).toContain("resistencia");
    bench.document.querySelector("#undo").click();
    expect(bench.componentIds()).toContain("sensor-1");
  } finally {
    bench.window.close();
  }
});

it("passes the exercise and its own program slot to the programming panel", () => {
  const bench = openWorkbench();
  try {
    select(bench, "led-blink");
    bench.canvas
      .querySelector('[data-component="uno-1"]')
      .dispatchEvent(
        new bench.window.MouseEvent("dblclick", { bubbles: true }),
      );
    const src = bench.document
      .querySelector("#program-frame")
      .getAttribute("src");
    expect(src).toContain("project=led-blink");
    expect(src).toContain("programKey=led-blink.uno-1");
  } finally {
    bench.window.close();
  }
});

it("lights the LED in the simulation, then burns it without the resistor", () => {
  const bench = openWorkbench();
  try {
    select(bench, "led-on");
    bench.document.querySelector("#run-circuit").click();
    const led = () => bench.canvas.querySelector('[data-component="led-1"]');
    expect(led().querySelector(".program-led-glow")).not.toBeNull();
    expect(statusText(bench)).toContain("funciona");
    // Remove the resistor and wire the LED straight to 5V.
    bench.pointer(
      "pointerdown",
      bench.canvas.querySelector('[data-component="resistor-1"]'),
      { clientX: 560, clientY: 220 },
    );
    bench.pointer("pointerup", bench.canvas, { clientX: 560, clientY: 220 });
    bench.document.querySelector("#delete-selection").click();
    for (const [component, pin] of [
      ["uno-1", "5V"],
      ["led-1", "ANODE"],
    ]) {
      const target = bench.document.querySelector(
        `circle.pin[data-owner="${component}"][data-pin="${pin}"]`,
      );
      bench.pointer("pointerdown", target, bench.pinPosition(component, pin));
    }
    expect(led().querySelector(".burn-effect")).not.toBeNull();
    expect(led().querySelector(".program-led-glow")).toBeNull();
    expect(statusText(bench)).toContain("se quemó");
  } finally {
    bench.window.close();
  }
});
