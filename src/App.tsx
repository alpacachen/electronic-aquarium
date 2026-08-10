import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Aquarium } from './aquarium/Aquarium'
import { FishMarket } from './aquarium/FishMarket'
import type { FishSpeciesId } from './aquarium/fishSpecies'
import { stockTank, stockingCapacity } from './aquarium/stocking'
import {
  DEFAULT_TANK_ID,
  TANK_PRESETS,
  getTankGeometry,
  getTankPreset,
} from './aquarium/tankPresets'
import type { TankPresetId } from './aquarium/tankPresets'

/** What the tank holds before a viewer changes anything. */
const DEFAULT_STOCK: Partial<Record<FishSpeciesId, number>> = {
  barramundi: 1,
  blueTang: 1,
  clownfish: 1,
  goldfish: 2,
  tuna: 1,
}

type AppProps = {
  /**
   * How the scene is driven. Defaults to a continuous loop; `never` hands the
   * clock to the caller, which lets tests advance time on their own terms.
   */
  frameloop?: 'always' | 'never'
}

export function App({ frameloop = 'always' }: AppProps = {}) {
  const [tankId, setTankId] = useState<TankPresetId>(DEFAULT_TANK_ID)
  const [counts, setCounts] = useState(DEFAULT_STOCK)
  const preset = getTankPreset(tankId)
  /**
   * Derived only when the tank changes. The scene reads the camera's framing out
   * of this, so handing down a fresh object on every render would swing the view
   * back to its default angle each time a viewer touched the fish market.
   */
  const geometry = useMemo(() => getTankGeometry(preset), [preset])
  const camera = useMemo(
    () => ({ fov: 42, position: geometry.camera.position }),
    [geometry],
  )
  const capacity = stockingCapacity(preset.volumeLiters)

  /**
   * Rebuilding the stock list on every render would hand each Fish a new seed
   * and restart it mid-swim, so the list is derived only when the counts change.
   */
  const fish = useMemo(() => stockTank(counts), [counts])

  const add = (species: FishSpeciesId) => {
    setCounts((current) => {
      const stocked = Object.values(current).reduce((sum, count) => sum + (count ?? 0), 0)
      if (stocked >= capacity) return current
      return { ...current, [species]: (current[species] ?? 0) + 1 }
    })
  }

  const remove = (species: FishSpeciesId) => {
    setCounts((current) => {
      const count = current[species] ?? 0
      if (count === 0) return current
      return { ...current, [species]: count - 1 }
    })
  }

  /**
   * Moving to a smaller tank can leave more fish than it holds, so the stocking
   * is thinned to fit. Fish are removed from the most numerous species first, so
   * a viewer keeps at least one of everything they had for as long as possible.
   */
  const chooseTank = (id: TankPresetId) => {
    setTankId(id)

    const limit = stockingCapacity(getTankPreset(id).volumeLiters)
    setCounts((current) => {
      let stocked = Object.values(current).reduce((sum, count) => sum + (count ?? 0), 0)
      if (stocked <= limit) return current

      const thinned = { ...current }
      while (stocked > limit) {
        const fullest = (Object.keys(thinned) as FishSpeciesId[])
          .filter((species) => (thinned[species] ?? 0) > 0)
          .sort((left, right) => (thinned[right] ?? 0) - (thinned[left] ?? 0))[0]
        if (!fullest) break
        thinned[fullest] = (thinned[fullest] ?? 0) - 1
        stocked -= 1
      }
      return thinned
    })
  }

  return (
    <main className="app-shell">
      {/*
        The camera options only place the camera on the first render; from then on
        it belongs to the viewer and the rig inside the scene. They are derived
        alongside the geometry so a re-render never hands Canvas a changed camera.
      */}
      <Canvas
        camera={camera}
        dpr={[1, 1.5]}
        frameloop={frameloop}
        aria-label="3D 电子鱼缸，可拖动旋转视角并使用滚轮缩放"
        aria-describedby="control-hint"
        fallback={
          <div className="webgl-fallback">
            当前浏览器无法启用 WebGL，暂时无法显示电子鱼缸。
          </div>
        }
        gl={{ antialias: true }}
        shadows="basic"
      >
        <Aquarium fish={fish} geometry={geometry} />
      </Canvas>

      <header className="title-card">
        <span>PHASE 01</span>
        <h1>电子鱼缸</h1>
        <p>一片不需要照料的水下世界</p>
      </header>

      <div className="side-panels">
        <section className="tank-selector" aria-label="鱼缸尺寸选择">
          <label htmlFor="tank-size">鱼缸尺寸</label>
          <select
            id="tank-size"
            value={preset.id}
            onChange={(event) => chooseTank(getTankPreset(event.target.value).id)}
          >
            {TANK_PRESETS.map(({ dimensions, id, label }) => (
              <option key={id} value={id}>
                {label} · {dimensions.length} × {dimensions.width} × {dimensions.height} cm
              </option>
            ))}
          </select>
          <output>约 {preset.volumeLiters} L</output>
        </section>

        <FishMarket capacity={capacity} counts={counts} onAdd={add} onRemove={remove} />
      </div>

      <div id="control-hint" className="control-hint" aria-label="相机操作提示">
        拖动旋转&nbsp;&nbsp;·&nbsp;&nbsp;滚轮缩放
      </div>
    </main>
  )
}
