import { FISH_SPECIES } from './fishSpecies'

/** Matches the `#loading-curtain` transition in index.html, in milliseconds. */
const FADE_MS = 420

/**
 * How long to wait for the models before showing the tank anyway.
 *
 * A curtain that never lifts is worse than the blank page it replaced, so a
 * request that hangs or fails does not get to hold the aquarium hostage: the
 * tank still appears, just without every fish in it.
 */
const GIVE_UP_MS = 15000

/**
 * Fetches every fish model, so the app can wait for the slow part of the load.
 *
 * `fetch` settles as soon as the response *headers* arrive, and the slow part of
 * a 6 MB model is its body — so the body has to be drained before the file counts
 * as loaded. Without that the curtain lifts on the first byte, which is what it
 * used to do.
 *
 * The loader fetches these files again, which is free: they are plain GETs of
 * static files, so the browser's HTTP cache answers the second request. Warming
 * the cache here is what lets one `await` stand for "the models are in hand".
 */
function fetchModels(onProgress: (fraction: number) => void) {
  const models = Object.values(FISH_SPECIES)

  /**
   * Progress is measured in bytes rather than in files. One model is most of the
   * download, so counting files would sit at 80% for the entire wait that
   * actually matters.
   */
  const expected = new Array<number>(models.length).fill(0)
  const received = new Array<number>(models.length).fill(0)

  const report = () => {
    const total = expected.reduce((sum, bytes) => sum + bytes, 0)
    if (total > 0) {
      onProgress(received.reduce((sum, bytes) => sum + bytes, 0) / total)
    }
  }

  const drain = async (response: Response, index: number) => {
    expected[index] = Number(response.headers.get('content-length')) || 0
    report()

    // No stream to read (an opaque or cached response): the body still has to be
    // waited for, it just cannot be reported on as it arrives.
    if (!response.body) {
      await response.arrayBuffer()
      received[index] = expected[index]
      report()
      return
    }

    const reader = response.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received[index] += value.byteLength
      report()
    }
  }

  return Promise.all(
    models.map(({ modelUrl }, index) =>
      fetch(modelUrl, { cache: 'force-cache' })
        .then((response) => drain(response, index))
        .catch(() => undefined),
    ),
  )
}

/** Takes the curtain down, letting it fade before it leaves the page. */
function lift(curtain: HTMLElement) {
  curtain.dataset.leaving = ''
  setTimeout(() => curtain.remove(), FADE_MS)
}

/**
 * Holds the HTML curtain up until the fish models have arrived.
 *
 * The models are megabytes and the tank cannot draw without them — `<Canvas>`
 * rethrows its Suspense fallback upward, so a pending model blanks the whole
 * canvas. The curtain covers that wait; see index.html for why it starts life
 * as markup rather than as a component.
 *
 * @see https://github.com/alpacachen/electronic-aquarium/issues/12
 */
export function hideLoadingCurtainWhenReady() {
  const curtain = document.getElementById('loading-curtain')
  if (!curtain) return

  const track = curtain.querySelector<HTMLElement>('.loading-curtain__track')
  const fill = curtain.querySelector<HTMLElement>('.loading-curtain__fill')
  const hint = curtain.querySelector<HTMLElement>('.loading-curtain__hint')

  const show = (fraction: number) => {
    const percent = Math.min(100, Math.round(fraction * 100))
    // Switching off the sweep is what tells the CSS a real figure has arrived.
    curtain.dataset.measured = ''
    if (fill) fill.style.width = `${percent}%`
    if (hint) hint.textContent = `正在把鱼放进缸里 ${percent}%`
    track?.setAttribute('aria-valuenow', String(percent))
  }

  const timeout = new Promise((resolve) => setTimeout(resolve, GIVE_UP_MS))
  Promise.race([fetchModels(show), timeout]).then(() => lift(curtain))
}
