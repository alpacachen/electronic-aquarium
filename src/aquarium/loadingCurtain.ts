/** Matches the `#loading-curtain` transition in index.html, in milliseconds. */
const FADE_MS = 420

/** A hung loader must not hold the page behind a curtain forever. */
const GIVE_UP_MS = 15000

/** Takes the curtain down, letting it fade before it leaves the page. */
function lift(curtain: HTMLElement, message?: string) {
  if (!curtain.isConnected || curtain.dataset.leaving !== undefined) return
  const hint = curtain.querySelector<HTMLElement>('.loading-curtain__hint')
  if (message && hint) hint.textContent = message
  curtain.dataset.leaving = ''
  setTimeout(() => curtain.remove(), FADE_MS)
}

/**
 * Starts the timeout fallback; the actual model loader lifts the curtain when
 * Three's LoadingManager reports that all GLTF parses have finished.
 *
 * The HTML curtain stays outside React so it paints before JavaScript and CSS.
 */
export function startLoadingCurtain() {
  const curtain = document.getElementById('loading-curtain')
  if (!curtain) return

  setTimeout(() => lift(curtain, '加载超时，部分鱼模型可能不可用'), GIVE_UP_MS)
}

/** Lifts the curtain from the same Three.js loading lifecycle that renders fish. */
export function liftLoadingCurtain(progress: number, errors: readonly string[]) {
  const curtain = document.getElementById('loading-curtain')
  if (!curtain) return

  const track = curtain.querySelector<HTMLElement>('.loading-curtain__track')
  const fill = curtain.querySelector<HTMLElement>('.loading-curtain__fill')
  const percent = Math.min(100, Math.round(progress))
  curtain.dataset.measured = ''
  if (fill) fill.style.width = `${percent}%`
  track?.setAttribute('aria-valuenow', String(percent))
  lift(curtain, errors.length > 0 ? '部分鱼模型加载失败，鱼缸仍可使用' : undefined)
}
