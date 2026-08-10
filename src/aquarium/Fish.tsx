import { Clone, useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { AnimationClip, Group } from 'three'
import { stepFish } from './fishSimulation'
import type { AquariumBounds, FishState } from './fishSimulation'

type FishProps = {
  bounds: AquariumBounds
  initialState: FishState
  modelScale: number
}

const GOLDFISH_URL = '/models/goldfish/goldfish_variety_3.glb'
// The downloaded GLB is authored in centimetre-like units; this brings its
// roughly 13 cm scene-space length in line with the previous procedural fish.
const MODEL_UNIT_SCALE = 7.5
// The downloaded mesh sits around y=0.0613 in its local coordinates.
const MODEL_CENTER_Y = 0.0613
const MAX_FRAME_DELTA = 0.05

function startAtFirstKeyframe(source: AnimationClip) {
  const clip = source.clone()
  const firstKeyframe = Math.min(
    ...clip.tracks.map((track) => track.times[0] ?? Number.POSITIVE_INFINITY),
  )

  if (Number.isFinite(firstKeyframe) && firstKeyframe > 0) {
    clip.tracks.forEach((track) => track.shift(-firstKeyframe))
    clip.resetDuration()
  }

  return clip
}

export function Fish({ bounds, initialState, modelScale }: FishProps) {
  const fishRef = useRef<Group>(null)
  const modelRef = useRef<Group>(null)
  const stateRef = useRef(initialState)
  const { animations, scene } = useGLTF(GOLDFISH_URL)
  const swimAnimation = useMemo(() => {
    const source = animations.find(({ name }) => name === 'Swim_Slow') ?? animations[0]
    return source ? startAtFirstKeyframe(source) : undefined
  }, [animations])
  const { actions } = useAnimations(swimAnimation ? [swimAnimation] : [], modelRef)

  useLayoutEffect(() => {
    const swim = swimAnimation ? actions[swimAnimation.name] : undefined
    swim?.reset().fadeIn(0.25).play()
    return () => {
      swim?.fadeOut(0.25)
    }
  }, [actions, swimAnimation])

  useFrame((_, delta) => {
    const elapsed = Math.min(delta, MAX_FRAME_DELTA)
    stateRef.current = stepFish(stateRef.current, elapsed, bounds)

    const { position, heading } = stateRef.current
    if (fishRef.current) {
      fishRef.current.position.set(position.x, position.y, position.z)
      fishRef.current.rotation.y = -heading
    }
  })

  return (
    <group
      ref={fishRef}
      userData={{ aquariumFish: true }}
      position={[initialState.position.x, initialState.position.y, initialState.position.z]}
      scale={[modelScale * MODEL_UNIT_SCALE, modelScale * MODEL_UNIT_SCALE, modelScale * MODEL_UNIT_SCALE]}
    >
      <Clone
        object={scene}
        position={[0, -MODEL_CENTER_Y, 0]}
        ref={modelRef}
      />
    </group>
  )
}

useGLTF.preload(GOLDFISH_URL)
