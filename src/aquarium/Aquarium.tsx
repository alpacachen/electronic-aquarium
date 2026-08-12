import { Edges, OrbitControls, SpotLight } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { BackSide, CatmullRomCurve3, DoubleSide, Quaternion, Vector3 } from 'three'
import type { Object3D, SpotLight as SpotLightImpl } from 'three'
import { PALETTE } from './palette'
import { Fish, FishErrorBoundary } from './Fish'
import { FISH_SPECIES } from './fishSpecies'
import type { FishSpeciesId } from './fishSpecies'
import type { FishSeed } from './fishSimulation'
import { clearAquariumProbe, setAquariumProbe } from './aquariumProbe'
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

/** The lamp doesn't take viewer input, so its color and output are fixed. */
const LAMP_COLOR = PALETTE.LAMP
const LAMP_STRENGTH = 0.7

/**
 * A box mesh's local Y axis stretched between two points, for arm segments
 * whose only job is to visually connect a clamp to the lamp head. `length` is
 * measured along that axis, so callers hand it a thickness for the other two.
 */
function strutBetween(from: Vector3, to: Vector3) {
  const delta = to.clone().sub(from)
  const length = delta.length()
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize())
  return { position: from.clone().addScaledVector(delta.normalize(), length / 2), quaternion, length }
}

/**
 * The clamp lamp's shape, in world space. Shared by the visible fixture and
 * the volumetric cone so the beam always originates exactly at the bulb.
 */
function lampFixture(geometry: TankSceneGeometry) {
  const rimY = geometry.size.height / 2
  const clampPos = new Vector3(geometry.size.length / 2 - 0.05, rimY, geometry.size.depth / 2 - 0.05)
  const postTop = clampPos.clone().add(new Vector3(0, 0.45, 0))
  const armEnd = new Vector3(0, rimY + 0.6, 0)
  const aimTarget = new Vector3(0, geometry.fishCenterY, 0)
  const aimDir = aimTarget.clone().sub(armEnd).normalize()

  const shadeHeight = 0.26
  const headCenter = armEnd.clone().addScaledVector(aimDir, shadeHeight / 2)
  const headQuaternion = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), aimDir)
  const bulbCenter = armEnd.clone().addScaledVector(aimDir, shadeHeight * 0.85)

  return {
    aimTarget,
    bulbCenter,
    headCenter,
    headQuaternion,
    post: strutBetween(clampPos, postTop),
    arm: strutBetween(postTop, armEnd),
    clampPos,
    shadeHeight,
  }
}

/**
 * A clamp lamp gripping the tank's front-right rim, its arm reaching in over
 * the water so the head can rake light across the tank at an angle instead of
 * flooding it from directly overhead — that angle is what reads as a real
 * light source rather than a flat fill.
 */
function Lamp({ fixture }: { fixture: ReturnType<typeof lampFixture> }) {
  const spotRef = useRef<SpotLightImpl>(null)
  const targetRef = useRef<Object3D>(null)

  useLayoutEffect(() => {
    if (spotRef.current && targetRef.current) {
      spotRef.current.target = targetRef.current
    }
  })

  const { aimTarget, bulbCenter, headCenter, headQuaternion, post, arm, clampPos, shadeHeight } = fixture

  /**
   * Physical light units make a point/spot light this close to its target
   * blow out to solid white well before intensity reaches high values — the
   * decay is a squared falloff over a distance of about one world unit.
   * This intensity was tuned by eye against the tank's own scale rather than
   * derived from a formula.
   */
  const intensity = 2.5 + LAMP_STRENGTH * 8
  const beamDistance = bulbCenter.distanceTo(aimTarget) * 1.2

  return (
    <group userData={{ aquariumLamp: true }}>
      <SpotLight
        ref={spotRef}
        angle={0.62}
        anglePower={4}
        attenuation={beamDistance * 0.75}
        castShadow
        color={LAMP_COLOR}
        decay={2}
        distance={beamDistance}
        intensity={intensity}
        opacity={0.16 + LAMP_STRENGTH * 0.3}
        penumbra={0.5}
        position={bulbCenter}
        radiusBottom={beamDistance * Math.tan(0.62)}
        radiusTop={0.015}
        userData={{ aquariumLampLight: true }}
      />
      <object3D ref={targetRef} position={aimTarget} />

      <mesh position={clampPos}>
        <boxGeometry args={[0.16, 0.22, 0.16]} />
        <meshStandardMaterial color={PALETTE.CABINET} roughness={0.4} />
      </mesh>
      <mesh position={post.position} quaternion={post.quaternion}>
        <cylinderGeometry args={[0.035, 0.035, post.length, 12]} />
        <meshStandardMaterial color={PALETTE.CABINET} roughness={0.4} />
      </mesh>
      <mesh position={arm.position} quaternion={arm.quaternion}>
        <cylinderGeometry args={[0.035, 0.035, arm.length, 12]} />
        <meshStandardMaterial color={PALETTE.CABINET} roughness={0.4} />
      </mesh>

      {/*
        Open at the bottom (openEnded) so the bulb inside stays visible instead
        of being capped by the shade's own base.
      */}
      <mesh castShadow position={headCenter} quaternion={headQuaternion}>
        <coneGeometry args={[0.16, shadeHeight, 24, 1, true]} />
        <meshStandardMaterial color={PALETTE.CABINET} roughness={0.35} side={DoubleSide} />
      </mesh>
      <mesh position={bulbCenter} quaternion={headQuaternion}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color={LAMP_COLOR} emissive={LAMP_COLOR} emissiveIntensity={LAMP_STRENGTH} />
      </mesh>
    </group>
  )
}

function airPumpFixture(geometry: TankSceneGeometry) {
  const sideX = geometry.size.length / 2
  const rimY = geometry.size.height / 2
  const topOfSubstrate = geometry.substrate.y + geometry.substrate.height / 2
  const z = geometry.size.depth * 0.18
  const pump = new Vector3(sideX + 0.34, rimY - 0.5, z)
  const diffuser = new Vector3(sideX * 0.28, topOfSubstrate + 0.07, z)
  const outlet = pump.clone().add(new Vector3(-0.3, 0.2, 0))
  const tube = new CatmullRomCurve3([
    outlet,
    new Vector3(sideX + 0.12, rimY + 0.14, z),
    new Vector3(sideX - 0.16, rimY + 0.08, z),
    new Vector3(sideX - 0.2, diffuser.y + 0.5, z),
    diffuser.clone().add(new Vector3(0, 0.08, 0)),
  ])
  return { diffuser, outlet, pump, rimY, sideX, tube }
}

const BUBBLES = Array.from({ length: 18 }, (_, index) => {
  const noise = (salt: number) => {
    const mixed = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453
    return mixed - Math.floor(mixed)
  }
  return {
    phase: noise(1),
    radius: 0.025 + noise(2) * 0.035,
    speed: 0.18 + noise(3) * 0.12,
    x: noise(4) * 2 - 1,
    z: noise(5) * 2 - 1,
  }
})

const RIPPLE_LIFETIME = 0.9

function Bubbles({ diffuser, surfaceY }: { diffuser: Vector3; surfaceY: number }) {
  const refs = useRef<Array<Object3D | null>>([])
  const rippleRefs = useRef<Array<Object3D | null>>([])

  useFrame(({ clock }) => {
    BUBBLES.forEach((bubble, index) => {
      const object = refs.current[index]
      const ripple = rippleRefs.current[index]
      if (!object) return
      const cycle = bubble.phase + clock.elapsedTime * bubble.speed
      const progress = cycle % 1
      const spread = 0.08 + progress * 0.18
      object.position.set(
        diffuser.x + bubble.x * spread + Math.sin(clock.elapsedTime * 2 + index) * 0.025,
        diffuser.y + 0.1 + progress * (surfaceY - diffuser.y - 0.14),
        diffuser.z + bubble.z * spread,
      )

      if (ripple) {
        const age = progress / bubble.speed
        const strength = Math.max(0, 1 - age / RIPPLE_LIFETIME)
        ripple.position.set(object.position.x, surfaceY + 0.01, object.position.z)
        ripple.scale.setScalar(strength > 0 ? 0.05 + age * 0.18 : 0)
        ;(ripple as Object3D & { material?: { opacity: number } }).material!.opacity =
          strength * 0.5
      }
    })
  })

  return (
    <group userData={{ aquariumBubbles: true }}>
      {BUBBLES.map((bubble, index) => (
        <group key={index}>
          <mesh
            position={[
              diffuser.x + bubble.x * (0.08 + bubble.phase * 0.18) + Math.sin(index) * 0.025,
              diffuser.y + 0.1 + bubble.phase * (surfaceY - diffuser.y - 0.14),
              diffuser.z + bubble.z * (0.08 + bubble.phase * 0.18),
            ]}
            ref={(object) => {
              refs.current[index] = object
            }}
            scale={bubble.radius}
            userData={{ aquariumBubble: true }}
          >
            <sphereGeometry args={[1, 10, 8]} />
            <meshPhysicalMaterial
              color={PALETTE.PANE}
              depthWrite={false}
              opacity={0.58}
              roughness={0}
              transparent
              transmission={0.4}
            />
          </mesh>
          <mesh
            ref={(object) => {
              rippleRefs.current[index] = object
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            userData={{ aquariumRipple: true }}
          >
            <ringGeometry args={[0.6, 1, 24]} />
            <meshBasicMaterial
              color={PALETTE.WATERLINE}
              depthWrite={false}
              opacity={0}
              transparent
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function AirPump({
  fixture,
  surfaceY,
}: {
  fixture: ReturnType<typeof airPumpFixture>
  surfaceY: number
}) {
  const { diffuser, outlet, pump, rimY, sideX, tube } = fixture

  return (
    <group>
      <group position={pump} userData={{ aquariumAirPump: true }}>
        <mesh castShadow>
          <boxGeometry args={[0.58, 0.82, 0.56]} />
          <meshStandardMaterial color={PALETTE.CABINET} roughness={0.45} />
        </mesh>
        <mesh position={[0.3, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.14, 0.14, 0.025, 20]} />
          <meshStandardMaterial color={PALETTE.PANE_EDGE} roughness={0.35} />
        </mesh>
      </group>

      <mesh position={[sideX + 0.05, rimY - 0.22, pump.z]}>
        <boxGeometry args={[0.12, 0.44, 0.18]} />
        <meshStandardMaterial color={PALETTE.CABINET} roughness={0.45} />
      </mesh>
      <mesh position={outlet} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.055, 0.055, 0.12, 12]} />
        <meshStandardMaterial color={PALETTE.PANE_EDGE} roughness={0.25} />
      </mesh>

      <mesh userData={{ aquariumAirTube: true }}>
        <tubeGeometry args={[tube, 48, 0.025, 8, false]} />
        <meshPhysicalMaterial
          color={PALETTE.PANE}
          depthWrite={false}
          opacity={0.48}
          roughness={0}
          transparent
          transmission={0.5}
        />
      </mesh>

      <mesh position={diffuser} userData={{ aquariumAirStone: true }}>
        <cylinderGeometry args={[0.28, 0.28, 0.08, 24]} />
        <meshStandardMaterial color={PALETTE.PANE_EDGE} roughness={0.85} />
      </mesh>
      <Bubbles diffuser={diffuser} surfaceY={surfaceY} />
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

function AquariumProbe({ geometry }: { geometry: TankSceneGeometry }) {
  const state = useThree()

  useEffect(() => {
    setAquariumProbe(state, geometry.size)
    return clearAquariumProbe
  }, [geometry.size, state])

  return null
}

export function Aquarium({
  fish,
  geometry,
  modelUrls,
  onFishError,
}: {
  fish: readonly StockedFish[]
  geometry: TankSceneGeometry
  modelUrls?: Partial<Record<FishSpeciesId, string>>
  onFishError(species: FishSpeciesId): void
}) {
  const fixture = lampFixture(geometry)
  const airPump = airPumpFixture(geometry)

  return (
    <>
      <AquariumProbe geometry={geometry} />
      <color attach="background" args={[PALETTE.ABYSS]} />
      <fog
        attach="fog"
        args={[
          PALETTE.ABYSS,
          Math.max(20, geometry.camera.maxDistance * 0.8),
          geometry.camera.maxDistance * 2.2,
        ]}
      />
      <ambientLight intensity={1.1} />
      <directionalLight
        color={PALETTE.SUNLIGHT}
        intensity={2.4}
        position={[geometry.size.length * 0.6, geometry.size.height * 1.7, geometry.size.depth * 1.6]}
      />
      <Lamp fixture={fixture} />
      <AirPump fixture={airPump} surfaceY={geometry.water.surfaceY} />

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
                modelUrl={modelUrls?.[species]}
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
