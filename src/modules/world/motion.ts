/** Inner face of the arena walls (scene.glb walls: center ±9 m, 0.45 m thick). */
export const ARENA_WALL_INNER_M = 8.775;

export interface ObstacleBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export interface RobotPose {
  x: number;
  z: number;
  headingRad: number;
}

export function advanceRobot(
  pose: RobotPose,
  leftPct: number,
  rightPct: number,
  deltaSeconds: number,
  obstacles: readonly ObstacleBounds[],
  radiusM = 0.9,
): RobotPose {
  let remaining = Math.max(0, Math.min(deltaSeconds, 0.25));
  let result = { ...pose };
  // Short substeps keep motion and collision checks consistent at low FPS.
  while (remaining > 0) {
    const seconds = Math.min(remaining, 0.02);
    result = advanceStep(
      result,
      leftPct,
      rightPct,
      seconds,
      obstacles,
      radiusM,
    );
    remaining -= seconds;
  }
  return result;
}

function advanceStep(
  pose: RobotPose,
  leftPct: number,
  rightPct: number,
  seconds: number,
  obstacles: readonly ObstacleBounds[],
  radiusM: number,
): RobotPose {
  const speedMps = ((leftPct + rightPct) / 200) * 2.2;
  const headingRad =
    pose.headingRad + ((leftPct - rightPct) / 200) * 2.5 * seconds;
  const middleHeading = (pose.headingRad + headingRad) / 2;
  const x = pose.x + Math.sin(middleHeading) * speedMps * seconds;
  const z = pose.z + Math.cos(middleHeading) * speedMps * seconds;
  // The robot body stops at the arena walls, so the sensor can read them up close.
  const limit = ARENA_WALL_INNER_M - radiusM;
  const isFree = (candidateX: number, candidateZ: number) =>
    Math.abs(candidateX) <= limit &&
    Math.abs(candidateZ) <= limit &&
    !collidesAt(candidateX, candidateZ, obstacles, radiusM);
  if (isFree(x, z)) return { x, z, headingRad };
  // Grazing contact: slide along the blocking surface by keeping the axis that
  // is still free. Near head-on contact (little sideways motion) still stops.
  const dx = x - pose.x;
  const dz = z - pose.z;
  const step = Math.hypot(dx, dz);
  // Tangent slide: drop the part of the move that goes into each touched
  // obstacle (along the contact normal). This also rounds box corners.
  const tangentSlides = obstacles.flatMap((bounds) => {
    if (!collidesAt(x, z, [bounds], radiusM)) return [];
    const closestX = Math.max(bounds.minX, Math.min(pose.x, bounds.maxX));
    const closestZ = Math.max(bounds.minZ, Math.min(pose.z, bounds.maxZ));
    const distance = Math.hypot(pose.x - closestX, pose.z - closestZ);
    if (distance < 1e-9) return [];
    const normalX = (pose.x - closestX) / distance;
    const normalZ = (pose.z - closestZ) / distance;
    const into = dx * normalX + dz * normalZ;
    if (into >= 0) return [];
    const slideX = dx - into * normalX;
    const slideZ = dz - into * normalZ;
    return [
      {
        x: pose.x + slideX,
        z: pose.z + slideZ,
        along: Math.hypot(slideX, slideZ),
      },
    ];
  });
  // Axis slides cover the arena walls, which are limits rather than bounds.
  const slide = [
    ...tangentSlides,
    { x, z: pose.z, along: Math.abs(dx) },
    { x: pose.x, z, along: Math.abs(dz) },
  ]
    .filter(
      (candidate) =>
        candidate.along > SLIDE_MIN_FRACTION * step &&
        isFree(candidate.x, candidate.z),
    )
    .sort((a, b) => b.along - a.along)[0];
  return slide
    ? { x: slide.x, z: slide.z, headingRad }
    : { ...pose, headingRad };
}

/** Sideways share of a step (≈ 12° off head-on) needed to slide along an obstacle. */
const SLIDE_MIN_FRACTION = 0.2;

/** True when a robot of radiusM centered at (x, z) touches any obstacle footprint. */
export function collidesAt(
  x: number,
  z: number,
  obstacles: readonly ObstacleBounds[],
  radiusM = 0.9,
): boolean {
  return obstacles.some((bounds) => {
    const closestX = Math.max(bounds.minX, Math.min(x, bounds.maxX));
    const closestZ = Math.max(bounds.minZ, Math.min(z, bounds.maxZ));
    return Math.hypot(x - closestX, z - closestZ) < radiusM;
  });
}
