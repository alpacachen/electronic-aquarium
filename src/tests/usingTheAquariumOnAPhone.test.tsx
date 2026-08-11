import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { openAquarium } from './aquariumPage'
import type { AquariumPage } from './aquariumPage'

describe('在手机上使用鱼缸', () => {
  let aquarium: AquariumPage

  beforeEach(async () => {
    // Given 观众用一块 390 × 844 的手机屏幕打开了电子鱼缸
    await page.viewport(390, 844)
    aquarium = await openAquarium()
  })

  afterEach(async () => {
    await page.viewport(600, 400)
  })

  it('先留出完整观赏空间，需要时再展开控件', async () => {
    // Then 标题、语言和控制入口都看得见，鱼市没有挡住鱼缸
    await expect.element(aquarium.heading()).toBeVisible()
    await expect.element(aquarium.text('中文')).toBeVisible()
    await expect.element(aquarium.controls().trigger()).toBeVisible()
    expect(aquarium.controls().market()).toBeNull()
    expect(aquarium.controls().isOpen()).toBe(false)

    // When 观众展开控制面板并多养一条小丑鱼
    await aquarium.controls().open()
    await expect.element(aquarium.controls().market()).toBeVisible()
    await aquarium.market().buy('小丑鱼')

    // Then 操作生效，收起后鱼市再次把观赏空间还给鱼缸
    expect(aquarium.market().tally()).toBe('缸里 7 条 · 上限 8 条')
    await aquarium.controls().close()
    await vi.waitFor(
      () => {
        if (aquarium.controls().market()) throw new Error('The controls drawer is still closing.')
      },
      { interval: 10, timeout: 2000 },
    )
  })
})
