import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Mesh } from 'three'
import { stepFish } from './fishSimulation'
import type { AquariumBounds, FishState } from './fishSimulation'

type FishProps = {
  accent: string
  body: string
  initialState: FishState
  phase: number
}

const FISH_BOUNDS: AquariumBounds = { x: 4.15, y: 2, z: 1.78 }
const MAX_FRAME_DELTA = 0.05

export function Fish({ accent, body, initialState, phase }: FishProps) {
  const fishRef = useRef<Group>(null)
  const tailRef = useRef<Mesh>(null)
  const stateRef = useRef(initialState)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    const elapsed = Math.min(delta, MAX_FRAME_DELTA)
    elapsedRef.current += elapsed
    stateRef.current = stepFish(stateRef.current, elapsed, FISH_BOUNDS)

    const { position, heading } = stateRef.current
    if (fishRef.current) {
      fishRef.current.position.set(position.x, position.y, position.z)
      fishRef.current.rotation.y = -heading
    }

    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(elapsedRef.current * 9 + phase) * 0.32
    }
  })

  return (
    <group ref={fishRef} position={[initialState.position.x, initialState.position.y, initialState.position.z]}>
      <mesh castShadow scale={[0.66, 0.31, 0.27]}>
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial color={body} roughness={0.34} />
      </mesh>

      <mesh castShadow position={[-0.68, 0, 0]} ref={tailRef} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.42, 0.72, 3]} />
        <meshStandardMaterial color={accent} roughness={0.42} />
      </mesh>

      <mesh castShadow position={[0.06, 0.27, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.14, 0.42, 3]} />
        <meshStandardMaterial color={accent} roughness={0.42} />
      </mesh>

      <mesh position={[0.42, 0.1, 0.23]}>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial color="#071219" roughness={0.24} />
      </mesh>
      <mesh position={[0.42, 0.1, -0.23]}>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial color="#071219" roughness={0.24} />
      </mesh>
    </group>
  )
}
