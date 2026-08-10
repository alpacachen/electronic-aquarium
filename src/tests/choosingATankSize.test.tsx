import { beforeEach, describe, expect, it } from 'vitest'
import { openAquarium } from './aquariumPage'
import type { AquariumPage } from './aquariumPage'

describe('挑选鱼缸尺寸', () => {
  let aquarium: AquariumPage

  beforeEach(async () => {
    // Given 观众打开了电子鱼缸
    aquarium = await openAquarium()
  })

  it('列出常见的几种缸，并写清尺寸', () => {
    // When 观众展开尺寸下拉框
    const offered = aquarium.offeredTankSizes()

    // Then 从迷你到加大依次排开，每一项都带着长宽高
    expect(offered).toEqual([
      '迷你缸 · 30 × 20 × 20 cm',
      '小型缸 · 45 × 30 × 30 cm',
      '标准缸 · 60 × 30 × 36 cm',
      '大型缸 · 90 × 45 × 45 cm',
      '加大型 · 120 × 50 × 50 cm',
    ])
  })

  it('一开始摆的是标准缸', async () => {
    // When 观众还没有做任何选择
    // Then 下拉框停在标准缸，旁边写着它的容量
    await expect.element(aquarium.sizePicker()).toHaveValue('standard')
    await expect.element(aquarium.capacity()).toHaveTextContent('约 64.8 L')
  })

  it('换成更大的缸，水体也跟着变大', async () => {
    // Given 观众记住了标准缸的样子
    const standard = aquarium.tank()

    // When 观众换成加大型
    await aquarium.chooseTankSize('加大型')

    // Then 缸的三个方向都变大了，容量也随之更新
    const extraLarge = aquarium.tank()
    expect(extraLarge.length).toBeGreaterThan(standard.length)
    expect(extraLarge.depth).toBeGreaterThan(standard.depth)
    expect(extraLarge.height).toBeGreaterThan(standard.height)
    await expect.element(aquarium.capacity()).toHaveTextContent('约 300 L')
  })

  it('换成迷你缸，水体也跟着变小', async () => {
    // Given 观众记住了标准缸的样子
    const standard = aquarium.tank()

    // When 观众换成迷你缸
    await aquarium.chooseTankSize('迷你缸')

    // Then 缸小了一圈，容量也小了
    const nano = aquarium.tank()
    expect(nano.length).toBeLessThan(standard.length)
    expect(nano.depth).toBeLessThan(standard.depth)
    expect(nano.height).toBeLessThan(standard.height)
    await expect.element(aquarium.capacity()).toHaveTextContent('约 12 L')
  })

  /**
   * 换到装得下的缸，鱼群应当原封不动地跟过去。换到更小的缸会因为容量而捞走几条，
   * 那是鱼市那边的规则，由 stockingTheTank 覆盖。
   */
  it('换到更大的缸，鱼群还在，个头也跟着变大', async () => {
    // Given 标准缸里的鱼群和它们的大小
    const inStandard = aquarium.fish()

    // When 观众换成大型缸
    await aquarium.chooseTankSize('大型缸')

    // Then 鱼一条都没少，鱼种也还是那些，只是变大了以配得上新缸
    const inLarge = aquarium.fish()
    expect(inLarge).toHaveLength(inStandard.length)
    expect(new Set(inLarge.map(({ species }) => species))).toEqual(
      new Set(inStandard.map(({ species }) => species)),
    )
    expect(inLarge[0]!.scale).toBeGreaterThan(inStandard[0]!.scale)
  })

  it('换成小缸时，鱼跟着缩小', async () => {
    // Given 标准缸里第一条鱼的大小
    const inStandard = aquarium.fish()[0]!.scale

    // When 观众换成迷你缸
    await aquarium.chooseTankSize('迷你缸')

    // Then 留下来的鱼变小了，以配得上这只更小的缸
    expect(aquarium.fish()[0]!.scale).toBeLessThan(inStandard)
  })

  it('换缸之后鱼继续在新的水体里游', async () => {
    // Given 观众换到了大型缸
    await aquarium.chooseTankSize('大型缸')
    const before = aquarium.fish().map(({ position }) => position)

    // When 过去两秒
    aquarium.letTimePass(2)

    // Then 鱼群照旧游动
    aquarium.fish().forEach(({ position }, index) => {
      expect(position).not.toEqual(before[index])
    })
  })

  it('换缸之后鱼被新玻璃拦住', async () => {
    // Given 观众换成了迷你缸
    await aquarium.chooseTankSize('迷你缸')
    const nano = aquarium.tank()

    // When 观众在小缸前看了半分钟
    for (let second = 0; second < 30; second += 1) {
      aquarium.letTimePass(1)

      // Then 鱼始终待在这只更小的缸里
      aquarium.fish().forEach(({ position }) => {
        expect(Math.abs(position.x)).toBeLessThan(nano.length / 2)
        expect(Math.abs(position.y)).toBeLessThan(nano.height / 2)
        expect(Math.abs(position.z)).toBeLessThan(nano.depth / 2)
      })
    }
  })

  it('换到大缸时把镜头一起拉远', async () => {
    // Given 标准缸前的取景距离
    const standard = aquarium.camera().distance

    // When 观众换成加大型
    await aquarium.chooseTankSize('加大型')

    // Then 镜头退得更远，好把整只缸收进画面
    expect(aquarium.camera().distance).toBeGreaterThan(standard)
  })
})
