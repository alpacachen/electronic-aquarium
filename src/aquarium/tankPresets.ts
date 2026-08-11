export type TankDimensions = Readonly<{
  length: number
  width: number
  height: number
}>

/** 缸尺寸的名字在 src/i18n/locales/ 的语言包里按 id 列着，这份只管几何。 */
export type TankPreset = Readonly<{
  id: 'nano' | 'small' | 'standard' | 'large' | 'xl'
  dimensions: TankDimensions
  /** Approximate gross capacity; substrate and equipment reduce usable volume. */
  volumeLiters: number
}>

export const TANK_PRESETS = [
  {
    dimensions: { height: 20, length: 30, width: 20 },
    id: 'nano',
    volumeLiters: 12,
  },
  {
    dimensions: { height: 30, length: 45, width: 30 },
    id: 'small',
    volumeLiters: 40.5,
  },
  {
    dimensions: { height: 36, length: 60, width: 30 },
    id: 'standard',
    volumeLiters: 64.8,
  },
  {
    dimensions: { height: 45, length: 90, width: 45 },
    id: 'large',
    volumeLiters: 182.25,
  },
  {
    dimensions: { height: 50, length: 120, width: 50 },
    id: 'xl',
    volumeLiters: 300,
  },
] as const satisfies readonly TankPreset[]

export type TankPresetId = (typeof TANK_PRESETS)[number]['id']

export const DEFAULT_TANK_ID: TankPresetId = 'standard'

function findDefaultTank(): TankPreset {
  const preset = TANK_PRESETS.find(({ id }) => id === DEFAULT_TANK_ID)
  if (!preset) {
    throw new Error(`Missing default tank preset: ${DEFAULT_TANK_ID}`)
  }
  return preset
}

const DEFAULT_TANK = findDefaultTank()

const WORLD_UNITS_PER_CM = 1 / 6
const BASE_HEIGHT = 0.35
const SUBSTRATE_HEIGHT = 0.25
const WATER_HEADROOM = 0.45
const WATER_INSET = 0.28

export function getTankPreset(id: string): TankPreset {
  return TANK_PRESETS.find((preset) => preset.id === id) ?? DEFAULT_TANK
}

export type TankSceneGeometry = Readonly<{
  size: Readonly<{
    depth: number
    height: number
    length: number
  }>
  base: Readonly<{
    depth: number
    height: number
    length: number
    y: number
  }>
  substrate: Readonly<{
    depth: number
    height: number
    length: number
    y: number
  }>
  water: Readonly<{
    centerY: number
    depth: number
    height: number
    length: number
    surfaceY: number
  }>
  floorY: number
  fishBounds: Readonly<{
    x: number
    y: number
    z: number
  }>
  fishCenterY: number
  fishPositionScale: Readonly<{
    x: number
    y: number
    z: number
  }>
  fishScale: number
  camera: Readonly<{
    maxDistance: number
    minDistance: number
    position: [number, number, number]
    targetY: number
  }>
}>

export function getTankGeometry(preset: TankPreset): TankSceneGeometry {
  const size = {
    depth: preset.dimensions.width * WORLD_UNITS_PER_CM,
    height: preset.dimensions.height * WORLD_UNITS_PER_CM,
    length: preset.dimensions.length * WORLD_UNITS_PER_CM,
  }
  const waterHeight = size.height - SUBSTRATE_HEIGHT - WATER_HEADROOM
  const waterBottom = -size.height / 2 + SUBSTRATE_HEIGHT
  const waterSurfaceY = waterBottom + waterHeight
  const fishScale = Math.min(size.length / 10, size.depth / 5, size.height / 6)
  const fishCenterY = waterBottom + waterHeight / 2
  const cameraDistance = Math.max(size.length, size.depth, size.height) * 1.7

  return {
    base: {
      depth: size.depth + 0.4,
      height: BASE_HEIGHT,
      length: size.length + 0.4,
      y: -size.height / 2 - BASE_HEIGHT / 2,
    },
    camera: {
      maxDistance: Math.max(12, cameraDistance * 1.6),
      minDistance: Math.max(3.5, fishScale * 5.5),
      position: [
        cameraDistance / Math.sqrt(2),
        fishCenterY + cameraDistance * 0.43,
        cameraDistance / Math.sqrt(2),
      ],
      targetY: fishCenterY,
    },
    fishBounds: {
      x: size.length / 2 - fishScale * 0.7,
      y: waterHeight / 2 - fishScale * 0.35,
      z: size.depth / 2 - fishScale * 0.45,
    },
    fishCenterY,
    fishPositionScale: {
      x: size.length / 10,
      y: size.height / 6,
      z: size.depth / 5,
    },
    fishScale,
    floorY: -size.height / 2 - BASE_HEIGHT - 0.02,
    size,
    substrate: {
      depth: Math.max(0.5, size.depth - WATER_INSET),
      height: SUBSTRATE_HEIGHT,
      length: Math.max(0.5, size.length - WATER_INSET),
      y: -size.height / 2 + SUBSTRATE_HEIGHT / 2,
    },
    water: {
      centerY: fishCenterY,
      depth: Math.max(0.5, size.depth - WATER_INSET),
      height: waterHeight,
      length: Math.max(0.5, size.length - WATER_INSET),
      surfaceY: waterSurfaceY,
    },
  }
}
