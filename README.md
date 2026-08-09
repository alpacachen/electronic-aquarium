# 电子鱼缸

一个只需要打开浏览器就能观赏的 PC 端 3D 虚拟鱼缸。

## 当前阶段

- Three.js 场景：玻璃鱼缸、水体和水面。
- 4 条程序化鱼持续游动，并在水体边界反弹。
- 鼠标拖动旋转视角，滚轮缩放。
- 当前不包含移动端适配、本地存储、后端和外部模型资源。

## 开发

```bash
pnpm install
pnpm dev
```

## 检查

```bash
pnpm check
```

`pnpm check` 会依次运行行为测试、TypeScript 检查和生产构建。

## 目录约定

- `src/aquarium/fishSimulation.ts`：无渲染依赖的鱼运动规则。
- `src/aquarium/fishSimulation.test.ts`：鱼运动规则的行为测试。
- `src/aquarium/Fish.tsx`：把模拟状态映射到 3D 鱼对象。
- `src/aquarium/Aquarium.tsx`：鱼缸场景、灯光和相机控制。
