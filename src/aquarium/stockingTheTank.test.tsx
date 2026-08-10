import { beforeEach, describe, expect, it } from 'vitest'
import { openAquarium } from '../testing/aquariumPage'
import type { AquariumPage } from '../testing/aquariumPage'

describe('逛鱼市', () => {
  let aquarium: AquariumPage

  beforeEach(async () => {
    // Given 观众打开了电子鱼缸
    aquarium = await openAquarium()
  })

  it('把可以养的鱼都摆出来', () => {
    // When 观众看向鱼市
    // Then 五种鱼都在架上，各自写着名字
    expect(aquarium.market().offered()).toEqual([
      '尖吻鲈',
      '蓝刀鲷',
      '小丑鱼',
      '金鱼',
      '金枪鱼',
    ])
  })

  it('写清缸里现在有几条、还能养几条', () => {
    // When 观众看向鱼市底下那行字
    // Then 它写着标准缸里的现状和上限
    expect(aquarium.market().tally()).toBe('缸里 6 条 · 上限 8 条')
  })

  it('挑一条鱼，它就出现在缸里', async () => {
    // Given 缸里此刻的鱼
    const before = aquarium.fish()
    const clownfish = before.filter(({ species }) => species === 'clownfish').length

    // When 观众又要了一条小丑鱼
    await aquarium.market().buy('小丑鱼')
    aquarium.letTimePass(0.5)

    // Then 缸里多了一条小丑鱼，别的鱼种没受影响
    const after = aquarium.fish()
    expect(after).toHaveLength(before.length + 1)
    expect(after.filter(({ species }) => species === 'clownfish')).toHaveLength(clownfish + 1)
    expect(aquarium.market().tally()).toBe('缸里 7 条 · 上限 8 条')
  })

  it('把鱼捞走，它就从缸里消失', async () => {
    // Given 缸里此刻的金鱼
    const before = aquarium.fish()
    const goldfish = before.filter(({ species }) => species === 'goldfish').length

    // When 观众捞走一条金鱼
    await aquarium.market().sell('金鱼')
    aquarium.letTimePass(0.5)

    // Then 缸里少了一条金鱼
    const after = aquarium.fish()
    expect(after).toHaveLength(before.length - 1)
    expect(after.filter(({ species }) => species === 'goldfish')).toHaveLength(goldfish - 1)
  })

  it('新来的鱼也会游，也会上下换深度', async () => {
    // Given 观众添了一条金枪鱼
    await aquarium.market().buy('金枪鱼')
    aquarium.letTimePass(1)
    const before = aquarium.fish()

    // When 过去十秒
    const seen = before.map(({ position }) => ({ maxY: position.y, minY: position.y }))
    for (let second = 0; second < 10; second += 1) {
      aquarium.letTimePass(1)
      aquarium.fish().forEach(({ position }, index) => {
        seen[index]!.maxY = Math.max(seen[index]!.maxY, position.y)
        seen[index]!.minY = Math.min(seen[index]!.minY, position.y)
      })
    }

    // Then 每条鱼都换过位置，也换过深度
    aquarium.fish().forEach(({ position }, index) => {
      expect(position).not.toEqual(before[index]!.position)
    })
    expect(Math.max(...seen.map(({ maxY, minY }) => maxY - minY))).toBeGreaterThan(0.1)
  })

  it('养满了就不让再往里加', async () => {
    // Given 标准缸上限 8 条，缸里已经有 6 条
    await aquarium.market().buy('小丑鱼')
    await aquarium.market().buy('小丑鱼')

    // When 缸已经满了
    // Then 加号按不动了，那行字也说明养满了
    expect(aquarium.market().tally()).toBe('缸里 8 条 · 上限 8 条 · 已养满')
    expect(aquarium.market().canBuy('小丑鱼')).toBe(false)
    expect(aquarium.market().canBuy('金鱼')).toBe(false)

    // 但还可以往外捞
    expect(aquarium.market().canSell('小丑鱼')).toBe(true)
  })

  it('捞光一个鱼种之后就不让再捞', async () => {
    // Given 缸里只有一条尖吻鲈，此刻还能捞
    expect(aquarium.market().canSell('尖吻鲈')).toBe(true)

    // When 观众把它捞走
    await aquarium.market().sell('尖吻鲈')

    // Then 缸里再没有尖吻鲈，减号也按不动了，但还能重新养一条
    expect(aquarium.fish().filter(({ species }) => species === 'barramundi')).toHaveLength(0)
    expect(aquarium.market().canSell('尖吻鲈')).toBe(false)
    expect(aquarium.market().canBuy('尖吻鲈')).toBe(true)
  })

  it('换成小缸时，上限跟着变小，多出来的鱼被捞走', async () => {
    // Given 标准缸里养着 6 条
    expect(aquarium.fish()).toHaveLength(6)

    // When 观众换成迷你缸
    await aquarium.chooseTankSize('迷你缸')

    // Then 上限降到 3 条，缸里的鱼也减到 3 条
    expect(aquarium.market().tally()).toBe('缸里 3 条 · 上限 3 条 · 已养满')
    expect(aquarium.fish()).toHaveLength(3)
  })

  it('换成大缸之后能养更多', async () => {
    // When 观众换成加大型
    await aquarium.chooseTankSize('加大型')

    // Then 上限提高了，还能继续往里加
    expect(aquarium.market().tally()).toBe('缸里 6 条 · 上限 12 条')
    expect(aquarium.market().canBuy('金鱼')).toBe(true)

    await aquarium.market().buy('金鱼')
    expect(aquarium.fish()).toHaveLength(7)
  })

  it('捞到空缸也不出错', async () => {
    // When 观众把缸里的鱼一条条全捞走
    for (const label of ['尖吻鲈', '蓝刀鲷', '小丑鱼', '金鱼', '金鱼', '金枪鱼']) {
      await aquarium.market().sell(label)
    }
    aquarium.letTimePass(1)

    // Then 缸空了，水和玻璃还在，页面没有崩
    expect(aquarium.fish()).toEqual([])
    expect(aquarium.market().tally()).toBe('缸里 0 条 · 上限 8 条')
    expect(aquarium.tank().length).toBeGreaterThan(0)
  })
})
