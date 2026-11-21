import { describe, expect, it } from "vitest";
import {
  ARENA_INNER_HALF_M,
  MAP_PRESET_IDS,
  OBSTACLE_PRESETS,
  createDefaultWorldMap,
  createPresetMap,
  obstacleBounds,
  parseWorldMap,
  serializeWorldMap,
} from "../src/modules/world/map";
import { collidesAt } from "../src/modules/world/motion";

/** Footprints of the fixed gas tank and flame measured from scene.glb. */
const HAZARDS = [
  { minX: -5.72, maxX: -4.67, minZ: 3.67, maxZ: 4.72 },
  { minX: 4.59, maxX: 5.61, minZ: 3.59, maxZ: 4.61 },
];
const ROBOT_RADIUS_M = 0.95;

describe("one-click map presets", () => {
  it("offers the scenery, an empty arena, a slalom, a zigzag and a corridor", () => {
    expect(MAP_PRESET_IDS).toEqual([
      "scenery",
      "empty",
      "slalom",
      "zigzag",
      "corridor",
    ]);
    expect(createPresetMap("scenery", createDefaultWorldMap())).toEqual(
      createDefaultWorldMap(),
    );
    expect(createPresetMap("empty", createDefaultWorldMap())).toMatchObject({
      obstacles: [],
      showSceneryObstacles: false,
    });
  });

  it.each(MAP_PRESET_IDS)("builds a valid %s map", (id) => {
    const current = { ...createDefaultWorldMap(), ultrasonicRangeCm: 250 };
    const map = createPresetMap(id, current);
    // Keeps the user's sensor range; survives storage unchanged.
    expect(map.ultrasonicRangeCm).toBe(250);
    expect(parseWorldMap(serializeWorldMap(map))).toEqual(map);
    const bounds = map.obstacles.map(obstacleBounds);
    for (const box of bounds) {
      expect(
        Math.max(Math.abs(box.minX), Math.abs(box.maxX)),
      ).toBeLessThanOrEqual(ARENA_INNER_HALF_M + 1e-9);
      expect(
        Math.max(Math.abs(box.minZ), Math.abs(box.maxZ)),
      ).toBeLessThanOrEqual(ARENA_INNER_HALF_M + 1e-9);
    }
    // Every obstacle is tall enough for the ~1 m high ultrasonic sensor.
    for (const obstacle of map.obstacles)
      expect(obstacle.heightM).toBeGreaterThanOrEqual(1.2);
    const { x, z } = map.robotStart;
    expect(collidesAt(x, z, [...bounds, ...HAZARDS], ROBOT_RADIUS_M)).toBe(
      false,
    );
    if (id !== "scenery" && id !== "empty")
      expect(map.obstacles.length).toBeGreaterThanOrEqual(3);
    expect(
      map.obstacles.every(
        (o) => o.colorHex === OBSTACLE_PRESETS[o.kind].colorHex,
      ),
    ).toBe(true);
  });
});
