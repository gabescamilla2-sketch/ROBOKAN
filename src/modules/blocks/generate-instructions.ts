import type { Instruction } from "../../core";
import type { WaitBlock } from "./definitions";

export function generateInstructions(
  blocks: readonly WaitBlock[],
): Extract<Instruction, { op: "wait" }>[] {
  return blocks.map((block) => ({
    op: "wait",
    delayMs: block.delayMs,
  }));
}
