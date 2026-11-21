// Modulo: blocks
// Responsable: Rol 2
// Editor de bloques tipo Scratch. Genera C++ e instrucciones del simulador.
// API publica: solo se exporta desde este archivo.
export type { WaitBlock } from "./definitions";
export { DEFAULT_WAIT_BLOCK } from "./definitions";
export { generateCpp } from "./generate-cpp";
export { generateInstructions } from "./generate-instructions";
