import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { I18nextProvider, useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Aquarium } from './aquarium/Aquarium'
import { FishMarket } from './aquarium/FishMarket'
import { LanguagePicker } from './aquarium/LanguagePicker'
import { LoadingCurtain } from './aquarium/LoadingCurtain'
import { Panel, PanelHeading } from './aquarium/Panel'
import type { FishSpeciesId } from './aquarium/fishSpecies'
import { stockTank, stockingCapacity } from './aquarium/stocking'
import {
  DEFAULT_TANK_ID,
  TANK_PRESETS,
  getTankGeometry,
  getTankPreset,
} from './aquarium/tankPresets'
import type { TankPresetId } from './aquarium/tankPresets'
import { HTML_LANG, createI18n, languageOf } from './i18n'
import type { I18n } from './i18n'

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
  /**
   * 用哪个 i18next 实例。不给就自己建一个，走它默认那条路：观众存过的选择优先，
   * 没有才问浏览器。线上由 main.tsx 建（加载幕布也要用同一个），交互测试一条用例
   * 建一个，好把语言固定住或者专门去试检测。
   */
  i18n?: I18n
  modelUrls?: Partial<Record<FishSpeciesId, string>>
}

function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(context)
  } catch {
    return false
  }
}

/**
 * 语言这一层套在缸外面。
 *
 * 切语言只是让 useTranslation 的那几个消费者重渲染，缸自己（Canvas、鱼、镜头）不
 * 重挂：真要是拿语言给 Canvas 当 key，观众一切语言鱼就会重新入场、视角也被拨回
 * 默认角度。
 */
export function App({ frameloop = 'always', i18n, modelUrls }: AppProps = {}) {
  /** 只在第一次渲染时建，不然每次重渲染都会新开一个实例、把语言拨回开局那种。 */
  const [instance] = useState(() => i18n ?? createI18n())

  return (
    <I18nextProvider i18n={instance}>
      <AquariumView frameloop={frameloop} modelUrls={modelUrls} />
    </I18nextProvider>
  )
}

function AquariumView({ frameloop, modelUrls }: Omit<AppProps, 'i18n'>) {
  const { i18n, t } = useTranslation()
  const language = languageOf(i18n)
  const [tankId, setTankId] = useState<TankPresetId>(DEFAULT_TANK_ID)
  const [counts, setCounts] = useState(DEFAULT_STOCK)
  const [failedSpecies, setFailedSpecies] = useState<ReadonlySet<FishSpeciesId>>(new Set())
  const [webglAvailable] = useState(canUseWebGL)
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
   * 文档自己那份语言记录：`<html lang>` 决定屏幕阅读器怎么念，标题是标签页上那行
   * 字，两者都在 React 树之外，i18next 也不碰它们。首帧由 index.html 的内联脚本写
   * 好，这里接着维护。
   */
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[language]
    document.title = t('documentTitle')
  }, [language, t])

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
        没有 WebGL 就不挂幕布：那种情况下一个模型都不会去下，幕布等不到「加载完」，
        只能挨到超时才走——白白压在降级提示上面十几秒。
      */}
      {webglAvailable && <LoadingCurtain />}

      {/*
        The camera options only place the camera on the first render; from then on
        it belongs to the viewer and the rig inside the scene. They are derived
        alongside the geometry so a re-render never hands Canvas a changed camera.
      */}
      {webglAvailable ? (
        <Canvas
          camera={camera}
          dpr={[1, 1.5]}
          frameloop={frameloop}
          aria-label={t('canvasLabel')}
          aria-describedby="control-hint"
          gl={{ antialias: true }}
          shadows="basic"
        >
          <Aquarium
            fish={fish}
            geometry={geometry}
            modelUrls={modelUrls}
            onFishError={reportFishError}
          />
        </Canvas>
      ) : (
        <div className="grid h-full w-full place-items-center p-8 text-center text-mist" role="status">
          {t('webglUnavailable')}
        </div>
      )}

      {failedSpecies.size > 0 && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full border border-glass/24 bg-surface/80 px-4 py-2 text-sm text-mist backdrop-blur-md"
          role="alert"
        >
          {t('modelFailure', {
            fish: [...failedSpecies].map((species) => t(`fish.${species}`)),
          })}
        </div>
      )}

      <header className="pointer-events-none absolute top-10 left-12 z-10 [text-shadow:0_2px_24px_--alpha(var(--color-abyss)/70%)] max-[720px]:top-6 max-[720px]:left-6">
        <span className="text-[0.7rem] font-bold tracking-[0.24em] text-lagoon">
          PHASE 01
        </span>
        <h1 className="mt-[0.45rem] text-[clamp(2.2rem,4vw,4.6rem)] font-[520] tracking-[-0.055em] max-[720px]:text-[clamp(2rem,12vw,3.4rem)]">
          {t('heading')}
        </h1>
        <p className="mt-[0.55rem] text-[0.95rem] tracking-[0.08em] text-mist max-[720px]:max-w-56 max-[720px]:text-[0.8rem]">
          {t('tagline')}
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
        {/*
          面板由自己那行小标题命名，而不是另写一份 aria-label：两处都要跟着语言翻，
          分开写就会有一天只翻了一处，屏幕阅读器念的和屏幕上的字对不上。
        */}
        <Panel aria-labelledby="tank-size-label" className="grid gap-1.5">
          <PanelHeading id="tank-size-label">{t('tank.heading')}</PanelHeading>
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
              {TANK_PRESETS.map(({ dimensions, id }) => (
                <SelectItem key={id} value={id}>
                  {t(`tanks.${id}`)} · {dimensions.length} × {dimensions.width} ×{' '}
                  {dimensions.height} cm
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <output className="text-[0.78rem] tracking-[0.06em] text-mist">
            {t('tank.volume', { liters: preset.volumeLiters })}
          </output>
        </Panel>

        <FishMarket capacity={capacity} counts={counts} onAdd={add} onRemove={remove} />
      </div>

      <LanguagePicker />

      {/*
        两半提示之间用不断行空格分隔：英文那版比中文长出一截，普通空格会让它在窄屏
        上从中间断开，胶囊也就跟着散成两行。
      */}
      <div
        id="control-hint"
        aria-label={t('camera.hintLabel')}
        className="pointer-events-none absolute right-12 bottom-9 z-10 rounded-full border border-glass/24 bg-surface/54 px-3.5 py-2.5 text-[0.76rem] tracking-[0.08em] text-mist backdrop-blur-md max-[720px]:right-4 max-[720px]:bottom-4"
      >
        {t('camera.drag')}&nbsp;&nbsp;·&nbsp;&nbsp;{t('camera.zoom')}
      </div>
    </main>
  )
}
