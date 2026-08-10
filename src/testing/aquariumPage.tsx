import { _roots, advance } from '@react-three/fiber'
import { afterEach, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { Box3, Vector3 } from 'three'
import type { Mesh, Object3D, WebGLRenderer } from 'three'
import { App } from '../App'
import '../styles.css'

/**
 * The app fills its host element, but the test container is an unsized div.
 * Handing it the viewport lets the canvas lay out at its real size, which both
 * the camera aspect ratio and every pointer interaction depend on.
 */
const layout = document.createElement('style')
layout.textContent = 'body > div { width: 100vw; height: 100vh; margin: 0 }'
document.head.append(layout)

/** The tank is a group of three meshes: cabinet, glass box and substrate. */
const MESHES_PER_TANK = 3

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
  _roots.forEach((root) => root.store.setState({ frameloop: 'always' }))
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
  /** Sums the fish's bone rotations, so any change of pose shows up as a change here. */
  poseKey: number
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

/** The tail bone each species swings, whatever its rig chose to call it. */
const TAIL_BONES = ['goldfish2Tail1_021', 'Tail']

/** The 鱼市 tally line, e.g. 缸里 6 条 · 上限 8 条. */
const marketTally = () =>
  document.querySelector('.fish-market__total')?.textContent ?? ''

/** Finds a button by its accessible name, for checking whether it is disabled. */
function nameButton(name: string) {
  return [...document.querySelectorAll('button')].find(
    (button) => button.getAttribute('aria-label') === name,
  )
}

function readFish(group: Object3D): RenderedFish {
  const tailAngle = () => {
    const bone = TAIL_BONES.map((name) => group.getObjectByName(name)).find(Boolean)
    return bone?.quaternion.z
      ?? Number(group.userData.aquariumTailPhase ?? group.rotation.y)
  }

  /**
   * Skinned meshes are posed on the GPU, so a bounding box of the geometry
   * reports the bind pose rather than what is on screen. Summing the bone
   * rotations is enough to tell one pose from another.
   */
  const poseKey = () => {
    let sum = 0
    group.traverse((object) => {
      if ((object as { isBone?: boolean }).isBone !== true) return
      sum += object.quaternion.x + object.quaternion.y + object.quaternion.z
    })
    return sum
  }

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
    get poseKey() {
      return poseKey()
    },
    position: { x: group.position.x, y: group.position.y, z: group.position.z },
    scale: group.scale.x,
    species: String(group.userData.aquariumFishSpecies ?? ''),
    get tailAngle() {
      return tailAngle()
    },
    get topY() {
      return extent().max.y
    },
  }
}

function readBoxSize(mesh: Mesh): RenderedTank {
  const { depth, height, width } = (
    mesh.geometry as unknown as {
      parameters: { depth: number; height: number; width: number }
    }
  ).parameters
  return { depth, height, length: width }
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
        const canvas = document.querySelector('canvas')
        const state = canvas ? _roots.get(canvas)?.store.getState() : undefined
        if (!state || state.scene.children.length === 0) {
          throw new Error('The aquarium scene has not been rendered yet.')
        }
        return state
      },
      { interval: 50, timeout: 5000 },
    )

    openRenderers.add(found.gl)
    found.clock.elapsedTime = 0
    return found
  }

  let scene = await liveScene()
  let elapsed = 0

  const groupsOf = (meshCount: number) => {
    const found: Object3D[] = []
    scene.scene.traverse((object) => {
      if (object.type === 'Group' && object.children.length === meshCount) {
        found.push(object)
      }
    })
    return found
  }

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
    const { internal } = scene
    const priority = internal.priority

    internal.priority = 1
    try {
      for (let frame = 0; frame < frames - 1; frame += 1) {
        elapsed += FRAME_SECONDS
        advance(elapsed, true, scene)
      }
    } finally {
      internal.priority = priority
    }

    elapsed += FRAME_SECONDS
    advance(elapsed, true, scene)
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
    tank: (): RenderedTank => readBoxSize(groupsOf(MESHES_PER_TANK)[0]!.children[1] as Mesh),

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
    sizePicker: () => page.getByRole('combobox'),
    text: (content: string | RegExp) => page.getByText(content),

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

      /** The species the market offers, in the order they are listed. */
      offered: () =>
        [...document.querySelectorAll('.fish-market__name')].map(
          (name) => name.textContent ?? '',
        ),

      /** The tally line under the list, e.g. 缸里 6 条 · 上限 8 条. */
      tally: marketTally,
    }),

    /** The sizes a viewer can pick from, as written in the dropdown. */
    offeredTankSizes: () =>
      [...document.querySelectorAll('option')].map((option) => option.textContent ?? ''),

    /** Picks a tank by name, e.g. 迷你缸, and waits for the new scene. */
    chooseTankSize: async (name: string) => {
      const option = [...document.querySelectorAll('option')].find((candidate) =>
        candidate.textContent?.startsWith(name),
      )
      if (!option) {
        throw new Error(`The dropdown offers no tank called ${name}.`)
      }

      await page.getByRole('combobox').selectOptions(option.textContent!)
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

    letTimePass,
  }
}
