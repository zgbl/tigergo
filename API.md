# TigerGo API 说明文档

## 项目概述

TigerGo 是一个基于 Web 的围棋平台，集成了棋谱分析、测试题生成、答题系统、用户管理等功能。项目采用前后端分离架构，前端使用原生 JavaScript，后端使用 Node.js + MongoDB，并集成 KataGo AI 引擎进行棋局分析。

## 架构概览

### 前端架构

- **技术栈**: 原生 JavaScript + HTML5 + CSS3
- **主要模块**: 棋盘渲染、SGF 解析、分析引擎、测试系统、用户界面
- **数据存储**: IndexedDB（本地缓存） + MongoDB（远程存储）

### 后端架构

- **主服务**: Node.js + MongoDB (部署在 Vercel)
- **AI 服务**: KataGo Analysis Engine (支持本地和云端部署)
- **数据库**: MongoDB (存储用户数据、棋谱、分析结果、测试题等)

## 已实现的主要功能

### 1. 棋谱分析系统

- **SGF 文件解析和显示**
- **KataGo AI 分析集成**
- **分析结果可视化**
- **分析历史管理**
- **候选点显示和评分**

### 2. 测试题生成系统

- **基于棋谱自动生成测试题**
- **多种题型支持**
- **批量题目生成**
- **题目质量评估**

### 3. 答题系统

- **交互式答题界面**
- **实时反馈**
- **成绩统计**
- **进度跟踪**

### 4. 用户系统

- **用户注册和登录**
- **个人资料管理**
- **学习进度跟踪**

### 5. 论坛系统

- **帖子发布和管理**
- **用户交流**
- **内容分类**

### 6. 比赛系统

- **比赛创建和管理**
- **参赛者管理**
- **赛程安排**

## API 接口规范

### 后端服务 API

#### 基础配置

```javascript
// API Base URLs
const CONFIG = {
  // 本地开发环境
  local: {
    API_BASE_URL: "http://localhost:3000/api",
    API_VERCEL_NEXTJS_BASE_URL: "http://localhost:3000",
  },
  // GitHub Pages 环境
  github: {
    API_BASE_URL: "https://blackricegobackend2-nextjs.vercel.app/api",
    API_VERCEL_NEXTJS_BASE_URL: "https://blackricegobackend2-nextjs.vercel.app",
  },
  // 生产环境
  production: {
    API_BASE_URL: "https://blackricegobackend2-nextjs.vercel.app/api",
    API_VERCEL_NEXTJS_BASE_URL: "https://blackricegobackend2-nextjs.vercel.app",
  },
};
```

#### 1. 棋谱管理 API

##### 保存棋谱

```http
POST /api/save-qipu
Content-Type: application/json

{
  "sgfContent": "string",     // SGF文件内容
  "fileName": "string",      // 文件名
  "gameInfo": {
    "blackPlayer": "string",  // 黑方棋手
    "whitePlayer": "string",  // 白方棋手
    "result": "string",       // 比赛结果
    "date": "string",         // 比赛日期
    "event": "string"         // 比赛名称
  },
  "analysisData": "object"    // 分析数据（可选）
}
```

**响应**:

```json
{
  "success": true,
  "message": "棋谱保存成功",
  "data": {
    "id": "string",
    "sgfHash": "string"
  }
}
```

##### 获取已分析棋谱列表

```http
GET /api/analyzed-games
```

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "fileName": "string",
      "blackPlayer": "string",
      "whitePlayer": "string",
      "result": "string",
      "analysisTime": "string",
      "sgfHash": "string"
    }
  ]
}
```

#### 2. 分析结果 API

##### 保存分析结果

```http
POST /api/saveAnalysis
Content-Type: application/json

{
  "sgfHash": "string",       // SGF哈希值
  "analysisData": {
    "moves": "array",         // 着法分析
    "evaluations": "array",  // 局面评估
    "variations": "array",   // 变化图
    "comments": "array"      // 评论
  },
  "metadata": {
    "engine": "string",       // 分析引擎
    "version": "string",      // 引擎版本
    "analysisTime": "number", // 分析时间
    "depth": "number"         // 分析深度
  }
}
```

#### 3. 测试题目 API

##### 批量创建测试题

```http
POST /api/testQuestions
Content-Type: application/json

{
  "questions": [
    {
      "id": "string",           // 题目ID
      "sgfHash": "string",      // 关联的SGF哈希
      "moveNumber": "number",   // 题目对应的手数
      "boardState": "string",   // 棋盘状态
      "candidatePoints": [
        {
          "point": "string",     // 候选点坐标
          "score": "number",     // AI评分
          "winRate": "number",   // 胜率
          "visits": "number"     // 访问次数
        }
      ],
      "correctAnswer": "string", // 正确答案
      "difficulty": "string",   // 难度等级
      "category": "string",     // 题目分类
      "explanation": "string"   // 解题说明
    }
  ]
}
```

##### 获取测试题目列表

```http
GET /api/testQuestions?page=1&limit=20&difficulty=medium&category=endgame
```

**查询参数**:

- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 20）
- `difficulty`: 难度筛选（easy/medium/hard）
- `verificationStatus`: 验证状态筛选（pending/verified/failed）
- `category`: 分类筛选
- `sort`: 排序方式（createdAt/-createdAt）

##### 批量更新测试题

```http
PATCH /api/testQuestions
Content-Type: application/json

{
  "updates": [
    {
      "id": "string",
      "candidatePoints": "array",
      "winRate": "number",
      "correctAnswer": "string",
      "verificationStatus": "verified"
    }
  ]
}
```

##### 获取单个测试题

```http
GET /api/testQuestions/:id
```

##### 删除测试题

```http
DELETE /api/testQuestions/:sgfHash
```

##### 获取测试题统计

```http
GET /api/testQuestions/stats
```

#### 4. 用户认证 API

##### 用户注册

```http
POST /api/register
Content-Type: application/json

{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

##### 用户登录

```http
POST /api/login
Content-Type: application/json

{
  "email": "string",
  "password": "string"
}
```

### KataGo 分析服务 API

#### 基础配置

```javascript
const KATAGO_CONFIG = {
  // 本地KataGo服务
  local: {
    KATAGO_BASE_URL: "http://localhost:2718",
    KATAGO_BOT_NAME: "katago",
  },
  // 云端代理服务
  cloud: {
    KATAGO_PROXY_URL:
      "https://blackricegobackend2-nextjs.vercel.app/api/katago-proxy",
    KATAGO_BOT_NAME: "katago_gtp_bot",
  },
};
```

#### 1. 局面分析 API

##### 分析当前局面

```http
POST /analyze
Content-Type: application/json

{
  "id": "analysis-request-1",
  "moves": [
    ["B", "pd"],  // [颜色, 坐标]
    ["W", "dp"],
    ["B", "pp"]
  ],
  "rules": "chinese",
  "komi": 7.5,
  "boardXSize": 19,
  "boardYSize": 19,
  "analyzeTurns": [3],  // 要分析的回合
  "maxVisits": 1000,    // 最大访问次数
  "includeOwnership": true,
  "includeMovesOwnership": true,
  "includePVVisits": true
}
```

**响应**:

```json
{
  "id": "analysis-request-1",
  "turnNumber": 3,
  "moveInfos": [
    {
      "move": "Q16",
      "visits": 800,
      "winrate": 0.52,
      "scoreMean": 1.2,
      "scoreStdev": 12.5,
      "pv": ["Q16", "D4", "Q4"],
      "order": 0
    }
  ],
  "ownership": [0.1, -0.2, 0.8, ...],  // 每个交叉点的归属概率
  "policy": [0.15, 0.08, 0.12, ...]    // 策略网络输出
}
```

#### 2. 最佳着法推荐 API

##### 获取推荐着法

```http
POST /select-move/katago_gtp_bot
Content-Type: application/json

{
  "moves": [
    ["B", "pd"],
    ["W", "dp"]
  ],
  "rules": "chinese",
  "komi": 7.5,
  "boardXSize": 19,
  "boardYSize": 19
}
```

**响应**:

```json
{
  "move": "Q4",
  "confidence": 0.85,
  "analysis": {
    "visits": 1000,
    "winrate": 0.51,
    "scoreMean": 0.8
  }
}
```

## 数据库设计

### MongoDB 集合结构

#### 1. sgfFiles 集合

```javascript
{
  _id: ObjectId,
  sgfHash: String,      // SGF内容哈希
  fileName: String,     // 文件名
  sgfContent: String,   // SGF内容
  gameInfo: {
    blackPlayer: String,
    whitePlayer: String,
    result: String,
    date: String,
    event: String
  },
  uploadTime: Date,
  analysisStatus: String // 'pending', 'analyzing', 'completed', 'failed'
}
```

#### 2. analysisResults 集合

```javascript
{
  _id: ObjectId,
  sgfHash: String,      // 关联的SGF哈希
  analysisData: Object, // 分析结果数据
  metadata: {
    engine: String,
    version: String,
    analysisTime: Number,
    depth: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### 3. testQuestions 集合

```javascript
{
  _id: ObjectId,
  id: String,           // 题目唯一ID
  sgfHash: String,      // 关联的SGF哈希
  moveNumber: Number,   // 题目对应的手数
  boardState: String,   // 棋盘状态
  candidatePoints: [{
    point: String,
    score: Number,
    winRate: Number,
    visits: Number
  }],
  correctAnswer: String,
  difficulty: String,   // 'easy', 'medium', 'hard'
  category: String,     // 题目分类
  explanation: String,  // 解题说明
  verificationStatus: { 
    type: String, 
    enum: ['pending', 'verified', 'failed'], 
    default: 'verified' 
  },
  verifiedAt: Date,     // AI 验证完成时间
  createdAt: Date,
  updatedAt: Date
}
```

#### 4. users 集合

```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  passwordHash: String,
  profile: {
    rank: String,
    country: String,
    joinDate: Date
  },
  stats: {
    gamesPlayed: Number,
    questionsAnswered: Number,
    correctRate: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

## 配置管理

### 环境配置

项目支持三种部署环境：

1. **本地开发环境 (local)**

   - API 服务: `http://localhost:3000/api`
   - KataGo 服务: `http://localhost:2718`

2. **GitHub Pages 环境 (github)**

   - API 服务: `https://blackricegobackend2-nextjs.vercel.app/api`
   - KataGo 代理: Vercel 代理服务

3. **生产环境 (production)**
   - API 服务: `https://blackricegobackend2-nextjs.vercel.app/api`
   - KataGo 代理: Vercel 代理服务

### KataGo 引擎配置

```javascript
const KATAGO_ENGINES = {
  local: {
    name: "Local KataGo",
    baseUrl: "http://localhost:2718",
    botName: "katago",
    maxVisits: 1000,
    analysisDepth: "medium",
  },
  cloud: {
    name: "Cloud KataGo",
    proxyUrl: "https://blackricegobackend2-nextjs.vercel.app/api/katago-proxy",
    botName: "katago_gtp_bot",
    maxVisits: 800,
    analysisDepth: "fast",
  },
};
```

## 技术特性

### 1. 数据同步策略

- **双重存储**: IndexedDB（本地） + MongoDB（远程）
- **离线支持**: 本地数据缓存，支持离线分析
- **自动同步**: 网络恢复时自动同步本地数据到服务器

### 2. 性能优化

- **懒加载**: 按需加载棋谱和分析数据
- **分页查询**: 大数据集分页处理
- **缓存策略**: 智能缓存常用数据
- **压缩传输**: API 响应数据压缩

### 3. 错误处理

- **重试机制**: 网络请求失败自动重试
- **降级策略**: 服务不可用时的备用方案
- **用户友好**: 清晰的错误提示和处理建议

### 4. 安全特性

- **输入验证**: 严格的数据验证和清理
- **SQL 注入防护**: 参数化查询
- **XSS 防护**: 输出内容转义
- **CORS 配置**: 跨域请求安全控制

## 部署信息

### 前端部署

- **平台**: GitHub Pages
- **域名**: 自定义域名支持
- **CDN**: GitHub CDN 加速

### 后端部署

- **平台**: Vercel
- **数据库**: MongoDB Atlas
- **域名**: `blackricegobackend2-nextjs.vercel.app`

### KataGo 服务

- **本地部署**: Docker 容器或直接安装
- **云端部署**: Vercel Serverless Functions 代理

## 开发指南

### 1. 本地开发环境搭建

```bash
# 克隆项目
git clone <repository-url>
cd tigergo

# 启动本地服务器
python -m http.server 8000
# 或使用 Node.js
npx serve .

# 启动KataGo服务（可选）
katago analysis -config analysis.cfg -model model.bin.gz
```

### 2. 配置文件修改

编辑 `js/config.js` 文件，根据部署环境调整配置：

```javascript
// 修改当前环境
const CURRENT_ENV = "local"; // 'local', 'github', 'production'
```

### 3. API 测试

使用提供的测试文件：

- `test-save-analysis.html`: 测试分析结果保存 API
- `python/TestOver_network.py`: 测试 KataGo 网络 API

### 4. 代码结构说明

## 未来规划

### 1. 功能扩展

- [ ] 实时对弈功能
- [ ] 多人在线分析
- [ ] 高级统计分析
- [ ] 移动端适配

### 2. 性能优化

- [ ] WebAssembly 集成
- [ ] 服务端渲染(SSR)
- [ ] 更智能的缓存策略
- [ ] 数据库查询优化

### 3. 用户体验

- [ ] 多语言支持
- [ ] 主题定制
- [ ] 快捷键支持
- [ ] 无障碍访问优化

### 4. 技术升级

- [ ] 迁移到现代前端框架
- [ ] 微服务架构
- [ ] 容器化部署
- [ ] CI/CD 流水线

---

**文档版本**: v1.1  
**最后更新**: 2026 年 2 月  
**维护者**: TigerGo 开发团队
