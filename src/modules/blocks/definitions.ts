export type WaitBlock = {
  type: "wait";
  delayMs: number;
};

export const DEFAULT_WAIT_BLOCK: WaitBlock = {
  type: "wait",
  delayMs: 1000,
};
