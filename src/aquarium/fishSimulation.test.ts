import { describe, expect, it } from 'vitest'
import { stepFish } from './fishSimulation'

const bounds = { x: 4.35, y: 2, z: 1.95 }

const angleBetween = (left: number, right: number) =>
  Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)))

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

  it('turns toward the tank before reaching a wall without snapping around', () => {
    let fish = {
      position: { x: 3.4, y: 0, z: 0.4 },
      heading: 0,
      speed: 1.4,
      turnRate: 0,
      verticalVelocity: 0,
    }

    const first = stepFish(fish, 1 / 60, bounds)

    expect(first.position.x).toBeGreaterThan(fish.position.x)
    expect(angleBetween(first.heading, fish.heading)).toBeGreaterThan(0)
    expect(angleBetween(first.heading, fish.heading)).toBeLessThan(0.15)

    for (let frame = 0; frame < 300; frame += 1) {
      const next = stepFish(fish, 1 / 60, bounds)
      expect(angleBetween(next.heading, fish.heading)).toBeLessThan(0.15)
      fish = next
    }

    expect(Math.abs(fish.position.x)).toBeLessThanOrEqual(bounds.x)
    expect(Math.abs(fish.position.z)).toBeLessThanOrEqual(bounds.z)
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
