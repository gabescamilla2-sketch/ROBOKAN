import { ARENA_WALL_INNER_M, type ObstacleBounds } from "./motion";

/**
 * Editable arena layout. Every shape is stretched to its width × depth × height
 * box; robot collisions use that axis-aligned footprint, while the ultrasonic
 * ray hits the real shape.
 */
export const OBSTACLE_KINDS = [
  "box",
  "wall",
  "cylinder",
  "sphere",
  "cone",
  "pyramid",
  // The robot's real chassis model, to place on its own (e.g. next to a bench circuit).
  "chassis",
] as const;
export type ObstacleKind = (typeof OBSTACLE_KINDS)[number];

export interface RobotStart {
  x: number;
  z: number;
  /** 0 faces +z (north); grows clockwise seen from above. */
  headingDeg: number;
}

export interface WorldObstacle {
  id: string;
  kind: ObstacleKind;
  /** Footprint center on the floor, in meters. */
  x: number;
  z: number;
  widthM: number;
  depthM: number;
  heightM: number;
  colorHex: string;
}

export interface WorldMap {
  version: 1;
  obstacles: WorldObstacle[];
  /** Shows the three obstacles that come with the scenery model. */
  showSceneryObstacles: boolean;
  /** Maximum HC-SR04 detection range in centimeters. */
  ultrasonicRangeCm: number;
  /** Where "Reiniciar robot" places the robot. */
  robotStart: RobotStart;
}

export const WORLD_MAP_STORAGE_KEY = "robokan.world.map.v1";
/** Selection id used by the world and the designer panel for the robot itself. */
export const ROBOT_SELECTION_ID = "robot";
/** Obstacles must stay inside the arena walls. */
export const ARENA_INNER_HALF_M = ARENA_WALL_INNER_M;
export const MAX_OBSTACLES = 30;
export const OBSTACLE_SIZE_M = {
  minFootprint: 0.2,
  maxFootprint: 8,
  minHeight: 0.2,
  maxHeight: 3,
} as const;
export const ULTRASONIC_RANGE_CM = { min: 20, max: 450, default: 450 } as const;
/** The robot's motion keeps |x|, |z| ≤ 8 m; start a little inside that. */
export const ROBOT_START_HALF_M = 7.5;
export const DEFAULT_ROBOT_START: RobotStart = Object.freeze({
  x: -5.5,
  z: -5.5,
  headingDeg: 0,
});

export const OBSTACLE_PRESETS: Readonly<
  Record<
    ObstacleKind,
    Pick<WorldObstacle, "widthM" | "depthM" | "heightM" | "colorHex">
  >
> = Object.freeze({
  // Default heights reach above the robot's ultrasonic sensor (about 1 m high).
  box: { widthM: 1.2, depthM: 1.2, heightM: 1.2, colorHex: "#E8615A" },
  wall: { widthM: 4, depthM: 0.3, heightM: 1.2, colorHex: "#52627A" },
  cylinder: { widthM: 0.7, depthM: 0.7, heightM: 2, colorHex: "#F28C28" },
  sphere: { widthM: 1.2, depthM: 1.2, heightM: 1.8, colorHex: "#1E9BD7" },
  cone: { widthM: 1.2, depthM: 1.2, heightM: 2.6, colorHex: "#8E44AD" },
  pyramid: { widthM: 1.4, depthM: 1.4, heightM: 2.6, colorHex: "#F2C12E" },
  chassis: { widthM: 1.1, depthM: 1.45, heightM: 0.55, colorHex: "#3B4A5E" },
});
const PRESETS = OBSTACLE_PRESETS;
/** Older saved maps called the cylinder "column". */
const LEGACY_KINDS: Record<string, ObstacleKind> = { column: "cylinder" };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function createDefaultWorldMap(): WorldMap {
  return {
    version: 1,
    obstacles: [],
    showSceneryObstacles: true,
    ultrasonicRangeCm: ULTRASONIC_RANGE_CM.default,
    robotStart: { ...DEFAULT_ROBOT_START },
  };
}

function clampRobotStart(start: RobotStart): RobotStart {
  const heading = Number.isFinite(start.headingDeg) ? start.headingDeg : 0;
  return {
    x: clamp(start.x, -ROBOT_START_HALF_M, ROBOT_START_HALF_M),
    z: clamp(start.z, -ROBOT_START_HALF_M, ROBOT_START_HALF_M),
    headingDeg: ((Math.round(heading) % 360) + 360) % 360,
  };
}

/** Moves or turns the robot's starting pose, kept inside the arena. */
export function setRobotStart(
  map: WorldMap,
  patch: Partial<RobotStart>,
): WorldMap {
  return {
    ...map,
    robotStart: clampRobotStart({ ...map.robotStart, ...patch }),
  };
}

export function clampUltrasonicRangeCm(rangeCm: number): number {
  return Number.isFinite(rangeCm)
    ? Math.round(
        clamp(rangeCm, ULTRASONIC_RANGE_CM.min, ULTRASONIC_RANGE_CM.max),
      )
    : ULTRASONIC_RANGE_CM.default;
}

/** Limits the size, then moves the footprint back inside the arena. */
export function clampObstacle(obstacle: WorldObstacle): WorldObstacle {
  const widthM = clamp(
    obstacle.widthM,
    OBSTACLE_SIZE_M.minFootprint,
    OBSTACLE_SIZE_M.maxFootprint,
  );
  const depthM = clamp(
    obstacle.depthM,
    OBSTACLE_SIZE_M.minFootprint,
    OBSTACLE_SIZE_M.maxFootprint,
  );
  const heightM = clamp(
    obstacle.heightM,
    OBSTACLE_SIZE_M.minHeight,
    OBSTACLE_SIZE_M.maxHeight,
  );
  const limitX = ARENA_INNER_HALF_M - widthM / 2;
  const limitZ = ARENA_INNER_HALF_M - depthM / 2;
  return {
    ...obstacle,
    widthM,
    depthM,
    heightM,
    x: clamp(obstacle.x, -limitX, limitX),
    z: clamp(obstacle.z, -limitZ, limitZ),
  };
}

export function obstacleBounds(obstacle: WorldObstacle): ObstacleBounds {
  return {
    minX: obstacle.x - obstacle.widthM / 2,
    maxX: obstacle.x + obstacle.widthM / 2,
    minZ: obstacle.z - obstacle.depthM / 2,
    maxZ: obstacle.z + obstacle.depthM / 2,
  };
}

function nextObstacleId(obstacles: readonly WorldObstacle[]): string {
  const highest = Math.max(
    0,
    ...obstacles.map((obstacle) =>
      Number(/^obstacle:(\d+)$/.exec(obstacle.id)?.[1] ?? 0),
    ),
  );
  return `obstacle:${highest + 1}`;
}

export function addObstacle(
  map: WorldMap,
  kind: ObstacleKind,
  at: { x: number; z: number },
): { map: WorldMap; id: string } {
  if (map.obstacles.length >= MAX_OBSTACLES)
    throw new RangeError(
      `El mapa admite como máximo ${MAX_OBSTACLES} obstáculos.`,
    );
  const id = nextObstacleId(map.obstacles);
  const obstacle = clampObstacle({
    id,
    kind,
    x: at.x,
    z: at.z,
    ...PRESETS[kind],
  });
  return { map: { ...map, obstacles: [...map.obstacles, obstacle] }, id };
}

export type ObstaclePatch = Partial<
  Pick<WorldObstacle, "x" | "z" | "widthM" | "depthM" | "heightM">
>;

/** Returns the same map when the id does not exist. */
export function updateObstacle(
  map: WorldMap,
  id: string,
  patch: ObstaclePatch,
): WorldMap {
  if (!map.obstacles.some((obstacle) => obstacle.id === id)) return map;
  return {
    ...map,
    obstacles: map.obstacles.map((obstacle) =>
      obstacle.id === id ? clampObstacle({ ...obstacle, ...patch }) : obstacle,
    ),
  };
}

export function removeObstacle(map: WorldMap, id: string): WorldMap {
  return {
    ...map,
    obstacles: map.obstacles.filter((obstacle) => obstacle.id !== id),
  };
}

export function clearObstacles(map: WorldMap): WorldMap {
  return { ...map, obstacles: [] };
}

export function serializeWorldMap(map: WorldMap): string {
  return JSON.stringify(map);
}

function parseObstacle(value: unknown): WorldObstacle | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const numbers = ["x", "z", "widthM", "depthM", "heightM"].map(
    (key) => candidate[key],
  );
  const kind =
    typeof candidate.kind === "string"
      ? (LEGACY_KINDS[candidate.kind] ?? candidate.kind)
      : "";
  if (
    typeof candidate.id !== "string" ||
    !/^obstacle:[1-9]\d{0,5}$/.test(candidate.id) ||
    !Object.hasOwn(PRESETS, kind) ||
    typeof candidate.colorHex !== "string" ||
    !/^#[0-9A-Fa-f]{6}$/.test(candidate.colorHex) ||
    !numbers.every(
      (number) => typeof number === "number" && Number.isFinite(number),
    )
  )
    return null;
  const [x, z, widthM, depthM, heightM] = numbers as number[];
  return clampObstacle({
    id: candidate.id,
    kind: kind as ObstacleKind,
    x,
    z,
    widthM,
    depthM,
    heightM,
    colorHex: candidate.colorHex,
  });
}

/** Parses a stored map; anything malformed falls back to the default map. */
export function parseWorldMap(source: string | null): WorldMap {
  const fallback = createDefaultWorldMap();
  if (!source || source.length > 100_000) return fallback;
  try {
    const value = JSON.parse(source) as Record<string, unknown>;
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      value.version !== 1 ||
      !Array.isArray(value.obstacles) ||
      value.obstacles.length > MAX_OBSTACLES ||
      typeof value.showSceneryObstacles !== "boolean" ||
      typeof value.ultrasonicRangeCm !== "number"
    )
      return fallback;
    const obstacles = value.obstacles.map(parseObstacle);
    if (
      obstacles.some((obstacle) => obstacle === null) ||
      new Set(obstacles.map((obstacle) => obstacle!.id)).size !==
        obstacles.length
    )
      return fallback;
    const start = value.robotStart as Record<string, unknown> | undefined;
    const robotStart =
      start &&
      typeof start === "object" &&
      [start.x, start.z, start.headingDeg].every(
        (number) => typeof number === "number" && Number.isFinite(number),
      )
        ? clampRobotStart(start as unknown as RobotStart)
        : { ...DEFAULT_ROBOT_START };
    return {
      version: 1,
      obstacles: obstacles as WorldObstacle[],
      showSceneryObstacles: value.showSceneryObstacles,
      ultrasonicRangeCm: clampUltrasonicRangeCm(value.ultrasonicRangeCm),
      robotStart,
    };
  } catch {
    return fallback;
  }
}

/** One-click arenas for demos; each brings its own obstacles and robot start. */
export const MAP_PRESET_IDS = [
  "scenery",
  "empty",
  "slalom",
  "zigzag",
  "corridor",
] as const;
export type MapPresetId = (typeof MAP_PRESET_IDS)[number];

type PresetObstacle = [ObstacleKind, number, number, ObstaclePatch?];

const PRESET_LAYOUTS: Record<
  Exclude<MapPresetId, "scenery">,
  { robotStart: RobotStart; obstacles: PresetObstacle[] }
> = {
  empty: { robotStart: { x: -5.5, z: -5.5, headingDeg: 0 }, obstacles: [] },
  // Columns in a zigzag straight ahead of the robot.
  slalom: {
    robotStart: { x: 0, z: -7.2, headingDeg: 0 },
    obstacles: [
      ["cylinder", 0, -4.2],
      ["cylinder", -2, -1.2],
      ["cylinder", 2, -1.2],
      ["cylinder", 0, 1.8],
      ["cylinder", -2.5, 5.8],
      ["cylinder", 2.5, 5.8],
    ],
  },
  // Long walls from alternate sides force the robot to keep turning.
  zigzag: {
    robotStart: { x: -6.8, z: -6.8, headingDeg: 0 },
    obstacles: [
      ["wall", -3.5, -5.2, { widthM: 0.3, depthM: 7 }],
      ["wall", 0.5, 5.2, { widthM: 0.3, depthM: 7 }],
      ["wall", 4.5, -5.2, { widthM: 0.3, depthM: 7 }],
      ["box", -1.5, 1.5],
    ],
  },
  // A corridor with a box waiting at its end.
  corridor: {
    robotStart: { x: 0, z: -7.3, headingDeg: 0 },
    obstacles: [
      ["wall", -1.9, -3.5, { widthM: 0.3, depthM: 7.5 }],
      ["wall", 1.9, -3.5, { widthM: 0.3, depthM: 7.5 }],
      ["box", 0, 2.5],
      ["pyramid", -4.5, 0],
      ["sphere", 4.5, 0],
    ],
  },
};

/** Builds a preset arena, keeping the current ultrasonic range. */
export function createPresetMap(id: MapPresetId, current: WorldMap): WorldMap {
  if (id === "scenery")
    return {
      ...createDefaultWorldMap(),
      ultrasonicRangeCm: current.ultrasonicRangeCm,
    };
  const layout = PRESET_LAYOUTS[id];
  let map: WorldMap = {
    ...createDefaultWorldMap(),
    showSceneryObstacles: false,
    ultrasonicRangeCm: current.ultrasonicRangeCm,
    robotStart: { ...layout.robotStart },
  };
  for (const [kind, x, z, size] of layout.obstacles) {
    const added = addObstacle(map, kind, { x, z });
    map = size
      ? updateObstacle(added.map, added.id, { x, z, ...size })
      : added.map;
  }
  return map;
}
