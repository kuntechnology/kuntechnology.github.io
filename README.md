# Kuntechnology 根站首页

这是 `https://kuntechnology.github.io/` 的纯静态首页，为四个内容不同的公开 GitHub Pages 项目提供统一入口。页面用原生 HTML、CSS、SVG、WebGL 与 Canvas；GSAP 以固定版本本地发布，无外部 CDN、字体或私有项目数据。

## 项目入口

| 项目 | 用途 | 地址 |
| --- | --- | --- |
| UI 设计风格集锦 | 44 种 UI 风格、tokens、示例与提示词 | https://kuntechnology.github.io/ui-style-gallery/ |
| 输液提醒小助手 | 输液计时与提醒页面 | https://kuntechnology.github.io/iv-infusion-helper/ |
| 安恒信息安全服务方案 | 金融行业安全服务展示 | https://kuntechnology.github.io/Das-security/ |
| SFTP 安全传输可视化指南 | 交互式 SFTP / SSH 加密学习页面 | https://kuntechnology.github.io/sftp-visualization-guide/ |

## 首页视觉与性能

首页以经纬度 UV 球面几何和本地 NASA Blue Marble 贴图构成旋转地球；WebGL 在球面上叠加低强度蓝色经纬线、缓慢扫描光与自发光大气边缘。Canvas 按深度生成远暗近亮、近大远小的星点，桌面鼠标带来轻微视差与局部柔光；随机低频的小彗星只短暂掠过。左侧项目入口以低饱和透明灯带响应鼠标与键盘焦点。SVG 轨道节点和 GSAP 入场仍只作克制的艺术化场景辅助。球体是视觉表达，不是精确地理定位或科学测量；装饰网格与轨道不代表真实轨迹，也不暗示 NASA 背书。

贴图来源为 NASA Earth Observatory 的 Blue Marble: Next Generation April 2004 global base map：

- 原始文件：https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/april/world.200404.3x5400x2700.jpg
- 官方项目与转载署名说明：https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/
- 首页署名：NASA Earth Observatory。
- 本地副本 `assets/earth-blue-marble.webp`：2048 × 1024 WebP，约 152 KB；由官方 5400 × 2700 全球影像缩放与压缩。原始数据来源归属 NASA Earth Observatory，NASA 未参与或背书本项目。

WebGL、贴图或着色器不可用时，首页显示同源 CSS / 图片静态地球；2D Canvas 不可用时保留纯 CSS 星点底图。WebGL backing buffer 与全屏 Canvas 均限制像素比和像素量，活动动效目标帧率不高于 30 fps；程序化星点上限为 180 个。地球场景与全屏星空分别在离开视口或标签页进入后台时暂停；`prefers-reduced-motion` 下显示静态星场与地球并关闭持续动效及指针视差。触摸设备不监听鼠标视差。项目链接使用原生语义化锚点、清晰键盘焦点环和跳过链接。布局从 320 CSS px 起适配。

## 第三方脚本许可

`assets/gsap-3.15.0.min.js` 来自 npm 官方 `gsap@3.15.0` 包。GSAP 采用 Standard “No Charge” license，允许网站使用；完整条款与限制见 [GSAP Standard License](https://gsap.com/community/standard-license/)。随仓库的 `assets/GSAP-LICENSE-NOTICE.txt` 记录版本与许可链接。

GitHub Pages 从 `main` 分支根目录发布；提交后首页地址为 `https://kuntechnology.github.io/`。本仓库只管理根站，不复制、修改或发布四个项目子站内容。
