import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ReadingsPanel } from "../src/modules/blocks/ReadingsPanel";
import { createTestDistanceAdapter } from "../src/dev/test-distance-adapter";

it("shows variable names, centimetres and the test source", () => {
  const html = renderToStaticMarkup(createElement(ReadingsPanel, { readings: { distance_cm: 23.5 }, isTestMode: true }));
  expect(html).toContain("distance_cm");
  expect(html).toContain("23.5");
  expect(html).toContain("cm");
  expect(html).toContain("Valores de prueba");
});

it("returns test readings and respects cancellation and invalid values", async () => {
  const instruction = { op: "read_distance", trigPinName: "D9", echoPinName: "D10", resultId: "distance_cm" } as const;
  const adapter = createTestDistanceAdapter(() => 23.5);
  await expect(adapter(instruction, new AbortController().signal)).resolves.toEqual({ kind: "reading", resultId: "distance_cm", reading: 23.5 });
  const controller = new AbortController();
  controller.abort();
  await expect(adapter(instruction, controller.signal)).rejects.toHaveProperty("name", "AbortError");
  await expect(createTestDistanceAdapter(() => NaN)(instruction, new AbortController().signal)).rejects.toThrow();
});
