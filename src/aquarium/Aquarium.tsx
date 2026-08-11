import { Edges, OrbitControls, useProgress } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { BackSide, DoubleSide } from 'three'
import { PALETTE } from './palette'
import { Fish, FishErrorBoundary } from './Fish'
import { FISH_SPECIES } from './fishSpecies'
import type { FishSpeciesId } from './fishSpecies'
import type { FishSeed } from './fishSimulation'
import { liftLoadingCurtain } from './loadingCurtain'
import type { StockedFish } from './stocking'
import type { TankSceneGeometry } from './tankPresets'

/**
 * Scales a fish written in standard-tank units to whichever tank is on screen.
 * Its cruise is left alone: depth and range are fractions of the tank, and the
 * periods are seconds, so both already carry over to any size.
 */
function scaleFishSeed(seed: FishSeed, geometry: TankSceneGeometry): FishSeed {
  return {
    ...seed,
    position: {
      x: seed.position.x * geometry.fishPositionScale.x,
      y: seed.position.y * geometry.fishPositionScale.y,
      z: seed.position.z * geometry.fishPositionScale.z,
    },
    speed: seed.speed * geometry.fishScale,
  }
}

function Tank({ geometry }: { geometry: TankSceneGeometry }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, geometry.base.y, 0]}>
        <boxGeometry args={[geometry.base.length, geometry.base.height, geometry.base.depth]} />
        <meshStandardMaterial color={PALETTE.CABINET} roughness={0.3} />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[geometry.size.length, geometry.size.height, geometry.size.depth]} />
        <meshPhysicalMaterial
          color={PALETTE.PANE}
          depthWrite={false}
          opacity={0.14}
          roughness={0.05}
          side={BackSide}
          transparent
        />
        <Edges color={PALETTE.PANE_EDGE} opacity={0.7} transparent />
      </mesh>

      <mesh position={[0, geometry.substrate.y, 0]} receiveShadow>
        <boxGeometry
          args={[geometry.substrate.length, geometry.substrate.height, geometry.substrate.depth]}
        />
        <meshStandardMaterial color={PALETTE.SUBSTRATE} roughness={0.95} />
      </mesh>
    </group>
  )
}

function Water({ geometry }: { geometry: TankSceneGeometry }) {
  return (
    <group>
      <mesh position={[0, geometry.water.centerY, 0]}>
        <boxGeometry args={[geometry.water.length, geometry.water.height, geometry.water.depth]} />
        <meshBasicMaterial
          color={PALETTE.WATER}
          depthWrite={false}
          opacity={0.13}
          side={BackSide}
          transparent
        />
      </mesh>

      <mesh
        position={[0, geometry.water.surfaceY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        userData={{ aquariumWaterSurface: true }}
      >
        <planeGeometry args={[geometry.water.length, geometry.water.depth]} />
        <meshPhysicalMaterial
          color={PALETTE.WATERLINE}
          depthWrite={false}
          ior={1.333}
          opacity={0.62}
          roughness={0.16}
          side={DoubleSide}
          transparent
          transmission={0.35}
        />
      </mesh>
    </group>
  )
}

/**
 * Frames a newly chosen tank, then leaves the camera to the viewer.
 *
 * Placing the camera is a one-off per tank, not a property of the render: a
 * viewer who has swung the view around expects it to stay where they left it
 * while they stock the tank. Keying off the framing itself rather than the
 * geometry object means an unrelated re-render cannot move the camera, however
 * the scene above chose to derive its props.
 */
function CameraRig({ geometry }: { geometry: TankSceneGeometry }) {
  const camera = useThree(({ camera }) => camera)
  const controls = useThree(({ controls }) => controls)
  const [x, y, z] = geometry.camera.position
  const { targetY } = geometry.camera

  useLayoutEffect(() => {
    camera.position.set(x, y, z)
    camera.lookAt(0, targetY, 0)

    /**
     * OrbitControls holds its own orbit around a target and writes the camera
     * every frame, so moving the camera behind its back would be undone on the
     * next one. Handing it the new target and letting it recompute keeps the two
     * in agreement.
     */
    const orbit = controls as { target?: { set(x: number, y: number, z: number): void }; update?(): void } | null
    orbit?.target?.set(0, targetY, 0)
    orbit?.update?.()
  }, [camera, controls, targetY, x, y, z])

  return null
}

function LoadingCurtainBridge() {
  const { active, errors, progress, total } = useProgress()
  const started = useRef(false)

  useEffect(() => {
    if (active || total > 0) started.current = true
    if (started.current && !active) liftLoadingCurtain(progress, errors)
  }, [active, errors, progress, total])

  return null
}

export function Aquarium({
  fish,
  geometry,
  onFishError,
}: {
  fish: readonly StockedFish[]
  geometry: TankSceneGeometry
  onFishError(species: FishSpeciesId): void
}) {
  return (
    <>
      <LoadingCurtainBridge />
      <color attach="background" args={[PALETTE.ABYSS]} />
      <fog
        attach="fog"
        args={[
          PALETTE.ABYSS,
          Math.max(20, geometry.camera.maxDistance * 0.8),
          geometry.camera.maxDistance * 2.2,
        ]}
      />
      <ambientLight intensity={1.2} />
      <directionalLight
        castShadow
        color={PALETTE.SUNLIGHT}
        intensity={3.4}
        position={[geometry.size.length * 0.6, geometry.size.height * 1.7, geometry.size.depth * 1.6]}
      />
      <pointLight
        color={PALETTE.LAMP}
        intensity={22}
        position={[-geometry.size.length * 0.5, geometry.fishCenterY, geometry.size.depth * 0.4]}
      />

      {/*
        makeDefault publishes the controls on the scene state, which is how the
        rig above finds them when it needs to re-aim at a new tank.
      */}
      <OrbitControls
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        makeDefault
        maxDistance={geometry.camera.maxDistance}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={geometry.camera.minDistance}
        minPolarAngle={0.18}
        target={[0, geometry.camera.targetY, 0]}
      />
      <CameraRig geometry={geometry} />

      <Tank geometry={geometry} />
      <Water geometry={geometry} />

      <group position={[0, geometry.fishCenterY, 0]}>
        {fish.map(({ id, species, ...seed }) => (
          <FishErrorBoundary key={id} onError={() => onFishError(species)}>
            <Suspense fallback={null}>
              <Fish
                bounds={geometry.fishBounds}
                modelScale={geometry.fishScale}
                seed={scaleFishSeed(seed, geometry)}
                species={FISH_SPECIES[species]}
                speciesId={species}
              />
            </Suspense>
          </FishErrorBoundary>
        ))}
      </group>

      <mesh position={[0, geometry.floorY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[Math.max(70, geometry.size.length * 4), Math.max(70, geometry.size.length * 4)]} />
        <meshStandardMaterial color={PALETTE.FLOOR} roughness={0.92} />
      </mesh>
    </>
  )
}
