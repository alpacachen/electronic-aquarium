import { useProgress } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** 淡出用多久，和下面那个 duration-[420ms] 是同一个数。 */
const FADE_MS = 420

/** A hung loader must not hold the page behind a curtain forever. */
const GIVE_UP_MS = 15000

/**
 * 挂上之后这么久还没有任何东西开始加载，就当作没什么要加载的，直接撤。
 *
 * `useProgress` 分不出「没什么要加载」和「还没开始加载」——两种都是
 * `active: false, total: 0`。模型全在缓存里时就是前者，等下去是白等：交互测试里同一
 * 文件第二条用例起就命中这条（`useGLTF` 的缓存是模块级的），去掉这段的话它们全部挨满
 * 15 秒超时。
 */
const NOTHING_TO_LOAD_MS = 250

/**
 * 模型下载解析完之前挡在缸前面的那块幕布。
 *
 * 这是一个普通的 React 组件——文案、样式、进度、撤场都在这一个文件里。它曾经住在
 * `index.html` 里（为了早于 JavaScript 就画出来），代价是文案要按语言各抄一份、一套
 * `data-*` 协议、以及 React 反过来用 portal 和 querySelector 去操作那块 DOM。现在的
 * 取舍是：React 挂上之前观众看不到加载指示（不限速约 1s，慢网下十几秒），换掉那些。
 *
 * 放在 Canvas 外面。`useProgress` 是挂在 Three 的 DefaultLoadingManager 上的一个
 * store，和 Canvas 无关，所以在外面照样收得到缸里那些 GLTF 的进度。
 */
export function LoadingCurtain() {
  const { active, errors, progress, total } = useProgress()
  const { t } = useTranslation()
  const [phase, setPhase] = useState<'showing' | 'leaving' | 'gone'>('showing')
  const [message, setMessage] = useState<string>()
  /**
   * 加载真的开始过。
   *
   * 没有用例盯得住这道闸：这个组件和 Canvas 在同一次提交里挂上，effect 跑起来时 GLTF
   * 已经在下了（`active` 已经是 true），所以「还没开始就被当成已结束」那条路在测试里
   * 走不到。留着是因为它便宜，而那条路真走到的话观众会看见幕布一闪而过、露出空缸。
   */
  const started = useRef(false)

  /** 全部解析完就撤场；哪条鱼坏了，撤的时候顺口说一句。 */
  useEffect(() => {
    if (active || total > 0) started.current = true
    if (!started.current || active) return

    if (errors.length > 0) setMessage(t('loading.partialFailure'))
    setPhase((current) => (current === 'showing' ? 'leaving' : current))
  }, [active, errors.length, t, total])

  /** 压根没东西要加载（模型都在缓存里）时，别干等到超时。 */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (started.current) return
      setPhase((current) => (current === 'showing' ? 'leaving' : current))
    }, NOTHING_TO_LOAD_MS)
    return () => clearTimeout(timer)
  }, [])

  /** 加载卡住时的兜底，别让幕布把页面永远挡着。 */
  useEffect(() => {
    const timer = setTimeout(() => {
      setMessage(t('loading.timedOut'))
      setPhase((current) => (current === 'showing' ? 'leaving' : current))
    }, GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [t])

  useEffect(() => {
    if (phase !== 'leaving') return
    const timer = setTimeout(() => setPhase('gone'), FADE_MS)
    return () => clearTimeout(timer)
  }, [phase])

  if (phase === 'gone') return null

  /**
   * 拿到真实进度之前，条子来回扫；拿到之后按百分比走。
   *
   * 只看 `total`，不看上面那个 `started` ref：ref 变了不会触发重渲染，而模型卡在半路
   * 时进度也不变——两下一凑，这里就永远停在「没测量」，进度条不动、`aria-valuenow`
   * 也写不上去。渲染要用的东西得来自 state。
   */
  const measured = total > 0
  const percent = Math.min(100, Math.round(progress))

  return (
    <div
      className="fixed inset-0 z-[2] grid place-items-center bg-abyss bg-[radial-gradient(circle_at_50%_32%,--alpha(var(--color-shell)/55%),transparent_46%)] text-ink transition-opacity duration-[420ms] ease-out data-[leaving]:pointer-events-none data-[leaving]:opacity-0 motion-reduce:transition-none"
      data-leaving={phase === 'leaving' ? '' : undefined}
      id="loading-curtain"
    >
      <div className="w-[min(320px,74vw)] text-center">
        <span className="text-[0.7rem] font-bold tracking-[0.24em] text-lagoon">PHASE 01</span>
        <p className="mt-2 mb-[1.35rem] text-[1.6rem] font-[520] tracking-[-0.03em]">
          {t('loading.title')}
        </p>
        <div
          aria-label={t('loading.progressLabel')}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={measured ? percent : undefined}
          className="h-[3px] overflow-hidden rounded-full bg-glass/18"
          role="progressbar"
        >
          <div
            className={
              measured
                ? 'h-full rounded-full bg-linear-90 from-lamp to-lagoon transition-[width] duration-[240ms] ease-out motion-reduce:transition-none'
                : 'h-full w-2/5 rounded-full bg-linear-90 from-lamp to-lagoon animate-loading-sweep motion-reduce:animate-none'
            }
            style={measured ? { width: `${percent}%` } : undefined}
          />
        </div>
        <p aria-live="polite" className="mt-[0.9rem] text-[0.8rem] tracking-[0.06em] text-mist">
          {message ?? t('loading.hint')}
        </p>
      </div>
    </div>
  )
}
