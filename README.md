# Kuntechnology 项目导航

这是 `https://kuntechnology.github.io/` 的纯静态首页，为四个内容不同的公开 GitHub Pages 项目提供统一入口。页面用原生 HTML、CSS、SVG、WebGL 与 Canvas；GSAP 以固定版本本地发布，无外部 CDN 请求、字体或私有项目数据。

## 项目入口

| 项目 | 用途 | 地址 |
| --- | --- | --- |
| UI 设计风格集锦 | 44 种 UI 风格、tokens、示例与提示词 | https://kuntechnology.github.io/ui-style-gallery/ |
| 输液提醒小助手 | 输液计时与提醒页面 | https://kuntechnology.github.io/iv-infusion-helper/ |
| 安恒信息安全服务方案 | 金融行业安全服务展示 | https://kuntechnology.github.io/Das-security/ |
| SFTP 安全传输可视化指南 | 交互式 SFTP / SSH 加密学习页面 | https://kuntechnology.github.io/sftp-visualization-guide/ |

## 首页体验与发布

首页以原生 WebGL fragment shader 绘制动态能量球与扫描网格，Canvas 2D 绘制粒子与信号线，GSAP 3.15.0 编排标题、星图、筛选、hover 与滚动揭示；页面仍无构建步骤。GSAP 由仓库本地托管，不请求运行时 CDN。WebGL 不可用或上下文丢失时回退到 CSS 静态星场；移动端折叠星图，保留纵向项目目录。

动画尊重 `prefers-reduced-motion`：只绘制静帧并停用 GSAP 动效。文档页进入后台时暂停 Canvas、WebGL 与 GSAP；星图离开视口时暂停 WebGL。Canvas DPR 有上限、粒子数量受限，WebGL backing buffer 与帧率也有上限。项目入口仍是语义化链接，筛选、搜索、键盘焦点环和 `/` 搜索快捷键均保留。

## 第三方脚本许可

`assets/gsap-3.15.0.min.js` 来自 npm 官方 `gsap@3.15.0` 包。GSAP 采用 Standard “No Charge” license，允许网站使用；完整条款与限制见 [GSAP Standard License](https://gsap.com/community/standard-license/)。随仓库的 `assets/GSAP-LICENSE-NOTICE.txt` 记录版本与许可链接。

GitHub Pages 从 `main` 分支根目录发布；提交后首页地址为 `https://kuntechnology.github.io/`。本仓库仅管理根站项目导航，不复制或迁移其他项目内容。
