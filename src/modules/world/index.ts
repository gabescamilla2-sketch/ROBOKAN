// Modulo: world
// Responsable: Rol 3
// Mundo 3D, fisica, arena y consultas de sensores.
// API publica: solo se exporta desde este archivo.
export type {
  WorldApi,
  WorldActuatorCommand,
  RobotWorld,
  WorldSnapshot,
} from "./types";
export { createRobotWorld } from "./create-world";
export type { WorldMap, WorldObstacle, ObstacleKind } from "./map";
export { WorldViewport } from "./WorldViewport";
