import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, it } from "vitest";
const { JSDOM } = createRequire(import.meta.url)("jsdom");

const STORAGE_KEY = "robokan.circuit-editor.v1";
const PROGRAM_KEY = "robokan.blocks.workspace.v1.uno-1";
const OLD_PROJECT = JSON.stringify({
  components: [{ id: "uno-1", type: "uno", x: 115, y: 305 }],
  wires: [],
});

function openWorkbench(confirmAnswer: boolean) {
  const html = readFileSync(
    new URL("../circuits.html", import.meta.url),
    "utf8",
  );
  const art = readFileSync(
    new URL("../circuits-art.js", import.meta.url),
    "utf8",
  )
    .replaceAll("export const ", "const ")
    .replaceAll("export function ", "function ");
  const script = readFileSync(
    new URL("../circuits.js", import.meta.url),
    "utf8",
  ).replace(/^import .*;\r?\n/gm, "");
  const dom = new JSDOM(html, {
    url: "http://localhost/circuits.html",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const window = dom.window;
  window.localStorage.setItem(STORAGE_KEY, OLD_PROJECT);
  window.localStorage.setItem(PROGRAM_KEY, "{}");
  window.structuredClone = structuredClone;
  window.matchMedia = () => ({ matches: true });
  window.confirm = () => confirmAnswer;
  window.DOMPoint = class {
    constructor(
      public x: number,
      public y: number,
    ) {}
    matrixTransform() {
      return this;
    }
  };
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  window.eval(art + "\n" + script);
  const ids = () =>
    [
      ...window.document.querySelectorAll("#circuit-canvas [data-component]"),
    ].map(
      (element: { dataset: { component: string } }) =>
        element.dataset.component,
    );
  return { window, ids };
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
