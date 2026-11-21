import { expect, it } from "vitest";
import { programSnapshot } from "../src/modules/blocks/program-snapshot";

it("ignores execution editing locks while detecting field and position changes", () => {
  const original = { blocks: [{ type: "robokan_wait", fields: { SECONDS: 1 }, x: 40 }] };
  const locked = { blocks: [{ ...original.blocks[0], editable: false, movable: false, deletable: false }] };
  expect(programSnapshot(locked)).toBe(programSnapshot(original));
  expect(programSnapshot({ blocks: [{ ...original.blocks[0], fields: { SECONDS: 5 } }] })).not.toBe(programSnapshot(original));
  expect(programSnapshot({ blocks: [{ ...original.blocks[0], x: 100 }] })).not.toBe(programSnapshot(original));
});
