import { expect, it } from "vitest";
import { openWorkbench as openBenchWithStorage } from "./helpers/workbench-dom";

const STORAGE_KEY = "robokan.circuit-editor.v1";
// Each exercise saves its board program under "<exercise>.<board>".
const PROGRAM_KEY = "robokan.blocks.workspace.v1.avoider.uno-1";
const OLD_PROJECT = JSON.stringify({
  components: [{ id: "uno-1", type: "uno", x: 115, y: 305 }],
  wires: [],
});

function openWorkbench(confirmAnswer: boolean) {
  const bench = openBenchWithStorage({
    confirm: confirmAnswer,
    storage: { [STORAGE_KEY]: OLD_PROJECT, [PROGRAM_KEY]: "{}" },
  });
  return { window: bench.window, ids: bench.componentIds };
}

it("restores the obstacle-avoider starter and forgets the saved project", () => {
  const { window, ids } = openWorkbench(true);
  try {
    expect(ids()).toEqual(["uno-1"]);
    window.document.querySelector("#reset-project").click();
    expect(ids()).toEqual([
      "uno-1",
      "sensor-1",
      "breadboard-1",
      "motor-1",
      "motor-2",
    ]);
    expect(window.document.querySelector("#wire-count").textContent).toBe("8");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(PROGRAM_KEY)).toBeNull();
    window.document.querySelector("#undo").click();
    expect(ids()).toEqual(["uno-1"]);
  } finally {
    window.close();
  }
});

it("keeps the current circuit when the reset is cancelled", () => {
  const { window, ids } = openWorkbench(false);
  try {
    window.document.querySelector("#reset-project").click();
    expect(ids()).toEqual(["uno-1"]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(OLD_PROJECT);
    expect(window.localStorage.getItem(PROGRAM_KEY)).toBe("{}");
  } finally {
    window.close();
  }
});
