import type { RootState } from '@react-three/fiber'
import type { Camera, Clock, Scene, WebGLRenderer } from 'three'

export type AquariumProbe = Readonly<{
  camera: Camera
  clock: Clock
  gl: WebGLRenderer
  scene: Scene
  tankSize: Readonly<{ depth: number; height: number; length: number }>
  advance(timestamp: number, draw?: boolean): void
  resume(): void
}>

let current: AquariumProbe | undefined

export function setAquariumProbe(
  state: RootState,
  tankSize: AquariumProbe['tankSize'],
) {
  current = {
    camera: state.camera,
    clock: state.clock,
    gl: state.gl,
    scene: state.scene,
    tankSize,
    advance: (timestamp, draw = true) => {
      const render = state.gl.render
      if (!draw) state.gl.render = () => undefined
      try {
        state.advance(timestamp, true)
      } finally {
        state.gl.render = render
      }
    },
    resume: () => state.setFrameloop('always'),
  }
}

export function clearAquariumProbe() {
  current = undefined
}

export function getAquariumProbe() {
  return current
}
