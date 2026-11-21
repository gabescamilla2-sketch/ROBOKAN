import type { WaitBlock } from "./definitions";

export function generateCpp(block: WaitBlock): string {
  return `delay(${block.delayMs});`;
}