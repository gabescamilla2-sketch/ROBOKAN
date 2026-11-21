import type { Instruction } from "../../core";
import type { ProgramBlock, WaitBlock } from "./definitions";

export function generateInstructions(blocks: readonly WaitBlock[]): Extract<Instruction, { op: "wait" }>[];
export function generateInstructions(blocks: readonly ProgramBlock[]): Instruction[];

export function generateInstructions(
  blocks: readonly ProgramBlock[],
): Instruction[] {
  return blocks.map((block) => {
    const { type, ...fields } = block;
    return { op: type, ...fields } as Instruction;
  });
}
