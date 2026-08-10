import { getConsoleFunction, setConsoleFunction } from 'three'

/**
 * Deprecation warnings that Three.js prints on our dependencies' behalf, and
 * that nothing in this repo can act on.
 *
 * `@react-three/fiber` 9 builds a `THREE.Clock` for every canvas it mounts, and
 * Three.js has deprecated the class as of r183. The replacement, `state.timer`,
 * only arrives in fiber 10 — which is still a canary, and which `@react-three/drei`
 * does not accept yet (it asks for fiber ^9). So every test that renders the
 * aquarium prints a warning about somebody else's code, once per canvas, and the
 * one thing a test log is for — telling us what changed — gets buried.
 *
 * Drop these lines and let everything else through, so a warning we *can* act on
 * still reaches the log. Once fiber 10 ships and drei follows, delete the entry
 * and the warning should stay gone on its own.
 *
 * @see https://github.com/pmndrs/react-three-fiber/issues/3741
 */
const SILENCED = [
  'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
]

/**
 * Filters the silenced warnings out of the test log.
 *
 * Three.js funnels every log, warning and error through one replaceable console
 * function, so this hands it a function that forwards all but the known lines.
 * Any handler already in place is kept, which keeps this safe to call twice.
 */
export function quietDependencyWarnings() {
  const previous = getConsoleFunction()

  setConsoleFunction((type, message, ...params) => {
    if (SILENCED.includes(message)) return
    if (previous) {
      previous(type, message, ...params)
      return
    }
    console[type](message, ...params)
  })
}
