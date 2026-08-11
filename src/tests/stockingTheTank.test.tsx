import { beforeEach, describe, expect, it } from 'vitest'
import { openAquarium } from './aquariumPage'
import type { AquariumPage } from './aquariumPage'

describe('逛鱼市', () => {
  let aquarium: AquariumPage

  beforeEach(async () => {
    // Given 观众打开了电子鱼缸
    aquarium = await openAquarium()
  })

  it('把可以养的鱼都摆出来，写清缸里现在有几条、还能养几条', () => {
    // When 观众看向鱼市
    // Then 鱼市把现有鱼种都摆出来，各自写着名字
    expect(aquarium.market().offered()).toEqual([
      '尖吻鲈',
      '蓝刀鲷',
      '装甲鲶鱼',
      '鹦嘴鱼',
      '斗鱼',
      '天竺鲷',
      '小丑鱼',
      '脂鲤',
      '金鱼',
      '麒麟鱼',
      '金枪鱼',
    ])

    // 底下那行字写着标准缸里的现状和上限
    expect(aquarium.market().tally()).toBe('缸里 6 条 · 上限 8 条')
  })

  /**
   * 增减鱼会让缸里其余的鱼跟着重新渲染一次。这条用例除了盯增减本身，还盯着那一下
   * 之后老住户的样子：还在原地游、身子也还在动——曾经它们会凭空跳到别处，或者僵在
   * 水里被水推着走。
   */
  it('挑一条鱼加进缸里，再捞走一条，老住户不受影响、不跳不僵', async () => {
    // Given 缸里此刻的鱼，让它们先游开
    aquarium.letTimePass(1)
    const before = aquarium.fish()
    const clownfish = before.filter(({ species }) => species === 'clownfish').length

    // When 观众又要了一条小丑鱼
    await aquarium.market().buy('小丑鱼')
    aquarium.letTimePass(0.5)

    // Then 缸里多了一条小丑鱼，别的鱼种没受影响
    const afterBuy = aquarium.fish()
    expect(afterBuy).toHaveLength(before.length + 1)
    expect(afterBuy.filter(({ species }) => species === 'clownfish')).toHaveLength(clownfish + 1)
    expect(aquarium.market().tally()).toBe('缸里 7 条 · 上限 8 条')

    // Given 记下此刻每条鱼在哪、身子摆到了哪
    const beforeSell = afterBuy.map(({ position, species }) => ({ position, species }))

    // When 观众捞走一条金鱼
    const goldfish = afterBuy.filter(({ species }) => species === 'goldfish').length
    await aquarium.market().sell('金鱼')
    aquarium.letTimePass(0.5)

    // Then 缸里少了一条金鱼
    const afterSell = aquarium.fish()
    expect(afterSell).toHaveLength(afterBuy.length - 1)
    expect(afterSell.filter(({ species }) => species === 'goldfish')).toHaveLength(goldfish - 1)

    /**
     * 剩下的鱼都还在原来那一带，没有被换成另一条鱼。捞的是那个鱼种里排在最后的
     * 一条，所以拿掉它之后，其余的鱼应当原样按序留下。
     */
    const lastGoldfish = beforeSell.reduce(
      (last, { species }, index) => (species === 'goldfish' ? index : last),
      -1,
    )
    const kept = beforeSell.filter((_, index) => index !== lastGoldfish)
    expect(afterSell).toHaveLength(kept.length)
    afterSell.forEach(({ position, species }, index) => {
      const was = kept[index]!
      expect(species).toBe(was.species)
      const jumped = Math.hypot(
        position.x - was.position.x,
        position.y - was.position.y,
        position.z - was.position.z,
      )
      expect(jumped, `${species} 跳了 ${jumped.toFixed(3)}`).toBeLessThan(0.5)
    })

    /**
     * 而且每条鱼都还在换姿态，没有僵在水里。自带动画的鱼看播放时间；barramundi 是
     * 程序化摆尾，看尾巴的相位。不把两者用「或」并起来判断：没有 species.tail 的
     * 鱼种，tailAngle 会退回读朝向，那个值光靠转弯就会变，僵住的鱼也能混过去。
     */
    const beforeMoving = afterSell.map(({ animationTime, tailAngle }) => ({
      animationTime,
      tailAngle,
    }))
    aquarium.letTimePass(0.3)

    aquarium.fish().forEach(({ animationTime, species, tailAngle }, index) => {
      const was = beforeMoving[index]!
      if (species === 'barramundi') {
        expect(tailAngle, `${species} 的尾巴僵住了`).not.toBe(was.tailAngle)
        return
      }
      expect(animationTime, `${species} 的动画僵住了`).not.toBe(was.animationTime)
    })
  })

  it('新来的鱼，不管是特殊体型还是普通体型，都会游、会换深度、会播放动画', async () => {
    // Given 观众添了一条金枪鱼和一条天竺鲷
    await aquarium.market().buy('金枪鱼')
    await aquarium.market().buy('天竺鲷')
    aquarium.letTimePass(1)
    const before = aquarium.fish()

    // When 过去十秒
    const seen = before.map(({ position }) => ({ maxY: position.y, minY: position.y }))
    for (let second = 0; second < 10; second += 1) {
      aquarium.letTimePass(1, false)
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

    // 而且普通体型的天竺鲷也在播放游泳动画
    const cardinalFish = aquarium.fish().find(({ species }) => species === 'cardinalFish')
    expect(cardinalFish).toBeDefined()
    expect(cardinalFish!.animationTime).toBeGreaterThan(0)
  })

  it('养满了就不让再往里加，捞光一个鱼种之后就不让再捞那种', async () => {
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
    expect(aquarium.market().canSell('尖吻鲈')).toBe(true)

    // When 观众把缸里唯一的尖吻鲈捞走
    await aquarium.market().sell('尖吻鲈')

    // Then 缸里再没有尖吻鲈，减号也按不动了，但还能重新养一条
    expect(aquarium.fish().filter(({ species }) => species === 'barramundi')).toHaveLength(0)
    expect(aquarium.market().canSell('尖吻鲈')).toBe(false)
    expect(aquarium.market().canBuy('尖吻鲈')).toBe(true)
  })

  /**
   * 同一个鱼种的几条鱼要各有各的性子。这条原来是拿 stockFish 直接比字段的，
   * 改成从缸里看：养一群同种鱼，它们不该像一支队伍那样一起上浮一起下潜。
   */
  it('同一个鱼种的几条鱼，不会齐步升降', async () => {
    // Given 观众把缸里换成清一色的小丑鱼
    for (const label of ['尖吻鲈', '蓝刀鲷', '金鱼', '金鱼', '金枪鱼']) {
      await aquarium.market().sell(label)
    }
    for (let more = 0; more < 5; more += 1) {
      await aquarium.market().buy('小丑鱼')
    }
    aquarium.letTimePass(2)

    /**
     * When 记下这一群鱼半分钟里的升降
     *
     * 看的是「有没有齐步走」：同种鱼若共用一套巡游参数，就会一起上浮、一起下潜，
     * 哪怕出发点不同也是同一个节奏。所以逐秒比较它们的升降方向，而不是比某一刻
     * 的深度差——后者光靠出发点不同就能凑出来，抹掉个体差异也照样通过。
     */
    const school = aquarium.fish()
    expect(school).toHaveLength(6)

    const trail: number[][] = [school.map(({ position }) => position.y)]
    for (let second = 0; second < 30; second += 1) {
      aquarium.letTimePass(1, false)
      trail.push(aquarium.fish().map(({ position }) => position.y))
    }

    // Then 总有那么些时刻，有鱼在上浮、同时有鱼在下潜
    const mixed = trail.slice(1).filter((heights, index) => {
      const deltas = heights.map((y, fish) => y - trail[index]![fish]!)
      return deltas.some((delta) => delta > 0.01) && deltas.some((delta) => delta < -0.01)
    })
    expect(mixed.length).toBeGreaterThan(trail.length / 4)
  })

  /** 鱼种的快慢基调要能在缸里看出来：金枪鱼是最快的，尖吻鲈是最慢的。 */
  it('金枪鱼比尖吻鲈游得快', async () => {
    // Given 缸里各有一条金枪鱼和尖吻鲈
    aquarium.letTimePass(2)

    // When 看它们各自游过多少路
    const swum = new Map<string, number>()
    let previous = new Map(
      aquarium.fish().map(({ position, species }) => [species, position]),
    )
    for (let second = 0; second < 30; second += 1) {
      aquarium.letTimePass(1, false)
      aquarium.fish().forEach(({ position, species }) => {
        const was = previous.get(species)
        if (!was) return
        swum.set(
          species,
          (swum.get(species) ?? 0) + Math.hypot(position.x - was.x, position.z - was.z),
        )
      })
      previous = new Map(aquarium.fish().map(({ position, species }) => [species, position]))
    }

    // Then 金枪鱼走得更远
    expect(swum.get('tuna')!).toBeGreaterThan(swum.get('barramundi')!)
  })

  it('换缸时上限跟着变，小缸捞走多余的鱼、大缸能再养更多，捞到空缸也不出错', async () => {
    // Given 标准缸里养着 6 条
    expect(aquarium.fish()).toHaveLength(6)

    // When 观众换成迷你缸
    await aquarium.chooseTankSize('迷你缸')

    // Then 上限降到 3 条，缸里的鱼也减到 3 条
    expect(aquarium.market().tally()).toBe('缸里 3 条 · 上限 3 条 · 已养满')
    expect(aquarium.fish()).toHaveLength(3)
    await expect.element(aquarium.capacity()).toHaveTextContent('约 12 L')

    // When 观众又换成加大型
    await aquarium.chooseTankSize('加大型')

    // Then 上限提高了，缸里的鱼没有再变，还能继续往里加
    expect(aquarium.market().tally()).toBe('缸里 3 条 · 上限 12 条')
    expect(aquarium.market().canBuy('金鱼')).toBe(true)
    await aquarium.market().buy('金鱼')
    expect(aquarium.fish()).toHaveLength(4)

    // When 观众把缸里的鱼一条条全捞走
    for (const label of aquarium.market().offered()) {
      while (aquarium.market().canSell(label)) {
        await aquarium.market().sell(label)
      }
    }
    aquarium.letTimePass(1)

    // Then 缸空了，水和玻璃还在，页面没有崩
    expect(aquarium.fish()).toEqual([])
    expect(aquarium.market().tally()).toBe('缸里 0 条 · 上限 12 条')
    expect(aquarium.tank().length).toBeGreaterThan(0)
  })
})
