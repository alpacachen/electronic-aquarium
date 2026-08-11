# 电子鱼缸

一个只需要打开浏览器就能观赏的 PC 端 3D 虚拟鱼缸。

线上：<https://alpacachen.github.io/electronic-aquarium/>（main 上每次提交自动部署）

## 当前阶段

- Three.js 场景：玻璃鱼缸、水体和水面。
- 十一个鱼种（金鱼、尖吻鲈、小丑鱼、金枪鱼、蓝刀鲷，以及六种新增的低多边形鱼）持续游动，并在水体边界转向。
- 每条鱼守着自己的水层上下巡游，升降时抬头低头，游速有快有慢；同种鱼也不会齐步走。
- 鱼市面板可以按鱼种增减，缸里养多少条由水体容量决定。
- 鼠标拖动旋转视角，滚轮缩放。
- 界面分中英文，头一次进来跟着浏览器偏好，左下角可以手动切，选过的会记住。
- 模型有几兆，下载完之前显示一块加载幕布。它是普通的 React 组件，所以脚本起来之前那一
  两秒（慢网下更久）观众看到的是空页——换来的是 `index.html` 干净、文案样式都只有一份。
- 手机上默认收起尺寸和鱼市控件，通过底部按钮展开；除了语言这一项，当前没有别的本地
  存储、也没有后端，鱼群的增减不会跨刷新保留。

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

`pnpm check` 会依次运行交互测试、颜色副本核对、TypeScript 检查和生产构建。测试只有一套，
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
- `src/tests/switchingLanguage.test.tsx`：切中英文，以及下次进来还记不记得。

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
盏蓝灯就是加载条的蓝，缸的底色就是页面的底色。有两处读它，改颜色时两处都要跟上：

- 面板和文字 —— Tailwind 由那些变量生成工具类（`bg-abyss`、`text-mist`……）。加载幕布
  也走这条，它就是个普通组件。
- 缸里的场景 —— Three.js 的材质拿不到 CSS 变量，由 `src/aquarium/palette.ts` 带一份
  同名的字面值过去。

另有一处单值副本：`index.html` 里的 `<meta name="theme-color">`（浏览器要在 CSS 之前就
知道拿什么色画地址栏）。

这本可以由构建期的代码生成打通，但这里选择靠约定同步，代价写在 `styles.css` 的注释里；
`pnpm check:colors` 在构建前核对这几份映射，并拦截源码里未登记的十六进制颜色。

## 文案与语言

用 [i18next](https://www.i18next.com) + [react-i18next](https://react.i18next.com)，语言
检测和存储交给 `i18next-browser-languagedetector`。界面文案全在
`src/i18n/locales/{zh,en}.json`，组件里一律 `t('key')`，别写死任何一种语言。鱼种名和缸
尺寸的名字也按 id 列在那儿——`fishSpecies.ts` 和 `tankPresets.ts` 描述的是鱼怎么游、缸
有多大，跟用哪种语言称呼它无关。

`src/i18n/index.ts` 里的 `createI18n()` 建实例。不用模块级单例：交互测试要一条用例开一
个（有的固定语言、有的走检测），共用会让前一条留下的语言漏到后一条身上。给 `lng` 就以
它开局，不给才让 detector 去认——两种情况下 detector 都挂着，所以观众切了语言照样缓存
得下来。

几处约定：

- 检测顺序收成 `['localStorage', 'navigator']`，键是 `aquarium-language`。默认那串还含
  querystring、cookie、htmlTag，这只缸用不到，留着等于多几条没人测过的入口。
- `load: 'languageOnly'` + `supportedLngs` 把 `zh-CN` 归到 `zh`，认不出的落到
  `fallbackLng: 'en'`。
- 鱼名列表用内置的 `list` formatter（走 `Intl.ListFormat`），所以中文两项是「A和B」、
  三项是「甲、乙和丙」，不用自己按语言挑分隔符。
- 内置 formatter 只有 currency / datetime / list / number / relativetime，小写是
  `createI18n()` 里自己加的一条，语言包里写 `{{label, lowercase}}`——英文鱼名在句中要
  小写、列表里又是句首大写，哪种语言要不要小写由那份语言包自己说。
- 「已养满」那半句用 i18next 的 context（`tally` / `tally_full`）。

切换控件在左下角，上面的字不跟着当前语言翻——只认得英文的人打开中文界面，得先认出
「English」那一颗。

和颜色不同，文案没有第二份副本：`index.html` 里一句译文都没有，全在
`src/i18n/locales/` 那两份 JSON 里。怎么做到的见下一节。

## 加载幕布

幕布整个在 React 里：`src/aquarium/LoadingCurtain.tsx` 一个文件，文案、样式、进度、撤场
都在那儿。`index.html` 保持 Vite 默认的样子（21 行）。

**代价是明知的**：脚本起来之前没有任何加载指示。实测（`vite preview` + CDP 限速）：

| | React 挂上 |
|---|---|
| 不限速 | 958ms |
| Fast 3G | 3124ms |
| Slow 3G | 11872ms |

产物 1.38 MB，模型另有 8 MB，所以慢网下这段空页有十几秒。曾经把底色和进度条写死在
`index.html` 里顶住这一段，但那要求文案跟着抄一份（两种语言各一份）、一套 `data-*` 协议
把 React 那侧接上来、外加一个 85 行的脚本核对两份副本别漂。为了可读性和可维护性，这里
选择接受空页，把那些全删掉。

几个细节：

- 组件放在 Canvas 外面。`useProgress` 是挂在 Three 的 `DefaultLoadingManager` 上的一个
  store，和 Canvas 无关，所以在外面照样收得到缸里那些 GLTF 的进度——而在外面就能正常拿
  到 i18n，不用把话当 prop 一路递进缸里。
- 进度条在拿到真实件数之前来回扫（`--animate-loading-sweep`，和颜色一样定义在
  `styles.css` 的 `@theme` 里）。判断「有没有真实进度」只看 `total`，不要看 ref：ref 变
  了不会触发重渲染，而模型卡在半路时进度也不变，两下一凑进度条就永远不动。
- 没有 WebGL 时不挂幕布：那种情况一个模型都不会去下，幕布等不到「加载完」，只能挨到超时
  才走，白白压在降级提示上面十几秒。
- `useProgress` 分不出「没什么要加载」和「还没开始加载」（两种都是
  `active: false, total: 0`）。所以挂上 250ms 后还没有任何东西开始加载，就当作没什么要
  加载的、直接撤——模型全在缓存里时就是这一条。
- `<title>` 和 `<html lang>` 在 HTML 里是中文（这只缸原本的语言），i18next 一起来就由
  `App` 换成观众那种。英文观众会看到一瞬中文标题：标签页上那行字比正文低一档，不值得为
  它在 HTML 里内联一套语言检测。
- 交互测试里，`openAquarium()` 默认等幕布走完再把缸交出去（幕布盖在缸上，之后的点击和
  拖动才落得准），实测每条用例多花约 240ms。想在幕布还在的时候看它的，用
  `stallModels: true` 把一个鱼种的 body 卡在半路。

## 目录约定

- `src/tests/`：所有测试，以及它们唯一的入口 `aquariumPage.tsx`。
- `src/i18n/locales/{zh,en}.json`：界面文案，一种语言一份。
- `src/i18n/index.ts`：`createI18n()` 和几个常量（支持的语言、`<html lang>` 标记、存储
  键、切换控件上那两个名字）。
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
- `src/aquarium/LanguagePicker.tsx`：左下角切中英文的那两颗按钮。
- `src/aquarium/Aquarium.tsx`：鱼缸场景、灯光和相机控制。
- `src/aquarium/LoadingCurtain.tsx`：模型下载解析完之前挡在缸前面的那块幕布。
- `public/models/*/`：各鱼种的 GLB 模型及署名信息，见 `docs/fish-assets.md`。
