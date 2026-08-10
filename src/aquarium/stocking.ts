import { FISH_SPECIES } from './fishSpecies'
import type { FishSpeciesId } from './fishSpecies'
import type { FishSeed } from './fishSimulation'

/**
 * Turns "one blue tang, please" into a fish with a life of its own.
 *
 * Two fish of the same species should not swim in step, so every individual
 * varies from its species baseline: a different depth, a different point in its
 * cycle, a slightly different pace. The variation is derived from a seed number
 * rather than Math.random, which keeps the tank reproducible — the tests assert
 * against real positions, and a random tank would make them flaky.
 */

/**
 * A cheap deterministic hash. Any seed gives a well-spread value in [0, 1),
 * and neighbouring seeds give unrelated results, which is all that is needed to
 * scatter a handful of fish.
 */
function noise(seed: number, salt: number) {
  const mixed = Math.sin((seed + 1) * 127.1 + salt * 311.7) * 43758.5453
  return mixed - Math.floor(mixed)
}

/** Spreads a value symmetrically around zero, in [-spread, spread]. */
const spreadAround = (unit: number, spread: number) => (unit * 2 - 1) * spread

export type StockedFish = FishSeed & {
  readonly id: string
  readonly species: FishSpeciesId
}

/**
 * Builds one fish of the given species. `seed` distinguishes individuals: the
 * same seed always produces the same fish, and different seeds produce fish
 * that differ in depth, phase, pace and starting position.
 */
/**
 * The widest a fish can range up and down before its nose would tilt past
 * `limit` radians.
 *
 * A sine of amplitude A and period P climbs fastest at 2πA/P, and pitch is
 * atan2(climb, forward speed), so the steepest tilt the cruise asks for follows
 * from the range and the period. Deriving the range from the tilt instead of
 * picking it by hand means a fish is never configured to swim steeper than it
 * can hold, whatever period it was given. The slowest speed in the surge cycle
 * is used, since that is when a given climb looks steepest.
 */
function roamWithin(limit: number, period: number, slowestSpeed: number, halfHeight: number) {
  const climb = Math.tan(limit) * slowestSpeed
  return (climb * period) / (2 * Math.PI * halfHeight)
}

/**
 * The steepest a fish should tilt while cruising. Comfortably inside the
 * simulation's own cap, so the cap only ever catches genuine surprises.
 */
const COMFORTABLE_PITCH = 0.32

/**
 * Ranges are expressed as a fraction of the tank's half-height, which is one
 * world unit per fishScale — so the standard tank is what they are sized against.
 */
const REFERENCE_HALF_HEIGHT = 2.3

export function stockFish(species: FishSpeciesId, seed: number): StockedFish {
  const { temperament } = FISH_SPECIES[species]

  /** Each draw uses its own salt so the traits vary independently. */
  const depth = noise(seed, 1)
  const phase = noise(seed, 2)
  const pace = noise(seed, 3)
  const cycle = noise(seed, 4)
  const startX = noise(seed, 5)
  const startZ = noise(seed, 6)
  const startY = noise(seed, 7)
  const facing = noise(seed, 8)
  const turn = noise(seed, 9)
  const surgeCycle = noise(seed, 10)

  const period = temperament.period * (1 + spreadAround(cycle, 0.25))
  const surge = temperament.surge * (1 + spreadAround(surgeCycle, 0.3))
  const speed = temperament.speed * (1 + spreadAround(pace, 0.18))

  /**
   * Some fish roam more than others, but none more than its period allows: the
   * wish is scaled by `depth` and then capped at what it can swim without
   * over-tilting.
   */
  const wanted = 0.45 + depth * 0.45
  const roam = Math.min(
    wanted,
    roamWithin(COMFORTABLE_PITCH, period, speed * (1 - surge), REFERENCE_HALF_HEIGHT),
  )

  return {
    cruise: {
      /** Fish of one species favour nearby depths without sharing a plane. */
      depth: Math.max(-0.75, Math.min(0.75, temperament.depth + spreadAround(depth, 0.28))),
      period,
      phase: phase * Math.PI * 2,
      range: roam,
      surge,
      /** Never a whole multiple of the cruise period, so the two stay out of step. */
      surgePeriod: temperament.period * (0.37 + surgeCycle * 0.21),
    },
    heading: facing * Math.PI * 2,
    id: `${species}-${seed}`,
    position: {
      x: spreadAround(startX, 3.2),
      y: spreadAround(startY, 1.1),
      z: spreadAround(startZ, 1.3),
    },
    species,
    speed,
    /** Slow, lazy circling; the wall-avoidance turns are much sharper than this. */
    turnRate: spreadAround(turn, 0.24),
  }
}

/**
 * How many fish a tank should hold.
 *
 * Aquarists size a stocking by water volume, so the limit follows the tank's
 * litres rather than being a flat number: a nano tank that fits three fish
 * should not be offered the same allowance as a 300 L one. The divisor is a
 * display choice, not husbandry advice — it keeps the biggest tank at a count
 * the software rasteriser can still animate.
 */
const LITERS_PER_FISH = 8
const MIN_CAPACITY = 3
/**
 * Every fish is a skinned model animated each frame, so the ceiling is a
 * rendering budget rather than a husbandry one. It bites on the two largest
 * tanks, which by volume alone would allow far more.
 */
const MAX_CAPACITY = 12

export function stockingCapacity(volumeLiters: number) {
  const byVolume = Math.floor(volumeLiters / LITERS_PER_FISH)
  return Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, byVolume))
}

/**
 * Stocks a tank from a count per species. Seeds run across the whole tank rather
 * than restarting per species, so no two fish anywhere share a set of traits.
 */
export function stockTank(counts: Partial<Record<FishSpeciesId, number>>): StockedFish[] {
  const fish: StockedFish[] = []
  let seed = 0

  for (const species of Object.keys(FISH_SPECIES) as FishSpeciesId[]) {
    for (let index = 0; index < (counts[species] ?? 0); index += 1) {
      fish.push(stockFish(species, seed))
      seed += 1
    }
  }

  return fish
}
