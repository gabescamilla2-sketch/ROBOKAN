// Modulo: blocks
// Responsable: Rol 2
// Editor de bloques tipo Scratch. Genera C++ e instrucciones del simulador.
// API publica: solo se exporta desde este archivo.
export type { WaitBlock, ProgramBlock } from "./definitions";
export { DEFAULT_WAIT_BLOCK } from "./definitions";
export { generateCpp, generateCppProgram } from "./generate-cpp";
export { generateInstructions } from "./generate-instructions";
export { BlocksEditor } from "./BlocksEditor";
export { ReadingsPanel } from "./ReadingsPanel";
export { validateProgram } from "./validate-program";
