import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, it } from "vitest";
const { JSDOM } = createRequire(import.meta.url)("jsdom");

it("opens programming only for Arduino and waits for approved close", async () => {
  const html = readFileSync(new URL("../circuits.html", import.meta.url), "utf8");
  const art = readFileSync(new URL("../circuits-art.js", import.meta.url), "utf8").replaceAll("export const ", "const ").replaceAll("export function ", "function ");
  const script = readFileSync(new URL("../circuits.js", import.meta.url), "utf8").replace(/^import .*;\r?\n/, "");
  const dom = new JSDOM(html, { url: "http://localhost/circuits.html", runScripts: "outside-only", pretendToBeVisual: true });
  const window = dom.window;
  window.structuredClone = structuredClone;
  window.matchMedia = () => ({ matches: true });
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  try {
    window.eval(art + "\n" + script);
    const canvas = window.document.querySelector("#circuit-canvas");
    const panel = window.document.querySelector("#program-panel");
    canvas.querySelector('[data-component="sensor-1"]').dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true }));
    expect(panel.open).toBe(false);
    canvas.querySelector('[data-component="uno-1"]').dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true }));
    expect(panel.open).toBe(true);
    const frame = window.document.querySelector("#program-frame");
    expect(frame.getAttribute("src")).toContain("embedded=1");
    expect(frame.getAttribute("src")).toContain("programKey=uno-1");
    expect(JSON.parse(window.sessionStorage.getItem("robokan.program.circuit-transfer")).components).toHaveLength(3);
    window.document.querySelector("#close-program-panel").click();
    expect(panel.open).toBe(true);
    window.dispatchEvent(new window.MessageEvent("message", { origin: "http://malicious.invalid", source: frame.contentWindow, data: { type: "robokan:close-allowed" } }));
    expect(panel.open).toBe(true);
    window.dispatchEvent(new window.MessageEvent("message", { origin: "http://localhost", source: frame.contentWindow, data: { type: "robokan:close-allowed" } }));
    await new Promise(resolve => window.setTimeout(resolve, 10));
    expect(panel.open).toBe(false);
    expect(frame.hasAttribute("src")).toBe(false);
  } finally { window.close(); }
});
