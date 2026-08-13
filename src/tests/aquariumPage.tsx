import { useProgress } from '@react-three/drei'
import { afterEach, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { Box3, Vector3 } from 'three'
import type { Object3D, WebGLRenderer } from 'three'
import { getAquariumProbe } from '../aquarium/aquariumProbe'
import { FISH_SPECIES } from '../aquarium/fishSpecies'
import type { FishSpeciesId } from '../aquarium/fishSpecies'
import { LANGUAGE_NAMES, LANGUAGE_STORAGE_KEY, createI18n, languageOf } from '../i18n'
import type { Language } from '../i18n'
import { quietDependencyWarnings } from './quietDependencyWarnings'
import '../styles.css'

quietDependencyWarnings()

/**
 * The app fills its host element, but the test container is an unsized div.
 * Handing it the viewport lets the canvas lay out at its real size, which both
 * the camera aspect ratio and every pointer interaction depend on.
 */
const layout = document.createElement('style')
layout.textContent = 'body > div { width: 100vw; height: 100vh; margin: 0 }'
document.head.append(layout)

/** The largest simulation step accepted by Fish, keeping tests fast and exact. */
const FRAME_SECONDS = 1 / 20

/**
 * A browser only grants a handful of WebGL contexts at a time, and unmounting
 * React is not enough to hand one back, so every renderer opened here is
 * released explicitly once its test ends.
 */
const openRenderers = new Set<WebGLRenderer>()
let restoreFetch: (() => void) | undefined
let restoreExpectedErrors: (() => void) | undefined
let restoreBrowserLanguage: (() => void) | undefined
/**
 * 放行被 `stallModels` 卡住的那半个 body。
 *
 * 用例结束时无论如何都放一次：`useProgress` 的 store 是模块级的，一个卡住不放的加载
 * 会让 `active` 永远是 true，同一文件后面每条用例的幕布都撤不掉——挨满超时才过，而且
 * 单独跑它们全是绿的。
 */
let releaseStalledModels: (() => void) | undefined

function release(renderer: WebGLRenderer) {
  openRenderers.delete(renderer)
  /**
   * `forceContextLoss()` 用来实测要 3.5s（SwiftShader 拆一个已经编译过 program
   * 的 context 很慢），而 `dispose()` 已经释放了几何、材质、渲染目标这些资源。
   * 只调 `dispose()`：如果浏览器的 context 上限真的被顶到，表现会是后面某条
   * 用例创建 context 失败，而不是这条本身变慢。
   */
  renderer.dispose()
}

afterEach(() => {
  /**
   * Unmounting a paused canvas waits for a frame that will never arrive, so the
   * loop is handed back before React tears the tree down.
   */
  getAquariumProbe()?.resume()
  cleanup()
  openRenderers.forEach(release)
  openRenderers.clear()
  restoreFetch?.()
  restoreFetch = undefined
  restoreExpectedErrors?.()
  restoreExpectedErrors = undefined
  restoreBrowserLanguage?.()
  restoreBrowserLanguage = undefined
  releaseStalledModels?.()
  releaseStalledModels = undefined
  /**
   * 把加载进度的 store 归零。
   *
   * 它在 drei 里是模块级的一份，线上每次都是全新一页、从零开始，而同一个测试文件里所有
   * 用例共用它——上一条留下的 `total > 0, active: false` 会让下一条的幕布一挂上就判定
   * 「加载早完了」，当场撤场。这里替页面刷新做这件事。
   */
  useProgress.setState({ active: false, errors: [], item: '', loaded: 0, progress: 0, total: 0 })
  document.getElementById('loading-curtain')?.remove()
  /**
   * 语言是记在 localStorage 里的，一条用例切过之后会留在那儿。不清掉，后面的用例
   * 就会因为前面跑过什么而变成英文——而且单独跑它还是绿的。
   */
  localStorage.removeItem(LANGUAGE_STORAGE_KEY)
})

type OpenAquariumOptions = {
  /**
   * 假装浏览器偏好是这种语言。给了它就不再把语言写死，改由应用自己去认——这是线上
   * 头一次进来走的那条路。
   */
  browserLanguage?: string
  fetch?: typeof globalThis.fetch
  /**
   * 界面开在哪种语言，默认中文。
   *
   * 默认写死而不是跟着浏览器：无头 Chromium 报的是 en-US，跟着它走的话全套用例都
   * 得改成英文断言，而中文才是这个项目原本的界面。'browser' 表示交给应用自己认。
   */
  language?: Language | 'browser'
  modelUrls?: Partial<Record<FishSpeciesId, string>>
  /**
   * 把**一个**鱼种的模型卡在半路：body 先发一半，等 `releaseModels()` 才发另一半。
   *
   * 本地那几个文件瞬间就收完了，幕布一闪而过——想看幕布的用例得先把它按住。
   *
   * 只卡一个，其余的照常收完，所以进度条上是个真的中间值（五分之四）。全都卡住的话
   * 一条都没「完成」，drei 按件数算出来的进度就是 0，那样反倒盯不住进度条动没动。
   *
   * 开着它就不再等幕布走完（不然就死等了）。
   */
  stallModels?: boolean
  /**
   * 开缸时要不要等加载幕布走完，默认要等（`stallModels` 开着时除外）。
   *
   * 幕布挡在缸前面（观众这时也点不到什么），所以默认等它走干净再把缸交出去，之后的
   * 点击和拖动才落在缸上。
   */
  waitForLoading?: boolean
}

export type RenderedFish = Readonly<{
  /** Longest horizontal extent on screen, in world units. */
  bodyLength: number
  position: Readonly<{ x: number; y: number; z: number }>
  headingY: number
  /** Radians the nose is tilted up, as the renderer posed it. */
  pitch: number
  /** Playback time of the fish's visible animation. */
  animationTime: number
  scale: number
  species: string
  tailAngle: number
  topY: number
}>

export type RenderedTank = Readonly<{
  depth: number
  height: number
  length: number
}>

/**
 * The 鱼市 panel.
 *
 * 认的是它那行小标题的 id，而不是标题上的字：面板的名字跟着界面语言变，按字找就
 * 只在中文界面下找得到。
 */
const marketPanel = () =>
  document.querySelector<HTMLElement>('[aria-labelledby="fish-market-label"]')

const visibleMarketPanel = () =>
  [...document.querySelectorAll<HTMLElement>('[aria-labelledby="fish-market-label"]')].find(
    (panel) =>
      panel.getClientRects().length > 0 &&
      panel.closest('[data-slot="drawer-content"]')?.getAttribute('data-state') !== 'closed',
  ) ?? null

const visibleTankOption = (option: Element) =>
  option.getClientRects().length > 0 &&
  option.closest('[data-slot="select-content"]')?.getAttribute('data-state') !== 'closed'

/**
 * The 鱼市 tally line, e.g. 缸里 6 条 · 上限 8 条.
 *
 * Read through the panel's live region rather than a class name: it is the same
 * text a screen reader announces after a click, so this keeps working however the
 * panel is styled.
 */
const marketTally = () =>
  marketPanel()?.querySelector('[aria-live]')?.textContent ?? ''

/** Finds a button by its accessible name, for checking whether it is disabled. */
function nameButton(name: string) {
  return [...document.querySelectorAll('button')].find(
    (button) => button.getAttribute('aria-label') === name,
  )
}

/**
 * Finds a button by the words printed on it.
 *
 * 鱼市那些按钮只有图标，名字挂在 aria-label 上（见上面那个）；语言那两颗是有字的，
 * 名字就是那行字。
 */
function textButton(text: string) {
  return [...document.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === text,
  )
}

function readFish(group: Object3D): RenderedFish {
  /**
   * The bounding box walks every vertex of a skinned mesh, which is far too slow
   * to do for each fish on each of the hundreds of samples a movement test
   * takes. It is computed on demand instead, so only the tests that ask about
   * size or the water surface pay for it.
   */
  let measured: Box3 | undefined
  const extent = () => (measured ??= new Box3().setFromObject(group))

  return {
    get bodyLength() {
      const box = extent()
      return Math.max(box.max.x - box.min.x, box.max.z - box.min.z)
    },
    headingY: group.rotation.y,
    pitch: group.rotation.z,
    get animationTime() {
      return Number(group.userData.aquariumAnimationTime ?? 0)
    },
    position: { x: group.position.x, y: group.position.y, z: group.position.z },
    scale: group.scale.x,
    species: String(group.userData.aquariumFishSpecies ?? ''),
    get tailAngle() {
      return Number(group.userData.aquariumTailPhase ?? group.rotation.y)
    },
    get topY() {
      return extent().max.y
    },
  }
}

export type AquariumPage = Awaited<ReturnType<typeof openAquarium>>

/**
 * Renders the whole app in a real browser and exposes it the way a viewer meets
 * it: visible text, the size control, the camera, and whatever the renderer
 * actually put on screen.
 *
 * The render loop is driven by hand. A headless browser rasterises WebGL in
 * software at a few frames per second, so waiting on wall-clock time would make
 * every test slow and flaky; stepping the clock keeps them quick and repeatable.
 */
export async function openAquarium({
  browserLanguage,
  fetch: fetchOverride,
  language = 'zh',
  modelUrls,
  stallModels = false,
  waitForLoading = !stallModels,
}: OpenAquariumOptions = {}) {
  /** `stallModels` 时，放行模型后半段 body 的那个闸。 */
  let releaseModels: (() => void) | undefined

  if (stallModels) {
    const upstream = (fetchOverride ?? globalThis.fetch).bind(globalThis)
    const opened = new Promise<void>((resolve) => {
      releaseModels = resolve
    })
    releaseStalledModels = () => releaseModels?.()

    /**
     * 给要卡的那个模型换一个没人用过的 URL。
     *
     * `useGLTF` 的缓存是模块级的，同一文件里前面的用例一跑，模型就都在缓存里了——再
     * 开缸根本不会发请求，也就没有 body 可卡，幕布一闪而过。加个查询串让缓存必然落空
     * （服务端不理它），这条用例才不依赖自己在文件里排第几。
     */
    modelUrls = {
      ...modelUrls,
      barramundi: `${FISH_SPECIES.barramundi.modelUrl}?stall=${crypto.randomUUID()}`,
    }

    fetchOverride = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const response = await upstream(input, init)
      if (!url.includes('barramundi')) return response

      const bytes = new Uint8Array(await response.arrayBuffer())
      const halfway = Math.floor(bytes.length / 2)
      return new Response(
        new ReadableStream({
          async start(controller) {
            controller.enqueue(bytes.slice(0, halfway))
            await opened
            controller.enqueue(bytes.slice(halfway))
            controller.close()
          },
        }),
        { headers: { 'content-type': 'model/gltf-binary' } },
      )
    }
  }

  if (browserLanguage !== undefined) {
    /**
     * 单数和复数两个都要桩上。detector 先看 `navigator.languages`（整个偏好列表，
     * 这也是正确的优先级），只桩单数的 `navigator.language` 会被它跳过去。
     */
    const stubbed: Array<['language', string] | ['languages', readonly string[]]> = [
      ['language', browserLanguage],
      ['languages', [browserLanguage]],
    ]
    const own = stubbed.map(
      ([property]) => [property, Object.getOwnPropertyDescriptor(navigator, property)] as const,
    )

    for (const [property, value] of stubbed) {
      Object.defineProperty(navigator, property, { configurable: true, get: () => value })
    }
    restoreBrowserLanguage = () => {
      for (const [property, descriptor] of own) {
        if (descriptor) Object.defineProperty(navigator, property, descriptor)
        else delete (navigator as unknown as Record<string, unknown>)[property]
      }
    }
  }

  /**
   * 一条用例一个 i18next 实例。
   *
   * 写死语言时给 `lng`，`'browser'` 则不给——让 detector 自己去认，这是线上头一次
   * 进来走的那条路。不共用一个实例：前一条用例切过的语言会漏到后一条身上。
   */
  const fixedLanguage = language === 'browser' ? undefined : language
  const i18n = createI18n({ lng: fixedLanguage })

  if (fetchOverride) {
    const previous = globalThis.fetch
    globalThis.fetch = fetchOverride
    restoreFetch = () => {
      globalThis.fetch = previous
    }
  }

  if (modelUrls) {
    const expected = (event: Event) => event.preventDefault()
    const consoleError = console.error
    window.addEventListener('error', expected)
    window.addEventListener('unhandledrejection', expected)
    console.error = (...values) => {
      const message = values.map((value) => value instanceof Error ? value.message : String(value)).join(' ')
      if (!message.includes('Could not load')) consoleError(...values)
    }
    restoreExpectedErrors = () => {
      window.removeEventListener('error', expected)
      window.removeEventListener('unhandledrejection', expected)
      console.error = consoleError
    }
  }

  const { App } = await import('../App')
  const rendered = await render(<App frameloop="never" i18n={i18n} modelUrls={modelUrls} />)

  /**
   * 界面此刻用的是哪个实例、哪种语言。
   *
   * `revisit()` 会换一个新实例（模拟观众下次进来），所以这里存的是可变的引用，读的
   * 时候取当下那个——鱼市的按钮名字跟着当前语言变，认错实例就和屏幕上的字脱节。
   */
  let live18n = i18n
  const currentLanguage = (): Language => languageOf(live18n)
  const say = (key: string, values?: Record<string, unknown>) => live18n.t(key, values)

  /** Opens the phone-only controls sheet when the current viewport uses it. */
  const openControls = async () => {
    const toggle = document.querySelector<HTMLButtonElement>('[aria-controls="aquarium-controls"]')
    if (!toggle || toggle.getClientRects().length === 0 || toggle.ariaExpanded === 'true') return
    await page.getByRole('button', { name: say('controls.open') }).click()
  }

  /** Finds the live renderer without coupling tests to how the canvas is mounted. */
  const liveScene = async () => {
    const found = await vi.waitFor(
      () => {
        const probe = getAquariumProbe()
        if (!probe || probe.scene.children.length === 0) {
          throw new Error('The aquarium scene has not been rendered yet.')
        }
        return probe
      },
      { interval: 50, timeout: 5000 },
    )

    openRenderers.add(found.gl)
    found.clock.elapsedTime = 0
    return found
  }

  await liveScene()
  let elapsed = 0

  /**
   * 等加载幕布走干净。
   *
   * 幕布铺满视口、盖在缸上面，观众这时也点不到什么，所以默认等它走完再把缸交出去，
   * 之后的点击和拖动才落在缸上。它是靠 Three 的 LoadingManager 撤的，和帧无关，所以
   * 这里不用推时钟。
   */
  if (waitForLoading) {
    await vi.waitFor(
      () => {
        if (document.getElementById('loading-curtain')) {
          throw new Error('The loading curtain is still up.')
        }
      },
      { interval: 20, timeout: 20000 },
    )
  }

  /**
   * 此刻挂在页面上的那块场景。
   *
   * 每次都重新取，不留在局部变量里：缸要是被重挂了（换鱼缸尺寸是明着重挂，别处也
   * 可能不小心把它连带重挂），存下来的那份就指着一块已经卸掉的场景——鱼冻在离场时
   * 的位置上，断言照旧是绿的，只是盯的不再是屏幕上那一块。
   */
  const live = () => {
    const probe = getAquariumProbe()
    if (!probe) throw new Error('The aquarium scene is not mounted.')
    return probe
  }

  const fishGroups = () => {
    const found: Object3D[] = []
    live().scene.traverse((object) => {
      if (object.userData.aquariumFish === true) {
        found.push(object)
      }
    })
    return found
  }

  const lampLight = () => {
    let found: Object3D | undefined
    live().scene.traverse((object) => {
      if (object.userData.aquariumLampLight === true) found = object
    })
    if (!found || !('intensity' in found) || !('color' in found)) {
      throw new Error('The aquarium has no controllable lamp.')
    }
    return found as Object3D & { intensity: number; color: { getHexString(): string } }
  }

  /**
   * Runs the render loop for a stretch of aquarium time, in seconds.
   *
   * By default only the last frame is drawn. Long sampling loops can turn that
   * last draw off too: scene state still advances, while the software rasteriser
   * has nothing useful to paint between assertions.
   */
  const letTimePass = (seconds = 1, draw = true) => {
    const frames = Math.max(1, Math.round(seconds / FRAME_SECONDS))
    for (let frame = 0; frame < frames - 1; frame += 1) {
      elapsed += FRAME_SECONDS
      live().advance(elapsed, false)
    }

    elapsed += FRAME_SECONDS
    live().advance(elapsed, draw)
  }

  /**
   * Runs the loop one frame at a time, handing each frame to `sample`.
   *
   * For the tests that assert nothing may change abruptly between two frames.
   * Calling `letTimePass(ONE_FRAME)` in a loop would do the same stepping, but it
   * paints every frame — the suppression above only skips the frames before the
   * last, and every call has a last frame. Painting each one in software costs
   * more than the whole rest of the file, so this keeps the paint suppressed
   * throughout and draws once at the end.
   */
  const eachFrame = (seconds: number, sample: () => void) => {
    const frames = Math.max(1, Math.round(seconds / FRAME_SECONDS))
    for (let frame = 0; frame < frames; frame += 1) {
      elapsed += FRAME_SECONDS
      live().advance(elapsed, false)
      sample()
    }

    live().advance(elapsed)
  }

  /**
   * Waits until the scene holds the expected number of fish, stepping the clock
   * so React can commit and each new model can mount. The loop is driven by hand
   * because the canvas is paused; nothing would progress on wall-clock time.
   */
  const settleFish = async (expected: number) => {
    await vi.waitFor(
      () => {
        letTimePass(FRAME_SECONDS)
        const found = fishGroups().length
        if (found !== expected) {
          throw new Error(`The tank holds ${found} fish, expected ${expected}.`)
        }
      },
      { interval: 10, timeout: 5000 },
    )
  }

  /**
   * Opens the tank-size dropdown and waits for its rows to be on screen.
   *
   * The list is a popup layer that Radix mounts on click and animates in, so a
   * caller that read straight after the click would find an empty list.
   */
  const openSizePicker = async () => {
    await openControls()
    document.getElementById('aquarium-controls')?.scrollTo({ top: 0 })
    if (
      [...document.querySelectorAll('[role="option"]')].some(
        visibleTankOption,
      )
    ) {
      return
    }
    const combo = [...document.querySelectorAll('[role="combobox"]')].find(
      (candidate) => candidate.getClientRects().length > 0,
    )
    if (!combo) {
      throw new Error('The tank-size picker is not visible.')
    }
    await userEvent.click(combo)
    await vi.waitFor(
      () => {
        if (!document.querySelector('[role="option"]')) {
          throw new Error('The tank-size dropdown has not opened yet.')
        }
      },
      { interval: 10, timeout: 2000 },
    )
  }

  /**
   * Drags the pointer across the canvas, the way a viewer swings the view.
   *
   * The grab starts on the left of the canvas rather than dead centre: the
   * side panels sit over the right of the viewport, and a drag beginning under
   * one of them would be delivered to the panel instead of the tank.
   */
  const drag = async (right: number, down: number) => {
    const canvas = document.querySelector('canvas')!
    const from = { x: canvas.clientWidth * 0.28, y: canvas.clientHeight / 2 }
    await userEvent.dragAndDrop(canvas, canvas, {
      sourcePosition: from,
      targetPosition: { x: from.x + right, y: from.y + down },
    })
    letTimePass(0.5)
  }

  return {
    /** Every fish now in the scene, as the renderer placed it. */
    fish: (): readonly RenderedFish[] => fishGroups().map(readFish),

    /** The glass box a viewer sees, in world units. */
    tank: (): RenderedTank => live().tankSize,

    camera: () => ({
      distance: live().camera.position.length(),
      height: live().camera.position.y,
      position: live().camera.position.clone(),
    }),

    lamp: () => ({
      intensity: () => lampLight().intensity,
      color: () => lampLight().color.getHexString(),
      position: () => lampLight().getWorldPosition(new Vector3()),
    }),

    airPump: () => {
      let body: Object3D | undefined
      let stone: Object3D | undefined
      let tube: Object3D | undefined
      const bubbles: Object3D[] = []
      const ripples: Object3D[] = []
      live().scene.traverse((object) => {
        if (object.userData.aquariumAirPump === true) body = object
        if (object.userData.aquariumAirStone === true) stone = object
        if (object.userData.aquariumAirTube === true) tube = object
        if (object.userData.aquariumBubble === true) bubbles.push(object)
        if (object.userData.aquariumRipple === true) ripples.push(object)
      })
      if (!body || !stone || !tube) throw new Error('The aquarium has no complete air pump.')
      const tubeBounds = new Box3().setFromObject(tube)
      return {
        body: body.getWorldPosition(new Vector3()),
        bubbles: bubbles.map((bubble) => bubble.getWorldPosition(new Vector3())),
        ripples: ripples.map((ripple) => ({
          position: ripple.getWorldPosition(new Vector3()),
          radius: ripple.scale.x,
        })),
        stone: stone.getWorldPosition(new Vector3()),
        tube: { max: tubeBounds.max.clone(), min: tubeBounds.min.clone() },
      }
    },

    scenery: () => {
      let rockery: Object3D | undefined
      const plants: Object3D[] = []
      const rocks: Object3D[] = []
      live().scene.traverse((object) => {
        if (object.userData.aquariumPlant === true) plants.push(object)
        if (object.userData.aquariumRock === true) rocks.push(object)
        if (object.userData.aquariumRockery === true) rockery = object
      })
      if (!rockery) throw new Error('The aquarium has no rockery.')
      return {
        plants: plants.map((plant) => new Box3().setFromObject(plant)),
        rocks: rocks.map((rock) => new Box3().setFromObject(rock)),
        rockery: new Box3().setFromObject(rockery),
      }
    },

    waterSurface: () => {
      let surface: Object3D | undefined
      live().scene.traverse((object) => {
        if (object.userData.aquariumWaterSurface === true) surface = object
      })
      if (!surface) throw new Error('The aquarium has no water surface.')
      return surface.getWorldPosition(new Vector3()).y
    },

    capacity: () => document.querySelector<HTMLOutputElement>('[id$="-tank-volume"]')!,
    heading: () => page.getByRole('heading', { level: 1 }),
    text: (content: string | RegExp) => page.getByText(content),
    loadingCurtain: () => document.getElementById('loading-curtain'),

    /** 放行被 `stallModels` 卡住的模型，让加载走完。 */
    releaseModels: () => releaseModels?.(),

    /** 幕布上那两行字，从上往下：标题、提示。 */
    loadingCurtainWords: () =>
      [...(document.querySelectorAll('#loading-curtain p') ?? [])].map(
        (line) => line.textContent?.trim() ?? '',
      ),

    /**
     * 进度条此刻的读数：屏幕阅读器听到的百分比，和那根条子实际的宽度。
     *
     * 两个一起给，好让用例交叉核对。只断言其中一个都盯不住——`aria-valuenow` 对而
     * 条子不动，看得见的那半就是坏的；反过来屏幕阅读器什么也听不到。
     */
    loadingProgress: () => {
      const bar = document.querySelector('#loading-curtain [role="progressbar"]')
      const announced = bar?.getAttribute('aria-valuenow')
      return {
        announced: announced === null || announced === undefined ? undefined : Number(announced),
        /** 还没拿到真实进度时条子在来回扫，宽度是类名给的，没有内联样式。 */
        barWidth: bar?.querySelector<HTMLElement>('div')?.style.width ?? '',
      }
    },
    modelFailure: () => page.getByRole('alert'),

    controls: () => ({
      close: async () => {
        const toggle = document.querySelector<HTMLButtonElement>(
          '[aria-controls="aquarium-controls"]',
        )
        if (toggle?.getClientRects().length && toggle.ariaExpanded === 'true') {
          await page.getByRole('button', { name: say('controls.close') }).click()
        }
      },
      isOpen: () =>
        document
          .querySelector<HTMLButtonElement>('[aria-controls="aquarium-controls"]')
          ?.getAttribute('aria-expanded') === 'true',
      market: visibleMarketPanel,
      open: openControls,
      trigger: () => page.getByRole('button', { name: say('controls.open') }),
    }),

    showWebGLFallback: async () => {
      const getContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = (() => null) as typeof getContext
      try {
        await rendered.rerender(<App frameloop="never" i18n={i18n} key="unavailable" />)
      } finally {
        HTMLCanvasElement.prototype.getContext = getContext
      }
      return page.getByText(say('webglUnavailable'))
    },

    /**
     * The tank size the picker currently shows, e.g. 标准缸 · 60 × 30 × 36 cm.
     *
     * The picker is a button rather than a native `<select>`, so what a viewer
     * reads is its label, not a form value.
     */
    chosenTankSize: () =>
      document.querySelector('[role="combobox"]')?.textContent?.trim() ?? '',

    /**
     * The 鱼市 panel, as a viewer meets it.
     *
     * 传进来的鱼名就是当前语言下写在面板上的那个，按钮名按同一种语言拼出来——观众
     * 也是这么找的：读到「小丑鱼」那一行，点它右边的加号。
     */
    market: () => ({
      /**
       * Adds one fish of a species by clicking its + button, then waits for the
       * new fish to reach the scene. React commits the click and mounts the model
       * over several frames, so returning any sooner would report a stale tank.
       */
      buy: async (label: string) => {
        await openControls()
        const before = fishGroups().length
        await page.getByRole('button', { name: say('market.addOne', { label }) }).click()
        await settleFish(before + 1)
      },

      /** Removes one fish of a species by clicking its − button. */
      sell: async (label: string) => {
        await openControls()
        const before = fishGroups().length
        await page.getByRole('button', { name: say('market.removeOne', { label }) }).click()
        await settleFish(before - 1)
      },

      /** Whether a species can still be added; false once the tank is full. */
      canBuy: (label: string) => !nameButton(say('market.addOne', { label }))?.disabled,

      canSell: (label: string) => !nameButton(say('market.removeOne', { label }))?.disabled,

      /**
       * The species the market offers, in the order they are listed.
       *
       * Each row reads as e.g. 小丑鱼×2 — the name, then the count that is hidden
       * from screen readers. Only the name is wanted here, so the count is
       * dropped; the ± buttons carry icons rather than text and contribute none.
       */
      offered: () =>
        [...(marketPanel()?.querySelectorAll('li') ?? [])].map((row) =>
          (row.textContent ?? '').replace(/×\d+$/, ''),
        ),

      /** The tally line under the list, e.g. 缸里 6 条 · 上限 8 条. */
      tally: marketTally,

      /**
       * 加减那些按钮的可及名字，屏幕阅读器念出来的就是这些。
       *
       * 断言这个要写字面量。别处的 buy/sell 是拿同一个 i18next 实例算出按钮名再去
       * 点的，模板改了两边一起变，盯不住——只有把话写死在用例里才盯得住。
       */
      buttonNames: () =>
        [...(marketPanel()?.querySelectorAll('button') ?? [])].map(
          (button) => button.getAttribute('aria-label') ?? '',
        ),
    }),

    /**
     * The sizes a viewer can pick from, as written in the dropdown.
     *
     * The list only exists while the dropdown is open — it is a popup layer, not
     * a set of `<option>` elements sitting in the page — so this opens it, reads
     * the rows and closes it again, leaving the page as it was found.
     */
  offeredTankSizes: async () => {
    await openSizePicker()
    const offered: string[] = []
    document.querySelectorAll('[role="option"]').forEach((option) => {
      if (visibleTankOption(option)) offered.push(option.textContent ?? '')
    })
    await userEvent.keyboard('{Escape}')
    return offered
  },

    /** Picks a tank by name, e.g. 迷你缸, and waits for the new scene. */
    chooseTankSize: async (name: string) => {
      await openSizePicker()

      const options = [...document.querySelectorAll('[role="option"]')].filter(
        visibleTankOption,
      )
      const optionIndex = options.findIndex(
        (candidate) =>
          candidate.textContent?.startsWith(name),
      )
      if (optionIndex < 0) {
        throw new Error(`The dropdown offers no tank called ${name}.`)
      }

      await userEvent.keyboard('{Home}')
      for (let step = 0; step < optionIndex; step += 1) {
        await userEvent.keyboard('{ArrowDown}')
      }
      await userEvent.keyboard('{Enter}')
      await vi.waitFor(
        () => {
          if (
            [...document.querySelectorAll('[role="option"]')].some(
              visibleTankOption,
            )
          ) {
            throw new Error('The tank-size dropdown is still closing.')
          }
        },
        { interval: 10, timeout: 2000 },
      )
      await liveScene()
      elapsed = 0
      letTimePass(FRAME_SECONDS)

      /**
       * A smaller tank cannot hold as many fish, so the stocking is thinned as
       * part of the switch. Waiting for the tally to agree with the scene keeps
       * a test from reading the tank mid-change.
       */
      await vi.waitFor(
        () => {
          letTimePass(FRAME_SECONDS)
          /* 两种语言都把缸里的条数写在最前面，取第一个数字就不用管当前是哪种。 */
          const stocked = Number(/\d+/.exec(marketTally())?.[0] ?? -1)
          if (stocked !== fishGroups().length) {
            throw new Error(
              `The market says ${stocked} fish but the tank shows ${fishGroups().length}.`,
            )
          }
        },
        { interval: 10, timeout: 5000 },
      )
    },

    /** 界面此刻用的是哪种语言，读的是文档自己那份记录（`<html lang>`）。 */
    language: currentLanguage,

    /** 标签页上那行字。 */
    documentTitle: () => document.title,

    /**
     * 左下角那排语言按钮，按上面的字点——观众也是这么点的：只认得英文的人在中文
     * 界面上找的就是「English」那一颗。
     */
    chooseLanguage: async (language: Language) => {
      await page.getByRole('button', { name: LANGUAGE_NAMES[language], exact: true }).click()
      await vi.waitFor(() => {
        if (currentLanguage() !== language) {
          throw new Error(`界面还没切到 ${language}。`)
        }
      }, { interval: 10, timeout: 2000 })
    },

    /** 当前语言那一颗是不是被标成了「正在用」。 */
    isLanguageChosen: (language: Language) =>
      textButton(LANGUAGE_NAMES[language])?.getAttribute('aria-pressed') === 'true',

    /**
     * 关掉页面再回来一次。
     *
     * 换掉 key 让 React 把整棵树拆了重挂，并且换一个不带 `lng` 的新实例——所以它
     * 走的是观众下次进来那条路：detector 自己去 localStorage 里翻上次选的那种。
     * 真正的刷新在浏览器测试里做不到，这是最接近的一步。
     */
    revisit: async () => {
      live18n = createI18n()
      await rendered.rerender(
        <App frameloop="never" i18n={live18n} key="revisit" modelUrls={modelUrls} />,
      )
      await liveScene()
      elapsed = 0
      letTimePass(FRAME_SECONDS)
    },

    dragAcross: (pixels: number) => drag(pixels, 0),
    dragDownwards: (pixels: number) => drag(0, pixels),

    /**
     * Scrolls over the tank.
     *
     * The pointer is placed on the left of the canvas, away from the side panels
     * that cover its right, and the button is released first: OrbitControls drops
     * a wheel event unless it is idle, so a drag left mid-gesture by an earlier
     * step would otherwise swallow the scroll.
     */
    scrollWheel: async (deltaY: number, draw = true) => {
      const canvas = document.querySelector('canvas')!
      const at = { x: canvas.clientWidth * 0.28, y: canvas.clientHeight / 2 }

      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, ...at }))
      canvas.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: at.x,
        clientY: at.y,
        deltaY,
      }))
      letTimePass(0.5, draw)
    },

    eachFrame,
    letTimePass,
  }
}
