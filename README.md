# 💣 智能扫雷 — Minesweeper AI & 多人对战版

[![License: MIT](https://img.shields.io/badge/License-MIT-rose.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D%2016.0.0-emerald.svg)](https://nodejs.org/)
![Platform](https://img.shields.io/badge/Platform-Web-blue.svg)

一个充满现代科技感的全功能网页扫雷游戏。不仅完美还原了经典玩法，更融入了**自适应阶梯算法AI**、**实时群组联机对战**以及**双全域主题切换**。前端基于原生精简技术栈构建，带来零延迟的流畅竞技体验。

🎯 **在线体验：** [点击直接游玩 (GitHub Pages)](https://xlcm111.github.io/aiMinesweeper/)  
*(注：GitHub Pages 静态托管版默认启用经典模式与人机对战，公网多人联机需另行部署后端)*

---

## ✨ 核心亮点

- 🎮 **经典单机** — 100% 还原传统扫雷体验，支持左键快速翻开、右键精准插旗、双键快捷排雷。
- 🤖 **人机对战 (VS AI)** — 独创 4 级智能 AI 陪练（初级/中级/高级/专家）。AI 智商与思考步频呈丝滑阶梯式递增，拒绝无脑暴毙，提供极具博弈感的拟人化对局。
- 🌐 **多人实时联机** — 基于 WebSocket 构建的动态大厅。支持一键创建房间、跨设备分享房间码、实时同步对手排雷进度条及公网动态排行榜。
- 🌗 **无缝全域双主题** - **深邃夜空 (默认)**：配合全屏动态流星粒子画布，打造沉浸式极客视觉。
  - **日落暖阳 / 经典模式**：高对比度清爽白天模式，精细适配每一处对战框边框与组件细节。
- 📊 **多维账号统计** — 完整的本地/云端战绩持久化，实时追踪多难度胜率、总游戏时长、各模式最佳纪录（Best Times），并配备精美段位/等级勋章。
- 📱 **移动端深度触屏优化** — 特制移动端多分辨率自适应视口，引入"智能长按插旗"防误触机制，打破键鼠限制。

---

## 🛠️ 技术栈

| 层级 | 选用技术 / 框架 | 作用说明 |
| :--- | :--- | :--- |
| **前端核心** | HTML5 / CSS3 (Variables + Grid) / Vanilla JS (ES6+) | 纯原生轻量化构建，0 框架依赖，极致加载速度 |
| **视觉特效** | HTML5 Canvas Api | 高性能实时背景粒子动效渲染 |
| **实时通信** | Node.js / `ws` (WebSocket) | 低延迟多人数据同步、房间状态机管理 |
| **本地持久化** | Web Storage API (LocalStorage) | 离线记录用户偏好、主题皮肤与本地战绩 |

---

## 📁 升级版项目结构

```text
aiMinesweeper/
├── index.html              # 前端主入口页面
├── style.css               # 全局样式（包含响应式适配、全套白天/黑夜主题覆盖）
├── config.js               # 游戏核心配置（关卡雷数、四级 AI 智商及速度梯队参数）
├── js/                     # 模块化前端核心逻辑
│   ├── state.js            # 核心全局状态管理机制
│   ├── cell.js             # 单个格子行为与状态类
│   ├── classic.js          # 经典单机模式控制器
│   ├── vs-mode.js          # 人机对战核心状态机（首步防炸保护、降智盲猜兜底）
│   ├── ai-solver.js        # AI 逻辑求解器（规则1/2推导、高阶定式识别、概率启发盲猜）
│   ├── multiplayer.js      # WebSocket 联机客户端核心
│   └── utils.js            # LED数字格式化、移动端长按适配等工具集
├── server.js               # Node.js 高并发后端服务器
├── package.json            # Node 项目配置文件
└── start-multiplayer.bat   # Windows 环境一键本地全栈启动脚本
```

---

## 🚀 快速开始

### 1. 本地联机部署（开发者环境）

确保本地已安装 Node.js (建议版本 v16 或更高)。

```bash
# 克隆仓库
git clone https://github.com/xlcm111/aiMinesweeper.git
cd aiMinesweeper

# 安装后端依赖
npm install

# 启动全栈服务器
npm start
```

### 2. Windows 玩家一键游玩

在 Windows 系统下，无需打开终端，直接双击运行项目根目录下的 `start-multiplayer.bat`。

脚本会自动启动 Node.js 后端服务并为你唤起浏览器。打开浏览器访问 `http://localhost:3000` 即可在本地一边开服务器一边享受联机对战！

---

## 📝 贡献与许可

欢迎任何形式的 Issue 提交或 Pull Request 贡献！

MIT © xlcm111
