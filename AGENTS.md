# 电子鱼缸

一个 PC 端 3D 虚拟鱼缸。项目介绍、开发与测试方式见 [README.md](README.md)。

## 待办从哪里看

[docs/roadmap.md](docs/roadmap.md) 是唯一的待办清单。每次开工前先读，
完成的条目在同一个提交里勾掉。清单末尾有维护约定。

## 动手之前

- 资源相关（新增鱼种、找模型、判许可）先读 [docs/fish-assets.md](docs/fish-assets.md)，
  里面有量朝向和缩放的方法，以及踩过的坑。
- 提交前跑 `pnpm check`（单元测试 + 交互测试 + 类型检查 + 构建）。
- 交互测试是串行跑的，见 README 的测试一节；别改成并行。
