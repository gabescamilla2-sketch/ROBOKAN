import { useEffect, useRef } from "react";
import * as Blockly from "blockly/core";
import * as spanish from "blockly/msg/es";
import type { ProgramBlock } from "./definitions";
import { blocks as labels } from "../../i18n/es.json";

Blockly.setLocale(Object.fromEntries(
  Object.entries(spanish).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
));

export interface BlocksEditorProps {
  isReadOnly: boolean;
  onChange: (blocks: ProgramBlock[]) => void;
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
        { type: "robokan_motor_write", message0: labels.motorMessage,
          args0: [{ type: "field_input", name: "INSTANCE", text: "dc-motor:1" }, { type: "field_number", name: "SPEED", value: 50, min: -100, max: 100 }], previousStatement: null, nextStatement: null, colour: 150 },
        { type: "robokan_read_distance", message0: labels.distanceMessage,
          args0: [{ type: "field_dropdown", name: "TRIG", options: Array.from({ length: 14 }, (_, index) => [`D${index}`, `D${index}`]) }, { type: "field_dropdown", name: "ECHO", options: Array.from({ length: 14 }, (_, index) => [`D${index}`, `D${index}`]) }, { type: "field_dropdown", name: "RESULT", options: [["distance_cm", "distance_cm"], ["distance_cm_2", "distance_cm_2"]] }], previousStatement: null, nextStatement: null, colour: 275 },
        { type: "robokan_digital_write", message0: labels.ledMessage,
          args0: [{ type: "field_dropdown", name: "PIN", options: Array.from({ length: 14 }, (_, index) => [`D${index}`, `D${index}`]) }, { type: "field_dropdown", name: "VALUE", options: [[labels.on, "1"], [labels.off, "0"]] }], previousStatement: null, nextStatement: null, colour: 45 },
        { type: "robokan_buzzer_write", message0: labels.buzzerMessage,
          args0: [{ type: "field_input", name: "INSTANCE", text: "buzzer:1" }, { type: "field_dropdown", name: "ON", options: [[labels.on, "true"], [labels.off, "false"]] }, { type: "field_number", name: "FREQUENCY", value: 440, min: 1, max: 20000 }], previousStatement: null, nextStatement: null, colour: 20 },
      ]);
    }
    const workspace = Blockly.inject(containerRef.current, {
      toolbox: {
        kind: "flyoutToolbox",
        contents: ["wait", "motor_write", "read_distance", "digital_write", "buzzer_write"].map((op) => ({ kind: "block", type: `robokan_${op}` })),
      },
      trashcan: true,
      scrollbars: true,
      media: "https://unpkg.com/blockly@12.0.0/media/",
    });
    workspaceRef.current = workspace;
    const publishProgram = () => {
      const blocks: ProgramBlock[] = [];
      for (const firstBlock of workspace.getTopBlocks(true)) {
        let block: Blockly.Block | null = firstBlock;
        while (block) {
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
