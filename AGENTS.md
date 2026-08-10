# 电子鱼缸

一个 PC 端 3D 虚拟鱼缸。项目介绍、开发与测试方式见 [README.md](README.md)。

## 待办从哪里看

[GitHub Issues](https://github.com/alpacachen/electronic-aquarium/issues) 是唯一的
待办来源，仓库里不再另存一份清单。

```bash
gh issue list                  # 还没做的
gh issue view 3                # 看某一条的上下文
gh issue comment 3 --body "…"  # 把进展记回去，别只留在对话里
```

约定：

- 开工前先读对应的 issue，正文里往往有已经查清的背景和前置条件。
- 提交信息里写 `Closes #3`，合并后 issue 会自动关闭；不要手动改清单。
- 干活中发现的新问题，`gh issue create` 记一条，而不是顺手做掉——除非它挡着当前这条路。
- issue 写得含糊时（比如标着「范围待定」），先问清楚再动手，不要自己替用户定范围。
- 查清了成因、或者否掉了某个猜想，评论到 issue 里；下一个接手的人（或 agent）只能看到这些。

## 动手之前

- 资源相关（新增鱼种、找模型、判许可）先读 [docs/fish-assets.md](docs/fish-assets.md)，
  里面有量朝向和缩放的方法，以及踩过的坑。
- 提交前跑 `pnpm check`（单元测试 + 交互测试 + 类型检查 + 构建）。
- 交互测试是串行跑的，见 README 的测试一节；别改成并行。
