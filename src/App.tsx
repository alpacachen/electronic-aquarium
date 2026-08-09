import { Canvas } from '@react-three/fiber'
import { Aquarium } from './aquarium/Aquarium'

export function App() {
  return (
    <main className="app-shell">
      <Canvas
        camera={{ position: [12, 7, 12], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        shadows
      >
        <Aquarium />
      </Canvas>

      <header className="title-card">
        <span>PHASE 01</span>
        <h1>电子鱼缸</h1>
        <p>一片不需要照料的水下世界</p>
      </header>
    </main>
  )
}
