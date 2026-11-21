// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as Blockly from "blockly/core";
import { BlocksEditor } from "../src/modules/blocks/BlocksEditor";
import { generateCppProgram } from "../src/modules/blocks/generate-cpp";
import type { ProgramBlock } from "../src/modules/blocks/definitions";

// Exercise React controls and real Blockly serialization/connections with a
// headless workspace. SVG rendering requires a real browser.
vi.mock("blockly/core", async (importOriginal) => {
  const module = await importOriginal<typeof import("blockly/core")>();
  const actual = (module as unknown as { default?: typeof module }).default ?? module;
  return {
    ...actual,
    inject: vi.fn(() => {
      const workspace = new actual.Workspace();
      const newBlock = workspace.newBlock.bind(workspace);
      workspace.newBlock = ((...args: Parameters<typeof workspace.newBlock>) => {
        const block = newBlock(...args);
        return Object.assign(block, { initSvg() {}, render() {} });
      }) as typeof workspace.newBlock;
      return Object.assign(workspace, { highlightBlock: vi.fn(), zoomToFit: vi.fn() });
    }),
    svgResize: vi.fn(),
  };
});

let root: Root;
let host: HTMLDivElement;
let program: ProgramBlock[];
const onChange = (blocks: ProgramBlock[]) => { program = blocks; };
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); }); };
const click = async (text: string) => {
  const button = [...host.querySelectorAll("button")].find((element) => element.textContent === text)!;
  await act(async () => button.click());
  await flush();
};
const workspace = () => vi.mocked(Blockly.inject).mock.results.at(-1)!.value as Blockly.WorkspaceSvg;

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(BlocksEditor, { isReadOnly: false, onChange })));
  await flush();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("saves, detects edits and restores only after confirmation", async () => {
  await click("Guardar programa");
  await act(async () => workspace().getTopBlocks(true)[0].setFieldValue(5, "SECONDS"));
  await flush();
  await act(async () => { await vi.waitFor(() => expect(generateCppProgram(program)).toContain("delay(5000)")); });
  expect(host.textContent).toContain("Cambios sin guardar");
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await click("Recuperar guardado");
  expect(generateCppProgram(program)).toContain("delay(5000)");
  confirm.mockReturnValue(true);
  await click("Recuperar guardado");
  expect(generateCppProgram(program)).toContain("delay(1000)");
  expect(host.textContent).toContain("Sin cambios pendientes");
});

it("preserves connections through serialization and undoes a field edit", async () => {
  const first = workspace().getTopBlocks(true)[0];
  await act(async () => {
    const second = workspace().newBlock("robokan_wait");
    second.setFieldValue(2, "SECONDS");
    first.nextConnection!.connect(second.previousConnection!);
  });
  await flush();
  await act(async () => { await vi.waitFor(() => expect(program).toHaveLength(2)); });
  await click("Guardar programa");
  workspace().clearUndo();
  await act(async () => first.setFieldValue(7, "SECONDS"));
  await flush();
  expect(generateCppProgram(program)).toContain("delay(7000)");
  await click("Deshacer");
  expect(generateCppProgram(program)).toContain("delay(1000)");
  await click("Recuperar guardado");
  expect(workspace().getTopBlocks(true)).toHaveLength(1);
  expect(workspace().getTopBlocks(true)[0].getNextBlock()).not.toBeNull();
});

it("highlights the cursor block while active and clears it on stop", async () => {
  const id = workspace().getTopBlocks(true)[0].id;
  await act(async () => root.render(createElement(BlocksEditor, { isReadOnly: true, onChange, activeInstructionIndex: 0 })));
  expect(workspace().highlightBlock).toHaveBeenLastCalledWith(id);
  await act(async () => root.render(createElement(BlocksEditor, { isReadOnly: false, onChange })));
  expect(workspace().highlightBlock).toHaveBeenLastCalledWith(null);
});
