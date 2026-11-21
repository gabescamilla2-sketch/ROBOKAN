import { expect, it } from "vitest";
import {
  avoidThresholdCm,
  createAvoiderProgram,
} from "../src/dev/world-example";

it("reads the avoid distance the 3D ray should show from the first drive-until block", () => {
  expect(avoidThresholdCm(createAvoiderProgram())).toBe(40);
  expect(avoidThresholdCm([{ type: "wait", delayMs: 1000 }])).toBeNull();
  const [drive, ...rest] = createAvoiderProgram();
  expect(
    avoidThresholdCm([
      ...rest,
      { ...drive, thresholdCm: 25 } as typeof drive,
      { ...drive, thresholdCm: 90 } as typeof drive,
    ]),
  ).toBe(25);
});
