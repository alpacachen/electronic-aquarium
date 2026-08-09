import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Aquarium } from './aquarium/Aquarium'
import {
  DEFAULT_TANK_ID,
  TANK_PRESETS,
  getTankGeometry,
  getTankPreset,
} from './aquarium/tankPresets'
import type { TankPresetId } from './aquarium/tankPresets'

export function App() {
  const [tankId, setTankId] = useState<TankPresetId>(DEFAULT_TANK_ID)
  const preset = getTankPreset(tankId)
  const geometry = getTankGeometry(preset)

  return (
    <main className="app-shell">
      <Canvas
        key={preset.id}
        camera={{ position: geometry.camera.position, fov: 42 }}
        dpr={[1, 1.5]}
        fallback={
          <div className="webgl-fallback">
            当前浏览器无法启用 WebGL，暂时无法显示电子鱼缸。
          </div>
        }
        gl={{ antialias: true }}
        shadows="basic"
      >
        <Aquarium geometry={geometry} />
      </Canvas>

      <header className="title-card">
        <span>PHASE 01</span>
        <h1>电子鱼缸</h1>
        <p>一片不需要照料的水下世界</p>
      </header>

      <section className="tank-selector" aria-label="鱼缸尺寸选择">
        <label htmlFor="tank-size">鱼缸尺寸</label>
        <select
          id="tank-size"
          value={preset.id}
          onChange={(event) => setTankId(getTankPreset(event.target.value).id)}
        >
          {TANK_PRESETS.map(({ dimensions, id, label }) => (
            <option key={id} value={id}>
              {label} · {dimensions.length} × {dimensions.width} × {dimensions.height} cm
            </option>
          ))}
        </select>
        <output>约 {preset.volumeLiters} L</output>
      </section>

      <div className="control-hint" aria-label="相机操作提示">
        拖动旋转&nbsp;&nbsp;·&nbsp;&nbsp;滚轮缩放
      </div>
    </main>
  )
}
