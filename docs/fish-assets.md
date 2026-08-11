# 新增鱼种的资源流程

这份文档讲三件事：去哪里找模型、怎么判断能不能用、拿到之后怎么接进鱼缸。文末是已接入
鱼种的台账。

## 推荐的资源契约

每个鱼种尽量提供一个 `.glb` 文件，并满足：

- 优先包含至少一个可循环的游泳动画（例如 `Swim_Slow`）；静态鱼模型需要配置尾部范围，由运行时做程序化摆尾；
- 模型朝向统一为“头朝 +X”，原点接近鱼体中心；
- 贴图控制在 1K～2K，避免把整个网页变成模型下载器；
- 在缸内的包围盒不会越过水面；
- 附带来源、作者、许可证和原始下载链接。

当前运行时已经使用 Three.js 的 `GLTFLoader` 支持 glTF 2.0，并读取返回结果中的 `animations` 数组，因此符合这份契约的资源不需要建模软件即可接入。

## 去哪里找

按“拿到就能用”的顺序排：

| 来源 | 许可 | 格式 | 适合 |
| --- | --- | --- | --- |
| [Poly Pizza](https://poly.pizza/bundle/Animated-Fish-Bundle-ZkGbjS8m8g) | CC0 | GLB | 首选。Quaternius 那批动画鱼的 GLB 转载，低多边形、带 `Swim` 循环、无贴图 |
| [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) | 多为 CC0 | GLB | 写实但多数没有动画，需要程序化摆尾 |
| [Quaternius 官网](https://quaternius.com/packs/animatedfish.html) | CC0 | FBX/OBJ/Blend | 同一批资源，但要自己转格式，优先走 Poly Pizza |
| [Poly Haven](https://polyhaven.com/license) | CC0 | GLB | 材质和 HDRI 好用，鱼类少 |
| [Sketchfab](https://sketchfab.com/developers/download-api/guidelines) | 逐个模型看 | 多种 | 写实模型多、动画齐全，但许可最需要留意 |

判断许可时，把作者、模型页、许可证和下载格式一起写进对应目录的 `ATTRIBUTION.md`。
不要把“免费预览”“可嵌入”或搜索结果里的“free”当作可再分发许可；`NC` 不适合商业用途，
`ND` 不适合修改，`SA` 会给衍生作品带上额外的许可义务。具体模型页的许可证优先于平台
的搜索结果页。

Poly Pizza 上每个模型页的 GLB 直链藏在页面里，可以直接取：

```bash
curl -sL "https://poly.pizza/m/<模型 id>" | grep -oE 'https://static\.poly\.pizza/[^"]+\.glb'
```

## 接入一个新鱼种

只改两处：`src/aquarium/fishSpecies.ts` 加一条配置，`src/App.tsx` 的 `DEFAULT_STOCK`
决定开局养几条（鱼市会自动列出新鱼种，不用另外登记）。

配置里的每一项都该量出来，不要猜：

- `label`：鱼市里显示的名字。
- `animation.name`：GLB 里循环游泳那条 clip 的名字。Blender 经 FBX2glTF 导出的资源通常
  叫 `Armature|Swim`，同一批里重名的第二条会变成 `Armature|Swim.001`，务必逐个确认。
  没有动画就不填这项，改为配置 `tail`，由运行时做程序化摆尾。
- `rotationY`：把模型转到项目约定的“头朝 +X”。**骨骼蒙皮模型的朝向要看骨骼的世界坐标**
  （比如 `Face` 和 `Tail_end` 分别落在 z 的哪一端），不能只看顶点包围盒——顶点存的是绑定
  姿态，量出来会反。Blender 惯用 Z-up，导出后多为头朝 +Z，对应 `Math.PI / 2`。
- `unitScale`：把体长拉到约 1 个世界单位，和缸里现有的鱼相称。
- `centerY`：模型自身坐标里鱼体中心的高度，用来把鱼挂在水体中线上。
- `temperament`：这个鱼种在水里的性子，见下一节。

### temperament 的四个数

`temperament` 给出鱼种的基调，`stocking.ts` 再给每条鱼加上个体差异，所以同种鱼不会
齐步走。

- `speed`：巡游速度，世界单位每秒。缸里现有的鱼在 0.5～0.85 之间。
- `depth`：偏爱的水层，取水体半高的比例。`-0.35` 偏底、`0.3` 偏上。
- `period`：上下巡游一个来回要几秒。**这个数比看起来重要**：它和鱼能上下走多远直接挂钩。
- `surge`：游速起落的幅度，占 `speed` 的比例。

`period` 之所以关键，是因为俯仰角是从实际升降速率推出来的（`atan2(升降, 前进)`）。一条
振幅 A、周期 P 的正弦，最快升降速率是 `2πA/P`；周期给得太短，鱼就得以接近甚至超过自己
前进的速度往上冲，姿态会一路顶到俯仰上限，看着像条竖起来的针。所以 `stocking.ts` 里的
`roamWithin` 反过来做：先定一个舒服的俯仰角（0.32 rad），再算出这个周期最多支持多大的
上下范围，取两者中较小的那个。要让鱼游得更开，加长 `period`，而不是直接调大范围。

## 怎么验

三件事值得单独验，都不是肉眼扫一眼能确认的：

**朝向**。渲染出来看，别只信数字。把每个鱼种并排摆在同一个相机下、各自应用自己的
`rotationY`，五条鱼都该朝同一边游。

**不越水面**。鱼在游泳动画的极限姿态下，背鳍也不能探出水面。蒙皮是在 GPU 上算的，
所以要采样整条 clip、用骨骼变换后的顶点来量（three.js 里是 `applyBoneTransform`），
直接取 `Box3` 只会得到绑定姿态。五个鱼种在全部缸型下的水面余量目前都为正，最紧的是
金鱼在迷你缸里的 0.033。

**俯仰角**。稳态下的俯仰应当落在 0.32 rad 附近，而不是贴着 0.5 的上限。如果贴住了上限，
说明 `period` 相对上下范围太短了。另外注意区分“入场瞬间”和“稳态”：鱼如果被放在离自己
巡游深度很远的地方，头一秒会被拽过去，那一下的俯仰远大于它之后的任何时刻——所以
`createFish` 接受 `bounds`，好让鱼一开始就待在自己的水层上。

## 接入成本估算

| 资源状态 | 预计成本 |
| --- | ---: |
| 已有可循环动画的 GLB，朝向和比例正常 | 5～15 分钟 |
| 有动画但为 FBX/Blend，需要转换和检查 | 30～90 分钟 |
| 静态、单体鱼模型，可使用程序化摆尾 | 15～30 分钟 |
| 鱼鳍结构复杂，程序化摆尾效果不足 | 1～3 小时 |
| 没有可用模型，需要重新制作 | 不再是“换资源”问题，按建模任务估算 |

因此长期最省成本的做法是：只接收满足资源契约的模型，把“转换、缩放、动画时间轴和碰壁表现”集中在运行时适配层处理，而不是每个鱼种都写一套组件。

## 已接入的鱼种

| 鱼种 | 作者 / 来源 | 许可 | clip | 体积 |
| --- | --- | --- | --- | ---: |
| 金鱼 | Picasty · [Sketchfab](https://sketchfab.com/3d-models/goldfish-variety-3-851c92634c014949ae78c4b52807584f) | CC BY 4.0（需署名） | `Swim_Slow` | 6.2 MB |
| 尖吻鲈 | Microsoft · [glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/BarramundiFish) | CC0 | 无，程序化摆尾 | 408 KB |
| 小丑鱼 | Quaternius · [Poly Pizza](https://poly.pizza/m/BEcU9rjiAq) | CC0 | `Armature\|Swim` | 82 KB |
| 金枪鱼 | Quaternius · [Poly Pizza](https://poly.pizza/m/XWl86YFtpF) | CC0 | `Armature\|Swim` | 70 KB |
| 蓝刀鲷 | Quaternius · [Poly Pizza](https://poly.pizza/m/Ymu8ftrmuT) | CC0 | `Armature\|Swim.001` | 64 KB |
| 装甲鲶鱼 | Quaternius · [Poly Pizza](https://poly.pizza/m/mtd9QK5yCe) | CC0 | `Fish_Armature\|Swimming_Normal` | 155 KB |
| 鹦嘴鱼 | Quaternius · [Poly Pizza](https://poly.pizza/m/lj0WFfJkbb) | CC0 | `Fish_Armature\|Swimming_Normal` | 146 KB |
| 斗鱼 | Quaternius · [Poly Pizza](https://poly.pizza/m/Vg8IlYjdZi) | CC0 | `Fish_Armature\|Swimming_Normal` | 153 KB |
| 天竺鲷 | Quaternius · [Poly Pizza](https://poly.pizza/m/YyZyVhg2Jq) | CC0 | `Fish_Armature\|Swimming_Normal` | 147 KB |
| 脂鲤 | Quaternius · [Poly Pizza](https://poly.pizza/m/l6AhogdZHe) | CC0 | `Fish_Armature\|Swimming_Normal` | 182 KB |
| 麒麟鱼 | Quaternius · [Poly Pizza](https://poly.pizza/m/h6M5zlF5Yx) | CC0 | `Fish_Armature\|Swimming_Normal` | 177 KB |

金鱼是唯一需要署名的资源，其余为 CC0。九个 Quaternius 模型无贴图、纯色 PBR 材质，
都是头朝 +Z，`rotationY` 取 `Math.PI / 2`。

同一批 Poly Pizza 资源里还有鲨鱼、海豚、鲸鱼和魟鱼（同为 CC0），想继续扩缸可以直接取用；
魟鱼的鳍是多骨骼驱动，接入前先确认它在小缸里的比例。

参考：[Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)。
