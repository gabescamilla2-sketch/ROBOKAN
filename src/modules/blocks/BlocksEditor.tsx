import { useEffect, useRef } from "react";
import * as Blockly from "blockly/core";
import * as spanish from "blockly/msg/es";
import type { WaitBlock } from "./definitions";
import { blocks as labels } from "../../i18n/es.json";

Blockly.setLocale(Object.fromEntries(
  Object.entries(spanish).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
));

export interface BlocksEditorProps {
  isReadOnly: boolean;
  onChange: (blocks: WaitBlock[]) => void;
}

export function BlocksEditor({ isReadOnly, onChange }: BlocksEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
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
          colour: 215,
        },
      ]);
    }
    const workspace = Blockly.inject(containerRef.current, {
      toolbox: {
        kind: "flyoutToolbox",
        contents: [{ kind: "block", type: "robokan_wait" }],
      },
      trashcan: true,
      scrollbars: true,
      media: "https://unpkg.com/blockly@12.0.0/media/",
    });
    workspaceRef.current = workspace;
    const publishProgram = () => {
      const blocks: WaitBlock[] = [];
      for (const firstBlock of workspace.getTopBlocks(true)) {
        let block: Blockly.Block | null = firstBlock;
        while (block) {
          blocks.push({ type: "wait", delayMs: Number(block.getFieldValue("SECONDS")) * 1000 });
          block = block.getNextBlock();
        }
      }
      onChangeRef.current(blocks);
    };
    workspace.addChangeListener(publishProgram);
    const firstBlock = workspace.newBlock("robokan_wait");
    firstBlock.initSvg();
    firstBlock.render();
    firstBlock.moveBy(40, 40);
    publishProgram();
    const observer = new ResizeObserver(() => Blockly.svgResize(workspace));
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
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

  return <div className="block-workspace" ref={containerRef} inert={isReadOnly} />;
}
