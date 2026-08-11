import { describe, expect, it, vi } from 'vitest'
import { openAquarium } from './aquariumPage'

describe('加载失败时仍给观众一个可解释的页面', () => {
  it('模型 body 还没收完时继续显示加载幕布', async () => {
    // Given 模型的 body 停在半路
    const aquarium = await openAquarium({ stallModels: true })

    // Then 幕布还挡在缸前面，而且上面确实有字
    await expect.element(aquarium.loadingCurtain()!).toBeVisible()
    expect(aquarium.loadingCurtain()?.dataset.leaving).toBeUndefined()
    await vi.waitFor(() =>
      expect(aquarium.loadingCurtainWords()).toEqual(['正在注水', '正在把鱼放进缸里']),
    )

    /**
     * 进度条读的是真进度，不是那个来回扫的占位动画。两个读数要一致：`aria-valuenow`
     * 对而条子不动的话，看得见的那半就是坏的。
     */
    await vi.waitFor(() => {
      const { announced, barWidth } = aquarium.loadingProgress()
      expect(announced).toBeGreaterThan(0)
      expect(announced).toBeLessThanOrEqual(100)
      expect(barWidth).toBe(`${announced}%`)
    })

    // When body 的后半段放行
    aquarium.releaseModels()

    // Then 解析完之后幕布自己撤了
    await vi.waitFor(() => {
      if (aquarium.loadingCurtain()) throw new Error('模型解析完成后加载幕布仍未消失。')
    }, { timeout: 5000 })
  })

  it('404 和无效 GLTF 只拿掉坏鱼，鱼缸仍可使用并说明原因', async () => {
    const missingUrl = new URL(`/models/missing-${crypto.randomUUID()}.glb`, location.href).href
    const originalFetch = globalThis.fetch.bind(globalThis)
    const failingFetch: typeof globalThis.fetch = (input, init) => {
      const requested = typeof input === 'string'
        ? new URL(input, location.href).href
        : input instanceof URL
          ? input.href
          : input.url
      return requested === missingUrl
        ? Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }))
        : originalFetch(input, init)
    }

    const aquarium = await openAquarium({
      fetch: failingFetch,
      modelUrls: {
        barramundi: missingUrl,
        blueTang: 'data:model/gltf-binary;base64,bm90IGEgZ2x0Zg==',
      },
    })

    /**
     * 「和」而不是「、」：名字由 i18next 的 list formatter 接 `Intl.ListFormat` 连
     * 起来，中文两项就是「A和B」，三项才是「甲、乙和丙」。这比原先手写的顿号更合
     * 中文习惯，也省了一份按语言挑分隔符的代码。
     */
    await expect.element(aquarium.modelFailure()).toHaveTextContent('尖吻鲈和蓝刀鲷')
    expect(aquarium.tank().length).toBeGreaterThan(0)
    expect(aquarium.fish().map(({ species }) => species)).not.toContain('barramundi')
    expect(aquarium.fish().map(({ species }) => species)).not.toContain('blueTang')
  })

  it('WebGL renderer 无法创建时显示明确降级文案', async () => {
    const aquarium = await openAquarium()

    const fallback = await aquarium.showWebGLFallback()

    await expect.element(fallback).toBeVisible()
  })
})
