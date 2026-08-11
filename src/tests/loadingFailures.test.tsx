import { describe, expect, it, vi } from 'vitest'
import { FISH_SPECIES } from '../aquarium/fishSpecies'
import { openAquarium } from './aquariumPage'

describe('加载失败时仍给观众一个可解释的页面', () => {
  it('模型 body 还没收完时继续显示加载幕布', async () => {
    const slowUrl = new URL(FISH_SPECIES.barramundi.modelUrl, location.href).href
    const originalFetch = globalThis.fetch.bind(globalThis)
    let releaseBody: (() => void) | undefined

    const slowFetch: typeof globalThis.fetch = async (input, init) => {
      const requested = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
      if (requested !== slowUrl) return originalFetch(input, init)

      const source = await originalFetch(FISH_SPECIES.barramundi.modelUrl)
      const bytes = new Uint8Array(await source.arrayBuffer())
      const paused = new Promise<void>((resolve) => {
        releaseBody = resolve
      })
      const halfway = Math.floor(bytes.length / 2)

      return new Response(
        new ReadableStream({
          async start(controller) {
            controller.enqueue(bytes.slice(0, halfway))
            await paused
            controller.enqueue(bytes.slice(halfway))
            controller.close()
          },
        }),
        { headers: { 'content-type': 'model/gltf-binary' } },
      )
    }

    const aquarium = await openAquarium({
      fetch: slowFetch,
      withLoadingCurtain: true,
    })

    await vi.waitFor(() => expect(releaseBody).toBeTypeOf('function'))
    await expect.element(aquarium.loadingCurtain()!).toBeVisible()
    expect(aquarium.loadingCurtain()?.dataset.leaving).toBeUndefined()

    releaseBody!()
    await vi.waitFor(() => {
      if (aquarium.loadingCurtain()) throw new Error('模型解析完成后加载幕布仍未消失。')
    }, { timeout: 3000 })
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

    await expect.element(aquarium.modelFailure()).toHaveTextContent('尖吻鲈、蓝刀鲷')
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
