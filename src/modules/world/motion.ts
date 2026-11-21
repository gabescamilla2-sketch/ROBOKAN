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
): RobotPose {
  let remaining = Math.max(0, Math.min(deltaSeconds, 0.25));
  let result = { ...pose };
  // Short substeps keep motion and collision checks consistent at low FPS.
  while (remaining > 0) {
    const seconds = Math.min(remaining, 0.02);
    result = advanceStep(result, leftPct, rightPct, seconds, obstacles);
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
): RobotPose {
  const speedMps = ((leftPct + rightPct) / 200) * 2.2;
  const headingRad =
    pose.headingRad + ((leftPct - rightPct) / 200) * 2.5 * seconds;
  const middleHeading = (pose.headingRad + headingRad) / 2;
  const x = pose.x + Math.sin(middleHeading) * speedMps * seconds;
  const z = pose.z + Math.cos(middleHeading) * speedMps * seconds;
  const radiusM = 0.9;
  const collides = obstacles.some((bounds) => {
    const closestX = Math.max(bounds.minX, Math.min(x, bounds.maxX));
    const closestZ = Math.max(bounds.minZ, Math.min(z, bounds.maxZ));
    return Math.hypot(x - closestX, z - closestZ) < radiusM;
  });
  return collides || Math.abs(x) > 8 || Math.abs(z) > 8
    ? { ...pose, headingRad }
    : { x, z, headingRad };
}
