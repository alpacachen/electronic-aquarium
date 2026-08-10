import { Edges, OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { BackSide, DoubleSide } from 'three'
import { Fish } from './Fish'
import type { FishState } from './fishSimulation'
import type { TankSceneGeometry } from './tankPresets'

const FISH: Array<FishState & { id: string }> = [
  {
    heading: 0.2,
    id: 'amber',
    position: { x: -2.8, y: 0.4, z: -0.55 },
    speed: 0.72,
    turnRate: 0.16,
    verticalVelocity: 0.03,
  },
  {
    heading: 2.4,
    id: 'coral',
    position: { x: 2.1, y: -0.15, z: 0.55 },
    speed: 0.58,
    turnRate: -0.19,
    verticalVelocity: -0.04,
  },
  {
    heading: -1.2,
    id: 'blue',
    position: { x: -0.8, y: -0.9, z: 0.7 },
    speed: 0.66,
    turnRate: 0.22,
    verticalVelocity: 0.05,
  },
  {
    heading: 1.7,
    id: 'sage',
    position: { x: 1.2, y: 1.05, z: -0.9 },
    speed: 0.5,
    turnRate: -0.14,
    verticalVelocity: -0.03,
  },
]

function scaleFishState(state: FishState, geometry: TankSceneGeometry): FishState {
  return {
    ...state,
    position: {
      x: state.position.x * geometry.fishPositionScale.x,
      y: state.position.y * geometry.fishPositionScale.y,
      z: state.position.z * geometry.fishPositionScale.z,
    },
    speed: state.speed * geometry.fishScale,
    verticalVelocity: state.verticalVelocity * geometry.fishScale,
  }
}

function Tank({ geometry }: { geometry: TankSceneGeometry }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, geometry.base.y, 0]}>
        <boxGeometry args={[geometry.base.length, geometry.base.height, geometry.base.depth]} />
        <meshStandardMaterial color="#10191e" roughness={0.3} />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[geometry.size.length, geometry.size.height, geometry.size.depth]} />
        <meshPhysicalMaterial
          color="#bceeff"
          depthWrite={false}
          opacity={0.14}
          roughness={0.05}
          side={BackSide}
          transparent
        />
        <Edges color="#7bc5da" opacity={0.7} transparent />
      </mesh>

      <mesh position={[0, geometry.substrate.y, 0]} receiveShadow>
        <boxGeometry
          args={[geometry.substrate.length, geometry.substrate.height, geometry.substrate.depth]}
        />
        <meshStandardMaterial color="#bfa67b" roughness={0.95} />
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
          color="#087f9e"
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
          color="#57d4e8"
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

function CameraRig({ geometry }: { geometry: TankSceneGeometry }) {
  const camera = useThree(({ camera }) => camera)

  useLayoutEffect(() => {
    camera.position.set(...geometry.camera.position)
    camera.lookAt(0, geometry.camera.targetY, 0)
  }, [camera, geometry])

  return null
}

export function Aquarium({ geometry }: { geometry: TankSceneGeometry }) {
  return (
    <>
      <color attach="background" args={['#061823']} />
      <fog
        attach="fog"
        args={[
          '#061823',
          Math.max(20, geometry.camera.maxDistance * 0.8),
          geometry.camera.maxDistance * 2.2,
        ]}
      />
      <ambientLight intensity={1.2} />
      <directionalLight
        castShadow
        color="#d8f7ff"
        intensity={3.4}
        position={[geometry.size.length * 0.6, geometry.size.height * 1.7, geometry.size.depth * 1.6]}
      />
      <pointLight
        color="#26bde2"
        intensity={22}
        position={[-geometry.size.length * 0.5, geometry.fishCenterY, geometry.size.depth * 0.4]}
      />

      <OrbitControls
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
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
        {FISH.map(({ id, ...initialState }) => (
          <Fish
            bounds={geometry.fishBounds}
            initialState={scaleFishState(initialState, geometry)}
            key={id}
            modelScale={geometry.fishScale}
          />
        ))}
      </group>

      <mesh position={[0, geometry.floorY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[Math.max(70, geometry.size.length * 4), Math.max(70, geometry.size.length * 4)]} />
        <meshStandardMaterial color="#071219" roughness={0.92} />
      </mesh>
    </>
  )
}
