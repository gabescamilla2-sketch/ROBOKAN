import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { circuitSpecs } from "../../src/dev/circuit-fixtures";
import { importCircuitWorkbench } from "../../src/dev/import-circuit-workbench";
import { evaluate } from "../../src/modules/circuit/api";
const { JSDOM } = createRequire(import.meta.url)("jsdom");

const read = (file: string) =>
  readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");

/** Static modules turned into plain scripts so JSDOM can evaluate them together. */
const asScript = (source: string) =>
  source
    .replace(/^import .*;\r?\n/gm, "")
    .replaceAll("export const ", "const ")
    .replaceAll("export function ", "function ");

/**
 * Opens circuits.html in JSDOM. Canvas coordinates equal client coordinates,
 * so tests can dispatch pointer events at pin positions read from the SVG.
 */
export function openWorkbench(
  options: { storage?: Record<string, string>; confirm?: boolean } = {},
) {
  const dom = new JSDOM(read("circuits.html"), {
    url: "http://localhost/circuits.html",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const window = dom.window;
  for (const [key, value] of Object.entries(options.storage ?? {}))
    window.localStorage.setItem(key, value);
  window.structuredClone = structuredClone;
  // circuits.js imports the real electrical engine; provide it as globals.
  Object.assign(window, { importCircuitWorkbench, circuitSpecs, evaluate });
  window.matchMedia = () => ({ matches: true });
  window.confirm = () => options.confirm ?? true;
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
  window.eval(
    [
      asScript(read("circuits-art.js")),
      asScript(read("circuit-projects.js")),
      asScript(read("circuits.js")),
    ].join("\n"),
  );
  const document = window.document;
  const canvas = document.querySelector("#circuit-canvas");
  canvas.getScreenCTM = () => ({ a: 1, inverse: () => ({}) });
  canvas.setPointerCapture = () => {};
  canvas.hasPointerCapture = () => false;
  canvas.releasePointerCapture = () => {};

  /** Canvas position of a component pin, read from the rendered pins layer. */
  const pinPosition = (component: string, pin: string) => {
    const circle = document.querySelector(
      `circle.pin[data-owner="${component}"][data-pin="${pin}"]`,
    );
    const [, x, y] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(
      circle.parentElement.getAttribute("transform"),
    )!;
    return { clientX: Number(x), clientY: Number(y) };
  };
  const pointer = (
    type: string,
    target: EventTarget,
    at: { clientX: number; clientY: number },
  ) =>
    target.dispatchEvent(
      new window.MouseEvent(type, { bubbles: true, button: 0, ...at }),
    );
  /** Title of a wire, "FROM → TO · …", to read its current endpoints. */
  const wireTitle = (id: string) =>
    document.querySelector(`[data-wire="${id}"] title`)?.textContent ?? "";
  const componentIds = () =>
    [...document.querySelectorAll("#circuit-canvas [data-component]")].map(
      (element: { dataset: { component: string } }) =>
        element.dataset.component,
    );
  return {
    window,
    document,
    canvas,
    pinPosition,
    pointer,
    wireTitle,
    componentIds,
  };
}
