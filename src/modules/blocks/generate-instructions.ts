import type { Instruction } from "../../core";
import type { WaitBlock } from "./definitions";

export function generateInstructions(blocks: readonly WaitBlock[]): Instruction[] {
  return blocks.map((block) => ({
    op: "wait",
    delayMs: block.delayMs,
  }));
}
