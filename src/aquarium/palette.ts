/**
 * 缸里的场景用到的颜色。
 *
 * 这份文件是 src/styles.css 里 `@theme` 那批变量在 JS 侧的副本：Three.js 的材质
 * 收到的是颜色字面值，读不到 CSS 变量，所以场景侧只能另存一份。名字和那边一一对应
 * （`--color-lamp` 就是 `LAMP`），`pnpm check:colors` 会阻止两边漂移。
 *
 * 为什么不干脆运行时从 `getComputedStyle(document.documentElement)` 把变量读过来：
 * 那样能省掉这份副本，但会让场景的颜色取决于样式表有没有到位——测试里画布挂载得
 * 比样式表早，读到的会是空串。副本换来的是「颜色和渲染时机无关」。
 */
export const PALETTE = {
  /** 场景底色与雾色，同页面底色 */
  ABYSS: '#061823',
  /** 缸下面的柜体 */
  CABINET: '#10191e',
  /** 玻璃 */
  PANE: '#bceeff',
  /** 玻璃的棱 */
  PANE_EDGE: '#7bc5da',
  /** 缸底的沙 */
  SUBSTRATE: '#bfa67b',
  /** 水体 */
  WATER: '#087f9e',
  /** 水面 */
  WATERLINE: '#57d4e8',
  /** 顶上的主光 */
  SUNLIGHT: '#d8f7ff',
  /** 缸侧那盏蓝灯，也是加载条的蓝 */
  LAMP: '#26bde2',
  /** 缸摆着的那层地面 */
  FLOOR: '#071219',
} as const
