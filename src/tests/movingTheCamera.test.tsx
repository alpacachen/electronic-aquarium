import { beforeEach, describe, expect, it } from 'vitest'
import { openAquarium } from './aquariumPage'
import type { AquariumPage } from './aquariumPage'

describe('挪动镜头', () => {
  let aquarium: AquariumPage

  beforeEach(async () => {
    // Given 观众打开了电子鱼缸
    aquarium = await openAquarium()
  })

  it('把操作方式写在角落里', async () => {
    // When 观众四下打量页面
    // Then 角落里提示可以拖动和滚轮
    await expect.element(aquarium.text(/拖动旋转/)).toBeVisible()
    await expect.element(aquarium.text(/滚轮缩放/)).toBeVisible()
  })

  it('横向拖动让镜头绕着鱼缸转', async () => {
    // Given 镜头此刻的位置和它离鱼缸的距离
    const before = aquarium.camera()

    // When 观众按住画面往左拖
    await aquarium.dragAcross(-260)

    // Then 镜头绕到了另一侧，但仍保持一样远
    const after = aquarium.camera()
    expect(after.position.x).not.toBeCloseTo(before.position.x, 1)
    expect(after.distance).toBeCloseTo(before.distance, 1)
  })

  it('纵向拖动让镜头俯仰', async () => {
    // Given 镜头此刻的高度
    const before = aquarium.camera().height

    // When 观众往下拖动画面
    await aquarium.dragDownwards(300)

    // Then 视角抬高了，改成俯视鱼缸
    expect(aquarium.camera().height).toBeGreaterThan(before)
  })

  it('不让观众把镜头翻到缸底以下', async () => {
    // When 观众一路往上拖，想钻到鱼缸下面去看
    for (let pull = 0; pull < 8; pull += 1) {
      await aquarium.dragDownwards(-400)
    }

    // Then 镜头压到水面附近就不再往下，始终在缸的上方
    expect(aquarium.camera().height).toBeGreaterThan(0)
  })

  it('往前滚滚轮把鱼缸拉近', async () => {
    // Given 镜头此刻离鱼缸的距离
    const before = aquarium.camera().distance

    // When 观众向前滚动滚轮
    await aquarium.scrollWheel(-600)

    // Then 镜头靠得更近了
    expect(aquarium.camera().distance).toBeLessThan(before)
  })

  it('往后滚滚轮把鱼缸推远', async () => {
    // Given 镜头此刻离鱼缸的距离
    const before = aquarium.camera().distance

    // When 观众向后滚动滚轮
    await aquarium.scrollWheel(600)

    // Then 镜头退得更远了
    expect(aquarium.camera().distance).toBeGreaterThan(before)
  })

  it('再怎么拉近也不会穿进玻璃里', async () => {
    // When 观众一路把滚轮往前推到底
    for (let push = 0; push < 12; push += 1) {
      await aquarium.scrollWheel(-1200)
    }

    // Then 镜头停在缸外，没有钻进水里
    const tank = aquarium.tank()
    expect(aquarium.camera().distance).toBeGreaterThan(tank.length / 2)
  })

  it('再怎么推远也不会把鱼缸丢出画面', async () => {
    // When 观众一路把滚轮往后拉到底
    for (let pull = 0; pull < 12; pull += 1) {
      await aquarium.scrollWheel(1200)
    }

    // Then 镜头收在一个还能看清鱼缸的距离上
    const tank = aquarium.tank()
    expect(aquarium.camera().distance).toBeLessThan(tank.length * 6)
  })

  /**
   * 视角是观众自己摆好的，不该被界面上别处的操作碰掉。这几条盯的就是这件事：
   * 鱼缸的取景参数是每次渲染都重算的，一旦把它当成渲染的产物交给相机，观众点一下
   * 鱼市，镜头就被拨回默认角度。
   *
   * 取样之前都先把阻尼放完。镜头开着 enableDamping，松手之后还会顺着惯性滑好几秒，
   * 这时候记下来的位置本来就要继续变——那是设计的手感，不是被谁拨回去了。
   */
  const settleCamera = () => aquarium.letTimePass(6)

  it('在鱼市里加一条鱼，不会把视角拨回去', async () => {
    // Given 观众把镜头转到一个自己中意的角度，并且惯性已经停下
    await aquarium.dragAcross(-220)
    await aquarium.dragDownwards(120)
    settleCamera()
    const chosen = aquarium.camera()

    // When 观众去鱼市添了一条鱼
    await aquarium.market().buy('小丑鱼')

    // Then 镜头还在观众留下它的地方
    const now = aquarium.camera()
    expect(now.position.x).toBeCloseTo(chosen.position.x, 2)
    expect(now.position.y).toBeCloseTo(chosen.position.y, 2)
    expect(now.position.z).toBeCloseTo(chosen.position.z, 2)
  })

  it('从鱼市捞走一条鱼，也不会把视角拨回去', async () => {
    // Given 观众把镜头转开，等它停稳
    await aquarium.dragAcross(200)
    settleCamera()
    const chosen = aquarium.camera()

    // When 观众捞走一条金鱼
    await aquarium.market().sell('金鱼')

    // Then 镜头没有动
    const now = aquarium.camera()
    expect(now.position.x).toBeCloseTo(chosen.position.x, 2)
    expect(now.position.y).toBeCloseTo(chosen.position.y, 2)
    expect(now.position.z).toBeCloseTo(chosen.position.z, 2)
  })

  it('反复增减鱼，视角始终待在观众放的位置', async () => {
    // Given 观众摆好了角度，等它停稳
    await aquarium.dragAcross(-160)
    settleCamera()
    const chosen = aquarium.camera()

    // When 观众在鱼市里来回折腾
    await aquarium.market().buy('小丑鱼')
    await aquarium.market().sell('金鱼')
    await aquarium.market().buy('金枪鱼')

    // Then 镜头一次都没有被拨回去
    const now = aquarium.camera()
    expect(now.distance).toBeCloseTo(chosen.distance, 2)
    expect(now.position.x).toBeCloseTo(chosen.position.x, 2)
    expect(now.position.z).toBeCloseTo(chosen.position.z, 2)
  })

  it('转过镜头之后鱼照旧游动', async () => {
    // Given 观众换了个角度看缸
    await aquarium.dragAcross(200)
    const before = aquarium.fish().map(({ position }) => position)

    // When 过去两秒
    aquarium.letTimePass(2)

    // Then 鱼群没有因为镜头动过而停下
    aquarium.fish().forEach(({ position }, index) => {
      expect(position).not.toEqual(before[index])
    })
  })
})
