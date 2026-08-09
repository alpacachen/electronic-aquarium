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
  let x = fish.position.x + Math.cos(heading) * fish.speed * elapsed
  let z = fish.position.z + Math.sin(heading) * fish.speed * elapsed
  let y = fish.position.y + fish.verticalVelocity * elapsed
  let verticalVelocity = fish.verticalVelocity

  if (x > bounds.x || x < -bounds.x) {
    x = clamp(x, bounds.x)
    heading = Math.PI - heading
  }

  if (z > bounds.z || z < -bounds.z) {
    z = clamp(z, bounds.z)
    heading = -heading
  }

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
