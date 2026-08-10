# 电子鱼缸

一个只需要打开浏览器就能观赏的 PC 端 3D 虚拟鱼缸。

线上：<https://alpacachen.github.io/electronic-aquarium/>（main 上每次提交自动部署）

## 当前阶段

- Three.js 场景：玻璃鱼缸、水体和水面。
- 五个鱼种（金鱼、尖吻鲈、小丑鱼、金枪鱼、蓝刀鲷）持续游动，并在水体边界转向。
- 每条鱼守着自己的水层上下巡游，升降时抬头低头，游速有快有慢；同种鱼也不会齐步走。
- 鱼市面板可以按鱼种增减，缸里养多少条由水体容量决定。
- 鼠标拖动旋转视角，滚轮缩放。
- 模型有几兆，下载完之前先显示一块加载幕布，而不是让观众对着空白页。
- 小屏提供基础布局；当前不包含本地存储和后端，鱼群的增减不会跨刷新保留。

接下来想做什么，记在 [GitHub Issues](https://github.com/alpacachen/electronic-aquarium/issues)。

## 开发

需要 Node.js 22.12+、pnpm 11 和 Chromium。首次运行测试时安装浏览器：

```bash
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

## 检查

```bash
pnpm check
```

`pnpm check` 会依次运行交互测试、TypeScript 检查和生产构建。测试只有一套，
`pnpm test` 就是它。

想看构建产物在线上那个子路径下的样子，用 `pnpm exec vite preview`：它和构建一样把
站点挂在 `/electronic-aquarium/` 下，所以模型少了会在本地就露出来。开发服务器和交互
测试仍然从根路径提供。

## 测试

**只写交互测试，不写函数级单元测试。** 测试全都放在 `src/tests/`，跑在真实的
Chromium 里（Vitest browser mode）：渲染整个应用、操作页面上的控件，再断言观众看得
见的结果——DOM 上的文字，以及 WebGL 真正渲染出来的鱼缸和鱼。

这条是刻意的取舍。单测锁的是函数签名，重构时最先碎掉，而且它保证不了「观众真的看到
鱼在游」；交互测试贵一些、慢一些，但它挂了就说明产品坏了。所以新增行为请从
`openAquarium()` 出发写，不要因为「这个函数好测」就退回去加一份单测。

- `src/tests/aquariumPage.tsx`：唯一的测试入口，把应用包装成"观众看到的鱼缸"。
- `src/tests/quietDependencyWarnings.ts`：滤掉依赖自己打的、我们改不动的过时警告。
- `src/tests/viewingTheAquarium.test.tsx`：打开页面看鱼游动。
- `src/tests/stockingTheTank.test.tsx`：在鱼市里增减鱼。
- `src/tests/choosingATankSize.test.tsx`：切换鱼缸尺寸。
- `src/tests/movingTheCamera.test.tsx`：拖动和滚轮操作镜头。

每个用例按 Given / When / Then 三段写成，注释直接标出这三步。

写完一条用例，把被测的那行代码改坏，确认它真的会挂。断言的阈值尤其容易写宽——留着
十几倍余量的阈值看着是绿的，其实什么都没盯住。阈值旁边写清实测值是多少、为什么留这么
多余量。

无头浏览器用软件光栅化跑 WebGL，只有几帧每秒，所以交互测试不靠真实时间等待，而是
用 `frameloop="never"` 接过时钟，再由 `letTimePass(秒)` 按固定步长推进帧。这样
长时间运动也能快速完成，且每次结果一致。

同理，交互测试文件是串行跑的（`fileParallelism: false`）：每个文件都要驱动自己的
WebGL 画布，几个文件一起抢同一个软件光栅化器时，单独都能过的用例反而会集体超时。

测试日志只留我们能动手改的东西。依赖自己打的过时警告（比如 fiber 9 每建一个画布就
建一个已废弃的 `THREE.Clock`）由 `src/tests/quietDependencyWarnings.ts` 按整条
消息滤掉，别的警告照旧打出来。要静音新的一条，往那份清单里加，并写清为什么我们改不动。

## 样式

界面用 Tailwind 写，面板上的控件来自 [shadcn/ui](https://ui.shadcn.com)（`Button`、
`Select`），按它的方式复制进 `src/components/ui/`——那些文件是本仓库的代码，可以直接
改，不要当成 node_modules 里的东西。

颜色只在 `src/styles.css` 的 `@theme` 里定义一次，页面和缸里的水共用同一批值：缸侧那
盏蓝灯就是加载条的蓝，缸的底色就是页面的底色。有三处读它，改颜色时三处都要跟上：

- 面板和文字 —— Tailwind 由那些变量生成工具类（`bg-abyss`、`text-mist`……）。
- 缸里的场景 —— Three.js 的材质拿不到 CSS 变量，由 `src/aquarium/palette.ts` 带一份
  同名的字面值过去。
- 加载幕布 —— 必须在第一帧就画出来，早于任何样式表，所以它在 `index.html` 里内联，
  同样自带一份字面值。

前两处本可以由构建期的代码生成打通，幕布那处绕不过去（它就是要早于 CSS）。所以这里
选择靠约定同步，代价写在 `styles.css` 的注释里。

## 目录约定

- `src/tests/`：所有测试，以及它们唯一的入口 `aquariumPage.tsx`。
- `src/components/ui/`：shadcn/ui 复制进来的组件。
- `src/lib/utils.ts`：shadcn 组件用的 `cn()`。
- `src/aquarium/Panel.tsx`：浮在缸前面的那种毛玻璃面板。
- `src/aquarium/palette.ts`：场景侧的颜色，对应 `styles.css` 里的 `@theme`。
- `src/aquarium/fishSimulation.ts`：无渲染依赖的鱼运动规则。
- `src/aquarium/fishSpecies.ts`：每个鱼种的模型、动画、比例和性子。
- `src/aquarium/stocking.ts`：把鱼种和数量变成一缸各有差异的鱼，以及容量上限。
- `src/aquarium/tankPresets.ts`：鱼缸尺寸预设与场景几何换算。
- `src/aquarium/Fish.tsx`：把模拟状态映射到 3D 鱼对象。
- `src/aquarium/FishMarket.tsx`：增减鱼的面板。
- `src/aquarium/Aquarium.tsx`：鱼缸场景、灯光和相机控制。
- `src/aquarium/loadingCurtain.ts`：等模型下载完再撤掉 `index.html` 里那块加载幕布。
- `public/models/*/`：各鱼种的 GLB 模型及署名信息，见 `docs/fish-assets.md`。
