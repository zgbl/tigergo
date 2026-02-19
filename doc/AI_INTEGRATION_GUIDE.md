# TigerGo AI 逻辑协调手册 (AI Integration Guide)

本手册旨在解释背景分析提示 (Circles) 与 题目编辑器手动验证 (ABCD) 之间的协调逻辑、坐标转换以及步数对齐机制。

## 1. 核心文件与职责

- **js/CandidatePointsDisplay.js**: 
  负责从数据库 (IndexedDB) 加载已有的分析结果，并在棋盘上绘制圆圈标志和胜率。
- **js/ProblemEditor.js**: 
  负责手动“AI验证”、构造分析排行列表、以及处理用户点击列表后的跳转逻辑。
- **js/BoardController.js**: 
  棋盘底层引擎，维护 `currentMoveIndex` (当前步数索引)。

---

## 2. 关键参数与索引对齐

### `currentMoveIndex` (步数索引)
- **定义**: `BoardController` 中的核心状态。
- **逻辑**:
  - `-1`: 棋盘上没有棋子 (初始局面)。
  - `0`: 棋盘上只有第 1 手棋。
  - `N`: 棋盘上共有 `N+1` 手棋。

### `moveNumber` (数据库步数)
- **来源**: KataGo 分析结果存入数据库时的标识。
- **对齐关系**: 
  - 记录 `moveNumber: N` 的分析数据中，包含的是在**完成第 N 手棋后**的局面评估。
  - 因此，该记录中的 `variations` (候选点) 实际上是针对 **下一手 (第 N+1 手)** 的建议。

### 核心对齐公式 (in CandidatePointsDisplay.js):
如果你想看“当前局面”下 AI 推荐哪儿，你需要找：
`targetMoveNumber = currentMoveIndex + 1`
> **例子**:
> - 棋盘只有 1 个子 (`currentMoveIndex = 0`)。
> - 你想要第 2 手的建议。
> - 查询数据库中 `moveNumber = 1` 的记录。

---

## 3. 坐标转换逻辑 (Coordinate Systems)

系统中存在三种坐标表示法，若转换不一致会导致“挂羊头卖肉”：

1. **KataGo 格式 (Q16)**:
   - 列：A-T (跳过 I)。A=1, B=2... H=8, J=9...
   - 行：1-19 (底部为 1，顶部为 19)。
2. **数组索引格式 (row: 0, col: 0)**:
   - 这是 DOM `data-row` 和 `data-col` 使用的格式。
   - `row`: 0 (顶部) 到 18 (底部)。
   - `col`: 0 (左侧A) 到 18 (右侧T)。
3. **SGF 格式 (pd)**:
   - 小写字母，a=0, b=1... s=18。

### 转换函数位置:
- `js/ProblemEditor.js` 中的 `kataGoToRowCol(coord)` 和 `rowColToKataGo(row, col)`。
- `js/CandidatePointsDisplay.js` 中的 `parseSGFPosition(sgfPos)`。
- **注意**: 若发现 ABCD 点位偏移，请检查其对 `I` 字母的 `charCodeAt` 偏移量是否统一。

---

## 4. 胜率视角 (Perspective)

- **统一规则**: 为了避免混淆，目前所有组件默认强制显示**黑棋胜率**。
- **代码位置**: `js/CandidatePointsDisplay.js` 中的 `displayCandidatePoints` 循环内。
- **逻辑**: 如果底层数据给的是落子方胜率，且当前是白棋回合，则需执行 `100 - winrate`。

---

## 5. 交互跳转流程

1. 用户点击“失误排行”中的某一项 (Move Index M)。
2. `ProblemEditor.onLossItemClick(M)` 被调用。
3. 执行 `boardController.goToMove(M - 2)`。
   - 目的：回到失误发生**前**的局面。如果想修复第 61 手，棋盘必须停在只有 60 手的状态。
4. `BoardController` 内部设置 `currentMoveIndex = M - 2`。
5. 触发 `updateMoveInfo()` -> 触发 `displayCandidatePoints(M - 2)`。
6. 背景提示加载 `moveNumber = (M - 2) + 1 = M - 1` 的分析记录。

---

## 6. 自行调试建议

如果你发现圆圈和 ABCD 依然错位：
1. **控制台输出**: 在 `displayCandidatePoints` 顶部添加 `console.log("Current board shows move:", currentMoveIndex + 1)`。
2. **比较**: 查看 AI 验证时的 `baseMoves.length`。这两者应该保持一致。
3. **坐标校对**: 在绘制圆圈的代码处打印 `intersection.dataset.row` 和 `intersection.dataset.col`，确保它们与你要的点位一致。
