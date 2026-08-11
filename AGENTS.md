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
- 样式用 Tailwind，控件用 shadcn/ui，颜色一律取 `src/styles.css` 里 `@theme` 定义的
  那批，不要在组件里另写十六进制值。缸里的场景另有一份同名副本
  （`src/aquarium/palette.ts`），改色的落点见 README 的样式一节。
- 界面文案在 `src/i18n/locales/{zh,en}.json`，组件里一律 `t('key')`，不要写死任何一种
  语言，也不要自己搭语言检测/存储那一层——那是
  `i18next-browser-languagedetector` 的活，配置在 `src/i18n/index.ts`。
- 加载幕布是一个普通组件（`src/aquarium/LoadingCurtain.tsx`），文案样式进度都在那一个
  文件里。`index.html` 保持干净，别往里加文案或样式——代价是 React 挂上之前没有加载
  指示（慢网下十几秒），这是明知的取舍，见 README 的加载幕布一节。
- 提交前跑 `pnpm check`（交互测试 + 副本核对 + 类型检查 + 构建）。
- 交互测试是串行跑的，见 README 的测试一节；别改成并行。

## 测试只写交互测试

这个项目**不写函数级单元测试**。所有测试都在 `src/tests/`，都从
`const aquarium = await openAquarium()` 出发，操作页面、断言观众看得见的东西。

为什么：单测锁的是函数签名，重构时最先碎掉，而且它证明不了「观众真的看到鱼在游」。
交互测试慢，但它挂了就说明产品坏了。

所以：

- 新增行为，写交互用例，不要因为「这个纯函数好测」就顺手加一份单测。
- 有些性质确实只有函数级才测得准（比如喂极端参数、比较两种步长的积分误差）。这种
  情况下**不要**加单测文件——要么想办法从缸里观察到它，要么就不测，并在 PR 里说清
  放弃了什么。
- 写完一条用例，把被测的代码改坏，确认它真的会挂。阈值尤其容易写得过宽：留着十几倍
  余量的断言看着是绿的，其实什么都没盯住。阈值旁边注明实测值和留余量的理由。
