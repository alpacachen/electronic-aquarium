import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { MeshStandardMaterial } from 'three'
import { clone as cloneSkinnedModel } from 'three/examples/jsm/utils/SkeletonUtils.js'
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
  /**
   * Every fish gets its own copy of the model, skeleton included.
   *
   * useGLTF caches one scene per URL, and its bones are ordinary objects that can
   * only hang in one place at a time. Mounting a second fish of a species used to
   * adopt those shared bones and so tear them out of the fish already swimming:
   * the tank went from 90 bones to 6 the moment a viewer bought a fish, and every
   * older fish was left a skinned mesh with nothing to deform it — drifting along
   * with a rigid body. SkeletonUtils' clone is the deep copy that rebinds a
   * skinned mesh to its own bones.
   *
   * Memoised on the source scene so a re-render reuses the copy rather than
   * rebuilding the model mid-swim.
   */
  const model = useMemo(() => {
    const copy = cloneSkinnedModel(scene)
    /**
     * Materials are still shared by the copy, and the tail shader below is
     * compiled per fish, so each one needs materials of its own — otherwise the
     * last fish to mount would dictate how every other one waves its tail.
     */
    copy.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) => material.clone())
        : mesh.material.clone()
    })
    return copy
  }, [scene])

  /**
   * The clip list has to keep its identity across renders: useAnimations treats a
   * new array as a new set of clips, and its cleanup stops every action.
   */
  const clips = useMemo(() => (swimAnimation ? [swimAnimation] : []), [swimAnimation])
  const { actions } = useAnimations(clips, modelRef)

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

  /**
   * The cloned materials hold GPU resources, and a viewer can take a fish out of
   * the tank at any time, so they are released when this fish goes. The geometry
   * and textures are not: those still belong to the cached GLTF that every fish
   * of the species shares.
   */
  useEffect(() => {
    return () => {
      model.traverse((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach((material) => material.dispose())
      })
    }
  }, [model])

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
      <primitive
        object={model}
        position={[0, -species.centerY, 0]}
        ref={modelRef}
        rotation={[0, species.rotationY, 0]}
      />
    </group>
  )
}

Object.values(FISH_SPECIES).forEach(({ modelUrl }) => useGLTF.preload(modelUrl))
