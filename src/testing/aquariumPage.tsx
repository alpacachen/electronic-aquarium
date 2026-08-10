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
  position: Readonly<{ x: number; y: number; z: number }>
  headingY: number
  scale: number
  tailAngle: number
  topY: number
}>

export type RenderedTank = Readonly<{
  depth: number
  height: number
  length: number
}>

function readFish(group: Object3D): RenderedFish {
  const tailAngle = group.getObjectByName('goldfish2Tail1_021')?.quaternion.z ?? group.rotation.y
  const bounds = new Box3().setFromObject(group)
  return {
    headingY: group.rotation.y,
    position: { x: group.position.x, y: group.position.y, z: group.position.z },
    scale: group.scale.x,
    tailAngle,
    topY: bounds.max.y,
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

  /** Drags the pointer across the canvas, the way a viewer swings the view. */
  const drag = async (right: number, down: number) => {
    const canvas = document.querySelector('canvas')!
    const from = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }
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
    },

    dragAcross: (pixels: number) => drag(pixels, 0),
    dragDownwards: (pixels: number) => drag(0, pixels),

    scrollWheel: async (deltaY: number) => {
      await userEvent.wheel(document.querySelector('canvas')!, { delta: { y: deltaY } })
      letTimePass(0.5)
    },

    letTimePass,
  }
}
