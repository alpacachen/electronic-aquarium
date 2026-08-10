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
})
