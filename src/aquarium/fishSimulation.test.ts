import { describe, expect, it } from 'vitest'
import { createFish, cruiseTargetY, stepFish, surgeSpeed } from './fishSimulation'
import type { FishCruise, FishSeed } from './fishSimulation'

const bounds = { x: 4.35, y: 2, z: 1.95 }

/** A fish that holds its depth, so tests can isolate one behaviour at a time. */
const level: FishCruise = {
  depth: 0,
  period: 20,
  phase: 0,
  range: 0,
  surge: 0,
  surgePeriod: 9,
}

const seed = (overrides: Partial<FishSeed> = {}): FishSeed => ({
  cruise: level,
  heading: 0,
  position: { x: 0, y: 0, z: 0 },
  speed: 1,
  turnRate: 0,
  ...overrides,
})

const angleBetween = (left: number, right: number) =>
  Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)))

describe('stepFish', () => {
  it('moves a fish according to its heading and speed', () => {
    const fish = createFish(seed({ speed: 2 }))

    expect(stepFish(fish, 0.5, bounds).position).toEqual({ x: 1, y: 0, z: 0 })
  })

  it('does not mutate the input state', () => {
    const fish = createFish(seed({
      heading: 0.6,
      position: { x: 1, y: -0.5, z: 0.25 },
      turnRate: 0.2,
    }))

    const original = structuredClone(fish)
    stepFish(fish, 0.5, bounds)

    expect(fish).toEqual(original)
  })

  it('treats a negative time step as no time passing', () => {
    const fish = createFish(seed({
      heading: 0.6,
      position: { x: 1, y: -0.5, z: 0.25 },
      turnRate: 0.2,
    }))

    expect(stepFish(fish, -1, bounds)).toEqual(fish)
  })

  it('turns toward the tank before reaching a wall without snapping around', () => {
    let fish = createFish(seed({ position: { x: 3.4, y: 0, z: 0.4 }, speed: 1.4 }))

    const first = stepFish(fish, 1 / 60, bounds)

    expect(first.position.x).toBeGreaterThan(fish.position.x)
    expect(angleBetween(first.heading, fish.heading)).toBeGreaterThan(0)
    expect(angleBetween(first.heading, fish.heading)).toBeLessThan(0.15)

    for (let frame = 0; frame < 300; frame += 1) {
      const next = stepFish(fish, 1 / 60, bounds)
      expect(angleBetween(next.heading, fish.heading)).toBeLessThan(0.15)
      fish = next
    }

    expect(Math.abs(fish.position.x)).toBeLessThanOrEqual(bounds.x)
    expect(Math.abs(fish.position.z)).toBeLessThanOrEqual(bounds.z)
  })

  it('keeps a wandering fish inside the water over many frames', () => {
    let fish = createFish(seed({
      cruise: { ...level, period: 7, range: 5 },
      heading: 0.4,
      position: { x: -3, y: 1, z: -1 },
      speed: 1.4,
      turnRate: 0.8,
    }))

    for (let frame = 0; frame < 240; frame += 1) {
      fish = stepFish(fish, 1 / 60, bounds)
      expect(Math.abs(fish.position.x)).toBeLessThanOrEqual(bounds.x)
      expect(Math.abs(fish.position.y)).toBeLessThanOrEqual(bounds.y)
      expect(Math.abs(fish.position.z)).toBeLessThanOrEqual(bounds.z)
    }
  })
})

describe('巡游深度', () => {
  it('把鱼带向它自己的巡游深度，而不是停在原处', () => {
    // Given 一条被放在水体中线、但偏爱上层的鱼
    const cruise: FishCruise = { ...level, depth: 0.6, period: 12 }
    let fish = createFish(seed({ cruise }))

    // When 过去六秒
    for (let frame = 0; frame < 360; frame += 1) {
      fish = stepFish(fish, 1 / 60, bounds)
    }

    // Then 它上浮到了偏爱的那一层，并跟着这一层缓慢移动（渐进逼近会留下一点滞后）
    expect(fish.position.y).toBeGreaterThan(bounds.y * 0.4)
    const lag = Math.abs(fish.position.y - cruiseTargetY(cruise, fish.elapsed, bounds))
    expect(lag).toBeLessThan(bounds.y * 0.1)
  })

  it('让鱼绕着巡游深度上下往复，而不是贴着某一层不动', () => {
    // Given 一条上下活动范围很大的鱼
    const cruise: FishCruise = { ...level, period: 16, range: 0.7 }
    let fish = createFish(seed({ cruise }), bounds)

    // When 观察它走过两个完整周期
    const heights: number[] = []
    const targets: number[] = []
    for (let frame = 0; frame < 60 * 32; frame += 1) {
      fish = stepFish(fish, 1 / 60, bounds)
      heights.push(fish.position.y)
      targets.push(cruiseTargetY(cruise, fish.elapsed, bounds))
    }

    /**
     * 拿鱼实际走过的高度和目标本身走过的高度比。目标会被水体上下夹住，所以直接
     * 按 range 反推振幅会得到一个够不着的数；而渐进逼近又总会差一点，因此这里
     * 要求走到目标行程的八成。
     */
    const travelled = Math.max(...heights) - Math.min(...heights)
    const available = Math.max(...targets) - Math.min(...targets)
    expect(travelled).toBeGreaterThan(available * 0.8)
    expect(travelled).toBeGreaterThan(bounds.y)
  })

  it('即使配置越界，也不会把鱼带出水面', () => {
    // Given 一条深度和范围都被配得离谱的鱼
    const cruise: FishCruise = { ...level, depth: 3, period: 5, range: 4 }

    // Then 它要去的高度始终在水体之内
    for (let second = 0; second < 30; second += 0.1) {
      const target = cruiseTargetY(cruise, second, bounds)
      expect(Math.abs(target)).toBeLessThanOrEqual(bounds.y)
    }
  })

  it('不同相位的鱼不会同步升降', () => {
    // Given 两条只有相位不同的鱼
    const first = { ...level, period: 9, range: 0.6 }
    const second = { ...first, phase: Math.PI }

    // When 在同一时刻比较它们要去的高度
    const apart = Array.from({ length: 40 }, (_, tick) => {
      const at = tick * 0.25
      return Math.abs(cruiseTargetY(first, at, bounds) - cruiseTargetY(second, at, bounds))
    })

    // Then 至少在某些时刻，两条鱼相差了大半个水深
    expect(Math.max(...apart)).toBeGreaterThan(bounds.y)
  })
})

describe('俯仰姿态', () => {
  it('上浮时抬头，下潜时低头', () => {
    // Given 一条正在明显上浮的鱼
    let rising = createFish(seed({
      cruise: { ...level, depth: 1, period: 6 },
      position: { x: 0, y: -bounds.y * 0.8, z: 0 },
    }))
    for (let frame = 0; frame < 30; frame += 1) {
      rising = stepFish(rising, 1 / 60, bounds)
    }

    // Then 它抬着头
    expect(rising.verticalVelocity).toBeGreaterThan(0)
    expect(rising.pitch).toBeGreaterThan(0.05)

    // Given 一条正在明显下潜的鱼
    let diving = createFish(seed({
      cruise: { ...level, depth: -1, period: 6 },
      position: { x: 0, y: bounds.y * 0.8, z: 0 },
    }))
    for (let frame = 0; frame < 30; frame += 1) {
      diving = stepFish(diving, 1 / 60, bounds)
    }

    // Then 它低着头
    expect(diving.verticalVelocity).toBeLessThan(0)
    expect(diving.pitch).toBeLessThan(-0.05)
  })

  it('平游时保持水平', () => {
    // Given 一条守着自己深度的鱼，已经游了一会儿
    let fish = createFish(seed({ speed: 1.2 }))
    for (let frame = 0; frame < 300; frame += 1) {
      fish = stepFish(fish, 1 / 60, bounds)
    }

    // Then 它几乎不抬头也不低头
    expect(Math.abs(fish.pitch)).toBeLessThan(0.02)
  })

  it('再怎么陡也不会把鱼竖成一根针', () => {
    // Given 一条被要求瞬间冲到顶、却几乎不往前游的鱼
    let fish = createFish(seed({
      cruise: { ...level, depth: 1, period: 0.5 },
      position: { x: 0, y: -bounds.y, z: 0 },
      speed: 0.05,
    }))

    // When 它一路往上冲
    for (let frame = 0; frame < 120; frame += 1) {
      fish = stepFish(fish, 1 / 60, bounds)
      // Then 俯仰角始终留在可信的范围里
      expect(Math.abs(fish.pitch)).toBeLessThanOrEqual(0.5)
    }
  })

  it('让抬头低头是渐变的，不会一帧翻过去', () => {
    // Given 一条上下往复很急的鱼
    let fish = createFish(seed({ cruise: { ...level, period: 3, range: 1 }, speed: 0.6 }))

    // When 记录它每一帧的俯仰角
    let previous = fish.pitch
    for (let frame = 0; frame < 60 * 10; frame += 1) {
      fish = stepFish(fish, 1 / 60, bounds)
      // Then 相邻两帧之间的变化很小
      expect(Math.abs(fish.pitch - previous)).toBeLessThan(0.05)
      previous = fish.pitch
    }
  })
})

describe('游速起落', () => {
  it('让游速在基准上下起落，而不是一成不变', () => {
    // Given 一条游速会起落的鱼
    const fish = createFish(seed({ cruise: { ...level, surge: 0.35, surgePeriod: 8 }, speed: 1 }))

    // When 在一个完整周期里取样
    const speeds = Array.from({ length: 40 }, (_, tick) => surgeSpeed(fish, tick * 0.2))

    // Then 它确实有快有慢，而且始终在往前游
    expect(Math.max(...speeds)).toBeGreaterThan(1.2)
    expect(Math.min(...speeds)).toBeLessThan(0.8)
    expect(Math.min(...speeds)).toBeGreaterThan(0)
  })

  it('不配起落的鱼就保持匀速', () => {
    const fish = createFish(seed({ speed: 0.8 }))

    expect(surgeSpeed(fish, 3)).toBeCloseTo(0.8, 10)
  })
})

describe('帧率无关', () => {
  /**
   * 这条用例只针对巡游和游速：靠近玻璃时的转向本来就按帧限幅，步长不同结果自然不同，
   * 所以起点放在缸中央、时间也短到鱼不会游到墙边。
   */
  it('粗步长和细步长走出来的路差不多', () => {
    // Given 同样一条鱼，用两种步长各走 6 秒
    const start = seed({
      cruise: { depth: 0.3, period: 9, phase: 0.7, range: 0.5, surge: 0.2, surgePeriod: 7 },
      heading: Math.PI / 2,
      position: { x: 0, y: 0, z: -1 },
      speed: 0.9,
      turnRate: 0.1,
    })

    const run = (step: number) => {
      let fish = createFish(start)
      for (let elapsed = 0; elapsed < 6; elapsed += step) {
        fish = stepFish(fish, step, bounds)
      }
      return fish
    }

    const fine = run(1 / 120)
    const coarse = run(1 / 20)

    // Then 两者落点接近，垂直方向不会因为步长变粗就走偏
    expect(coarse.position.y).toBeCloseTo(fine.position.y, 1)
    expect(coarse.position.x).toBeCloseTo(fine.position.x, 1)
  })
})
