import { describe, expect, it } from 'vitest'
import { stepFish } from './fishSimulation'

const bounds = { x: 4.35, y: 2, z: 1.95 }

describe('stepFish', () => {
  it('moves a fish according to its heading and speed', () => {
    const fish = {
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 2,
      turnRate: 0,
      verticalVelocity: 0,
    }

    expect(stepFish(fish, 0.5, bounds).position).toEqual({ x: 1, y: 0, z: 0 })
  })

  it('does not mutate the input state', () => {
    const fish = {
      position: { x: 1, y: -0.5, z: 0.25 },
      heading: 0.6,
      speed: 1,
      turnRate: 0.2,
      verticalVelocity: 0.1,
    }

    const original = structuredClone(fish)
    stepFish(fish, 0.5, bounds)

    expect(fish).toEqual(original)
  })

  it('treats a negative time step as no time passing', () => {
    const fish = {
      position: { x: 1, y: -0.5, z: 0.25 },
      heading: 0.6,
      speed: 1,
      turnRate: 0.2,
      verticalVelocity: 0.1,
    }

    expect(stepFish(fish, -1, bounds)).toEqual(fish)
  })

  it('keeps a fish inside the tank and reflects its heading at a wall', () => {
    const fish = {
      position: { x: 4, y: 0, z: 0 },
      heading: 0,
      speed: 2,
      turnRate: 0,
      verticalVelocity: 0,
    }

    const next = stepFish(fish, 1, bounds)

    expect(next.position.x).toBe(bounds.x)
    expect(next.heading).toBe(Math.PI)
  })

  it('keeps a turning fish inside the water over many frames', () => {
    let fish = {
      position: { x: -3, y: 1, z: -1 },
      heading: 0.4,
      speed: 1.4,
      turnRate: 0.8,
      verticalVelocity: 0.6,
    }

    for (let frame = 0; frame < 240; frame += 1) {
      fish = stepFish(fish, 1 / 60, bounds)
      expect(Math.abs(fish.position.x)).toBeLessThanOrEqual(bounds.x)
      expect(Math.abs(fish.position.y)).toBeLessThanOrEqual(bounds.y)
      expect(Math.abs(fish.position.z)).toBeLessThanOrEqual(bounds.z)
    }
  })
})
