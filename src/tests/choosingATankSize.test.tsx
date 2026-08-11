import { beforeEach, describe, expect, it } from 'vitest'
import { openAquarium } from './aquariumPage'
import type { AquariumPage } from './aquariumPage'

describe('挑选鱼缸尺寸', () => {
  let aquarium: AquariumPage

  beforeEach(async () => {
    // Given 观众打开了电子鱼缸
    aquarium = await openAquarium()
  })

  it('列出常见的几种缸并写清尺寸，一开始摆的是标准缸', async () => {
    // When 观众展开尺寸下拉框
    const offered = await aquarium.offeredTankSizes()

    // Then 从迷你到加大依次排开，每一项都带着长宽高
    expect(offered).toEqual([
      '迷你缸 · 30 × 20 × 20 cm',
      '小型缸 · 45 × 30 × 30 cm',
      '标准缸 · 60 × 30 × 36 cm',
      '大型缸 · 90 × 45 × 45 cm',
      '加大型 · 120 × 50 × 50 cm',
    ])

    // 而且观众还没做任何选择时，下拉框停在标准缸，旁边写着它的容量
    expect(aquarium.chosenTankSize()).toBe('标准缸 · 60 × 30 × 36 cm')
    await expect.element(aquarium.capacity()).toHaveTextContent('约 64.8 L')
  })

  /**
   * 换到装得下的缸，鱼群应当原封不动地跟过去。换到更小的缸会因为容量而捞走几条，
   * 那是鱼市那边的规则，由 stockingTheTank 覆盖。
   */
  it('换成大缸时，水体、容量、镜头都跟着变大，鱼还在、变大、继续游、游速也跟着变快', async () => {
    // Given 观众记住了标准缸的样子、标准缸里的鱼群和它们的大小，以及取景距离
    const standard = aquarium.tank()
    const inStandard = aquarium.fish()
    const standardCameraDistance = aquarium.camera().distance

    // 也记下第一条鱼离开入场位置后一小段稳定的水平位移，作为标准缸的游速基准
    aquarium.letTimePass(2)
    const beforeStep = aquarium.fish()[0]!.position
    aquarium.letTimePass(0.05)
    const afterStep = aquarium.fish()[0]!.position
    const horizontalDistance = (from: typeof beforeStep, to: typeof beforeStep) =>
      Math.hypot(to.x - from.x, to.z - from.z)
    const standardSpeed = horizontalDistance(beforeStep, afterStep)

    // When 观众换成大型缸
    await aquarium.chooseTankSize('大型缸')

    // Then 缸的三个方向都变大了，容量也随之更新
    const large = aquarium.tank()
    expect(large.length).toBeGreaterThan(standard.length)
    expect(large.depth).toBeGreaterThan(standard.depth)
    expect(large.height).toBeGreaterThan(standard.height)
    await expect.element(aquarium.capacity()).toHaveTextContent('约 182.25 L')

    // 鱼一条都没少，鱼种也还是那些，只是变大了以配得上新缸
    const inLarge = aquarium.fish()
    expect(inLarge).toHaveLength(inStandard.length)
    expect(new Set(inLarge.map(({ species }) => species))).toEqual(
      new Set(inStandard.map(({ species }) => species)),
    )
    expect(inLarge[0]!.scale).toBeGreaterThan(inStandard[0]!.scale)

    // 而且鱼的水平游速按缸体比例放大了；阈值留在 1.15，实测约 1.25 倍，仍能抓住
    // 速度状态没有迁移，却给边界转向留一点余量
    const largeBeforeStep = aquarium.fish()[0]!.position
    aquarium.letTimePass(0.05)
    const largeAfterStep = aquarium.fish()[0]!.position
    const largeSpeed = horizontalDistance(largeBeforeStep, largeAfterStep)
    expect(
      largeSpeed / standardSpeed,
      `标准 ${standardSpeed}，大型 ${largeSpeed}`,
    ).toBeGreaterThan(1.15)

    // 过去两秒，鱼群照旧游动，没有停在换缸那一刻
    const beforeSwim = aquarium.fish().map(({ position }) => position)
    aquarium.letTimePass(2)
    aquarium.fish().forEach(({ position }, index) => {
      expect(position).not.toEqual(beforeSwim[index])
    })

    // 镜头也退得更远了，好把整只缸收进画面
    expect(aquarium.camera().distance).toBeGreaterThan(standardCameraDistance)
  })

  it('换成小缸时，水体和容量都跟着变小，鱼跟着缩小，且被新玻璃拦住', async () => {
    // Given 标准缸的样子，以及第一条鱼的大小
    const standard = aquarium.tank()
    const inStandard = aquarium.fish()[0]!.scale

    // When 观众换成迷你缸
    await aquarium.chooseTankSize('迷你缸')

    // Then 缸小了一圈，容量也小了
    const nano = aquarium.tank()
    expect(nano.length).toBeLessThan(standard.length)
    expect(nano.depth).toBeLessThan(standard.depth)
    expect(nano.height).toBeLessThan(standard.height)
    await expect.element(aquarium.capacity()).toHaveTextContent('约 12 L')

    // 鱼跟着缩小，以配得上这只更小的缸
    expect(aquarium.fish()[0]!.scale).toBeLessThan(inStandard)

    // When 观众在小缸前看了半分钟
    for (let second = 0; second < 30; second += 1) {
      aquarium.letTimePass(1, false)

      // Then 鱼始终待在这只更小的缸里，被新玻璃拦住
      aquarium.fish().forEach(({ position }) => {
        expect(Math.abs(position.x)).toBeLessThan(nano.length / 2)
        expect(Math.abs(position.y)).toBeLessThan(nano.height / 2)
        expect(Math.abs(position.z)).toBeLessThan(nano.depth / 2)
      })
    }
  })
})
