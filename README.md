# 电子鱼缸

一个只需要打开浏览器就能观赏的 PC 端 3D 虚拟鱼缸。

## 当前阶段

- Three.js 场景：玻璃鱼缸、水体和水面。
- 五个鱼种（金鱼、尖吻鲈、小丑鱼、金枪鱼、蓝刀鲷）持续游动，并在水体边界转向。
- 每条鱼守着自己的水层上下巡游，升降时抬头低头，游速有快有慢；同种鱼也不会齐步走。
- 鱼市面板可以按鱼种增减，缸里养多少条由水体容量决定。
- 鼠标拖动旋转视角，滚轮缩放。
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

`pnpm check` 会依次运行行为测试、TypeScript 检查和生产构建。

## 测试

纯函数测试在 Node.js 中运行，交互测试跑在真实的 Chromium 里（Vitest browser mode）。
交互用例会渲染整个应用、
操作页面上的控件，再断言观众看得见的结果：DOM 上的文字，以及 WebGL 真正渲染
出来的鱼缸和鱼。

- `src/testing/aquariumPage.tsx`：唯一的测试入口，把应用包装成"观众看到的鱼缸"。
- `src/aquarium/viewingTheAquarium.test.tsx`：打开页面看鱼游动。
- `src/aquarium/stockingTheTank.test.tsx`：在鱼市里增减鱼。
- `src/aquarium/choosingATankSize.test.tsx`：切换鱼缸尺寸。
- `src/aquarium/movingTheCamera.test.tsx`：拖动和滚轮操作镜头。

每个用例按 Given / When / Then 三段写成，注释直接标出这三步。

无头浏览器用软件光栅化跑 WebGL，只有几帧每秒，所以交互测试不靠真实时间等待，而是
用 `frameloop="never"` 接过时钟，再由 `letTimePass(秒)` 按固定步长推进帧。这样
长时间运动也能快速完成，且每次结果一致。

同理，交互测试文件是串行跑的（`fileParallelism: false`）：每个文件都要驱动自己的
WebGL 画布，几个文件一起抢同一个软件光栅化器时，单独都能过的用例反而会集体超时。

## 目录约定

- `src/aquarium/fishSimulation.ts`：无渲染依赖的鱼运动规则。
- `src/aquarium/fishSimulation.test.ts`：鱼运动规则的快速单元测试。
- `src/aquarium/fishSpecies.ts`：每个鱼种的模型、动画、比例和性子。
- `src/aquarium/stocking.ts`：把鱼种和数量变成一缸各有差异的鱼，以及容量上限。
- `src/aquarium/tankPresets.ts`：鱼缸尺寸预设与场景几何换算。
- `src/aquarium/tankPresets.test.ts`：鱼缸尺寸与场景换算的单元测试。
- `src/aquarium/Fish.tsx`：把模拟状态映射到 3D 鱼对象。
- `src/aquarium/FishMarket.tsx`：增减鱼的面板。
- `src/aquarium/Aquarium.tsx`：鱼缸场景、灯光和相机控制。
- `public/models/*/`：各鱼种的 GLB 模型及署名信息，见 `docs/fish-assets.md`。
