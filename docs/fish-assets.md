# 新增鱼种的资源流程

## 推荐的资源契约

每个鱼种尽量提供一个 `.glb` 文件，并满足：

- 包含至少一个可循环的游泳动画（例如 `Swim_Slow`）；
- 模型朝向统一为“头朝 +X”，原点接近鱼体中心；
- 贴图控制在 1K～2K，避免把整个网页变成模型下载器；
- 在缸内的包围盒不会越过水面；
- 附带来源、作者、许可证和原始下载链接。

当前运行时已经使用 Three.js 的 `GLTFLoader` 支持 glTF 2.0，并读取返回结果中的 `animations` 数组，因此符合这份契约的资源不需要建模软件即可接入。

## 资源与授权

- [Poly Haven License](https://polyhaven.com/license)：模型、材质和 HDRI 均为 CC0，可用于商业项目，不要求署名。
- [Quaternius FAQ](https://quaternius.com/faq.html)：模型为 CC0，可修改并用于商业项目；它更偏低多边形风格，适合快速补充品种。
- [Sketchfab Download API Guidelines](https://sketchfab.com/developers/download-api/guidelines)：可下载的 Creative Commons 模型需要署名作者和来源；具体模型页的许可证优先于平台的搜索结果。

选用 Sketchfab 资源时，将作者、模型页、许可证和下载格式一起写入对应目录的 `ATTRIBUTION.md`。不要把“免费预览”“可嵌入”或搜索结果中的“free”当作可再分发许可；`NC` 不适合商业用途，`ND` 不适合修改，`SA` 会增加衍生作品的许可证义务。

## 接入成本估算

| 资源状态 | 预计成本 |
| --- | ---: |
| 已有可循环动画的 GLB，朝向和比例正常 | 5～15 分钟 |
| 有动画但为 FBX/Blend，需要转换和检查 | 30～90 分钟 |
| 静态模型，需要补动画或修材质/骨骼 | 1～3 小时 |
| 没有可用模型，需要重新制作 | 不再是“换资源”问题，按建模任务估算 |

因此长期最省成本的做法是：只接收满足资源契约的模型，把“转换、缩放、动画时间轴和碰壁表现”集中在运行时适配层处理，而不是每个鱼种都写一套组件。

参考：[Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)。
