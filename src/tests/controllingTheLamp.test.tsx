import { beforeEach, describe, expect, it } from 'vitest'
import { openAquarium } from './aquariumPage'
import type { AquariumPage } from './aquariumPage'

describe('鱼缸灯', () => {
  let aquarium: AquariumPage

  beforeEach(async () => {
    aquarium = await openAquarium()
  })

  it('灯夹在缸口一角，灯头探到缸正上方垂直往下照', () => {
    const position = aquarium.lamp().position()
    const tank = aquarium.tank()

    expect(position.x).toBeCloseTo(0)
    expect(position.z).toBeCloseTo(0)
    expect(position.y).toBeGreaterThan(tank.height / 2)
  })

  it('灯是有颜色、有实际亮度的光源', () => {
    expect(aquarium.lamp().intensity()).toBeGreaterThan(0)
    expect(aquarium.lamp().color()).toBe('26bde2')
  })
})
