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
        this.pendingQuestions = []; // 待验证题目列表
        this.winrateChart = null; // Chart.js instance

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

        // 🔥 关键：劫持 BoardController.updateMoveInfo，确保任何导航行为（前进、后退、跳转）都触发清理与同步
        const originalUpdateMoveInfo = this.boardController.updateMoveInfo.bind(this.boardController);
        this.boardController.updateMoveInfo = () => {
            // 1. 先调用原始逻辑更新文本和数据库候选点
            // 1. 先调用原始逻辑更新文本、数据库候选点以及上一手三角
            originalUpdateMoveInfo();

            // 2. 清理编辑器特有的候选点标记 (ABCD)
            this.clearCandidates();

            // 3. 渲染实战下一手提示
            this.renderActualNextMoveHint();

            // 4. 同步更新胜率图指示器
            const currentIndex = window.currentMoveIndex !== undefined ? window.currentMoveIndex : this.boardController.currentMoveIndex;
            // 胜率图索引 = 步数 (0对应开始, 1对应第一步)
            const moveNum = Math.max(0, currentIndex + 1);
            this.updateChartIndicator(moveNum);
        };

        // 🔥 初始化 KataGo API (使用中央配置的直连/代理和备用引擎)
        this.kataGoAPI = new KataGoAPI(null, 'katago_gtp_bot', true);
        console.log(`🤖 初始化 KataGoAPI, 模式: ${this.kataGoAPI.isProxyMode ? '代理' : '直连'}, 目标: ${this.kataGoAPI.targetUrl}`);

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

        // 8. 初始化可拖拽边栏
        this.initResizableSidebar();

        // 9. 初始化音量控制
        this.initVolumeControl();
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
                if (this.gameId) {
                    if (this.boardController) {
                        this.boardController.refreshBoard();
                    } else {
                        this.initBoard();
                    }
                }
            }, 200);
        });
    }


    // 🔊 初始化音量控制
    initVolumeControl() {
        console.log("🔊 Initializing Volume Control...");
        this.volumeIcon = document.getElementById('volumeIcon');
        this.volumePopup = document.getElementById('volumePopup');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');

        // 音频元素
        this.stoneSound = document.getElementById('stoneSound');
        this.correctSound = document.getElementById('correctSound');
        this.incorrectSound = document.getElementById('incorrectSound');

        if (!this.volumeIcon || !this.volumeSlider) {
            console.warn("🔊 Volume control elements not found");
            return;
        }

        // 1. 从 localStorage 加载音量 (与 SGFAnalysis 共用相同的 key: 'sgfVolume')
        const savedVolume = localStorage.getItem('sgfVolume') || 50;
        this.setVolume(parseInt(savedVolume));

        // 2. 绑定事件
        console.log("🔊 Binding Volume Icon click event...");
        this.volumeIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log("🔊 Volume Icon clicked! Current display:", this.volumePopup.style.display);
            const isVisible = window.getComputedStyle(this.volumePopup).display === 'block';
            this.volumePopup.style.display = isVisible ? 'none' : 'block';
            console.log("🔊 New display set to:", this.volumePopup.style.display);
        });

        this.volumeSlider.addEventListener('input', (e) => {
            console.log("🔊 Volume Slider input:", e.target.value);
            this.setVolume(e.target.value);
        });

        // 点击外部关闭弹窗
        document.addEventListener('click', (e) => {
            if (this.volumePopup && !this.volumePopup.contains(e.target) && e.target !== this.volumeIcon) {
                this.volumePopup.style.display = 'none';
            }
        });

        console.log("🔊 Volume Control initialized with volume:", savedVolume);
    }

    // 🔊 设置音量
    setVolume(pct) {
        const vol = pct / 100;

        // 这里的元素是在 ProblemEditor.html 中新增的
        if (!this.stoneSound) this.stoneSound = document.getElementById('stoneSound');
        if (!this.correctSound) this.correctSound = document.getElementById('correctSound');
        if (!this.incorrectSound) this.incorrectSound = document.getElementById('incorrectSound');

        if (this.stoneSound) this.stoneSound.volume = vol;
        if (this.correctSound) this.correctSound.volume = vol;
        if (this.incorrectSound) this.incorrectSound.volume = vol;

        if (this.volumeSlider) this.volumeSlider.value = pct;
        if (this.volumeValue) this.volumeValue.textContent = `${pct}%`;

        // 更新图标 (可选：静音图标切换)
        const icon = this.volumeIcon ? this.volumeIcon.querySelector('i') : null;
        if (icon) {
            if (pct == 0) {
                icon.className = 'fas fa-volume-mute';
            } else if (pct < 50) {
                icon.className = 'fas fa-volume-down';
            } else {
                icon.className = 'fas fa-volume-up';
            }
        }

        localStorage.setItem('sgfVolume', pct);
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
            const info = this.gameData.gameInfo || {};
            const blackStr = `${info.black || info.blackPlayer || '未知'}${info.blackRank ? ` (${info.blackRank})` : ''}`;
            const whiteStr = `${info.white || info.whitePlayer || '未知'}${info.whiteRank ? ` (${info.whiteRank})` : ''}`;

            let gameInfoHtml = `<strong>${blackStr} (B) vs ${whiteStr} (W)</strong><br>`;
            if (info.event && info.event !== '未知') gameInfoHtml += `<span style="color:#666">${info.event}</span><br>`;
            gameInfoHtml += `结果: ${info.result || '?'}<br>日期: ${info.date || '-'}`;

            document.getElementById('gameInfoDisplay').innerHTML = gameInfoHtml;

            // Store analysis results for search
            this.analysisResults = data.analysisResults || [];
            console.log(`Loaded ${this.analysisResults.length} analysis records`);

            // 🔥 关键修复：将后端获取到的分析数据同步到本地 IndexedDB，
            // 否则 CandidatePointsDisplay 会因为本地数据库为空而不显示任何胜率。
            if (this.analysisResults.length > 0) {
                console.log(`🔄 正在同步 ${this.analysisResults.length} 条云端分析数据到本地存储...`);
                await this.analysisStorage.restoreAnalysisResults(this.gameId, this.analysisResults);
            }

            // 🔥 初始化并构建胜率图表
            this.initChart();
            this.updateWinrateChart();

            // 🔥 构建胜率损失排行
            this.buildWinrateLossRanking();

            // 🔥 加载该棋谱的待验证题目
            this.loadPendingQuestions();

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

        // 快速保存按钮
        const quickSaveBtn = document.getElementById('quickSaveProblemBtn');
        if (quickSaveBtn) {
            quickSaveBtn.addEventListener('click', () => this.quickSaveProblem());
        }

        // 批量验证按钮
        const batchVerifyBtn = document.getElementById('batchVerifyBtn');
        if (batchVerifyBtn) {
            batchVerifyBtn.addEventListener('click', () => this.batchVerifyAll());
        }

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

    /**
     * 初始化左侧边栏拖拽调宽功能
     */
    initResizableSidebar() {
        const handle = document.getElementById('leftResizeHandle');
        const container = document.querySelector('.analysis-container');
        if (!handle || !container) return;

        let isResizing = false;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            handle.classList.add('active');
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            // 计算新的宽度 (横向鼠标位置)
            let newWidth = e.clientX;

            // 限制范围 (200px - 800px)
            if (newWidth < 200) newWidth = 200;
            if (newWidth > 800) newWidth = 800;

            container.style.setProperty('--sidebar-width', `${newWidth}px`);
        });

        window.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                handle.classList.remove('active');

                // 触发 window resize 事件，让原有的 resize 监听器处理布局刷新
                // 这样能复用 bindResize 中的防抖和逻辑，且避免直接调用 initBoard 可能带来的重置风险
                window.dispatchEvent(new Event('resize'));
            }
        });
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
            listEl.innerHTML = `<li class="loss-empty">需要至少 2 手分析数据才能计算胜率变化</li>`;
            return;
        }

        console.log(`📊 开始计算胜率损失排行... (总记录数: ${this.analysisResults.length})`);

        // 1. 计算所有步数的变化
        const allChanges = [];

        for (let i = 1; i < this.analysisResults.length; i++) {
            const prev = this.analysisResults[i - 1];
            const curr = this.analysisResults[i];

            if (!prev || !curr) continue;

            const prevBWR = this.extractWinRate(prev);
            const currBWR = this.extractWinRate(curr);

            if (prevBWR === null || currBWR === null) continue;

            const moveInfo = this.getMoveInfo(curr);
            const moveIndex = curr.moveNumber || i;

            // 归一化胜率为“当前落子方视角”
            let prevPlayerWR, currPlayerWR;
            const isBlack = moveInfo.color === 'B' || moveInfo.color === 'black';

            if (isBlack) {
                prevPlayerWR = prevBWR;
                currPlayerWR = currBWR;
            } else {
                prevPlayerWR = 100 - prevBWR;
                currPlayerWR = 100 - currBWR;
            }

            const loss = prevPlayerWR - currPlayerWR;

            // 只要变动超过 0.1% 就记录，无论是亏了还是赚了
            if (Math.abs(loss) > 0.1) {
                allChanges.push({
                    moveIndex: moveIndex,
                    color: isBlack ? 'B' : 'W',
                    coord: moveInfo.coord || '--',
                    lossPercent: loss,
                    currWR: currPlayerWR,
                    prevWR: prevPlayerWR,
                    scoreLoss: this.extractScoreLoss(prev, curr, isBlack ? 'B' : 'W')
                });
            }
        }

        // 保存原始数据供筛选
        this.lossRanking = allChanges;

        // 2. 应用筛选
        let filtered = [...allChanges];
        if (this.lossFilter === 'black') {
            filtered = filtered.filter(l => l.color === 'B');
        } else if (this.lossFilter === 'white') {
            filtered = filtered.filter(l => l.color === 'W');
        }

        // 3. 按损失排序 (从大到小，收益排在最后)
        filtered.sort((a, b) => b.lossPercent - a.lossPercent);

        // 4. 渲染 (显示前 100 名)
        const topN = filtered.slice(0, 100);
        console.log(`✅ 筛选后共 ${filtered.length} 个变化点, 渲染前 ${topN.length} 个`);

        if (topN.length === 0) {
            listEl.innerHTML = `<li class="loss-empty">在此条件下没有找到明显的胜率变动</li>`;
            return;
        }

        listEl.innerHTML = topN.map((item, idx) => {
            const isLoss = item.lossPercent >= 0.1;
            const isGain = item.lossPercent <= -0.1;
            const absLoss = Math.abs(item.lossPercent);

            const badgeClass = isLoss ? 'loss' : (isGain ? 'gain' : 'neutral');
            const sign = isLoss ? '-' : (isGain ? '+' : '');

            return `
            <li class="loss-item" data-move-index="${item.moveIndex}" onclick="editor.onLossItemClick(${item.moveIndex})">
                <span class="rank-num">${idx + 1}</span>
                
                <span class="color-dot" style="background: ${item.color === 'B' ? '#333' : '#fff'};"></span>
                
                <span class="move-num">#${item.moveIndex}</span>
                
                <span class="coord-info">${item.coord}</span>
                
                <div class="wr-stats">
                    <span class="curr-wr">${item.currWR.toFixed(1)}%</span>
                    <span class="prev-wr">前: ${item.prevWR.toFixed(1)}%</span>
                </div>
                
                <div class="loss-badge-container">
                    <span class="loss-badge ${badgeClass}">
                        ${sign}${absLoss.toFixed(1)}%
                    </span>
                </div>
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
        } else if (typeof move === 'object' && move !== null) {
            // 🔥 MongoDB对象格式: {color: "black"/"white", position: "Q16", row, col}
            color = move.color || null;
            coord = move.position || move.coord || '';
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
        // 清理实战下一手提示
        document.querySelectorAll('.actual-move-hint').forEach(el => el.remove());
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

            // 💡 关键：确保 BoardController 的状态完全同步
            this.boardController.currentMoveIndex = boardIndex;
            window.currentMoveIndex = boardIndex;
            this.boardController.updateMoveInfo();
        }

        // 🔥 重新绘制候选点标记
        this.updateBoardOverlay();
    }

    addCandidate(row, col) {
        const labels = ['A', 'B', 'C', 'D', 'E'];
        if (this.candidates.length >= labels.length) return;

        const label = labels[this.candidates.length];
        // 🔥 修复：初始分数为 0，等到 AI 验证完再统一评分
        const score = 0;
        this.candidates.push({ row, col, label, score });

        this.renderCandidates();
        this.updateBoardOverlay();
    }

    /**
     * 更新候选点的分数
     */
    updateCandidateScore(label, score) {
        const candidate = this.candidates.find(c => c.label === label);
        if (candidate) {
            candidate.score = parseInt(score, 10);
            candidate.manualScore = true; // 🔥 标记为手动修改过，重新评分时可选择保留
            console.log(`Updated candidate ${label} score to ${candidate.score}`);
        }
    }

    /**
     * 根据分析结果重新计算评分
     */
    recalculateScores() {
        console.log('📊 开始重新校准候选点评分...');

        // 🔥 修复：过滤掉没有分析结果或由于超时/API错误导致结果缺失的点
        const analyzed = this.candidates.filter(c => c.aiResult && c.aiResult.winRate !== undefined && c.aiResult.lossPercent !== undefined);
        if (analyzed.length === 0) return;

        // 按胜率损失从小到大排序
        const sorted = [...analyzed].sort((a, b) => a.aiResult.lossPercent - b.aiResult.lossPercent);

        // 重新赋值分值
        this.candidates.forEach(c => {
            // 如果用户手动改过分，我们可以选择保留，或者弹出提示。这里暂且总是根据 AI 更新
            const rank = sorted.indexOf(c);
            if (rank === 0) {
                c.score = 10;
            } else if (rank !== -1) {
                // 根据损失程度给分 (0-8)
                const loss = c.aiResult.lossPercent;
                if (loss < 2.0) c.score = 8;
                else if (loss < 5.0) c.score = 6;
                else if (loss < 10.0) c.score = 4;
                else if (loss < 20.0) c.score = 2;
                else c.score = 0;
            } else {
                c.score = 0;
            }
        });

        this.renderCandidates();
    }

    renderCandidates() {
        const list = document.getElementById('candidateList');
        const nextColor = this.getNextColor();

        // 🔥 预先计算哪个是最佳点 (正确答案)
        let bestLabel = null;
        if (this.candidates.length > 0) {
            // 🔥 修复：必须确保有有效的胜率数据，排除 504 Timeout 等失败结果
            const analyzed = this.candidates.filter(c => c.aiResult && c.aiResult.winRate !== undefined);
            if (analyzed.length > 0) {
                const best = analyzed.reduce((prev, curr) => {
                    if (nextColor === 'B') {
                        // 黑棋落子：寻找黑棋胜率最高的
                        return (prev.aiResult.winRate > curr.aiResult.winRate) ? prev : curr;
                    } else {
                        // 白棋落子：寻找黑棋胜率最低的
                        return (prev.aiResult.winRate < curr.aiResult.winRate) ? prev : curr;
                    }
                });
                bestLabel = best.label;
            }
        }

        list.innerHTML = this.candidates.map(c => {
            let statsHtml = '<span style="color:#999">Stats: Pending</span>';
            let correctBadge = '';

            if (c.verifying) {
                statsHtml = '<span style="color:#6366f1"><i class="fas fa-spinner fa-spin"></i> 分析中...</span>';
            } else if (c.aiResult) {
                const r = c.aiResult;
                const wrColor = r.lossPercent > 5 ? '#ef4444' : r.lossPercent > 2 ? '#b45309' : '#10b981';

                // 将胜率转换为当前下棋方的视角
                let displayWR = r.winRate;
                if (nextColor === 'W' && displayWR !== undefined) {
                    displayWR = parseFloat((100 - displayWR).toFixed(1));
                }

                statsHtml = `
                    <span style="color:${wrColor}; font-weight:bold;">
                        胜率: ${displayWR}%
                    </span><br>
                    <span style="color:#555; font-size:11px;">
                        损失: <strong style="color:${wrColor}">-${r.lossPercent}%</strong>
                        &nbsp;|&nbsp; 目差: ${r.scoreDiff > 0 ? '+' : ''}${r.scoreDiff}
                    </span>
                `;

                if (c.label === bestLabel) {
                    correctBadge = '<span style="background:#10b981; color:white; padding:1px 6px; border-radius:10px; font-size:10px; margin-left:8px;"><i class="fas fa-check"></i> 正确答案</span>';
                }
            }

            const winRateLoss = c.aiResult ? c.aiResult.lossPercent : 0;
            const score = c.score !== undefined ? c.score : 0;

            return `
                <li class="candidate-item" id="candidate-${c.label}">
                    <span class="candidate-label">${c.label}</span>
                    <span class="candidate-info">
                        (${c.row}, ${c.col}) ${correctBadge}<br>
                        ${statsHtml}
                    </span>
                    <div class="candidate-actions">
                        <div class="candidate-score-edit">
                            <label>评分:</label>
                            <input type="number" class="score-input" min="0" max="10" value="${score}" 
                                   onchange="editor.updateCandidateScore('${c.label}', this.value)">
                        </div>
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
     * 在当前局面的最后一手添加小三角标志
     */

    /**
     * 渲染实战下一手提示
     */
    renderActualNextMoveHint() {
        // 先清理旧的提示
        document.querySelectorAll('.actual-move-hint').forEach(el => el.remove());

        const currentIndex = window.currentMoveIndex !== undefined ? window.currentMoveIndex : this.boardController.currentMoveIndex;

        // 确保数据存在且有下一手
        if (!this.gameData || !this.gameData.moves || currentIndex + 1 >= this.gameData.moves.length) {
            return;
        }

        const nextMove = this.gameData.moves[currentIndex + 1];

        // 如果是虚着，不显示
        if (!nextMove || nextMove.pass || nextMove.row === undefined || nextMove.col === undefined) {
            console.log('Next move is pass or invalid, skipping hint');
            return;
        }

        const intersection = document.querySelector(`[data-row="${nextMove.row}"][data-col="${nextMove.col}"]`);
        if (intersection) {
            // 检查该位置是否已有棋子 (通常应该没有，除非是回退局面)
            if (intersection.querySelector('.stone')) {
                return;
            }

            const hint = document.createElement('div');
            hint.className = 'actual-move-hint';
            hint.title = `实战下一手: ${this.rowColToKataGo(nextMove.row, nextMove.col)}`;

            // 内部不放任何图标，保持清晰
            hint.innerHTML = '';

            intersection.appendChild(hint);
            console.log(`Rendered actual move hint at ${nextMove.row}, ${nextMove.col}`);
        }
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
     * 检查该局面是否已有题目
     */
    async checkExistence(sgfHash, moveNumber) {
        try {
            const apiUrl = `${CONFIG.API_VERCEL_NEXTJS_BASE_URL}/api/testQuestions?sgfHash=${sgfHash}&moveNumber=${moveNumber}`;
            const response = await fetch(apiUrl);
            if (!response.ok) return null;

            const result = await response.json();
            if (result.success && result.data && result.data.questions && result.data.questions.length > 0) {
                return result.data.questions[0];
            }
            return null;
        } catch (error) {
            console.error('🔍 检查题目重复失败:', error);
            return null;
        }
    }

    /**
     * 保存题目到数据库
     */
    async saveProblem() {
        if (this.candidates.length < 2) {
            alert('请至少选择 2 个候选点（一个最佳点，几个干扰点）');
            return;
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
            const nextColor = (currentMoveIndex + 1) % 2 === 0 ? 'B' : 'W';

            // 🔥 1. 检查是否已存在该局面的题目
            console.log(`🔍 检查重复题目: hash=${this.gameId}, move=${moveNumber}`);
            const existingQuestion = await this.checkExistence(this.gameId, moveNumber);
            let overwrite = false;

            if (existingQuestion) {
                const choice = confirm(`⚠️ 该局面（第${moveNumber}手）已存在题目：\n"${existingQuestion.questionText}"\n\n是否覆盖原有题目？\n[确定] 覆盖原有题目\n[取消] 放弃保存`);
                if (!choice) {
                    console.log('🚫 用户取消保存');
                    // 重置按钮状态
                    if (saveBtn) {
                        saveBtn.disabled = false;
                        saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存题目';
                    }
                    return;
                }
                overwrite = true;
                console.log('🔄 进入覆盖模式');
            }

            // 准备候选点数据
            let formattedCandidates = this.candidates.map(c => {
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
                    scoreVal: c.score !== undefined ? c.score : 0 // 🔥 保存时包含手动评分
                };
            });

            // 按照绝对胜率排序，而不是相对的 winRateLoss（因为如果 loss 被折叠为0会导致排序错误）
            const isBlackTurn = nextColor === 'B';
            formattedCandidates.sort((a, b) => {
                if (isBlackTurn) {
                    return b.winRate - a.winRate; // 黑棋求胜率最高
                } else {
                    return a.winRate - b.winRate; // 白棋求黑棋胜率最低
                }
            });

            // 重新计算并保存真正的相对于全场最佳选点的 winRateLoss
            const winrates = formattedCandidates.map(c => c.winRate);
            const baselineWinRate = isBlackTurn ? Math.max(...winrates) : Math.min(...winrates);

            // 分配 type 和 description
            formattedCandidates.forEach((candidate, index) => {
                let typeStr, descStr;
                if (index === 0) {
                    typeStr = 'best';
                    descStr = '最佳选点';
                } else if (index === 1) {
                    typeStr = 'alternate';
                    descStr = '次优选点';
                } else {
                    typeStr = 'alternate';
                    descStr = ''; // 第3，4名不显示描述
                }
                candidate.type = typeStr;
                candidate.description = descStr;

                // 强制修正入库时的 winRateLoss
                let trueLoss = isBlackTurn ? Math.max(0, baselineWinRate - candidate.winRate) : Math.max(0, candidate.winRate - baselineWinRate);
                candidate.winRateLoss = parseFloat(trueLoss.toFixed(1));

                candidate.score = candidate.scoreVal; // 将原始名字覆盖回来
                delete candidate.scoreVal;
            });

            // 恢复字母顺序 (可选项，避免乱序)
            formattedCandidates.sort((a, b) => a.label.localeCompare(b.label));

            // 自动寻找正确答案 (直接使用刚才打好标签的最佳选点)
            let bestCandidate = formattedCandidates.find(c => c.type === 'best');

            const description = document.getElementById('questionText')?.value || `第${moveNumber}手，${nextColor === 'B' ? '黑' : '白'}方下一步最佳选择是？`;
            const difficulty = document.getElementById('difficultySelect')?.value || '3';

            // 构建 Payload
            const payload = {
                questions: [{
                    id: existingQuestion ? existingQuestion.id : `${this.gameId}_${moveNumber}`,
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

                    // 比赛信息
                    blackPlayer: this.gameData?.gameInfo?.blackPlayer || this.gameData?.gameInfo?.black || '',
                    whitePlayer: this.gameData?.gameInfo?.whitePlayer || this.gameData?.gameInfo?.white || '',
                    blackRank: this.gameData?.gameInfo?.blackRank || '',
                    whiteRank: this.gameData?.gameInfo?.whiteRank || '',
                    gameDate: this.gameData?.gameInfo?.date || '',
                    result: this.gameData?.gameInfo?.result || '',

                    createdAt: existingQuestion ? existingQuestion.createdAt : new Date().toISOString()
                }],
                metadata: {
                    sgfHash: this.gameId,
                    sgfFilename: this.gameData?.filename,
                    totalQuestions: 1,
                    source: 'problem_editor'
                },
                overwrite: overwrite // 🔥 传递覆盖标志
            };

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
            alert(overwrite ? '题目覆盖成功！' : '题目保存成功！');

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

        // 字母列: A-T (跳过 I)
        let col;
        if (colLetter <= 'H') {
            col = colLetter.charCodeAt(0) - 65; // A-H -> 0-7
        } else {
            col = colLetter.charCodeAt(0) - 66; // J-T -> 8-18 (跳过I)
        }

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
        const nextColor = this.getNextColor();

        // --- 模式 A: AI 发现模式 (0 选点时自动填充) ---
        if (this.candidates.length === 0) {
            console.log(`🚀 进入 AI 发现模式, 分析局面: 第 ${currentMoveIndex + 1} 手`);
            try {
                // 🔥 修复：使用 baseMoves.length 确保分析当前局面的全部着法
                const result = await this.kataGoAPI.analyzePosition(
                    baseMoves, baseMoves.length, null, 'deep'
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
                            score: 0, // 🔥 初始给 0
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
            // 🔥 修复：使用 baseMoves.length 确保分析基准局面的全部着法
            const baseResult = await this.kataGoAPI.analyzePosition(
                baseMoves, baseMoves.length, null, 'deep'
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

                // 🔥 记录开始时间以确保起码分析达到配置时长
                const startTime = Date.now();
                const analysisDepth = 'extreme'; // 默认使用极端模式验证选点
                const analysisConfig = this.kataGoAPI.getAnalysisConfig(analysisDepth);
                const minDuration = analysisConfig.minDuration || 15000;

                console.log(`⏱️ [${candidate.label}] 开始深度验证 (目标 ${minDuration / 1000}s)...`);

                // 🔥 生产环境特殊处理：Vercel 10s 超时限制
                // 我们在 KatagoAPI 内部已有 getAnalysisConfig 逻辑，但这里如果是生产环境，
                // 我们需要确保传递给 analyzePosition 的深度配置是可接受的，或者在内部被截断。

                // 调用 KataGo 分析 (使用配置的深度)
                // 🔥 修复：使用 testMoves.length 确保包含候选这一手
                const result = await this.kataGoAPI.analyzePosition(
                    testMoves, testMoves.length, null, analysisDepth
                );

                // 🔥 计算已用时间并强制补足配置时长 (仅在成功时补足)
                const elapsed = Date.now() - startTime;
                if (result.success && elapsed < minDuration) {
                    const waitTime = minDuration - elapsed;
                    console.log(`⏳ [${candidate.label}] 分析过快 (${(elapsed / 1000).toFixed(1)}s), 补足等待 ${(waitTime / 1000).toFixed(1)}s...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }

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

        // 🔥 所有候选点验证完成后，重新计算评分 (根据实际 AI 损失排名)
        this.recalculateScores();

        // 完成
        this.isVerifying = false;
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-microchip"></i> AI 验证';
        }

        console.log('\n🎉 所有候选点验证完成！');
    }

    // 获取下一手颜色 ('B' 或 'W')
    getNextColor() {
        const currentMoveIndex = this.boardController ? this.boardController.currentMoveIndex : -1;
        // 棋谱第 0 手是初始状态，第 1 手索引为 0
        // 如果 currentMoveIndex 是 -1，下一手是第 0 手（黑先）
        // 如果 currentMoveIndex 是 0，下一手是第 1 手（白先）
        return (currentMoveIndex + 1) % 2 === 0 ? 'B' : 'W';
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

    /**
     * 初始化 Chart.js 胜率图表
     */
    initChart() {
        const ctx = document.getElementById('winrateChart');
        if (!ctx) return;

        // 如果已经存在图表，先销毁
        if (this.winrateChart) {
            this.winrateChart.destroy();
        }

        this.winrateChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '黑棋胜率',
                    data: [],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `黑棋胜率: ${context.parsed.y.toFixed(1)}%`;
                            },
                            title: function (context) {
                                return `第 ${context[0].label} 手`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: false },
                        grid: { display: false }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            callback: value => value + '%'
                        },
                        grid: { color: '#f0f0f0' }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        console.log(`📈 图表点击: 跳转到第 ${index} 手`);
                        this.boardController.goToMove(index);
                    }
                }
            }
        });
    }

    /**
     * 更新胜率图数据
     */
    updateWinrateChart() {
        if (!this.winrateChart || !this.gameData || !this.gameData.moves) return;

        // 1. 建立快速查找 Map，以 moveNumber 为索引
        const wrMap = new Map();
        this.analysisResults.forEach(r => {
            const moveNum = r.moveNumber || 0;
            const wr = this.extractWinRate(r);
            if (wr !== null) {
                // 如果同一个手数有多个记录（比如由于重新分析），保留最后一条或第一条（这里保留最后一条）
                wrMap.set(moveNum, wr);
            }
        });

        const labels = [];
        const data = [];
        const totalMoves = this.gameData.moves.length;
        let lastKnownWR = 50; // 默认为 50%

        // 2. 严格按棋谱步数（0 到 totalMoves）生成曲线
        for (let i = 0; i <= totalMoves; i++) {
            labels.push(i);

            if (wrMap.has(i)) {
                lastKnownWR = wrMap.get(i);
            }
            // 如果某一手没有分析，则继承前一手的值（平滑处理）
            data.push(lastKnownWR);
        }

        this.winrateChart.data.labels = labels;
        this.winrateChart.data.datasets[0].data = data;

        // 可选：如果手数太多，隐藏 X 轴刻度，只保留每 50 手的
        if (totalMoves > 100) {
            this.winrateChart.options.scales.x.ticks = {
                callback: function (value, index) {
                    return index % 50 === 0 ? index : '';
                }
            };
        }

        this.winrateChart.update();
        console.log(`📉 胜率图更新: 显示第 0-${totalMoves} 手共 ${data.length} 个点`);
    }

    /**
     * 更新图表上的当前手数指示器
     */
    updateChartIndicator(index) {
        const indicator = document.getElementById('chartMoveIndicator');
        if (indicator) {
            indicator.innerText = `#${index}`;
        }

        if (this.winrateChart) {
            // 通过修改 pointRadius 来突出当前手
            const radii = this.winrateChart.data.labels.map((_, i) => i === index ? 6 : 0);
            const hoverRadii = this.winrateChart.data.labels.map((_, i) => i === index ? 8 : 5);

            this.winrateChart.data.datasets[0].pointRadius = radii;
            this.winrateChart.data.datasets[0].pointHoverRadius = hoverRadii;
            this.winrateChart.data.datasets[0].pointBackgroundColor = this.winrateChart.data.labels.map((_, i) => i === index ? '#e74c3c' : '#3498db');

            this.winrateChart.update('none'); // 使用 'none' 模式避免多余动画
        }
    }

    // ==================== 快速保存 + 批量验证 ====================

    /**
     * 快速保存题目（不等AI验证）
     * 保存候选点坐标和棋盘状态，使用占位值填充必填字段
     */
    async quickSaveProblem() {
        if (this.candidates.length < 2) {
            alert('请至少选择 2 个候选点');
            return;
        }

        const btn = document.getElementById('quickSaveProblemBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        }

        try {
            const currentMoveIndex = this.boardController.currentMoveIndex;
            const moveNumber = currentMoveIndex + 1;
            const boardState = this.getBoardStateAtCurrentMove();
            const nextColor = (currentMoveIndex + 1) % 2 === 0 ? 'B' : 'W';
            const questionId = `${this.gameId}_${moveNumber}`;

            // 检查重复
            const existing = await this.checkExistence(this.gameId, moveNumber);
            if (existing) {
                const choice = confirm(`第${moveNumber}手已有题目，是否覆盖？`);
                if (!choice) {
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> 快速保存'; }
                    return;
                }
            }

            // 使用占位值构建候选点（满足后端必填校验）
            const labels = ['A', 'B', 'C', 'D'];
            const formattedCandidates = this.candidates.map((c, idx) => ({
                label: c.label || labels[idx],
                row: c.row,
                col: c.col,
                position: this.rowColToKataGo(c.row, c.col),
                winRate: c.aiResult?.winRate || 0,
                score: c.score || 0,
                winRateLoss: c.aiResult?.lossPercent || 0,
                scoreLoss: 0,
                type: idx === 0 ? 'best' : 'alternate',
                description: idx === 0 ? '待验证' : ''
            }));

            const firstCandidate = formattedCandidates[0];
            const description = document.getElementById('questionText')?.value
                || `第${moveNumber}手，${nextColor === 'B' ? '黑' : '白'}方下一步最佳选择是？`;

            const payload = {
                questions: [{
                    id: questionId,
                    sgfHash: this.gameId,
                    sgfFilename: this.gameData?.filename || 'manual_edit',
                    moveNumber: moveNumber,
                    boardState: boardState,
                    currentPlayer: nextColor === 'B' ? 'black' : 'white',
                    candidatePoints: formattedCandidates,
                    correctAnswer: {
                        label: firstCandidate.label,
                        position: firstCandidate.position,
                        winRate: 0,
                        explanation: '待AI验证'
                    },
                    winRateLoss: 0,
                    difficulty: document.getElementById('difficultySelect')?.value === '1' ? 'easy'
                        : document.getElementById('difficultySelect')?.value === '5' ? 'hard' : 'medium',
                    questionText: description,
                    title: description,
                    source: this.gameData?.filename || '棋谱编辑器',

                    // 比赛信息
                    blackPlayer: this.gameData?.gameInfo?.blackPlayer || this.gameData?.gameInfo?.black || '',
                    whitePlayer: this.gameData?.gameInfo?.whitePlayer || this.gameData?.gameInfo?.white || '',
                    blackRank: this.gameData?.gameInfo?.blackRank || '',
                    whiteRank: this.gameData?.gameInfo?.whiteRank || '',
                    gameDate: this.gameData?.gameInfo?.date || '',
                    result: this.gameData?.gameInfo?.result || '',

                    verificationStatus: 'pending'
                }],
                metadata: {
                    sgfHash: this.gameId,
                    sgfFilename: this.gameData?.filename,
                    totalQuestions: 1,
                    source: 'problem_editor'
                },
                overwrite: !!existing
            };

            const apiUrl = `${CONFIG.API_VERCEL_NEXTJS_BASE_URL}/api/testQuestions`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`保存失败: ${response.status} ${errorText}`);
            }

            console.log(`✅ 快速保存成功: 第${moveNumber}手`);

            // 添加到待验证列表
            this.pendingQuestions.push({
                id: questionId,
                moveNumber: moveNumber,
                sgfHash: this.gameId,
                currentPlayer: nextColor === 'B' ? 'black' : 'white',
                candidateCount: formattedCandidates.length
            });

            this.renderPendingQuestions();
            this.clearCandidates();

        } catch (error) {
            console.error('❌ 快速保存失败:', error);
            alert(`保存失败: ${error.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-bolt"></i> 快速保存';
            }
        }
    }

    /**
     * 从服务器加载当前棋谱的待验证题目
     */
    async loadPendingQuestions() {
        if (!this.gameId) return;
        try {
            const apiUrl = `${CONFIG.API_VERCEL_NEXTJS_BASE_URL}/api/testQuestions?sgfHash=${this.gameId}&verificationStatus=pending&limit=50`;
            const response = await fetch(apiUrl);
            if (!response.ok) return;

            const result = await response.json();
            if (result.success && result.data?.questions) {
                this.pendingQuestions = result.data.questions.map(q => ({
                    id: q.id,
                    moveNumber: q.moveNumber,
                    sgfHash: q.sgfHash,
                    currentPlayer: q.currentPlayer,
                    candidateCount: q.candidatePoints?.length || 0
                }));
                this.renderPendingQuestions();
            }
        } catch (error) {
            console.error('加载待验证题目失败:', error);
        }
    }

    /**
     * 渲染待验证题目列表
     */
    renderPendingQuestions() {
        const panel = document.getElementById('pendingQuestionsPanel');
        const list = document.getElementById('pendingQuestionsList');
        const countBadge = document.getElementById('pendingCount');

        if (!panel || !list) return;

        if (this.pendingQuestions.length === 0) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';
        countBadge.textContent = this.pendingQuestions.length;

        list.innerHTML = this.pendingQuestions.map((q, idx) => {
            const colorDot = q.currentPlayer === 'black'
                ? '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#222;border:1px solid #ccc;margin-right:6px"></span>'
                : '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#fff;border:1px solid #ccc;margin-right:6px"></span>';
            return `
                <li class="loss-item" style="cursor:pointer; padding:6px 8px"
                    onclick="editor.goToPendingQuestion(${q.moveNumber})">
                    <span class="rank-num">${idx + 1}</span>
                    ${colorDot}
                    <span style="font-weight:bold; color:#2c3e50">第${q.moveNumber}手</span>
                    <span style="margin-left:auto; color:#e67e22; font-size:11px">
                        <i class="fas fa-clock"></i> 待验证
                    </span>
                </li>
            `;
        }).join('');
    }

    /**
     * 点击待验证题目链接 → 跳转到对应局面
     */
    goToPendingQuestion(moveNumber) {
        if (this.boardController) {
            this.boardController.goToMove(moveNumber - 1);
            // 触发UI更新 (会由 goToMove -> updateMoveInfo -> renderLastMoveMarker 自动完成，但这里确保编辑器特有逻辑也同步)
            this.renderActualNextMoveHint();
            this.updateWinrateChart();
            this.updateChartIndicator(moveNumber - 1);
        }
    }


    /**
     * 批量 AI 验证所有待验证题目
     */
    async batchVerifyAll() {
        if (this.isVerifying) {
            console.warn('❗ 验证正在进行中');
            return;
        }

        if (!this.kataGoAPI) {
            alert('KataGo API 未初始化');
            return;
        }

        // 如果本地没有 pending 列表，尝试从服务器加载
        if (this.pendingQuestions.length === 0) {
            await this.loadPendingQuestions();
        }

        if (this.pendingQuestions.length === 0) {
            alert('没有待验证的题目');
            return;
        }

        const pendingIds = new Set(this.pendingQuestions.map(q => q.id));
        const total = this.pendingQuestions.length;
        if (!confirm(`将开始批量验证 ${total} 个题目，这可能需要较长时间。继续？`)) return;

        this.isVerifying = true;

        const batchBtn = document.getElementById('batchVerifyBtn');
        const progressBar = document.getElementById('batchProgressBar');
        const progressFill = document.getElementById('batchProgressFill');
        const progressText = document.getElementById('batchProgressText');

        if (batchBtn) {
            batchBtn.disabled = true;
            batchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 批量验证中...';
        }
        if (progressBar) progressBar.style.display = 'block';

        // 获取完整题目数据（不用 verificationStatus 过滤，兼容未部署后端）
        let fullQuestions = [];
        try {
            const apiUrl = `${CONFIG.API_VERCEL_NEXTJS_BASE_URL}/api/testQuestions?sgfHash=${this.gameId}&limit=100`;
            const resp = await fetch(apiUrl);
            const data = await resp.json();
            if (data.success && data.data?.questions) {
                // 只保留本地 pending 列表中的题目
                fullQuestions = data.data.questions.filter(q => pendingIds.has(q.id));
            }
            console.log(`📋 获取到 ${fullQuestions.length} 个待验证题目数据`);
        } catch (e) {
            console.error('加载完整题目数据失败:', e);
            alert('加载题目数据失败');
            this.isVerifying = false;
            if (batchBtn) { batchBtn.disabled = false; batchBtn.innerHTML = '<i class="fas fa-tasks"></i> 批量 AI验证'; }
            return;
        }

        if (fullQuestions.length === 0) {
            alert('无法从服务器获取题目数据，请检查网络或后端是否已部署');
            this.isVerifying = false;
            if (batchBtn) { batchBtn.disabled = false; batchBtn.innerHTML = '<i class="fas fa-tasks"></i> 批量 AI验证'; }
            return;
        }

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < fullQuestions.length; i++) {
            const question = fullQuestions[i];
            const moveIndex = question.moveNumber - 1;

            // 更新进度
            const pct = Math.round(((i) / total) * 100);
            if (progressFill) progressFill.style.width = `${pct}%`;
            if (progressText) progressText.textContent = `${i}/${total} - 正在验证第${question.moveNumber}手...`;

            console.log(`\n📦 [批量 ${i + 1}/${total}] 开始验证第${question.moveNumber}手`);

            try {
                // 1. 跳转到对应局面
                this.boardController.goToMove(moveIndex);

                // 2. 恢复候选点
                const labels = ['A', 'B', 'C', 'D'];
                this.candidates = (question.candidatePoints || []).map((cp, idx) => ({
                    label: cp.label || labels[idx],
                    row: cp.row,
                    col: cp.col,
                    score: cp.score || 0,
                    aiResult: null // 将由 AI 验证填充
                }));

                this.renderCandidates();
                this.updateBoardOverlay();

                // 3. 调用现有 AI 验证逻辑（临时解除 isVerifying 锁，否则 aiVerifyCandidates 会直接跳过）
                this.isVerifying = false;
                await this.aiVerifyCandidates();
                this.isVerifying = true;

                // 4. AI验证完成后，構建更新数据并通过 PATCH 更新
                const nextColor = this.getNextColor();
                const isBlackTurn = nextColor === 'B';

                let formattedCandidates = this.candidates.map(c => {
                    const r = c.aiResult || {};
                    return {
                        label: c.label,
                        row: c.row,
                        col: c.col,
                        position: r.coord || this.rowColToKataGo(c.row, c.col),
                        winRate: r.winRate || 0,
                        score: r.score || 0,
                        winRateLoss: r.lossPercent || 0,
                        scoreLoss: r.scoreDiff || 0,
                        type: 'alternate',
                        description: ''
                    };
                });

                // 排序并分配 type
                formattedCandidates.sort((a, b) => isBlackTurn
                    ? b.winRate - a.winRate
                    : a.winRate - b.winRate
                );

                const winrates = formattedCandidates.map(c => c.winRate);
                const baselineWR = isBlackTurn ? Math.max(...winrates) : Math.min(...winrates);

                formattedCandidates.forEach((c, idx) => {
                    c.type = idx === 0 ? 'best' : 'alternate';
                    c.description = idx === 0 ? '最佳选点' : idx === 1 ? '次优选点' : '';
                    c.winRateLoss = parseFloat((isBlackTurn
                        ? Math.max(0, baselineWR - c.winRate)
                        : Math.max(0, c.winRate - baselineWR)).toFixed(1));
                });

                formattedCandidates.sort((a, b) => a.label.localeCompare(b.label));

                const bestCandidate = formattedCandidates.find(c => c.type === 'best');

                // PATCH 更新
                const updatePayload = {
                    questions: [{
                        id: question.id,
                        candidatePoints: formattedCandidates,
                        correctAnswer: {
                            label: bestCandidate.label,
                            position: bestCandidate.position,
                            winRate: bestCandidate.winRate,
                            explanation: `最佳选点，胜率: ${bestCandidate.winRate}%`
                        },
                        winRateLoss: bestCandidate.winRateLoss,
                        verificationStatus: 'verified',
                        verifiedAt: new Date().toISOString()
                    }]
                };

                const patchResp = await fetch(`${CONFIG.API_VERCEL_NEXTJS_BASE_URL}/api/testQuestions`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatePayload)
                });

                if (patchResp.ok) {
                    successCount++;
                    console.log(`✅ [批量 ${i + 1}/${total}] 第${question.moveNumber}手 验证成功`);
                } else {
                    failCount++;
                    console.error(`❌ [批量 ${i + 1}/${total}] PATCH 失败:`, await patchResp.text());
                }

            } catch (error) {
                failCount++;
                console.error(`❌ [批量 ${i + 1}/${total}] 第${question.moveNumber}手 验证异常:`, error);
            }

            this.clearCandidates();
        }

        // 完成
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = `完成！成功 ${successCount}/${total}，失败 ${failCount}`;

        this.isVerifying = false;
        if (batchBtn) {
            batchBtn.disabled = false;
            batchBtn.innerHTML = '<i class="fas fa-tasks"></i> 批量 AI验证';
        }

        // 刷新待验证列表
        await this.loadPendingQuestions();

        alert(`批量验证完成！\n成功: ${successCount}\n失败: ${failCount}`);
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
