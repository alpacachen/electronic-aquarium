import { Canvas } from '@react-three/fiber'
import { Aquarium } from './aquarium/Aquarium'

export function App() {
  return (
    <main className="app-shell">
      <Canvas
        camera={{ position: [12, 7, 12], fov: 42 }}
        dpr={[1, 1.5]}
        fallback={
          <div className="webgl-fallback">
            当前浏览器无法启用 WebGL，暂时无法显示电子鱼缸。
          </div>
        }
        gl={{ antialias: true }}
        shadows="basic"
      >
        <Aquarium />
      </Canvas>

      <header className="title-card">
        <span>PHASE 01</span>
        <h1>电子鱼缸</h1>
        <p>一片不需要照料的水下世界</p>
      </header>

      <div className="control-hint" aria-label="相机操作提示">
        拖动旋转&nbsp;&nbsp;·&nbsp;&nbsp;滚轮缩放
      </div>
    </main>
  )
}
