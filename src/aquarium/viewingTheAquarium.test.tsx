import { beforeEach, describe, expect, it } from 'vitest'
import { openAquarium } from '../testing/aquariumPage'
import type { AquariumPage } from '../testing/aquariumPage'

describe('观赏鱼缸', () => {
  let aquarium: AquariumPage

  beforeEach(async () => {
    // Given 观众打开了电子鱼缸
    aquarium = await openAquarium()
  })

  it('用标题和一句介绍迎接观众', async () => {
    // When 页面呈现在观众眼前
    // Then 观众读到鱼缸的名字和它的承诺
    await expect.element(aquarium.heading()).toHaveTextContent('电子鱼缸')
    await expect.element(aquarium.text('一片不需要照料的水下世界')).toBeVisible()
  })

  it('在水里养了一群朝向各异的鱼', () => {
    // When 鱼群开始游动
    aquarium.letTimePass(0.1)
    const fish = aquarium.fish()

    // Then 缸里有四条鱼，没有两条朝着同一个方向
    expect(fish).toHaveLength(4)
    expect(new Set(fish.map(({ headingY }) => headingY)).size).toBe(4)
  })

  it('让每条鱼都游起来', () => {
    // Given 记下此刻每条鱼待的地方
    const before = aquarium.fish().map(({ position }) => position)

    // When 过去两秒
    aquarium.letTimePass(2)

    // Then 每条鱼都换了位置
    aquarium.fish().forEach(({ position }, index) => {
      expect(position).not.toEqual(before[index])
    })
  })

  it('让鱼一边游一边摆尾', () => {
    // Given 记下第一条鱼尾巴的角度
    const before = aquarium.fish()[0]!.tailAngle

    // When 过去一小会儿
    aquarium.letTimePass(0.2)

    // Then 尾巴摆到了别的角度
    expect(aquarium.fish()[0]!.tailAngle).not.toBe(before)
  })

  it('不让任何一条鱼游出玻璃', () => {
    // Given 玻璃缸的尺寸就是水体的边界
    const tank = aquarium.tank()
    const waterSurface = aquarium.waterSurface()

    // When 观众看了整整一分钟
    for (let second = 0; second < 60; second += 1) {
      aquarium.letTimePass(1)

      // Then 这一分钟里的每一秒，所有鱼都还在缸内
      aquarium.fish().forEach(({ position, topY }) => {
        expect(Math.abs(position.x)).toBeLessThan(tank.length / 2)
        expect(Math.abs(position.y)).toBeLessThan(tank.height / 2)
        expect(Math.abs(position.z)).toBeLessThan(tank.depth / 2)
        expect(topY).toBeLessThanOrEqual(waterSurface)
      })
    }
  })

  it('让游到玻璃前的鱼转身回到水中央', () => {
    // Given 记录每条鱼一路上的朝向
    const trail: number[][] = [aquarium.fish().map(({ headingY }) => headingY)]

    // When 观众看了半分钟
    for (let second = 0; second < 30; second += 1) {
      aquarium.letTimePass(1)
      trail.push(aquarium.fish().map(({ headingY }) => headingY))
    }

    // Then 有鱼在撞上玻璃时猛地调头，而不是停在原地或穿出去
    const turnedSharply = trail
      .slice(1)
      .some((headings, index) =>
        headings.some((heading, fish) => Math.abs(heading - trail[index]![fish]!) > 1.5),
      )
    expect(turnedSharply).toBe(true)
  })

  it('让鱼群游遍整个缸，而不是挤在一角', () => {
    // Given 从鱼群此刻的位置开始记录它们到过的范围
    const seen = aquarium.fish().map(({ position }) => ({
      maxX: position.x,
      minX: position.x,
    }))

    // When 观众看了一分钟
    for (let second = 0; second < 60; second += 1) {
      aquarium.letTimePass(1)
      aquarium.fish().forEach(({ position }, index) => {
        seen[index]!.maxX = Math.max(seen[index]!.maxX, position.x)
        seen[index]!.minX = Math.min(seen[index]!.minX, position.x)
      })
    }

    // Then 至少有一条鱼横向游过了缸长的一半
    const tank = aquarium.tank()
    const widest = Math.max(...seen.map(({ maxX, minX }) => maxX - minX))
    expect(widest).toBeGreaterThan(tank.length / 2)
  })
})
