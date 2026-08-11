/**
 * Models are fetched at runtime by URL rather than imported, so the bundler
 * never sees them and cannot rewrite their paths. Prefixing Vite's `BASE_URL`
 * keeps them resolvable wherever the app is served from: the root in
 * development, a repository subpath on GitHub Pages.
 */
const modelUrl = (path: string) => `${import.meta.env.BASE_URL}models/${path}`

/**
 * 鱼种名不在这里，在 src/i18n/locales/ 的语言包里按 id 列着：这份说的是鱼怎么游、
 * 模型多大，和界面用哪种语言称呼它无关。
 */
export type FishSpecies = Readonly<{
  animation?: Readonly<{ name: string; speed: number }>
  centerY: number
  modelUrl: string
  /** What the species reads like in the water, before individual variation. */
  temperament: Readonly<{
    /** Cruising speed in world units per second. */
    speed: number
    /** Height it favours, as a fraction of the tank's half-height. */
    depth: number
    /** Seconds for one full up-and-down. Larger fish work the tank more slowly. */
    period: number
    /** How much its speed rises and falls, as a fraction of `speed`. */
    surge: number
  }>
  rotationY: number
  tail?: Readonly<{
    amplitude: number
    direction: 1 | -1
    end: number
    frequency: number
    start: number
  }>
  unitScale: number
}>

/**
 * The Quaternius models are exported from Blender with the body along +Z, so
 * they share a quarter turn to reach the head-along-+X convention. Their
 * `unitScale` brings each one to a body length near one world unit, which is
 * where the goldfish and the barramundi already sit.
 */
export const FISH_SPECIES = {
  barramundi: {
    centerY: 0.143,
    modelUrl: modelUrl('barramundi/barramundi.glb'),
    rotationY: Math.PI / 2,
    tail: {
      amplitude: 0.035,
      direction: -1,
      end: 0.32,
      frequency: 7,
      start: 0.05,
    },
    /** A heavier fish: slow, low in the tank, and steady. */
    temperament: { depth: -0.35, period: 54, speed: 0.5, surge: 0.16 },
    unitScale: 1.5,
  },
  blueTang: {
    animation: { name: 'Armature|Swim.001', speed: 1.5 },
    centerY: 0.1407,
    modelUrl: modelUrl('blue-tang/blue-tang.glb'),
    rotationY: Math.PI / 2,
    /** Busy and inquisitive, ranging through the middle of the tank. */
    temperament: { depth: 0.1, period: 56, speed: 0.64, surge: 0.3 },
    unitScale: 0.09,
  },
  armoredCatfish: {
    animation: { name: 'Fish_Armature|Swimming_Normal', speed: 1.3 },
    centerY: 0.1,
    label: '装甲鲶鱼',
    modelUrl: modelUrl('armored-catfish/armored-catfish.glb'),
    rotationY: Math.PI / 2,
    temperament: { depth: -0.2, period: 58, speed: 0.52, surge: 0.18 },
    unitScale: 0.17,
  },
  parrotFish: {
    animation: { name: 'Fish_Armature|Swimming_Normal', speed: 1.5 },
    centerY: 0.29,
    label: '鹦嘴鱼',
    modelUrl: modelUrl('parrot-fish/parrot-fish.glb'),
    rotationY: Math.PI / 2,
    temperament: { depth: 0.15, period: 54, speed: 0.63, surge: 0.24 },
    unitScale: 0.17,
  },
  betta: {
    animation: { name: 'Fish_Armature|Swimming_Normal', speed: 1.2 },
    centerY: -0.04,
    label: '斗鱼',
    modelUrl: modelUrl('betta/betta.glb'),
    rotationY: Math.PI / 2,
    temperament: { depth: 0.25, period: 48, speed: 0.45, surge: 0.22 },
    unitScale: 0.18,
  },
  cardinalFish: {
    animation: { name: 'Fish_Armature|Swimming_Normal', speed: 1.7 },
    centerY: -0.02,
    label: '天竺鲷',
    modelUrl: modelUrl('cardinal-fish/cardinal-fish.glb'),
    rotationY: Math.PI / 2,
    temperament: { depth: -0.05, period: 60, speed: 0.62, surge: 0.28 },
    unitScale: 0.18,
  },
  clownfish: {
    animation: { name: 'Armature|Swim', speed: 1.8 },
    centerY: 0.3261,
    modelUrl: modelUrl('clownfish/clownfish.glb'),
    rotationY: Math.PI / 2,
    /** Small and fidgety: the largest change of pace, and it roams the most. */
    temperament: { depth: -0.1, period: 66, speed: 0.58, surge: 0.34 },
    unitScale: 0.13,
  },
  tetra: {
    animation: { name: 'Fish_Armature|Swimming_Normal', speed: 1.9 },
    centerY: -0.02,
    label: '脂鲤',
    modelUrl: modelUrl('tetra/tetra.glb'),
    rotationY: Math.PI / 2,
    temperament: { depth: 0, period: 50, speed: 0.7, surge: 0.32 },
    unitScale: 0.19,
  },
  goldfish: {
    animation: { name: 'Swim_Slow', speed: 1 },
    centerY: 0.0613,
    modelUrl: modelUrl('goldfish/goldfish_variety_3.glb'),
    rotationY: 0,
    /** Unhurried, drifting around the middle. */
    temperament: { depth: 0.05, period: 52, speed: 0.6, surge: 0.2 },
    unitScale: 7.5,
  },
  mandarinFish: {
    animation: { name: 'Fish_Armature|Swimming_Normal', speed: 1.4 },
    centerY: 0.02,
    label: '麒麟鱼',
    modelUrl: modelUrl('mandarin-fish/mandarin-fish.glb'),
    rotationY: Math.PI / 2,
    temperament: { depth: -0.1, period: 62, speed: 0.5, surge: 0.28 },
    unitScale: 0.225,
  },
  tuna: {
    animation: { name: 'Armature|Swim', speed: 1.2 },
    centerY: 0.2061,
    modelUrl: modelUrl('tuna/tuna.glb'),
    rotationY: Math.PI / 2,
    /** Built to cruise: the fastest, and quick to change level because of it. */
    temperament: { depth: 0.3, period: 38, speed: 0.85, surge: 0.12 },
    unitScale: 0.137,
  },
} as const satisfies Record<string, FishSpecies>

export type FishSpeciesId = keyof typeof FISH_SPECIES
