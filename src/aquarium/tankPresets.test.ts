import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TANK_ID,
  TANK_PRESETS,
  getTankGeometry,
  getTankPreset,
} from './tankPresets'

describe('tank presets', () => {
  it('offers a small set of common aquarium sizes', () => {
    expect(TANK_PRESETS.map((preset) => preset.id)).toEqual([
      'nano',
      'small',
      'standard',
      'large',
      'xl',
    ])

    expect(TANK_PRESETS.map((preset) => preset.dimensions)).toEqual([
      { length: 30, width: 20, height: 20 },
      { length: 45, width: 30, height: 30 },
      { length: 60, width: 30, height: 36 },
      { length: 90, width: 45, height: 45 },
      { length: 120, width: 50, height: 50 },
    ])
  })

  it('uses the standard tank as the default and fallback', () => {
    expect(getTankPreset(DEFAULT_TANK_ID).id).toBe('standard')
    expect(getTankPreset('not-a-tank').id).toBe('standard')
  })

  it('reports approximate capacity in litres', () => {
    expect(getTankPreset('standard').volumeLiters).toBe(64.8)
    expect(getTankPreset('xl').volumeLiters).toBe(300)
  })

  it('maps physical dimensions to a usable scene and camera range', () => {
    const geometry = getTankGeometry(getTankPreset('standard'))

    expect(geometry.size).toEqual({ depth: 5, height: 6, length: 10 })
    expect(geometry.water.surfaceY).toBeLessThan(geometry.size.height / 2)
    expect(geometry.fishBounds.x).toBeLessThan(geometry.size.length / 2)
    expect(geometry.camera.minDistance).toBeLessThan(geometry.camera.maxDistance)
  })

  it('gives a larger preset more room and a farther camera range', () => {
    const standard = getTankGeometry(getTankPreset('standard'))
    const large = getTankGeometry(getTankPreset('large'))

    expect(large.size.length).toBeGreaterThan(standard.size.length)
    expect(large.size.depth).toBeGreaterThan(standard.size.depth)
    expect(large.camera.maxDistance).toBeGreaterThan(standard.camera.maxDistance)
  })
})
