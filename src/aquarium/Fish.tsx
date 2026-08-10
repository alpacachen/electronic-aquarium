import { Clone, useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { MeshStandardMaterial } from 'three'
import type { AnimationClip, Group, Mesh } from 'three'
import { FISH_SPECIES } from './fishSpecies'
import type { FishSpecies, FishSpeciesId } from './fishSpecies'
import { createFish, stepFish } from './fishSimulation'
import type { AquariumBounds, FishSeed } from './fishSimulation'

type FishProps = {
  bounds: AquariumBounds
  modelScale: number
  seed: FishSeed
  species: FishSpecies
  speciesId: FishSpeciesId
}

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

export function Fish({ bounds, modelScale, seed, species, speciesId }: FishProps) {
  const fishRef = useRef<Group>(null)
  const modelRef = useRef<Group>(null)
  const stateRef = useRef(createFish(seed, bounds))
  const animationTimeRef = useRef(0)
  const tailUniformsRef = useRef<Array<{ value: number }>>([])
  const { animations, scene } = useGLTF(species.modelUrl)
  const swimAnimation = useMemo(() => {
    const source = species.animation
      ? animations.find(({ name }) => name === species.animation?.name) ?? animations[0]
      : undefined
    return source ? startAtFirstKeyframe(source) : undefined
  }, [animations, species.animation])
  const { actions } = useAnimations(swimAnimation ? [swimAnimation] : [], modelRef)

  useLayoutEffect(() => {
    tailUniformsRef.current = []
    modelRef.current?.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh || !species.tail) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((material) => {
        if (!(material instanceof MeshStandardMaterial)) return
        const tail = species.tail!
        material.onBeforeCompile = (shader) => {
          const time = { value: 0 }
          tailUniformsRef.current.push(time)
          shader.uniforms.aquariumTime = time
          shader.vertexShader = shader.vertexShader
            .replace(
              '#include <common>',
              '#include <common>\nuniform float aquariumTime;',
            )
            .replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
              float aquariumTail = smoothstep(${tail.start}, ${tail.end}, position.z * ${tail.direction.toFixed(1)});
              transformed.x += sin(aquariumTime * ${tail.frequency.toFixed(1)} + aquariumTail * 1.5)
                * ${tail.amplitude} * aquariumTail * aquariumTail;`,
            )
        }
        material.customProgramCacheKey = () => JSON.stringify(tail)
        material.needsUpdate = true
      })
    })

    const swim = swimAnimation ? actions[swimAnimation.name] : undefined
    swim?.reset().setEffectiveTimeScale(species.animation?.speed ?? 1).fadeIn(0.25).play()
    return () => {
      swim?.fadeOut(0.25)
    }
  }, [actions, species.animation, species.tail, swimAnimation])

  useFrame((_, delta) => {
    const elapsed = Math.min(delta, MAX_FRAME_DELTA)
    stateRef.current = stepFish(stateRef.current, elapsed, bounds)
    animationTimeRef.current += elapsed
    tailUniformsRef.current.forEach((uniform) => {
      uniform.value = animationTimeRef.current
    })

    const { position, heading, pitch } = stateRef.current
    if (fishRef.current) {
      fishRef.current.position.set(position.x, position.y, position.z)
      /**
       * The model faces +X, so tilting about Z lifts its nose and turning about
       * Y aims it. With no X rotation in play the Euler order reduces to yaw
       * times pitch either way, which applies the tilt in the fish's own frame
       * and leaves it upright however it is heading.
       */
      fishRef.current.rotation.y = -heading
      fishRef.current.rotation.z = pitch
      if (species.tail) {
        fishRef.current.userData.aquariumTailPhase = Math.sin(
          animationTimeRef.current * species.tail.frequency,
        )
      }
    }
  })

  return (
    <group
      ref={fishRef}
      userData={{ aquariumFish: true, aquariumFishSpecies: speciesId }}
      position={[seed.position.x, seed.position.y, seed.position.z]}
      scale={modelScale * species.unitScale}
    >
      <Clone
        deep="materialsOnly"
        object={scene}
        position={[0, -species.centerY, 0]}
        ref={modelRef}
        rotation={[0, species.rotationY, 0]}
      />
    </group>
  )
}

Object.values(FISH_SPECIES).forEach(({ modelUrl }) => useGLTF.preload(modelUrl))
