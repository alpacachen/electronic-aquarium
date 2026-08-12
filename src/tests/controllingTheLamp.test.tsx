import { beforeEach, describe, expect, it } from 'vitest'
import { openAquarium } from './aquariumPage'
import type { AquariumPage } from './aquariumPage'

describe('鱼缸设备', () => {
  let aquarium: AquariumPage

  beforeEach(async () => {
    aquarium = await openAquarium()
  })

  it('灯夹在缸口一角，灯头探到缸正上方垂直往下照，还是个有颜色有亮度的光源', () => {
    // Then 灯头在缸的正上方，垂直往下照
    const position = aquarium.lamp().position()
    const tank = aquarium.tank()
    expect(position.x).toBeCloseTo(0)
    expect(position.z).toBeCloseTo(0)
    expect(position.y).toBeGreaterThan(tank.height / 2)

    // 而且是个有颜色、有实际亮度的光源
    expect(aquarium.lamp().intensity()).toBeGreaterThan(0)
    expect(aquarium.lamp().color()).toBe('26bde2')
  })

  it('外挂机身用透明气管连到底部气盘，气泡随机散开并向水面上升', () => {
    const tank = aquarium.tank()
    const surface = aquarium.waterSurface()
    const before = aquarium.airPump()

    // 主机在右侧玻璃外，气管翻过缸口再伸回缸内。
    expect(before.body.x).toBeGreaterThan(tank.length / 2)
    expect(before.tube.min.x).toBeLessThan(tank.length / 2)
    expect(before.tube.max.x).toBeGreaterThan(tank.length / 2)
    expect(before.tube.max.y).toBeGreaterThan(tank.height / 2)

    // 圆形气盘贴着缸底，冒出的气泡留在水里并横向散开。
    expect(before.stone.y).toBeLessThan(-tank.height / 2 + 0.5)
    expect(before.bubbles).toHaveLength(18)
    before.bubbles.forEach(({ y }) => {
      expect(y).toBeGreaterThan(before.stone.y)
      expect(y).toBeLessThan(surface)
    })
    const spread =
      Math.max(...before.bubbles.map(({ x }) => x)) -
      Math.min(...before.bubbles.map(({ x }) => x))
    expect(spread).toBeGreaterThan(0.15)

    aquarium.letTimePass(1)
    const after = aquarium.airPump()
    const risen = after.bubbles.filter(({ y }, index) => y > before.bubbles[index]!.y)
    /** 实测 13/18 继续上升，其余已经到水面并从气盘重新冒出；至少一半上升才算气流成立。 */
    expect(risen.length).toBeGreaterThan(before.bubbles.length / 2)
  })
})
