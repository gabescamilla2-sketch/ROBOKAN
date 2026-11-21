import { describe, expect, it } from "vitest";
import {
  ARENA_INNER_HALF_M,
  DEFAULT_ROBOT_START,
  MAX_OBSTACLES,
  OBSTACLE_KINDS,
  OBSTACLE_PRESETS,
  ROBOT_START_HALF_M,
  ULTRASONIC_RANGE_CM,
  addObstacle,
  clearObstacles,
  createDefaultWorldMap,
  obstacleBounds,
  parseWorldMap,
  removeObstacle,
  serializeWorldMap,
  setRobotStart,
  updateObstacle,
} from "../src/modules/world/map";
import { advanceRobot, collidesAt } from "../src/modules/world/motion";

describe("world map model", () => {
  it("starts with scenery obstacles visible, no user obstacles and the 450 cm range", () => {
    expect(createDefaultWorldMap()).toEqual({
      version: 1,
      obstacles: [],
      showSceneryObstacles: true,
      ultrasonicRangeCm: 450,
      robotStart: { x: -5.5, z: -5.5, headingDeg: 0 },
    });
    expect(DEFAULT_ROBOT_START).toEqual({ x: -5.5, z: -5.5, headingDeg: 0 });
    expect(ULTRASONIC_RANGE_CM).toEqual({ min: 20, max: 450, default: 450 });
  });

  it("offers six basic shapes like a shape library", () => {
    expect(OBSTACLE_KINDS).toEqual([
      "box",
      "wall",
      "cylinder",
      "sphere",
      "cone",
      "pyramid",
    ]);
    let map = createDefaultWorldMap();
    for (const kind of OBSTACLE_KINDS)
      map = addObstacle(map, kind, { x: 0, z: 0 }).map;
    expect(map.obstacles.map((obstacle) => obstacle.kind)).toEqual(
      OBSTACLE_KINDS,
    );
    expect(
      new Set(map.obstacles.map((obstacle) => obstacle.colorHex)).size,
    ).toBe(6);
    // Every preset reaches above the robot's ultrasonic sensor (about 1 m high).
    for (const kind of OBSTACLE_KINDS)
      expect(OBSTACLE_PRESETS[kind].heightM, kind).toBeGreaterThanOrEqual(1.2);
  });

  it("adds box, wall and cylinder presets with unique ids", () => {
    let map = createDefaultWorldMap();
    const ids: string[] = [];
    for (const kind of ["box", "wall", "cylinder"] as const) {
      const added = addObstacle(map, kind, { x: 1, z: 2 });
      map = added.map;
      ids.push(added.id);
    }
    expect(ids).toEqual(["obstacle:1", "obstacle:2", "obstacle:3"]);
    expect(
      map.obstacles.map((o) => [o.kind, o.widthM, o.depthM, o.heightM]),
    ).toEqual([
      ["box", 1.2, 1.2, 1.2],
      ["wall", 4, 0.3, 1.2],
      ["cylinder", 0.7, 0.7, 2],
    ]);
    // New ids follow the highest id still present, so they never collide.
    map = removeObstacle(map, "obstacle:3");
    expect(addObstacle(map, "box", { x: 0, z: 0 }).id).toBe("obstacle:3");
    map = removeObstacle(map, "obstacle:1");
    expect(addObstacle(map, "box", { x: 0, z: 0 }).id).toBe("obstacle:3");
  });

  it("refuses to exceed the obstacle limit", () => {
    let map = createDefaultWorldMap();
    for (let index = 0; index < MAX_OBSTACLES; index++)
      map = addObstacle(map, "box", { x: 0, z: 0 }).map;
    expect(() => addObstacle(map, "box", { x: 0, z: 0 })).toThrow(RangeError);
  });

  it("stretches and moves obstacles while keeping them inside the arena", () => {
    let map = addObstacle(createDefaultWorldMap(), "box", { x: 0, z: 0 }).map;
    map = updateObstacle(map, "obstacle:1", {
      widthM: 50,
      depthM: 0.01,
      heightM: 9,
    });
    expect(map.obstacles[0]).toMatchObject({
      widthM: 8,
      depthM: 0.2,
      heightM: 3,
    });
    map = updateObstacle(map, "obstacle:1", { x: 100, z: -100 });
    const bounds = obstacleBounds(map.obstacles[0]);
    expect(bounds.maxX).toBeCloseTo(ARENA_INNER_HALF_M);
    expect(bounds.minZ).toBeCloseTo(-ARENA_INNER_HALF_M);
    expect(updateObstacle(map, "missing", { x: 1 })).toBe(map);
  });

  it("computes collision bounds that stop the robot", () => {
    const map = addObstacle(createDefaultWorldMap(), "wall", {
      x: 0,
      z: 3,
    }).map;
    const bounds = obstacleBounds(map.obstacles[0]);
    expect(bounds).toEqual({ minX: -2, maxX: 2, minZ: 2.85, maxZ: 3.15 });
    let pose = { x: 0, z: 0, headingRad: 0 };
    for (let step = 0; step < 40; step++)
      pose = advanceRobot(pose, 100, 100, 0.1, [bounds]);
    expect(pose.z).toBeLessThan(2.85);
  });

  it("clears user obstacles and clamps the ultrasonic range", () => {
    let map = addObstacle(createDefaultWorldMap(), "box", { x: 0, z: 0 }).map;
    map = clearObstacles(map);
    expect(map.obstacles).toEqual([]);
    expect(
      parseWorldMap(serializeWorldMap({ ...map, ultrasonicRangeCm: 5 }))
        .ultrasonicRangeCm,
    ).toBe(20);
  });

  it("round-trips through storage and falls back to the default on invalid data", () => {
    let map = addObstacle(createDefaultWorldMap(), "cone", {
      x: -3,
      z: 4,
    }).map;
    map = {
      ...map,
      showSceneryObstacles: false,
      ultrasonicRangeCm: 120,
      robotStart: { x: 2, z: 3, headingDeg: 90 },
    };
    expect(parseWorldMap(serializeWorldMap(map))).toEqual(map);
    for (const invalid of [
      null,
      "",
      "{",
      "[]",
      JSON.stringify({ version: 2, obstacles: [] }),
      JSON.stringify({ ...map, obstacles: [{ id: "x", kind: "rocket" }] }),
      JSON.stringify({
        ...map,
        obstacles: Array(MAX_OBSTACLES + 1).fill(map.obstacles[0]),
      }),
    ])
      expect(parseWorldMap(invalid)).toEqual(createDefaultWorldMap());
  });

  it("reads maps saved before shapes and robot start existed", () => {
    const legacy = {
      version: 1,
      obstacles: [
        {
          id: "obstacle:1",
          kind: "column",
          x: 1,
          z: 1,
          widthM: 0.6,
          depthM: 0.6,
          heightM: 2,
          colorHex: "#E8615A",
        },
      ],
      showSceneryObstacles: true,
      ultrasonicRangeCm: 300,
    };
    const map = parseWorldMap(JSON.stringify(legacy));
    expect(map.obstacles[0].kind).toBe("cylinder");
    expect(map.robotStart).toEqual(DEFAULT_ROBOT_START);
    expect(map.ultrasonicRangeCm).toBe(300);
  });

  it("moves and turns the robot start inside the arena", () => {
    let map = setRobotStart(createDefaultWorldMap(), {
      x: 50,
      headingDeg: -90,
    });
    expect(map.robotStart).toEqual({
      x: ROBOT_START_HALF_M,
      z: -5.5,
      headingDeg: 270,
    });
    map = setRobotStart(map, { headingDeg: 725 });
    expect(map.robotStart.headingDeg).toBe(5);
  });

  it("detects when the robot would overlap an obstacle", () => {
    const bounds = obstacleBounds(
      addObstacle(createDefaultWorldMap(), "box", { x: 0, z: 0 }).map
        .obstacles[0],
    );
    expect(collidesAt(0, 1.2, [bounds], 0.9)).toBe(true);
    expect(collidesAt(0, 2, [bounds], 0.9)).toBe(false);
  });
});
