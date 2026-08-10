import { describe, expect, it } from 'vitest'
import { FISH_SPECIES } from './fishSpecies'
import type { FishSpeciesId } from './fishSpecies'
import { stockFish, stockTank, stockingCapacity } from './stocking'

const SPECIES = Object.keys(FISH_SPECIES) as FishSpeciesId[]

describe('stockFish', () => {
  it('每次都给出同一条鱼，好让鱼缸可复现', () => {
    expect(stockFish('goldfish', 7)).toEqual(stockFish('goldfish', 7))
  })

  it('同种鱼的不同个体各有自己的深度、相位和步调', () => {
    // Given 同一个鱼种的一群鱼
    const school = Array.from({ length: 8 }, (_, seed) => stockFish('clownfish', seed))

    // Then 深度、相位、周期和游速都没有两条完全一样
    const distinct = (values: number[]) => new Set(values).size
    expect(distinct(school.map(({ cruise }) => cruise.depth))).toBe(school.length)
    expect(distinct(school.map(({ cruise }) => cruise.phase))).toBe(school.length)
    expect(distinct(school.map(({ cruise }) => cruise.period))).toBe(school.length)
    expect(distinct(school.map(({ speed }) => speed))).toBe(school.length)
  })

  it('个体差异围着鱼种的基调，不会偏出常理', () => {
    for (const species of SPECIES) {
      const { temperament } = FISH_SPECIES[species]
      for (let seed = 0; seed < 24; seed += 1) {
        const fish = stockFish(species, seed)

        // 游速始终为正，且不偏离鱼种基准两成以上
        expect(fish.speed).toBeGreaterThan(0)
        expect(Math.abs(fish.speed / temperament.speed - 1)).toBeLessThanOrEqual(0.2)

        // 巡游深度留在水体之内，周期是正数
        expect(Math.abs(fish.cruise.depth)).toBeLessThanOrEqual(0.75)
        expect(fish.cruise.period).toBeGreaterThan(0)
        expect(fish.cruise.surgePeriod).toBeGreaterThan(0)

        // 起落幅度不会大到让鱼倒着游
        expect(fish.cruise.surge).toBeLessThan(1)
      }
    }
  })

  it('让鱼种的快慢基调传下去：金枪鱼比石斑快', () => {
    const tuna = stockFish('tuna', 0)
    const barramundi = stockFish('barramundi', 0)

    expect(tuna.speed).toBeGreaterThan(barramundi.speed)
    expect(tuna.cruise.depth).toBeGreaterThan(barramundi.cruise.depth)
  })
})

describe('stockingCapacity', () => {
  it('缸越大能养越多', () => {
    expect(stockingCapacity(64.8)).toBeGreaterThan(stockingCapacity(12))
    expect(stockingCapacity(182.25)).toBeGreaterThan(stockingCapacity(64.8))
  })

  it('再小的缸也能养几条', () => {
    expect(stockingCapacity(12)).toBe(3)
    expect(stockingCapacity(0)).toBe(3)
  })

  it('再大的缸也有个头，别把渲染压垮', () => {
    expect(stockingCapacity(300)).toBe(12)
    expect(stockingCapacity(100000)).toBe(12)
  })
})

describe('stockTank', () => {
  it('按数量把鱼放进缸里', () => {
    const fish = stockTank({ clownfish: 2, goldfish: 1, tuna: 1 })

    expect(fish).toHaveLength(4)
    expect(fish.filter(({ species }) => species === 'clownfish')).toHaveLength(2)
    expect(new Set(fish.map(({ id }) => id)).size).toBe(4)
  })

  it('缸里没有两条鱼的起伏是同步的', () => {
    // Given 每种鱼两条
    const fish = stockTank(
      Object.fromEntries(SPECIES.map((species) => [species, 2])),
    )

    // Then 相位两两不同，所有鱼不会一起上浮一起下潜
    const phases = fish.map(({ cruise }) => cruise.phase)
    expect(new Set(phases).size).toBe(fish.length)
  })

  it('没点鱼就是空缸', () => {
    expect(stockTank({})).toEqual([])
  })

  /**
   * 捞走一条鱼，不能连带把别的鱼换成另一条。以前的编号是按整缸顺序发的，捞掉前面
   * 一条会让后面每条鱼的 id 和性子都平移一位；界面上认 id，于是那些鱼被卸掉重建，
   * 表现就是它们凭空跳到别处、还停了动画。
   */
  it('捞走一条鱼，剩下的鱼还是原来那几条', () => {
    // Given 缸里每种鱼都养着，金鱼两条
    const before = stockTank({ barramundi: 1, blueTang: 1, clownfish: 1, goldfish: 2, tuna: 1 })

    // When 捞走排在最前面的那条尖吻鲈
    const after = stockTank({ blueTang: 1, clownfish: 1, goldfish: 2, tuna: 1 })

    // Then 剩下的鱼一条都没变——连 id 带性子，整条都还是原来那条
    const kept = before.filter(({ species }) => species !== 'barramundi')
    expect(after).toEqual(kept)
  })

  it('添一条鱼，也不会顺手换掉别的鱼', () => {
    // Given 缸里一条小丑鱼、两条金鱼
    const before = stockTank({ clownfish: 1, goldfish: 2 })

    // When 又添一条小丑鱼
    const after = stockTank({ clownfish: 2, goldfish: 2 })

    // Then 金鱼还是原来那两条，只是多了一条新的小丑鱼
    expect(after).toHaveLength(before.length + 1)
    expect(after.filter(({ species }) => species === 'goldfish')).toEqual(
      before.filter(({ species }) => species === 'goldfish'),
    )
  })

  it('增减之间来回折腾，老住户始终是同一条', () => {
    // Given 一开始的缸
    const start = stockTank({ clownfish: 1, goldfish: 2 })

    // When 添一条小丑鱼、捞掉一条金鱼，再各自还原
    stockTank({ clownfish: 2, goldfish: 2 })
    stockTank({ clownfish: 2, goldfish: 1 })
    const back = stockTank({ clownfish: 1, goldfish: 2 })

    // Then 折腾一圈回到原样，鱼还是那几条鱼
    expect(back).toEqual(start)
  })

  /** 不同鱼种之间的编号不能撞上，否则两条鱼会长成一模一样。 */
  it('鱼种之间的编号互不打扰', () => {
    const fish = stockTank(Object.fromEntries(SPECIES.map((species) => [species, 2])))

    expect(new Set(fish.map(({ id }) => id)).size).toBe(fish.length)
    expect(new Set(fish.map(({ cruise }) => cruise.phase)).size).toBe(fish.length)
  })
})
