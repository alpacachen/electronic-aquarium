import { afterEach, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { Box3, Vector3 } from 'three'
import type { Object3D, WebGLRenderer } from 'three'
import { App } from '../App'
import { getAquariumProbe } from '../aquarium/aquariumProbe'
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

function release(renderer: WebGLRenderer) {
  openRenderers.delete(renderer)
  renderer.forceContextLoss()
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
})

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

/** The 鱼市 panel, found by the name a screen reader would read out. */
const marketPanel = () => document.querySelector('[aria-label="鱼市"]')

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
export async function openAquarium() {
  render(<App frameloop="never" />)

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

  let scene = await liveScene()
  let elapsed = 0

  const fishGroups = () => {
    const found: Object3D[] = []
    scene.scene.traverse((object) => {
      if (object.userData.aquariumFish === true) {
        found.push(object)
      }
    })
    return found
  }

  /**
   * Runs the render loop for a stretch of aquarium time, in seconds.
   *
   * Only the last frame is drawn. Every frame still runs the animation, but
   * repainting each one would spend seconds in the software rasteriser without
   * changing what the final frame looks like.
   */
  const letTimePass = (seconds = 1) => {
    const frames = Math.max(1, Math.round(seconds / FRAME_SECONDS))
    for (let frame = 0; frame < frames - 1; frame += 1) {
      elapsed += FRAME_SECONDS
      scene.advance(elapsed, false)
    }

    elapsed += FRAME_SECONDS
    scene.advance(elapsed)
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
      scene.advance(elapsed, false)
      sample()
    }

    scene.advance(elapsed)
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
    if (document.querySelector('[role="option"]')) return
    await page.getByRole('combobox').click()
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
    tank: (): RenderedTank => scene.tankSize,

    camera: () => ({
      distance: scene.camera.position.length(),
      height: scene.camera.position.y,
      position: scene.camera.position.clone(),
    }),

    waterSurface: () => {
      let surface: Object3D | undefined
      scene.scene.traverse((object) => {
        if (object.userData.aquariumWaterSurface === true) surface = object
      })
      if (!surface) throw new Error('The aquarium has no water surface.')
      return surface.getWorldPosition(new Vector3()).y
    },

    capacity: () => page.getByRole('status'),
    heading: () => page.getByRole('heading', { level: 1 }),
    text: (content: string | RegExp) => page.getByText(content),

    /**
     * The tank size the picker currently shows, e.g. 标准缸 · 60 × 30 × 36 cm.
     *
     * The picker is a button rather than a native `<select>`, so what a viewer
     * reads is its label, not a form value.
     */
    chosenTankSize: () =>
      document.querySelector('[role="combobox"]')?.textContent?.trim() ?? '',

    /** The 鱼市 panel, as a viewer meets it. */
    market: () => ({
      /**
       * Adds one fish of a species by clicking its + button, then waits for the
       * new fish to reach the scene. React commits the click and mounts the model
       * over several frames, so returning any sooner would report a stale tank.
       */
      buy: async (label: string) => {
        const before = fishGroups().length
        await page.getByRole('button', { name: `多养一条${label}` }).click()
        await settleFish(before + 1)
      },

      /** Removes one fish of a species by clicking its − button. */
      sell: async (label: string) => {
        const before = fishGroups().length
        await page.getByRole('button', { name: `少养一条${label}` }).click()
        await settleFish(before - 1)
      },

      /** Whether a species can still be added; false once the tank is full. */
      canBuy: (label: string) =>
        !nameButton(`多养一条${label}`)?.disabled,

      canSell: (label: string) =>
        !nameButton(`少养一条${label}`)?.disabled,

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
      const offered = [...document.querySelectorAll('[role="option"]')].map(
        (option) => option.textContent ?? '',
      )
      await userEvent.keyboard('{Escape}')
      return offered
    },

    /** Picks a tank by name, e.g. 迷你缸, and waits for the new scene. */
    chooseTankSize: async (name: string) => {
      await openSizePicker()

      const option = [...document.querySelectorAll('[role="option"]')].find((candidate) =>
        candidate.textContent?.startsWith(name),
      )
      if (!option) {
        throw new Error(`The dropdown offers no tank called ${name}.`)
      }

      await page.getByRole('option', { name: option.textContent! }).click()
      scene = await liveScene()
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
          const stocked = Number(/缸里 (\d+) 条/.exec(marketTally())?.[1] ?? -1)
          if (stocked !== fishGroups().length) {
            throw new Error(
              `The market says ${stocked} fish but the tank shows ${fishGroups().length}.`,
            )
          }
        },
        { interval: 10, timeout: 5000 },
      )
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
    scrollWheel: async (deltaY: number) => {
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
      letTimePass(0.5)
    },

    eachFrame,
    letTimePass,
  }
}
