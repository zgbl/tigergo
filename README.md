# TigerGo Frontend

TigerGo is a Go (Weiqi) platform web application. This repository contains the frontend code (HTML/JS/CSS).

## 🚀 Quick Start (Local Development)

You can run this project locally using a simple static file server.

### Method 1: Python (Recommended for macOS/Linux)

Most macOS and Linux systems have Python installed by default.

1. Open a terminal in the project root directory.
2. Run the following command:
   ```bash
   python3 -m http.server 8000
   ```
3. Open your browser and visit: [http://localhost:8000](http://localhost:8000)

### Method 2: Node.js

If you have Node.js installed, you can use `http-server` or `live-server` for a better experience (auto-reload).

1. Install `http-server` (optional, or use npx):
   ```bash
   npm install -g http-server
   ```
2. Run the server:
   ```bash
   npx http-server .
   ```
3. Visit the URL shown in the terminal (usually [http://127.0.0.1:8080](http://127.0.0.1:8080)).

## ⚙️ Configuration & Backend

The application automatically detects the environment based on the hostname (`js/config.js`):

- **Local (`localhost`)**:
  - Expects the backend API at `http://localhost:3000`.
  - Expects KataGo engine at `http://192.168.0.249:8080` or via proxy.
- **GitHub Pages / Production**:
  - Uses the production backend at `https://blackricegobackend2-nextjs.vercel.app`.

> **Note**: If you are running the frontend locally but do not have the backend running locally, API calls (login, save game, etc.) will fail. To fix this for frontend-only development, you may need to temporarily modify `js/config.js` to point `local` settings to the production URL.

## ✨ Recent Enhancements (2026.02)

### 1. 题目流水线 (Batch Question Workflow)
- **快速保存**: 极大提升题目制作效率，支持人工先锚定局面，后续再由 AI 批量补全数据。
- **批量验证**: 自动化处理待验证题目，完善 AI 分数、胜率及推荐点。

### 2. 答题体验优化 (Quiz Experience)
- **智能防泄密**: 答题前不泄露胜率预测，答题后全自动揭示统计数据并高亮正确选项。
- **紧凑型交互**: 新增弹窗式音量调节与持久化设置，节省页面空间。

### 3. 全局布局适配
- **棋盘等比缩放**: 统一减小棋盘尺寸（~80%），完美适配笔记本及平板屏幕。
- **压缩版导航栏**: 为答题页定制的极简导航，最大化核心操作区域。

## 📂 Project Structure
- `index.html`: Main entry point.
- `js/`: JavaScript logic (Game logic, API handling, UI controllers).
- `css/`: Stylesheets.
- `images/`: Assets.
- `API.md`: API documentation.

---
**Last Updated**: 2026-02-20
