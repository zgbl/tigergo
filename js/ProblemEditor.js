/**
 * ProblemEditor.js
 * 负责题目制作页面的逻辑控制
 */

class ProblemEditor {
    constructor() {
        this.analysisStorage = new AnalysisStorage();
        this.boardController = null; // Will init later
        this.kataGoAPI = null; // KataGo API instance
        this.gameId = null;
        this.gameData = null;
        this.rawMoves = []; // Raw moves in KataGo format ["B", "Q16"]
        this.analysisResults = [];
        this.candidates = []; // Current problem candidates
        this.editMode = 'view'; // 'view' or 'edit'
        this.lossRanking = [];
        this.lossFilter = 'all'; // 'all', 'black', 'white'
        this.isVerifying = false; // AI verification in progress

        this.init();
    }

    async init() {
        console.log('ProblemEditor Initializing...');

        // 1. 获取 URL 参数中的 gameId
        const urlParams = new URLSearchParams(window.location.search);
        this.gameId = urlParams.get('gameId');

        // 2. 初始化数据库
        await this.analysisStorage.initDB();

        if (!this.gameId) {
            this.showGameSelector();
            return;
        }

        // 3. 加载棋谱数据
        await this.loadGameData();

        // 4. 初始化棋盘控制器
        // Mock AnalysisDisplay for BoardController compatibility
        const mockDisplay = { addLogEntry: console.log };
        this.boardController = new BoardController(mockDisplay, this.analysisStorage);

        // Critical: Set SGF Hash for CandidatePointsDisplay
        if (this.gameId && this.boardController.candidatePointsDisplay) {
            console.log("Setting SGF Hash for CandidatePointsDisplay:", this.gameId);
            this.boardController.candidatePointsDisplay.setSGFHash(this.gameId);
        }

        // Setup control button event listeners
        console.log("🎮 Setting up control button listeners");
        this.boardController.setupEventListeners();

        // 🔥 关键：劫持 BoardController.goToMove，确保手动导航时也清理候选点
        const originalGoToMove = this.boardController.goToMove.bind(this.boardController);
        this.boardController.goToMove = (index) => {
            this.clearCandidates();
            originalGoToMove(index);
        };

        // 🔥 初始化 KataGo API（使用 Custom Server, 即 192.168.0.162:8080）
        const engineUrl = CONFIG.KATAGO_ENGINES.custom.url || CONFIG.KATAGO_ENGINES.local.url;
        console.log(`🤖 初始化 KataGoAPI, 引擎地址: ${engineUrl}`);
        this.kataGoAPI = new KataGoAPI(engineUrl);

        // Setup controls
        // Note: boardController.setupEventListeners might look for specific IDs.
        // But since we are manually controlling layout, let's bind manually or rely on BoardController if IDs match.
        // BoardController.js binds: logostartBtn, logofastBackwardBtn, logobackwardBtn, etc.
        // valid IDs: logostartBtn, logofastBackwardBtn, logobackwardBtn, logoforwardBtn, logofastForwardBtn, logoendBtn

        // 5. 绑定事件 (提前绑定，防止 initBoard 出错导致按钮失效)
        this.bindEvents();

        // 6. 渲染棋盘
        this.initBoard();

        // 7. 绑定 Resize
        this.bindResize();
    }

    async showGameSelector() {
        console.log('No game ID provided, showing selector.');
        const modal = document.getElementById('gameSelectorModal');
        modal.style.display = 'flex';

        // Init table script
        const table = new AnalyzedGamesTable();
        await table.init(this.analysisStorage);

        // Override global load function for the table interactions
        window.loadSGFGame = (content, filename, id) => {
            // Simply reload page with ID
            window.location.href = `ProblemEditor.html?gameId=${id}`;
        };
    }

    bindResize() {
        let timeout;
        window.addEventListener('resize', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (this.gameId) this.initBoard();
            }, 200);
        });
    }

    async loadGameData() {
        try {
            const data = await this.analysisStorage.getAnalysisResult(this.gameId);
            if (!data) {
                alert('未找到该棋谱的分析数据');
                return;
            }

            console.log('Loaded game data:', data);

            // Parse SGF
            const parser = new SGFParser();
            const rawMoves = parser.parseSGFMoves(data.sgf.content);
            console.log('Parsed raw moves count:', rawMoves ? rawMoves.length : 0);

            this.gameData = {
                sgfContent: data.sgf.content,
                moves: rawMoves,
                gameInfo: data.sgf.gameInfo || {}
            };

            // 🔥 保存原始 KataGo 格式的着法（用于 AI 验证）
            this.rawMoves = rawMoves.slice();

            // Conversion to Board12 format
            const convertedMoves = this.convertMoves(this.gameData.moves);
            console.log('Converted moves count:', convertedMoves ? convertedMoves.length : 0);
            this.gameData.moves = convertedMoves;

            // Update UI Info
            document.getElementById('gameInfoDisplay').innerHTML = `
                <strong>${this.gameData.gameInfo.black || 'Unknown'} (B) vs ${this.gameData.gameInfo.white || 'Unknown'} (W)</strong><br>
                Result: ${this.gameData.gameInfo.result || '?'}<br>
                Date: ${this.gameData.gameInfo.date || '-'}
            `;

            // Store analysis results for search
            this.analysisResults = data.analysisResults || [];
            console.log(`Loaded ${this.analysisResults.length} analysis records`);

            // 🔥 构建胜率损失排行
            this.buildWinrateLossRanking();

        } catch (e) {
            console.error('Error loading game:', e);
            alert('加载失败: ' + e.message);
        }
    }

    initBoard() {
        console.log('🎯 ProblemEditor.initBoard() 开始');
        if (!this.gameData || !this.gameData.moves) {
            console.error('❌ initBoard: 没有棋谱数据');
            return;
        }

        // 1. 设置基本的全局变量给 GoBoard12.js
        window.currentMoves = this.gameData.moves;
        window.currentMoveIndex = -1;
        window.displayMode = 0;

        // 2. 使用 BoardController 来统一管理渲染逻辑
        console.log('  - 调用 BoardController.setGameData, moves count:', this.gameData.moves.length);
        this.boardController.setGameData(this.gameData);

        // 3. 导航到第一手棋
        console.log('  - 导航到索引为 0 的第一手棋');
        this.boardController.goToMove(0);

        // 4. 为编辑模式绑定点击事件 (使用事件委托或先清理)
        const boardEl = document.getElementById('board');
        // 先移除旧的监听器（如果有的话，但 innerHTML='' 已经帮我们清了）
        // 我们直接给 board 绑定一个委托监听器
        if (this._boardClickHandler) {
            boardEl.removeEventListener('click', this._boardClickHandler);
        }
        this._boardClickHandler = (e) => {
            const intersection = e.target.closest('.intersection');
            if (intersection) {
                this.handleBoardClick({ target: intersection });
            }
        };
        boardEl.addEventListener('click', this._boardClickHandler);

        console.log('🎯 ProblemEditor.initBoard() 完成');
    }

    bindEvents() {

        document.getElementById('modeView').addEventListener('click', () => this.setMode('view'));
        document.getElementById('modeEdit').addEventListener('click', () => this.setMode('edit'));

        document.getElementById('saveProblemBtn').addEventListener('click', () => this.saveProblem());

        document.getElementById('switchGameBtn').addEventListener('click', () => this.showGameSelector());

        // 🔥 AI 验证按钮
        const analyzeBtn = document.getElementById('analyzeCandidatesBtn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.aiVerifyCandidates());
        }

        // 🔥 寻找下一个失误点
        const findNextBtn = document.getElementById('findNextBtn');
        if (findNextBtn) {
            findNextBtn.addEventListener('click', () => this.findNextMistake());
        }

        // 🔥 排行榜筛选按钮
        const fAll = document.getElementById('filterAll');
        const fB = document.getElementById('filterBlack');
        const fW = document.getElementById('filterWhite');

        if (fAll) fAll.addEventListener('click', () => this.setLossFilter('all'));
        if (fB) fB.addEventListener('click', () => this.setLossFilter('black'));
        if (fW) fW.addEventListener('click', () => this.setLossFilter('white'));
    }

    setMode(mode) {
        this.editMode = mode;
        document.getElementById('modeView').classList.toggle('active', mode === 'view');
        document.getElementById('modeEdit').classList.toggle('active', mode === 'edit');
    }

    handleBoardClick(e) {
        const row = parseInt(e.target.dataset.row);
        const col = parseInt(e.target.dataset.col);

        if (this.editMode === 'edit') {
            console.log(`Adding candidate at ${row}, ${col}`);
            this.addCandidate(row, col);
        } else {
            // View mode: maybe just log or highlight
            // Or let BoardController handle navigation if we implemented click-to-nav
        }
    }

    findNextMistake() {
        const threshold = parseFloat(document.getElementById('minWinrateLoss').value) / 100;
        const currentIdx = this.boardController.currentMoveIndex;

        console.log(`Searching for mistake > ${threshold * 100}% starting from move ${currentIdx}`);

        if (!this.lossRanking || this.lossRanking.length === 0) {
            alert('没有可用的分析数据');
            return;
        }

        // 从当前手数之后，按手数顺序找下一个超过阈值的失误
        const nextMistake = this.lossRanking.find(item =>
            item.moveIndex > currentIdx && item.lossPercent >= threshold * 100
        );

        if (nextMistake) {
            this.onLossItemClick(nextMistake.moveIndex);
        } else {
            alert('后续没有找到更大的失误点');
        }
    }

    /**
     * 构建胜率损失排行列表
     * 计算每步棋的胜率损失，按损失从大到小排列前20
     */
    buildWinrateLossRanking() {
        const listEl = document.getElementById('winrateLossList');
        if (!listEl) return;

        if (!this.analysisResults || this.analysisResults.length < 2) {
            listEl.innerHTML = '<li class="loss-empty">分析数据不足（需要至少2步棋的分析）</li>';
            return;
        }

        console.log(`📊 开始计算胜率损失排行... (总记录数: ${this.analysisResults.length})`);

        // 1. 计算所有步数的损失 (黑白一起)
        const allLosses = [];

        for (let i = 1; i < this.analysisResults.length; i++) {
            const prev = this.analysisResults[i - 1];
            const curr = this.analysisResults[i];

            if (!prev || !curr) continue;

            const prevWinRate = this.extractWinRate(prev);
            const currWinRate = this.extractWinRate(curr);

            if (prevWinRate === null || currWinRate === null) continue;

            const moveInfo = this.getMoveInfo(curr);
            const moveIndex = curr.moveNumber !== undefined ? curr.moveNumber : i;

            // 🔥 统一损失公式 (适用 Side-to-Move 格式):
            // 损失 = 落子方落子前胜率 - (100 - 落子后对方胜率)
            // = prevWinRate + currWinRate - 100
            const loss = parseFloat((prevWinRate + currWinRate - 100).toFixed(1));

            // 无论黑白，只要有损失就记录
            if (loss > 0.1) {
                allLosses.push({
                    moveIndex: moveIndex,
                    color: moveInfo.color,
                    coord: moveInfo.coord,
                    lossPercent: loss,
                    prevWinRate: prevWinRate,
                    currWinRate: currWinRate,
                    scoreLoss: this.extractScoreLoss(prev, curr, moveInfo.color)
                });
            }
        }

        // 保存原始数据供筛选
        this.lossRanking = allLosses;

        // 2. 应用筛选
        let filteredLosses = [...allLosses];
        if (this.lossFilter === 'black') {
            filteredLosses = filteredLosses.filter(l => l.color === 'B');
        } else if (this.lossFilter === 'white') {
            filteredLosses = filteredLosses.filter(l => l.color === 'W');
        }

        // 3. 按损失排序 (从大到小)
        filteredLosses.sort((a, b) => b.lossPercent - a.lossPercent);

        // 4. 渲染前 20 名 (确保显示 20 个局面)
        const topN = filteredLosses.slice(0, 20);
        console.log(`✅ 筛选后共 ${filteredLosses.length} 个失误点, 渲染前 ${topN.length} 个`);

        if (topN.length === 0) {
            listEl.innerHTML = `<li class="loss-empty">在此筛选条件下没有找到明显的胜率损失</li>`;
            return;
        }

        const maxLoss = topN[0].lossPercent;

        listEl.innerHTML = topN.map((item, idx) => {
            const rankClass = idx < 3 ? 'top3' : idx < 10 ? 'top10' : 'normal';
            const severityClass = item.lossPercent >= 10 ? 'severe' :
                item.lossPercent >= 5 ? 'moderate' :
                    item.lossPercent >= 2 ? 'minor' : 'tiny';
            const barWidth = Math.max(10, (item.lossPercent / maxLoss) * 100);

            return `
                <li class="loss-item" data-move-index="${item.moveIndex}" onclick="editor.onLossItemClick(${item.moveIndex})">
                    <span class="loss-rank ${rankClass}">${idx + 1}</span>
                    <span class="loss-move-num">#${item.moveIndex}</span>
                    <span class="loss-color ${item.color === 'B' ? 'black' : 'white'}"></span>
                    <span class="loss-coord">${item.coord}</span>
                    <span class="loss-bar-container">
                        <span class="loss-bar ${severityClass}" style="width: ${barWidth}%"></span>
                    </span>
                    <span class="loss-value ${severityClass}">-${item.lossPercent}%</span>
                </li>
            `;
        }).join('');
    }

    /**
     * 设置损失排行筛选器
     */
    setLossFilter(filter) {
        this.lossFilter = filter;

        // 更新按钮状态
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = 'white';
            btn.style.color = '#333';
            btn.style.borderColor = '#ddd';
        });

        const activeBtnId = filter === 'all' ? 'filterAll' : filter === 'black' ? 'filterBlack' : 'filterWhite';
        const activeBtn = document.getElementById(activeBtnId);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.background = '#8e44ad';
            activeBtn.style.color = 'white';
            activeBtn.style.borderColor = '#8e44ad';
        }

        // 重新构建排行
        this.buildWinrateLossRanking();
    }

    /**
     * 从分析结果中提取黑棋视角的胜率
     */
    extractWinRate(record) {
        // record 可能是 { moveNumber, move, analysis: { winRate, ... } }
        // 或者直接是 { analysis: { winRate } }
        const analysis = record.analysis || record;

        // winRate 可能是 "36.5" (字符串) 或 36.5 (数字) 或 0.365 (比例)
        let wr = analysis.winRate;
        if (wr === undefined || wr === null) {
            wr = analysis.winrate;
        }
        if (wr === undefined || wr === null) return null;

        wr = parseFloat(wr);
        // 如果值 <= 1，认为是比例格式，转为百分比
        if (wr > 0 && wr <= 1) wr = wr * 100;

        return wr;
    }

    /**
     * 从分析记录中获取着法信息
     */
    getMoveInfo(record) {
        // 尝试从 move 字段获取
        const move = record.move || '';
        let color = record.color || null;
        let coord = '';

        if (Array.isArray(move)) {
            // ["B", "Q16"] 格式
            color = move[0];
            coord = move[1] || '';
        } else if (typeof move === 'string') {
            coord = move;
        }

        // 统一颜色格式为 'B' 或 'W'
        if (color) {
            const c = color.toString().toUpperCase()[0];
            color = (c === 'B' || c === 'W') ? c : null;
        }

        // 如果没有颜色信息，根据手数推断 (1-indexed: 第1手是黑, 第2手是白)
        if (!color && record.moveNumber !== undefined) {
            color = record.moveNumber % 2 === 1 ? 'B' : 'W';
        }

        // Fallback
        if (!color) color = 'B';

        return { color, coord };
    }

    /**
     * 计算目数损失
     */
    extractScoreLoss(prev, curr, color) {
        const prevScore = parseFloat((prev.analysis || prev).score || 0);
        const currScore = parseFloat((curr.analysis || curr).score || 0);
        if (color === 'B') {
            return parseFloat((prevScore - currScore).toFixed(1));
        } else {
            return parseFloat((currScore - prevScore).toFixed(1));
        }
    }

    /**
     * 清理候选点并重绘
     */
    clearCandidates() {
        this.candidates = [];
        this.renderCandidates();
        this.updateBoardOverlay();
    }

    /**
     * 点击损失排行项 → 跳转棋盘 + 标记上一手 + 显示轮次信息
     */
    onLossItemClick(moveIndex) {
        console.log(`🎯 跳转到第 ${moveIndex} 手 (失误点)`);

        // 🔥 跳转前清除旧的候选点
        this.clearCandidates();

        // 高亮当前选中项
        document.querySelectorAll('.loss-item').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.moveIndex) === moveIndex);
        });

        // 🔥 关键修正：跳转到失误发生前的局面
        // 如果 moveIndex 为 142，我们需要跳转到第 141 手执行后的局面 (boardIndex = 140)
        // 这样当前局面下，轮到的就是第 142 手的棋手
        const boardIndex = moveIndex - 2;
        if (this.boardController) {
            this.boardController.goToMove(boardIndex);
        }

        // 🔥 清除旧的三角标记
        document.querySelectorAll('.last-move-triangle').forEach(el => el.remove());

        // 🔥 在上一手的棋子上添加三角标记 (即第 moveIndex - 1 手)
        if (this.gameData && this.gameData.moves && boardIndex >= 0) {
            const lastMove = this.gameData.moves[boardIndex];
            if (lastMove && lastMove.row !== undefined && lastMove.col !== undefined) {
                const intersection = document.querySelector(
                    `[data-row="${lastMove.row}"][data-col="${lastMove.col}"]`
                );
                if (intersection) {
                    const triangle = document.createElement('div');
                    triangle.className = 'last-move-triangle';
                    const isBlack = lastMove.color === 'black';
                    const triColor = isBlack ? '#ffffff' : '#000000';
                    triangle.style.cssText = `
                        position: absolute;
                        top: 50%; left: 50%;
                        transform: translate(-50%, -50%);
                        width: 0; height: 0;
                        border-left: 7px solid transparent;
                        border-right: 7px solid transparent;
                        border-bottom: 12px solid ${triColor};
                        z-index: 15;
                        pointer-events: none;
                        filter: drop-shadow(0 0 1px rgba(0,0,0,0.3));
                    `;
                    intersection.appendChild(triangle);
                }
            }
        }

        // 🔥 显示局面信息面板
        const contextPanel = document.getElementById('moveContextPanel');
        const contextInfo = document.getElementById('moveContextInfo');
        if (contextPanel && contextInfo && this.gameData && this.gameData.moves) {
            const lastMove = boardIndex >= 0 ? this.gameData.moves[boardIndex] : null;
            const lastColor = lastMove ? lastMove.color : null;

            // 下一手颜色 (如果上一手是黑，则下一手是白；如果没有上一手，第1手是黑)
            const nextColorRaw = lastColor === 'black' ? 'white' : 'black';
            const nextColorText = nextColorRaw === 'white' ? '白' : '黑';
            const nextDotColor = nextColorRaw === 'white' ? '#fff' : '#000';
            const nextDotBorder = nextColorRaw === 'white' ? '2px solid #333' : '2px solid #999';

            const lastCoord = lastMove ? this.rowColToKataGo(lastMove.row, lastMove.col) : '无';
            const lastColorText = lastColor === 'black' ? '黑' : '白';
            const lastDotColor = lastColor === 'black' ? '#000' : '#fff';
            const lastDotBorder = lastColor === 'black' ? '2px solid #999' : '2px solid #333';

            contextInfo.innerHTML = `
                <div style="font-weight:bold; color:#e67e22; margin-bottom:10px;">
                    <i class="fas fa-exclamation-triangle"></i> 准备修复第 <strong>${moveIndex}</strong> 手的失误
                </div>
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:12px; color:#666;">
                    <span>📍 上一手 (第 ${boardIndex + 1} 手)：</span>
                    <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${lastDotColor}; border:${lastDotBorder};"></span>
                    <span><strong>${lastColorText}</strong>走 <strong>${lastCoord}</strong></span>
                </div>
                <div style="display:flex; align-items:center; gap:6px; background:#fff; padding:6px; border-radius:6px; border:1px dashed #ddd;">
                    <span>👉 现在轮到</span>
                    <span style="display:inline-block; width:16px; height:16px; border-radius:50%; background:${nextDotColor}; border:${nextDotBorder};"></span>
                    <strong style="font-size:15px; color:#8e44ad;">${nextColorText}棋</strong>
                    <span>下（请在此局面制作题目）</span>
                </div>
            `;
            contextPanel.style.display = 'block';
        }

        // 🔥 重新绘制候选点标记
        this.updateBoardOverlay();
    }

    addCandidate(row, col) {
        const labels = ['A', 'B', 'C', 'D', 'E'];
        if (this.candidates.length >= labels.length) return;

        const label = labels[this.candidates.length];
        this.candidates.push({ row, col, label });

        this.renderCandidates();
        this.updateBoardOverlay();
    }

    renderCandidates() {
        const list = document.getElementById('candidateList');

        // 🔥 预先计算哪个是最佳点 (正确答案)
        let bestLabel = null;
        if (this.candidates.length > 0) {
            const analyzed = this.candidates.filter(c => c.aiResult);
            if (analyzed.length > 0) {
                const best = analyzed.reduce((prev, curr) =>
                    (prev.aiResult.winRate > curr.aiResult.winRate) ? prev : curr
                );
                bestLabel = best.label;
            }
        }

        list.innerHTML = this.candidates.map(c => {
            let statsHtml = '<span style="color:#999">Stats: Pending</span>';
            let correctBadge = '';

            if (c.verifying) {
                statsHtml = '<span style="color:#8e44ad"><i class="fas fa-spinner fa-spin"></i> 分析中...</span>';
            } else if (c.aiResult) {
                const r = c.aiResult;
                const wrColor = r.lossPercent > 5 ? '#e74c3c' : r.lossPercent > 2 ? '#e67e22' : '#27ae60';
                statsHtml = `
                    <span style="color:${wrColor}; font-weight:bold;">
                        胜率: ${r.winRate}%
                    </span><br>
                    <span style="color:#555; font-size:11px;">
                        损失: <strong style="color:${wrColor}">-${r.lossPercent}%</strong>
                        &nbsp;|&nbsp; 目差: ${r.scoreDiff > 0 ? '+' : ''}${r.scoreDiff}
                    </span>
                `;

                if (c.label === bestLabel) {
                    correctBadge = '<span style="background:#27ae60; color:white; padding:1px 6px; border-radius:10px; font-size:10px; margin-left:8px;"><i class="fas fa-check"></i> 正确答案</span>';
                }
            }

            return `
                <li class="candidate-item" id="candidate-${c.label}">
                    <span class="candidate-label">${c.label}</span>
                    <span class="candidate-info">
                        (${c.row}, ${c.col}) ${correctBadge}<br>
                        ${statsHtml}
                    </span>
                    <div class="candidate-actions">
                        <button class="action-btn delete-btn" onclick="editor.removeCandidate('${c.label}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </li>
            `;
        }).join('');
    }

    removeCandidate(label) {
        this.candidates = this.candidates.filter(c => c.label !== label);
        this.renderCandidates();
        this.updateBoardOverlay();
    }

    updateBoardOverlay() {
        // Clear existing custom candidates
        document.querySelectorAll('.manual-candidate').forEach(el => el.remove());

        const board = document.getElementById('board');
        this.candidates.forEach(c => {
            const intersection = document.querySelector(`[data-row="${c.row}"][data-col="${c.col}"]`);
            if (intersection) {
                const dot = document.createElement('div');
                dot.className = 'manual-candidate';
                dot.innerText = c.label;
                dot.style.cssText = `
                    position: absolute;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    width: 20px; height: 20px;
                    background: #3498db; color: white;
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 12px; font-weight: bold;
                    z-index: 10; pointer-events: none;
                 `;
                intersection.appendChild(dot);
            }
        });
    }

    /**
     * 获取当前手数的棋盘状态快照 (19x19 二维数组)
     */
    getBoardStateAtCurrentMove() {
        const boardIndex = this.boardController.currentMoveIndex;
        const board = Array(19).fill(null).map(() => Array(19).fill(null));

        // 如果没有着法数据，直接返回空棋盘
        if (!this.gameData || !this.gameData.moves) return board;

        // 重放到当前手数
        for (let i = 0; i <= boardIndex && i < this.gameData.moves.length; i++) {
            const move = this.gameData.moves[i];
            if (!move.pass && move.row !== undefined && move.col !== undefined) {
                // 🔥 修复：后端要求值为 null, "black" 或 "white"
                board[move.row][move.col] = move.color === 'black' ? 'black' : 'white';
            }
        }
        return board;
    }

    /**
     * 保存题目到数据库
     */
    async saveProblem() {
        if (this.candidates.length < 2) {
            alert('请至少选择 2 个候选点（一个最佳点，几个干扰点）');
            return;
        }

        // 检查是否所有候选点都有 AI 结果
        const missingAI = this.candidates.find(c => !c.aiResult);
        if (missingAI) {
            if (!confirm('部分候选点缺少 AI 验证数据，是否仍要保存？')) {
                return;
            }
        }

        const saveBtn = document.getElementById('saveProblemBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        }

        try {
            const currentMoveIndex = this.boardController.currentMoveIndex;
            const moveNumber = currentMoveIndex + 1;
            const boardState = this.getBoardStateAtCurrentMove();

            // 确定下一手颜色 (与 aiVerifyCandidates 逻辑一致)
            const nextColor = (currentMoveIndex + 1) % 2 === 0 ? 'B' : 'W';

            // 准备候选点数据，适配后端结构
            const formattedCandidates = this.candidates.map(c => {
                const r = c.aiResult || {};
                return {
                    label: c.label,
                    row: c.row,
                    col: c.col,
                    position: c.aiResult?.coord || this.rowColToKataGo(c.row, c.col),
                    winRate: r.winRate || 0,
                    score: r.score || 0,
                    winRateLoss: r.lossPercent || 0,
                    scoreLoss: r.scoreDiff || 0,
                    type: (r.lossPercent !== undefined && r.lossPercent < 1.0) ? 'best' : 'alternate',
                    description: (r.lossPercent !== undefined && r.lossPercent < 1.0) ? '最佳选点' : '次优选点'
                };
            });

            // 自动寻找正确答案（损失最小的点）
            let bestCandidate = formattedCandidates.reduce((prev, curr) => {
                return (prev.winRateLoss < curr.winRateLoss) ? prev : curr;
            });

            const description = document.getElementById('questionText')?.value || `第${moveNumber}手，${nextColor === 'B' ? '黑' : '白'}方下一步最佳选择是？`;
            const difficulty = document.getElementById('difficultySelect')?.value || '3';

            // 构建最终 Payload
            // 🔥 修复：增加 id 和 sgfHash (question 内部也需要)
            const payload = {
                questions: [{
                    id: `${this.gameId}_${moveNumber}`,
                    sgfHash: this.gameId,
                    sgfFilename: this.gameData?.filename || 'manual_edit',
                    moveNumber: moveNumber,
                    boardState: boardState,
                    currentPlayer: nextColor === 'B' ? 'black' : 'white',
                    candidatePoints: formattedCandidates,
                    correctAnswer: {
                        label: bestCandidate.label,
                        position: bestCandidate.position,
                        winRate: bestCandidate.winRate,
                        explanation: `最佳选点，胜率: ${bestCandidate.winRate}%, 损失: ${bestCandidate.winRateLoss}%`
                    },
                    winRateLoss: bestCandidate.winRateLoss,
                    difficulty: difficulty === '1' ? 'easy' : difficulty === '5' ? 'hard' : 'medium',
                    questionText: description,
                    title: description,
                    source: this.gameData?.filename || '棋谱编辑器',
                    createdAt: new Date().toISOString()
                }],
                metadata: {
                    sgfHash: this.gameId,
                    sgfFilename: this.gameData?.filename,
                    totalQuestions: 1,
                    source: 'problem_editor'
                }
            };

            console.log('🚀 发送保存请求:', payload);

            const apiUrl = `${CONFIG.API_VERCEL_NEXTJS_BASE_URL}/api/testQuestions`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`保存失败: ${response.status} ${response.statusText}. ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ 保存成功:', result);
            alert('题目保存成功！');

            // 🔥 保存成功后清理候选点，准备下一题
            this.clearCandidates();

        } catch (error) {
            console.error('❌ 保存题目异常:', error);
            alert(`保存失败: ${error.message}`);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存题目';
            }
        }
    }

    /**
     * 棋盘坐标 (row, col) 转换为 KataGo 格式 (如 "Q16")
     * row: 0-18 (从上到下)
     * 将棋盘行/列 (0-18) 转换为 KataGo 坐标 (如 Q16)
     */
    rowColToKataGo(row, col) {
        if (row < 0 || col < 0) return 'pass';

        // 字母列: A-T (跳过 I)
        const colLetter = col >= 8 ? String.fromCharCode(65 + col + 1) : String.fromCharCode(65 + col);
        // 数字行: 19 - row
        const rowNum = 19 - row;

        return `${colLetter}${rowNum}`;
    }

    /**
     * 将 KataGo 坐标 (如 Q16) 转换为棋盘行/列 (0-18)
     */
    kataGoToRowCol(coord) {
        if (!coord || coord.toLowerCase() === 'pass') return { row: -1, col: -1 };

        const colLetter = coord[0].toUpperCase();
        const rowNum = parseInt(coord.substring(1));

        // A=0, B=1... H=7, J=8 (跳过 I)
        let col = colLetter.charCodeAt(0) - 65;
        if (col > 8) col--; // 减去跳过的 I

        const row = 19 - rowNum;

        return { row, col };
    }

    /**
     * AI 验证所有候选点
     * 顺序对每个候选点调用 KataGo 分析，显示胜率和目数
     */
    async aiVerifyCandidates() {
        if (this.isVerifying) {
            console.warn('⚠️ AI 验证正在进行中');
            return;
        }

        if (!this.kataGoAPI) {
            alert('KataGo API 未初始化');
            return;
        }

        const currentMoveIndex = this.boardController.currentMoveIndex;
        if (currentMoveIndex < 0) {
            alert('请先导航到出题局面');
            return;
        }

        this.isVerifying = true;
        const analyzeBtn = document.getElementById('analyzeCandidatesBtn');
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';
        }

        // 准备当前局面的着法序列（KataGo格式）
        const baseMoves = this.rawMoves.slice(0, currentMoveIndex + 1);
        const nextColor = (currentMoveIndex + 1) % 2 === 0 ? 'B' : 'W';

        // --- 模式 A: AI 发现模式 (0 选点时自动填充) ---
        if (this.candidates.length === 0) {
            console.log(`🚀 进入 AI 发现模式, 分析局面: 第 ${currentMoveIndex + 1} 手`);
            try {
                const result = await this.kataGoAPI.analyzePosition(
                    baseMoves, currentMoveIndex, null, 'deep'
                );

                if (result.success && result.data && result.data.analysis) {
                    const aiMoves = result.data.analysis.slice(0, 4); // 取前 4 个
                    const labels = ['A', 'B', 'C', 'D'];
                    const bestWinRate = aiMoves[0] ? aiMoves[0].winrate * 100 : 0;
                    const bestScore = aiMoves[0] ? (aiMoves[0].scoreLead || aiMoves[0].scoreMean || 0) : 0;

                    this.candidates = aiMoves.map((m, idx) => {
                        const { row, col } = this.kataGoToRowCol(m.move);
                        const wr = parseFloat((m.winrate * 100).toFixed(1));
                        const sc = parseFloat((m.scoreLead || m.scoreMean || 0).toFixed(1));

                        return {
                            label: labels[idx],
                            row, col,
                            aiResult: {
                                winRate: wr,
                                score: sc,
                                lossPercent: parseFloat(Math.abs(bestWinRate - wr).toFixed(1)),
                                scoreDiff: parseFloat((sc - bestScore).toFixed(1)),
                                coord: m.move
                            }
                        };
                    });

                    console.log(`✅ AI 发现 ${this.candidates.length} 个建议点`);
                } else {
                    alert('AI 分析未能返回建议点');
                }
            } catch (error) {
                console.error('AI 发现失败:', error);
                alert('AI 分析出现错误');
            } finally {
                this.isVerifying = false;
                if (analyzeBtn) {
                    analyzeBtn.disabled = false;
                    analyzeBtn.innerHTML = '<i class="fas fa-robot"></i> AI 验证';
                }
                this.renderCandidates();
                this.updateBoardOverlay();
            }
            return;
        }

        // --- 模式 B: 选点验证模式 (已有选点时逐个验证) ---
        console.log(`🤖 开始 AI 验证 ${this.candidates.length} 个候选点, 下一手: ${nextColor}`);

        // 🔥 先分析当前局面的 AI 最佳胜率作为基准 (如果尚未分析过)
        let baseWinRate = null;
        let baseScore = null;
        try {
            console.log('🔍 分析基准局面...');
            const baseResult = await this.kataGoAPI.analyzePosition(
                baseMoves, currentMoveIndex, null, 'deep'
            );
            if (baseResult.success) {
                const baseData = baseResult.data;
                baseWinRate = baseData.winrate !== undefined
                    ? parseFloat((baseData.winrate * 100).toFixed(1))
                    : (baseData.analysis && baseData.analysis[0])
                        ? parseFloat((baseData.analysis[0].winrate * 100).toFixed(1))
                        : null;
                baseScore = baseData.score !== undefined
                    ? parseFloat(parseFloat(baseData.score).toFixed(1))
                    : (baseData.analysis && baseData.analysis[0])
                        ? parseFloat((baseData.analysis[0].scoreLead || 0).toFixed(1))
                        : null;
                console.log(`📊 基准胜率: ${baseWinRate}%, 基准目数: ${baseScore}`);
            }
        } catch (e) {
            console.error('基准分析失败:', e);
        }

        // 🔥 逐个候选点分析
        for (let i = 0; i < this.candidates.length; i++) {
            const candidate = this.candidates[i];
            const kataGoCoord = this.rowColToKataGo(candidate.row, candidate.col);

            console.log(`\n🎯 [${candidate.label}] 分析候选点: (${candidate.row}, ${candidate.col}) → ${kataGoCoord}`);

            // 标记正在分析
            candidate.verifying = true;
            this.renderCandidates();
            this.updateBoardOverlay();

            try {
                // 构建着法序列：基础着法 + 候选着法
                const testMoves = [...baseMoves, [nextColor, kataGoCoord]];

                // 调用 KataGo 分析（用 deep 模式，约10-15秒）
                const result = await this.kataGoAPI.analyzePosition(
                    testMoves, testMoves.length - 1, null, 'deep'
                );

                candidate.verifying = false;

                if (result.success) {
                    const data = result.data;

                    // 提取胜率（黑棋视角）
                    let winRate = null;
                    if (data.winrate !== undefined) {
                        winRate = parseFloat((data.winrate * 100).toFixed(1));
                    } else if (data.analysis && data.analysis[0]) {
                        winRate = parseFloat((data.analysis[0].winrate * 100).toFixed(1));
                    }

                    // 提取目数
                    let score = null;
                    if (data.score !== undefined) {
                        score = parseFloat(parseFloat(data.score).toFixed(1));
                    } else if (data.analysis && data.analysis[0]) {
                        score = parseFloat((data.analysis[0].scoreLead || 0).toFixed(1));
                    }

                    // 计算损失（相对于基准）
                    let lossPercent = 0;
                    let scoreDiff = 0;

                    if (baseWinRate !== null && winRate !== null) {
                        if (nextColor === 'B') {
                            // 黑棋走的：基准胜率（黑棋视角）应 >= 走完后的胜率
                            lossPercent = parseFloat((baseWinRate - winRate).toFixed(1));
                        } else {
                            // 白棋走的：从白棋角度看损失
                            lossPercent = parseFloat((winRate - baseWinRate).toFixed(1));
                        }
                    }
                    if (baseScore !== null && score !== null) {
                        if (nextColor === 'B') {
                            scoreDiff = parseFloat((score - baseScore).toFixed(1));
                        } else {
                            scoreDiff = parseFloat((baseScore - score).toFixed(1));
                        }
                    }

                    candidate.aiResult = {
                        winRate: winRate,
                        score: score,
                        lossPercent: Math.max(0, lossPercent),
                        scoreDiff: scoreDiff,
                        coord: kataGoCoord
                    };

                    console.log(`✅ [${candidate.label}] 完成: 胜率=${winRate}%, 损失=-${lossPercent}%, 目差=${scoreDiff}`);
                } else {
                    candidate.aiResult = { error: result.error || '分析失败' };
                    console.error(`❌ [${candidate.label}] 分析失败:`, result.error);
                }

            } catch (error) {
                candidate.verifying = false;
                candidate.aiResult = { error: error.message };
                console.error(`❌ [${candidate.label}] 异常:`, error);
            }

            // 更新 UI
            this.renderCandidates();
            this.updateBoardOverlay();
        }

        // 完成
        this.isVerifying = false;
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-microchip"></i> AI 验证';
        }

        console.log('\n🎉 所有候选点验证完成！');
    }

    // Helper to convert SGF moves to GoBoard12 format (row, col)
    convertMoves(moves) {
        console.log('开始转换棋谱格式, 原始数量:', moves ? moves.length : 0);
        if (!Array.isArray(moves)) {
            console.warn('convertMoves received invalid input:', moves);
            return [];
        }

        const converted = moves.map((move, idx) => {
            if (!move) return null;

            // Handle array format [color, position] (from SGFParser.js)
            let color, position;
            if (Array.isArray(move)) {
                [color, position] = move;
            } else {
                // Handle object format { B: "pd" } etc (legacy/alternative)
                if (move.B) { color = 'B'; position = move.B; }
                else if (move.W) { color = 'W'; position = move.W; }
                else if (move.type === 'B') { color = 'B'; position = move.move; }
                else if (move.type === 'W') { color = 'W'; position = move.move; }
                else {
                    color = move.color;
                    position = move.pass ? 'pass' : (move.position || move.coord || move.move);
                }
            }

            if (!position) return null;

            // Correct color format
            const normalizedColor = (color && (color.toUpperCase() === 'B' || color.toLowerCase() === 'black')) ? 'black' : 'white';

            if (position === 'pass' || position === '') {
                return { pass: true, color: normalizedColor };
            }

            // If it's already row/col (rare here but for safety)
            if (typeof move.row === 'number' && typeof move.col === 'number') {
                return { ...move, color: normalizedColor };
            }

            // Check if it's KataGo format (e.g. "Q16") or SGF format (e.g. "pd")
            let rowIndex, colIndex;
            if (position.length >= 2 && /[A-T][0-9]+/.test(position.toUpperCase())) {
                // KataGo Format (A-T, 1-19)
                const pos = position.toUpperCase();
                const colLetter = pos[0];
                const rowStr = pos.slice(1);

                if (colLetter <= 'H') {
                    colIndex = colLetter.charCodeAt(0) - 65; // A-H -> 0-7
                } else {
                    colIndex = colLetter.charCodeAt(0) - 66; // J-T -> 8-18 (skip I)
                }
                rowIndex = 19 - parseInt(rowStr);
            } else if (position.length >= 2) {
                // SGF Format (a-s, a-s)
                colIndex = position.charCodeAt(0) - 97; // 'a' -> 0
                rowIndex = position.charCodeAt(1) - 97; // 'a' -> 0
            } else {
                return null;
            }

            if (idx < 5) {
                console.log(`  - 转换[${idx}]: ${color}[${position}] -> row:${rowIndex}, col:${colIndex}, color:${normalizedColor}`);
            }

            return { row: rowIndex, col: colIndex, color: normalizedColor };
        }).filter(m => m !== null);

        console.log('转换完成, 最终数量:', converted.length);
        return converted;
    }
}

// Global instance for inline onclick handlers
let editor;
document.addEventListener('DOMContentLoaded', () => {
    // Check if navbar script is loaded and call it
    if (typeof loadNavbar === 'function') {
        loadNavbar();
    }

    // Mock SGFAnalyzer for simple utility usage if needed, or ensure it's loaded in HTML
    editor = new ProblemEditor();
});
