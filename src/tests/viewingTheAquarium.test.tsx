import { beforeEach, describe, expect, it } from 'vitest'
import { openAquarium } from './aquariumPage'
import type { AquariumPage } from './aquariumPage'

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

    // Then 缸里有六条鱼、五个不同模型的鱼种，没有两条朝着同一个方向
    expect(fish).toHaveLength(6)
    expect(new Set(fish.map(({ species }) => species))).toEqual(
      new Set(['barramundi', 'blueTang', 'clownfish', 'goldfish', 'tuna']),
    )
    expect(new Set(fish.map(({ headingY }) => headingY)).size).toBe(6)
  })

  it('让每个鱼种的体型都和缸里的其他鱼相称', () => {
    // Given 每个鱼种都有一条鱼在缸里
    aquarium.letTimePass(0.1)
    const bySpecies = new Map(aquarium.fish().map((fish) => [fish.species, fish]))

    // Then 没有哪一种鱼的体长是另一种的两倍以上
    const lengths = [...bySpecies.values()].map(({ bodyLength }) => bodyLength)
    expect(Math.max(...lengths)).toBeLessThan(Math.min(...lengths) * 2)
  })

  it('让没有骨骼动画的鱼种也会摆尾', () => {
    aquarium.letTimePass(1)
    const before = aquarium.fish().find(({ species }) => species === 'barramundi')!.tailAngle

    aquarium.letTimePass(0.2)

    const after = aquarium.fish().find(({ species }) => species === 'barramundi')!.tailAngle
    expect(after).not.toBe(before)
  })

  it('让每个自带游泳动画的鱼种都真的动起来', () => {
    // Given 入场过渡结束后，记下每个鱼种的姿态
    aquarium.letTimePass(1)
    const before = new Map(aquarium.fish().map(({ species, poseKey }) => [species, poseKey]))

    // When 过去一小会儿
    aquarium.letTimePass(0.3)

    // Then 除了靠程序化摆尾的 barramundi，其余鱼种的骨骼都换了姿态
    aquarium.fish().forEach(({ poseKey, species }) => {
      if (species === 'barramundi') return
      expect(poseKey, species).not.toBe(before.get(species))
    })
  })

  it('让鱼在水里上下游，而不只是贴着一层平移', () => {
    // Given 记下每条鱼此刻的高度
    const start = aquarium.fish().map(({ position }) => position.y)
    const seen = start.map((y) => ({ max: y, min: y }))

    // When 观众看了二十秒
    for (let second = 0; second < 20; second += 1) {
      aquarium.letTimePass(1)
      aquarium.fish().forEach(({ position }, index) => {
        seen[index]!.max = Math.max(seen[index]!.max, position.y)
        seen[index]!.min = Math.min(seen[index]!.min, position.y)
      })
    }

    // Then 每条鱼都明显换过深度，而不是停在入场那一层
    const tank = aquarium.tank()
    seen.forEach(({ max, min }, index) => {
      expect(max - min, `第 ${index} 条鱼几乎没有上下移动`).toBeGreaterThan(tank.height * 0.1)
    })
  })

  it('让鱼上浮时抬头、下潜时低头', () => {
    // Given 让鱼群先游一会儿，越过入场姿态
    aquarium.letTimePass(3)

    /**
     * 用很短的步长取样。俯仰角是当下的姿态，而升降量是一段时间的平均；鱼的起伏
     * 周期只有十几秒，如果一次走满一秒，鱼可能在这一秒里就已经转头向下了，两个
     * 量就不再描述同一个时刻。
     */
    const STEP = 0.25
    const samples: Array<{ pitch: number; rising: number }> = []
    let previous = aquarium.fish().map(({ position }) => position.y)

    for (let step = 0; step < 40; step += 1) {
      aquarium.letTimePass(STEP)
      const now = aquarium.fish()
      now.forEach(({ pitch, position }, index) => {
        samples.push({ pitch, rising: position.y - previous[index]! })
      })
      previous = now.map(({ position }) => position.y)
    }

    /**
     * 只看抬头低头都明显的样本。俯仰角正在穿过零点时（升降刚要反向），它的正负
     * 没有意义，拿来比较只会得到一个和实现细节较劲的用例。
     */
    const moving = samples.filter(
      ({ pitch, rising }) => Math.abs(rising) > 0.005 && Math.abs(pitch) > 0.02,
    )

    // Then 这些时刻的俯仰角方向，始终跟着升降方向走
    expect(moving.length).toBeGreaterThan(10)
    moving.forEach(({ pitch, rising }) => {
      expect(Math.sign(pitch), `升降 ${rising.toFixed(3)} 时俯仰角为 ${pitch.toFixed(3)}`)
        .toBe(Math.sign(rising))
    })
  })

  it('不让任何一条鱼翻过来或者竖起来', () => {
    // When 观众看了二十秒
    for (let second = 0; second < 20; second += 1) {
      aquarium.letTimePass(1)

      // Then 鱼始终大致保持水平，没有立成一根针
      aquarium.fish().forEach(({ pitch }) => {
        expect(Math.abs(pitch)).toBeLessThanOrEqual(0.5)
      })
    }
  })

  it('让每条鱼各游各的，不会整缸同步升降', () => {
    // Given 让鱼群游开
    aquarium.letTimePass(5)

    // When 记录半分钟里每条鱼的高度
    const trail: number[][] = []
    for (let second = 0; second < 30; second += 1) {
      aquarium.letTimePass(1)
      trail.push(aquarium.fish().map(({ position }) => position.y))
    }

    // Then 总有那么些时刻，有鱼在上浮、同时有鱼在下潜
    const mixed = trail.slice(1).filter((heights, index) => {
      const deltas = heights.map((y, fish) => y - trail[index]![fish]!)
      return deltas.some((delta) => delta > 0.01) && deltas.some((delta) => delta < -0.01)
    })
    expect(mixed.length).toBeGreaterThan(trail.length / 4)
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
    // Given 入场过渡结束后，记下第一条鱼尾巴的角度
    aquarium.letTimePass(1)
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

    // Then 鱼会持续改变方向；逐帧是否平滑由模拟层的回归测试负责
    const turns = trail
      .slice(1)
      .flatMap((headings, index) =>
        headings.map((heading, fish) =>
          Math.abs(Math.atan2(
            Math.sin(heading - trail[index]![fish]!),
            Math.cos(heading - trail[index]![fish]!),
          )),
        ),
      )
    expect(Math.max(...turns)).toBeGreaterThan(0.2)
  })

  it('不让鱼的朝向逐帧跳变，转身总是转过去的', () => {
    // Given 让鱼群游开，其中总有鱼正贴着玻璃转身
    aquarium.letTimePass(2)

    // When 一帧一帧地看十秒
    let previous = aquarium.fish().map(({ headingY }) => headingY)
    aquarium.eachFrame(10, () => {
      const now = aquarium.fish()

      // Then 没有哪条鱼在一帧之内甩过一个大角度
      now.forEach(({ headingY, species }, index) => {
        const turned = Math.abs(
          Math.atan2(
            Math.sin(headingY - previous[index]!),
            Math.cos(headingY - previous[index]!),
          ),
        )
        /**
         * 贴着玻璃转身是这里最急的一下，实测约 0.13 弧度——那是模拟里 per-frame
         * 的转向限幅在起作用。阈值留到 0.2：够松，不会因为正常转身而误报；也够紧，
         * 一旦限幅失效（甩过半个身位以上）就会立刻挂。
         */
        expect(turned, `${species} 一帧转了 ${turned.toFixed(3)} 弧度`).toBeLessThan(0.2)
      })
      previous = now.map(({ headingY }) => headingY)
    })
  })

  it('不让鱼的抬头低头逐帧跳变', () => {
    // Given 让鱼群越过入场姿态
    aquarium.letTimePass(3)

    // When 一帧一帧地看十秒
    let previous = aquarium.fish().map(({ pitch }) => pitch)
    aquarium.eachFrame(10, () => {
      const now = aquarium.fish()

      // Then 俯仰角是渐变的，不会一帧翻过去
      now.forEach(({ pitch, species }, index) => {
        /**
         * 实测一帧最多仰 0.006 弧度，因为升降本身是渐进逼近出来的。阈值定在 0.05：
         * 仍有近十倍余量不会误报，但真要是哪天姿态改成一步到位，一帧就会跨过它。
         */
        const swung = Math.abs(pitch - previous[index]!)
        expect(swung, `${species} 一帧仰了 ${swung.toFixed(3)} 弧度`).toBeLessThan(0.05)
      })
      previous = now.map(({ pitch }) => pitch)
    })
  })

  it('让鱼有快有慢，而不是一成不变地匀速前进', () => {
    // Given 让鱼群游开
    aquarium.letTimePass(2)

    /**
     * When 逐帧量每条鱼走过的距离
     *
     * 位移的模长就是速度乘步长，和朝向无关，所以不必知道鱼往哪游也能看出它的快慢。
     */
    const travelled = new Map<number, number[]>()
    let previous = aquarium.fish().map(({ position }) => position)
    aquarium.eachFrame(10, () => {
      const now = aquarium.fish()
      now.forEach(({ position }, index) => {
        const step = Math.hypot(
          position.x - previous[index]!.x,
          position.y - previous[index]!.y,
          position.z - previous[index]!.z,
        )
        travelled.set(index, [...(travelled.get(index) ?? []), step])
      })
      previous = now.map(({ position }) => position)
    })

    // Then 至少有一条鱼明显地时快时慢，且没有鱼倒着游
    const spans = [...travelled.values()].map((steps) => Math.max(...steps) / Math.min(...steps))
    expect(Math.max(...spans)).toBeGreaterThan(1.3)
    ;[...travelled.values()].forEach((steps) => {
      expect(Math.min(...steps)).toBeGreaterThan(0)
    })
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
