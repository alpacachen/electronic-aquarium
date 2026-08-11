import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Aquarium } from './aquarium/Aquarium'
import { FishMarket } from './aquarium/FishMarket'
import { Panel, PanelHeading } from './aquarium/Panel'
import { FISH_SPECIES } from './aquarium/fishSpecies'
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
  const [failedSpecies, setFailedSpecies] = useState<ReadonlySet<FishSpeciesId>>(new Set())
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

  const reportFishError = (species: FishSpeciesId) => {
    setFailedSpecies((current) =>
      current.has(species) ? current : new Set(current).add(species),
    )
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
    <main className="relative h-full w-full bg-abyss bg-[radial-gradient(circle_at_50%_30%,--alpha(var(--color-shell)/45%),transparent_44%)]">
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
          <div className="grid h-full w-full place-items-center p-8 text-center text-mist">
            当前浏览器无法启用 WebGL，暂时无法显示电子鱼缸。
          </div>
        }
        gl={{ antialias: true }}
        shadows="basic"
      >
        <Aquarium fish={fish} geometry={geometry} onFishError={reportFishError} />
      </Canvas>

      {failedSpecies.size > 0 && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full border border-glass/24 bg-surface/80 px-4 py-2 text-sm text-mist backdrop-blur-md"
          role="alert"
        >
          部分鱼模型加载失败：
          {[...failedSpecies].map((species) => FISH_SPECIES[species].label).join('、')}
        </div>
      )}

      <header className="pointer-events-none absolute top-10 left-12 z-10 [text-shadow:0_2px_24px_--alpha(#000a12/70%)] max-[720px]:top-6 max-[720px]:left-6">
        <span className="text-[0.7rem] font-bold tracking-[0.24em] text-lagoon">
          PHASE 01
        </span>
        <h1 className="mt-[0.45rem] text-[clamp(2.2rem,4vw,4.6rem)] font-[520] tracking-[-0.055em] max-[720px]:text-[clamp(2rem,12vw,3.4rem)]">
          电子鱼缸
        </h1>
        <p className="mt-[0.55rem] text-[0.95rem] tracking-[0.08em] text-mist max-[720px]:max-w-56 max-[720px]:text-[0.8rem]">
          一片不需要照料的水下世界
        </p>
      </header>

      {/*
        The two right-hand panels share a column so they can never overlap each
        other, however tall the market's list grows.

        The column is only a layout box; the gap between its two panels sits over
        the tank, and a viewer dragging there means to swing the camera. Each
        panel takes its own events back with pointer-events-auto.

        It stays a column on the right even on a narrow screen. Stretching it
        across the full width would leave nowhere to grab the tank, since a drag
        anywhere under the panels swings nothing.
      */}
      <div className="pointer-events-none absolute top-10 right-12 z-10 grid max-h-[calc(100%-130px)] w-[290px] content-start gap-3.5 [&>*]:pointer-events-auto max-[720px]:top-6 max-[720px]:right-4 max-[720px]:max-h-[calc(100%-150px)] max-[720px]:w-[min(290px,62vw)]">
        <Panel aria-label="鱼缸尺寸选择" className="grid gap-1.5">
          <PanelHeading id="tank-size-label">鱼缸尺寸</PanelHeading>
          <Select value={preset.id} onValueChange={(id) => chooseTank(getTankPreset(id).id)}>
            {/*
              The trigger is labelled by the heading above it rather than carrying
              its own label: Radix renders a button, not a form control, so a
              <label for> would have nothing to point at.
            */}
            <SelectTrigger
              aria-labelledby="tank-size-label"
              className="w-full bg-control text-ink hover:bg-control-hover"
            >
              <SelectValue />
            </SelectTrigger>
            {/*
              Hung below the trigger rather than aligned to the chosen row. The
              panel sits near the top of the window, so aligning the list on the
              current size — the default — pushes the sizes above it off screen,
              and 迷你缸 loses its top edge whenever 标准缸 or lower is chosen.
            */}
            <SelectContent align="start" position="popper">
              {TANK_PRESETS.map(({ dimensions, id, label }) => (
                <SelectItem key={id} value={id}>
                  {label} · {dimensions.length} × {dimensions.width} × {dimensions.height} cm
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <output className="text-[0.78rem] tracking-[0.06em] text-mist">
            约 {preset.volumeLiters} L
          </output>
        </Panel>

        <FishMarket capacity={capacity} counts={counts} onAdd={add} onRemove={remove} />
      </div>

      <div
        id="control-hint"
        aria-label="相机操作提示"
        className="pointer-events-none absolute right-12 bottom-9 z-10 rounded-full border border-glass/24 bg-surface/54 px-3.5 py-2.5 text-[0.76rem] tracking-[0.08em] text-mist backdrop-blur-md max-[720px]:right-4 max-[720px]:bottom-4"
      >
        拖动旋转&nbsp;&nbsp;·&nbsp;&nbsp;滚轮缩放
      </div>
    </main>
  )
}
