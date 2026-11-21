import { useEffect, useRef, useState } from "react";
import * as Blockly from "blockly/core";
import * as spanish from "blockly/msg/es";
import type { ProgramBlock } from "./definitions";
import { blocks as labels } from "../../i18n/es.json";
import { MAX_PROGRAM_FILE_BYTES, parseProgramFile } from "./program-file";
import { programSnapshot } from "./program-snapshot";

Blockly.setLocale(Object.fromEntries(
  Object.entries(spanish).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
));

export interface BlocksEditorProps {
  isReadOnly: boolean;
  onChange: (blocks: ProgramBlock[]) => void;
  activeInstructionIndex?: number;
  programKey?: string;
  onClose?: () => void;
}

export function BlocksEditor({ isReadOnly, onChange, activeInstructionIndex, programKey = "default", onClose }: BlocksEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const orderedBlockIdsRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isReadOnlyRef = useRef(isReadOnly);
  isReadOnlyRef.current = isReadOnly;
  const [storageMessage, setStorageMessage] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const savedSnapshotRef = useRef<string | null>(null);
  const snapshot = () => programSnapshot(Blockly.serialization.workspaces.save(workspaceRef.current!));
  const updateDirtyState = () => {
    if (!workspaceRef.current || savedSnapshotRef.current === null) return;
    setHasUnsavedChanges(snapshot() !== savedSnapshotRef.current);
  };
  const markSaved = () => {
    savedSnapshotRef.current = snapshot();
    setHasUnsavedChanges(false);
  };
  const confirmReplacement = () => savedSnapshotRef.current === null || snapshot() === savedSnapshotRef.current || window.confirm(labels.confirmReplace);
  const storageKey = programKey === "default" ? "robokan.blocks.workspace.v1" : `robokan.blocks.workspace.v1.${programKey}`;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const loadProgram = (source: string) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const state = parseProgramFile(source);
    const scratch = new Blockly.Workspace();
    try { Blockly.serialization.workspaces.load(state, scratch); }
    finally { scratch.dispose(); }
    const previous = Blockly.serialization.workspaces.save(workspace);
    try { Blockly.serialization.workspaces.load(state, workspace); }
    catch (error) {
      Blockly.serialization.workspaces.load(previous, workspace);
      throw error;
    }
  };
  const exportProgram = () => {
    if (!workspaceRef.current) return;
    let url: string | undefined;
    try {
      const source = JSON.stringify({ version: 1, workspace: Blockly.serialization.workspaces.save(workspaceRef.current) }, null, 2);
      url = URL.createObjectURL(new Blob([source], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "robokan-programa.json";
      document.body.append(link);
      link.click();
      link.remove();
      setStorageMessage(labels.exported);
    } catch { setStorageMessage(labels.exportError); }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000); }
  };
  const importProgram = async (file?: File) => {
    if (!file || isReadOnlyRef.current) return;
    try {
      if (file.size > MAX_PROGRAM_FILE_BYTES) throw new Error("File too large");
      const source = await file.text();
      if (isReadOnlyRef.current || !workspaceRef.current) return;
      if (!confirmReplacement()) return;
      loadProgram(source);
      updateDirtyState();
      setStorageMessage(labels.imported);
    } catch { setStorageMessage(labels.importError); }
  };
  const restore = () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const previous = Blockly.serialization.workspaces.save(workspace);
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) { setStorageMessage(labels.noSaved); return; }
      if (!confirmReplacement()) return;
      loadProgram(saved);
      markSaved();
      setStorageMessage(labels.restored);
    } catch {
      Blockly.serialization.workspaces.load(previous, workspace);
      setStorageMessage(labels.restoreError);
    }
  };
  const save = () => {
    if (!workspaceRef.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, workspace: Blockly.serialization.workspaces.save(workspaceRef.current) }));
      markSaved();
      setStorageMessage(labels.saved);
    } catch { setStorageMessage(labels.saveError); }
  };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;
    if (!Blockly.Blocks["robokan_wait"]) {
      Blockly.defineBlocksWithJsonArray([
        {
          type: "robokan_wait",
          message0: labels.waitMessage,
          args0: [{ type: "field_number", name: "SECONDS", value: 1, min: 0, max: 86400 }],
          previousStatement: null,
          nextStatement: null,
          colour: "#2878F0",
        },
        { type: "robokan_motor_write", message0: labels.motorMessage,
          args0: [{ type: "field_input", name: "INSTANCE", text: "dc-motor:1" }, { type: "field_number", name: "SPEED", value: 50, min: -100, max: 100 }], previousStatement: null, nextStatement: null, colour: "#20C997" },
        { type: "robokan_read_distance", message0: labels.distanceMessage,
          args0: [{ type: "field_dropdown", name: "TRIG", options: Array.from({ length: 14 }, (_, index) => [`D${index}`, `D${index}`]) }, { type: "field_dropdown", name: "ECHO", options: Array.from({ length: 14 }, (_, index) => [`D${index}`, `D${index}`]) }, { type: "field_dropdown", name: "RESULT", options: [["distance_cm", "distance_cm"], ["distance_cm_2", "distance_cm_2"]] }], previousStatement: null, nextStatement: null, colour: "#8B72E8" },
        { type: "robokan_digital_write", message0: labels.ledMessage,
          args0: [{ type: "field_dropdown", name: "PIN", options: Array.from({ length: 14 }, (_, index) => [`D${index}`, `D${index}`]) }, { type: "field_dropdown", name: "VALUE", options: [[labels.on, "1"], [labels.off, "0"]] }], previousStatement: null, nextStatement: null, colour: "#FFB84D" },
        { type: "robokan_buzzer_write", message0: labels.buzzerMessage,
          args0: [{ type: "field_input", name: "INSTANCE", text: "buzzer:1" }, { type: "field_dropdown", name: "ON", options: [[labels.on, "true"], [labels.off, "false"]] }, { type: "field_number", name: "FREQUENCY", value: 440, min: 1, max: 20000 }], previousStatement: null, nextStatement: null, colour: "#F16C75" },
      ]);
    }
    const workspace = Blockly.inject(containerRef.current, {
      toolbox: {
        kind: "flyoutToolbox",
        contents: ["wait", "motor_write", "read_distance", "digital_write", "buzzer_write"].map((op) => ({ kind: "block", type: `robokan_${op}` })),
      },
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.6, minScale: 0.5, scaleSpeed: 1.1 },
      move: { scrollbars: true, drag: true, wheel: true },
      grid: { spacing: 24, length: 2, colour: "#DCE4EF", snap: false },
      theme: Blockly.Theme.defineTheme("robokan", {
        name: "robokan",
        base: Blockly.Themes.Classic,
        componentStyles: { workspaceBackgroundColour: "#F3F6FB", toolboxBackgroundColour: "#FFFFFF", flyoutBackgroundColour: "#FFFFFF", flyoutOpacity: 1, scrollbarColour: "#8B72E8", insertionMarkerColour: "#20C997", insertionMarkerOpacity: 0.5 },
      }),
      scrollbars: true,
      media: "https://unpkg.com/blockly@12.0.0/media/",
    });
    workspaceRef.current = workspace;
    const publishProgram = () => {
      const blocks: ProgramBlock[] = [];
      const blockIds: string[] = [];
      for (const firstBlock of workspace.getTopBlocks(true)) {
        let block: Blockly.Block | null = firstBlock;
        while (block) {
          blockIds.push(block.id);
          switch (block.type) {
            case "robokan_wait": blocks.push({ type: "wait", delayMs: Number(block.getFieldValue("SECONDS")) * 1000 }); break;
            case "robokan_motor_write": blocks.push({ type: "motor_write", instanceId: block.getFieldValue("INSTANCE"), speedPct: Number(block.getFieldValue("SPEED")) }); break;
            case "robokan_read_distance": blocks.push({ type: "read_distance", trigPinName: block.getFieldValue("TRIG"), echoPinName: block.getFieldValue("ECHO"), resultId: block.getFieldValue("RESULT") }); break;
            case "robokan_digital_write": blocks.push({ type: "digital_write", pinName: block.getFieldValue("PIN"), digitalValue: block.getFieldValue("VALUE") === "1" ? 1 : 0 }); break;
            case "robokan_buzzer_write": blocks.push({ type: "buzzer_write", instanceId: block.getFieldValue("INSTANCE"), isOn: block.getFieldValue("ON") === "true", frequencyHz: Number(block.getFieldValue("FREQUENCY")) }); break;
          }
          block = block.getNextBlock();
        }
      }
      onChangeRef.current(blocks);
      orderedBlockIdsRef.current = blockIds;
      updateDirtyState();
    };
    workspace.addChangeListener(publishProgram);
    const firstBlock = workspace.newBlock("robokan_wait");
    firstBlock.initSvg();
    firstBlock.render();
    firstBlock.moveBy(40, 40);
    restore();
    if (savedSnapshotRef.current === null) markSaved();
    publishProgram();
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (savedSnapshotRef.current !== null && snapshot() !== savedSnapshotRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    const requestClose = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== "robokan:request-close") return;
      if (confirmReplacement()) closeRef.current?.();
    };
    window.addEventListener("message", requestClose);
    const escapePanel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".blocklyWidgetDiv:not([style*='display: none']) input")) {
        if (confirmReplacement()) closeRef.current?.();
      }
    };
    window.addEventListener("keydown", escapePanel);
    const observer = new ResizeObserver(() => Blockly.svgResize(workspace));
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      window.removeEventListener("message", requestClose);
      window.removeEventListener("keydown", escapePanel);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    for (const block of workspace.getAllBlocks(false)) {
      block.setEditable(!isReadOnly);
      block.setMovable(!isReadOnly);
      block.setDeletable(!isReadOnly);
    }
  }, [isReadOnly]);

  useEffect(() => {
    workspaceRef.current?.highlightBlock(
      activeInstructionIndex === undefined ? null : orderedBlockIdsRef.current[activeInstructionIndex] ?? null,
    );
  }, [activeInstructionIndex]);

  return <>
    <nav className="workspace-tools" aria-label={labels.storageControls}>
      <button disabled={isReadOnly} onClick={save}>{labels.save}</button>
      <button disabled={isReadOnly} onClick={restore}>{labels.restore}</button>
      <button disabled={isReadOnly} onClick={exportProgram}>{labels.export}</button>
      <button disabled={isReadOnly} onClick={() => fileInputRef.current?.click()}>{labels.import}</button>
      <button disabled={isReadOnly} onClick={() => workspaceRef.current?.undo(false)}>{labels.undo}</button>
      <button disabled={isReadOnly} onClick={() => workspaceRef.current?.undo(true)}>{labels.redo}</button>
      <button onClick={() => workspaceRef.current?.zoomToFit()}>{labels.fit}</button>
    </nav>
    <input hidden ref={fileInputRef} type="file" accept=".json,application/json" aria-label={labels.import} onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      void importProgram(file);
    }} />
    <p className="storage-status" role="status">{storageMessage}</p>
    <p className={`save-indicator ${hasUnsavedChanges ? "is-unsaved" : "is-saved"}`} role="status">{hasUnsavedChanges ? labels.unsavedChanges : labels.noPendingChanges}</p>
    <div className="block-workspace" ref={containerRef} inert={isReadOnly} />
  </>;
}

