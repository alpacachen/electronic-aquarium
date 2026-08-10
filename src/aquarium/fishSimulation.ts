export type Point3 = {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * What tells one fish apart from another: the depth it favours, how far it
 * strays from it, and how its speed rises and falls. Two fish given different
 * cruises never move in step, which is what keeps a tank from looking like a
 * formation.
 */
export type FishCruise = {
  /** Height this fish prefers, as a fraction of the tank's half-height. */
  readonly depth: number
  /** How far it strays above and below that, in the same fraction. */
  readonly range: number
  /** Seconds for one full up-and-down. */
  readonly period: number
  /** Where in that cycle the fish starts, in radians. */
  readonly phase: number
  /** How much the swimming speed rises and falls, as a fraction of `speed`. */
  readonly surge: number
  /** Seconds for one full surge cycle. */
  readonly surgePeriod: number
}

/** The part of a fish an author writes down; the rest is derived as it swims. */
export type FishSeed = {
  readonly position: Point3
  readonly heading: number
  /** Cruising speed before the individual's own surge is applied. */
  readonly speed: number
  readonly turnRate: number
  readonly cruise: FishCruise
}

export type FishState = FishSeed & {
  /**
   * Seconds this fish has been swimming. Its wander and surge are read from
   * this, so vertical motion is a function of elapsed time rather than an
   * accumulating velocity that could drift.
   */
  readonly elapsed: number
  /** Radians the nose is tilted up. Derived from the climb rate, never set by hand. */
  readonly pitch: number
  /** World units per second the fish is rising. Derived, reported for tests and posture. */
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

/**
 * A fish's nose tilts up when it climbs, and the tilt tracks the slope it is
 * actually travelling on: pitch is atan2(climb, forward speed). The cap keeps a
 * fish from standing on its tail if it ever climbs faster than it swims.
 */
const MAX_PITCH = 0.5
/** Below this the pitch angle is meaningless, so the fish is left level. */
const MIN_SPEED_FOR_PITCH = 0.001
/** Radians per second the nose may swing, so posture eases rather than snaps. */
const MAX_PITCH_RATE = 1.6

const TWO_PI = Math.PI * 2

/**
 * Seconds a fish takes to close most of the gap to its cruise target.
 *
 * Deliberately not derived from the cruise period: tying the two together made a
 * short-period fish chase its target so hard that it climbed as fast as it swam
 * forward, which pinned the pitch at its cap. A fixed, short value means the
 * fish tracks its target closely and the climb rate is set by the period alone.
 */
const CRUISE_RESPONSE = 1.5

const approach = (from: number, to: number, maxStep: number) =>
  Math.abs(to - from) <= maxStep ? to : from + Math.sign(to - from) * maxStep

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
 * The height this fish is heading for right now, in world units.
 *
 * Each fish keeps to its own depth and works up and down around it on its own
 * period, so a tank of fish spreads through the water instead of sharing one
 * plane. The result is clamped so the target itself can never sit outside the
 * water, however the cruise was configured.
 */
export function cruiseTargetY(cruise: FishCruise, elapsed: number, bounds: AquariumBounds) {
  const angle = cruise.phase + (TWO_PI * elapsed) / cruise.period
  const fraction = cruise.depth + Math.sin(angle) * cruise.range
  return clamp(fraction * bounds.y, bounds.y)
}

/**
 * Starts a fish swimming from what an author wrote down.
 *
 * The bounds are optional but worth passing: with them the fish begins already
 * at its cruise depth, instead of being hauled there over the first second in a
 * lurch that pitches its nose far steeper than it ever does again.
 */
export function createFish(seed: FishSeed, bounds?: AquariumBounds): FishState {
  const position = bounds
    ? { ...seed.position, y: cruiseTargetY(seed.cruise, 0, bounds) }
    : seed.position
  return { ...seed, elapsed: 0, pitch: 0, position, verticalVelocity: 0 }
}

/** The speed this fish is swimming at right now, easing above and below its cruise. */
export function surgeSpeed(fish: FishState, elapsed: number) {
  const angle = fish.cruise.phase + (TWO_PI * elapsed) / fish.cruise.surgePeriod
  return fish.speed * (1 + Math.sin(angle) * fish.cruise.surge)
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
  const step = Math.max(0, deltaTime)
  const elapsed = fish.elapsed + step
  let heading = fish.heading + fish.turnRate * step
  heading = avoidWall(fish, heading, step, bounds)

  /**
   * The surge is read from the middle of the step rather than its start, which
   * is the average speed over the step to second order. Sampling at the start
   * would make the distance covered depend on the frame rate.
   */
  const speed = surgeSpeed(fish, fish.elapsed + step / 2)
  let x = fish.position.x + Math.cos(heading) * speed * step
  let z = fish.position.z + Math.sin(heading) * speed * step

  /**
   * Vertical motion eases towards the cruise target instead of integrating a
   * constant velocity, which is what used to pin every fish to one plane. The
   * easing also means a fish enters from wherever it was placed rather than
   * snapping onto its cruise, and that the climb rate stays finite, so the pitch
   * derived from it below is always sane.
   *
   * Written as an exponential so the motion is the same whatever the frame rate:
   * a fixed fraction per frame would drift between the browser's ~60fps and the
   * coarser steps the tests use.
   */
  const targetY = cruiseTargetY(fish.cruise, elapsed, bounds)
  const reach = 1 - Math.exp(-step / CRUISE_RESPONSE)
  let y = fish.position.y + (targetY - fish.position.y) * reach
  y = clamp(y, bounds.y)

  const verticalVelocity = step > 0 ? (y - fish.position.y) / step : fish.verticalVelocity

  x = clamp(x, bounds.x)
  z = clamp(z, bounds.z)

  /** Posture follows the slope actually travelled, then eases into place. */
  const wanted = speed > MIN_SPEED_FOR_PITCH
    ? clamp(Math.atan2(verticalVelocity, speed), MAX_PITCH)
    : 0
  const pitch = step > 0 ? approach(fish.pitch, wanted, MAX_PITCH_RATE * step) : fish.pitch

  return {
    ...fish,
    elapsed,
    heading,
    pitch,
    position: { x, y, z },
    verticalVelocity,
  }
}
