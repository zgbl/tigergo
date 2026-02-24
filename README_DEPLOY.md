# TigerGo 部署指南 🚀

本项目采用前后端分离架构，前端部署在 GitHub Pages，后端部署在 Vercel，GPU 引擎建议通过 Cloudflare Tunnel 穿透。

## 1. 后端部署 (Vercel)

将 `blackricegobackend2` 仓库连接到 Vercel。

### 环境变量设置
在 Vercel 控制面板中添加以下环境变量：
- `KATAGO_SERVER_URL`: 填写你的 KataGo 引擎地址（如 Cloudflare Tunnel 提供的域名）。
  - 如果还没设置 Tunnel，可以暂时不填或填本地测试 IP。
- `MONGODB_URI`: 填写你的 MongoDB 连接字符串。

## 2. 前端部署 (GitHub Pages)

将 `tigergo` 仓库启用 GitHub Pages。

### 配置文件检查
确保 `js/config.js` 中的 `github` 配置项正确指向你的 Vercel 域名：
```javascript
github: {
    API_BASE_URL: "https://your-backend-name.vercel.app/api",
    // ...
}
```

## 3. GPU 引擎穿透 (Cloudflare Tunnel) - 推荐方案

这是将家里的 GPU 引擎安全暴露到公网的最佳方案。

### 步骤：
1. **安装 cloudflared**: 在运行 KataGo 的电脑上安装 Cloudflare 客户端。
2. **登录**: `cloudflared tunnel login`
3. **创建隧道**: `cloudflared tunnel create katago-tunnel`
4. **配置路由**: `cloudflared tunnel route dns katago-tunnel katago.yourdomain.com`
5. **运行隧道**:
   ```bash
   cloudflared tunnel run --url http://localhost:8080 katago-tunnel
   ```
6. **更新配置**: 将获得的 `https://katago.yourdomain.com` 填入：
   - Vercel 的 `KATAGO_SERVER_URL` 环境变量。
   - `tigergo/js/config.js` 中的 `tunnel` 引擎 URL。

### 为什么使用 Tunnel?
- **强制 HTTPS**: GitHub Pages 和 Vercel 必须通过 HTTPS 访问。Tunnel 自动提供 SSL，避免浏览器拦截 "Mixed Content"。
- **无需公网 IP**: 即使家里没有固定公网 IP 也能稳定访问。
- **安全**: 不需要打开路由器端口。

---
祝部署顺利！如有问题请随时询问。
