import { Edges } from '@react-three/drei'
import { BackSide, DoubleSide } from 'three'

const TANK_SIZE = [10, 6, 5] as const

function Tank() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, -3.15, 0]}>
        <boxGeometry args={[10.4, 0.35, 5.4]} />
        <meshStandardMaterial color="#10191e" roughness={0.3} />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <boxGeometry args={TANK_SIZE} />
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

      <mesh position={[0, -2.82, 0]} receiveShadow>
        <boxGeometry args={[9.8, 0.25, 4.8]} />
        <meshStandardMaterial color="#bfa67b" roughness={0.95} />
      </mesh>
    </group>
  )
}

function Water() {
  return (
    <group>
      <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[9.72, 5.35, 4.72]} />
        <meshBasicMaterial
          color="#087f9e"
          depthWrite={false}
          opacity={0.13}
          side={BackSide}
          transparent
        />
      </mesh>

      <mesh position={[0, 2.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9.72, 4.72, 32, 16]} />
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

export function Aquarium() {
  return (
    <>
      <color attach="background" args={['#061823']} />
      <fog attach="fog" args={['#061823', 20, 42]} />
      <ambientLight intensity={1.2} />
      <directionalLight
        castShadow
        color="#d8f7ff"
        intensity={3.4}
        position={[6, 10, 8]}
      />
      <pointLight color="#26bde2" intensity={22} position={[-5, 1, 2]} />

      <group position={[0, 0.25, 0]}>
        <Tank />
        <Water />
      </group>

      <mesh position={[0, -3.15, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color="#071219" roughness={0.92} />
      </mesh>
    </>
  )
}
