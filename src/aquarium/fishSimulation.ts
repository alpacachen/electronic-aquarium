export type Point3 = {
  readonly x: number
  readonly y: number
  readonly z: number
}

export type FishState = {
  readonly position: Point3
  readonly heading: number
  readonly speed: number
  readonly turnRate: number
  readonly verticalVelocity: number
}

export type AquariumBounds = {
  readonly x: number
  readonly y: number
  readonly z: number
}

const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value))

const WALL_TURN_START = 0.6
const MIN_WALL_TURN_RATE = 0.35
const MAX_WALL_TURN_RATE = 2.8
const MAX_WALL_TURN_PER_STEP = 0.12

const wrappedAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

function avoidWall(
  fish: FishState,
  heading: number,
  elapsed: number,
  bounds: AquariumBounds,
) {
  const normalizedX = fish.position.x / bounds.x
  const normalizedZ = fish.position.z / bounds.z
  const proximity = Math.max(Math.abs(normalizedX), Math.abs(normalizedZ))
  const movingOutward =
    normalizedX * Math.cos(heading) + normalizedZ * Math.sin(heading)

  if (proximity <= WALL_TURN_START || movingOutward <= 0) {
    return heading
  }

  const strength = clamp(
    (proximity - WALL_TURN_START) / (1 - WALL_TURN_START),
    1,
  )
  const target = Math.atan2(-normalizedZ, -normalizedX)
  const turnRate =
    MIN_WALL_TURN_RATE +
    (MAX_WALL_TURN_RATE - MIN_WALL_TURN_RATE) * strength
  const maxTurn = Math.min(turnRate * elapsed, MAX_WALL_TURN_PER_STEP)

  return heading + clamp(wrappedAngle(target - heading), maxTurn)
}

/**
 * Advances one fish without mutating the input state.
 * The bounds are half-extents around the center of the water volume.
 */
export function stepFish(
  fish: FishState,
  deltaTime: number,
  bounds: AquariumBounds,
): FishState {
  const elapsed = Math.max(0, deltaTime)
  let heading = fish.heading + fish.turnRate * elapsed
  heading = avoidWall(fish, heading, elapsed, bounds)
  let x = fish.position.x + Math.cos(heading) * fish.speed * elapsed
  let z = fish.position.z + Math.sin(heading) * fish.speed * elapsed
  let y = fish.position.y + fish.verticalVelocity * elapsed
  let verticalVelocity = fish.verticalVelocity

  x = clamp(x, bounds.x)
  z = clamp(z, bounds.z)

  if (y > bounds.y || y < -bounds.y) {
    y = clamp(y, bounds.y)
    verticalVelocity = -verticalVelocity
  }

  return {
    ...fish,
    heading,
    position: { x, y, z },
    verticalVelocity,
  }
}
