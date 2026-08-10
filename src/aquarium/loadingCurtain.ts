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
 * The files are already fetched a second time by the GLTF loader, which is free:
 * these are plain GETs of static files, so the browser's HTTP cache answers the
 * loader's request. Warming the cache here is what lets one `await` stand for
 * "the models are in hand".
 */
function fetchModels() {
  return Promise.all(
    Object.values(FISH_SPECIES).map(({ modelUrl }) =>
      fetch(modelUrl, { cache: 'force-cache' }).catch(() => undefined),
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

  const timeout = new Promise((resolve) => setTimeout(resolve, GIVE_UP_MS))
  Promise.race([fetchModels(), timeout]).then(() => lift(curtain))
}
