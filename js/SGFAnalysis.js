/**
 * SGF 分析主类 - 重构后只负责核心功能
 */
class SGFAnalyzer {
    constructor() {
        this.gameData = null;
        this.currentMoveIndex = -1;
        this.sgfParser = new SGFParser();
        // 🔥 修复：恢复使用代理模式（云端引擎必须使用代理避开CORS）
        // 同时支持设置目标后端地址
        this.katagoAPI = new KataGoAPI(null, 'katago_gtp_bot', true);
        this.katagoAPI.targetUrl = window.CONFIG?.KATAGO_BASE_URL || 'http://192.168.0.162:8080';

        // 初始化新的模块
        this.analysisStorage = new AnalysisStorage();
        this.analysisDisplay = new AnalysisDisplay();
        this.analysisEngine = new AnalysisEngine(this.katagoAPI, this.analysisStorage, this.analysisDisplay);
        this.boardController = new BoardController(this.analysisDisplay, this.analysisStorage);

        // 初始化测试题生成器
        this.testQuestionGenerator = null;

        // 🔥 新增：设置全局变量，供 GoBoard12.js 中的全局函数调用
        window.candidatePointsDisplay = this.boardController.candidatePointsDisplay;
        console.log("🔧 设置全局 candidatePointsDisplay:", window.candidatePointsDisplay);

        this.currentSGFHash = null;
        this.isAnalyzing = false;
        this.analysisResults = [];

        // 🔥 新增：批量分析状态
        this.batchQueue = [];
        this.isStopped = false;
        this.isBatchProcessing = false;

        // 🔊 音量控制初始化
        this.stoneSound = document.getElementById('stoneSound');
        this.correctSound = document.getElementById('correctSound');
        this.incorrectSound = document.getElementById('incorrectSound');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');

        const savedVol = parseInt(localStorage.getItem('sgfVolume') ?? '30');
        this.setVolume(savedVol);

        this.init();
        this.setupEventListeners();
    }

    async init() {
        try {
            await this.analysisStorage.initDB();
            this.analysisDisplay.addLogEntry('系统初始化完成', 'success');

            // 🔥 设置全局变量，供AnalyzedGamesTable使用
            window.sgfParser = this.sgfParser;
            window.currentMoves = null;
            window.currentMoveIndex = -1;
            window.currentSGFHash = null;

            // 🔥 保存对当前实例的引用，避免this上下文丢失
            const self = this;

            // 🔥 设置全局函数，使用闭包保持对实例的引用
            window.clearBoard = function () {
                console.log('全局clearBoard被调用，检查boardController:', self.boardController);
                if (self.boardController && typeof self.boardController.clearBoard === 'function') {
                    console.log('使用boardController.clearBoard');
                    self.boardController.clearBoard();
                } else {
                    console.log('boardController不可用，使用本地clearBoard函数');
                    // 如果boardController不可用，使用GoBoard12.js中的clearBoard函数
                    const intersections = document.querySelectorAll('.intersection');
                    intersections.forEach(intersection => {
                        const stone = intersection.querySelector('.stone');
                        if (stone) {
                            intersection.removeChild(stone);
                        }
                    });

                    // 清空棋盘状态
                    if (typeof boardState !== 'undefined') {
                        for (let i = 0; i < 19; i++) {
                            for (let j = 0; j < 19; j++) {
                                boardState[i][j] = null;
                            }
                        }
                    }
                }
            };

            window.goToStart = function () {
                console.log('全局goToStart被调用');
                if (self.boardController && typeof self.boardController.goToMove === 'function') {
                    self.boardController.goToMove(0);
                }
            };

            // 🔥 设置全局的SGF解析和加载函数
            window.loadSGFGame = function (sgfContent, filename, gameId) {
                return self.loadSGFFromTable(sgfContent, filename, gameId);
            };

            // 🔥 新增：初始化已分析棋谱表格
            if (window.analyzedGamesTable) {
                await window.analyzedGamesTable.init(this.analysisStorage);
                console.log('已分析棋谱表格初始化完成');
            }

            // 🔥 关键修复：同步全局 updateMoveInfo，确保导航也能触发三角标记更新
            const originalGlobalUpdateMoveInfo = window.updateMoveInfo;
            window.updateMoveInfo = function () {
                // 如果原始全局函数存在且不是当前覆写的函数（防止死循环）
                if (originalGlobalUpdateMoveInfo && originalGlobalUpdateMoveInfo !== window.updateMoveInfo) {
                    originalGlobalUpdateMoveInfo();
                }
                if (self.boardController) {
                    self.boardController.updateMoveInfo();
                }
            };
            console.log('✅ 全局 updateMoveInfo 已与 BoardController 同步');
        } catch (error) {
            console.error('初始化失败:', error);
            this.analysisDisplay.addLogEntry('系统初始化失败', 'error');
        }

        // 延迟测试连接
        setTimeout(() => {
            this.testKataGoConnection(false); // 不是手动切换，按优先级走
        }, 1000);
    }

    // 🔊 设置音量
    setVolume(pct) {
        const vol = pct / 100;

        // 🔥 修复：如果 constructor 运行时元素还没加载，这里重新获取
        if (!this.stoneSound) this.stoneSound = document.getElementById('stoneSound');
        if (!this.correctSound) this.correctSound = document.getElementById('correctSound');
        if (!this.incorrectSound) this.incorrectSound = document.getElementById('incorrectSound');

        if (this.stoneSound) this.stoneSound.volume = vol;
        if (this.correctSound) this.correctSound.volume = vol;
        if (this.incorrectSound) this.incorrectSound.volume = vol;

        if (this.volumeSlider) this.volumeSlider.value = pct;
        if (this.volumeValue) this.volumeValue.textContent = `${pct}%`;
        localStorage.setItem('sgfVolume', pct);

        console.log(`🔊 [SGFAnalysis] 音量调整为: ${pct}% (音控元素: ${this.stoneSound ? '已找到' : '未找到'})`);
    }

    // 🔥 新增：从表格加载SGF的方法
    // 🔥 新增：从表格加载SGF的方法
    async loadSGFFromTable(sgfContent, filename, gameId) {
        try {
            console.log(`从表格加载棋谱: ${filename}`);

            // 设置当前SGF哈希
            this.currentSGFHash = gameId;
            this.analysisEngine.setSGFHash(this.currentSGFHash);

            // 🔥 新增：如果内容为空，尝试从后端获取完整数据
            let analysisRecord = null;
            if (!sgfContent) {
                console.log('SGF内容为空，尝试从后端获取完整数据...');
                this.analysisDisplay.addLogEntry('正在获取棋谱内容...', 'info');
                try {
                    analysisRecord = await this.analysisStorage.getAnalysisResult(gameId);
                    if (analysisRecord && analysisRecord.sgf && analysisRecord.sgf.content) {
                        sgfContent = analysisRecord.sgf.content;
                        console.log('成功获取到SGF内容');
                    } else {
                        throw new Error('无法获取SGF内容');
                    }
                } catch (err) {
                    throw new Error('获取SGF内容失败: ' + err.message);
                }
            }

            // 解析 SGF 内容
            const rawMoves = this.sgfParser.parseSGFMoves(sgfContent);
            if (rawMoves.length === 0) {
                this.analysisDisplay.addLogEntry('警告: SGF解析结果为空', 'warning');
            }

            // 🔥 新增：计算基于前50手移动的固定 Hash，用于 session sticky
            const sessionHash = this.katagoAPI.computeSGFHash(rawMoves);
            this.katagoAPI.setFixedHash(sessionHash);
            console.log(`🔗 [SGFAnalysis] 加载棋谱设置 Session Hash: ${sessionHash}`);

            const convertedMoves = this.convertMovesToGoBoard12Format(rawMoves);

            this.gameData = {
                sgfContent: sgfContent,
                filename: filename,
                rawMoves: rawMoves,
                moves: convertedMoves,
                gameInfo: this.sgfParser.extractGameInfo(sgfContent)
            };

            // 设置游戏数据并渲染棋盘
            this.boardController.setGameData(this.gameData);

            // 设置候选点显示的SGF哈希值
            this.boardController.candidatePointsDisplay.setSGFHash(this.currentSGFHash);

            // 确保全局变量也能访问到 SGF 哈希值
            if (window.candidatePointsDisplay) {
                window.candidatePointsDisplay.setSGFHash(this.currentSGFHash);
            }

            // 设置全局变量
            window.currentMoves = convertedMoves;
            window.currentMoveIndex = -1;
            window.currentSGFHash = gameId;

            // 🔥 新增：尝试从后端获取并恢复详细分析结果 (如果之前没获取过)
            if (!analysisRecord) {
                try {
                    this.analysisDisplay.addLogEntry('正在同步云端分析数据...', 'info');
                    analysisRecord = await this.analysisStorage.getAnalysisResult(gameId);
                } catch (err) {
                    console.warn('同步分析数据失败(可能是本地新上传文件):', err);
                }
            }

            if (analysisRecord && analysisRecord.analysisResults && analysisRecord.analysisResults.length > 0) {
                console.log(`获取到云端分析记录: ${analysisRecord.analysisResults.length} 手`);
                await this.analysisStorage.restoreAnalysisResults(gameId, analysisRecord.analysisResults);
                this.analysisDisplay.addLogEntry(`已同步 ${analysisRecord.analysisResults.length} 手分析数据`, 'success');
            } else {
                console.log('云端记录中没有详细分析数据');
            }

            // 清空棋盘并回到开始
            this.boardController.clearBoard();
            this.boardController.goToMove(-1); // Changed to -1 to start at beginning

            this.analysisDisplay.addLogEntry(`已加载棋谱: ${filename}，共 ${this.gameData.moves.length} 手棋`, 'success');

            // 更新文件信息显示
            this.updateFileInfo(filename, this.gameData.moves.length);

            // 重置按钮状态为idle
            this.updateAnalysisButtons('idle');

            // 🔥 触发sgfLoaded事件，通知测试题生成器
            document.dispatchEvent(new CustomEvent('sgfLoaded'));

            // 🔥 新增：触发gameDataChanged事件
            document.dispatchEvent(new CustomEvent('gameDataChanged'));

            return true;

        } catch (error) {
            console.error('从表格加载SGF失败:', error);
            this.analysisDisplay.addLogEntry(`加载棋谱失败: ${error.message}`, 'error');
            return false;
        }
    }

    setupEventListeners() {
        // 文件上传相关
        const fileInput = document.getElementById('fileInput');
        const selectFileBtn = document.getElementById('selectFileBtn');
        const analyzeFileBtn = document.getElementById('analyzeFileBtn');
        const uploadArea = document.getElementById('uploadArea');

        console.log('  - analyzeFileBtn:', analyzeFileBtn);

        if (fileInput) {
            fileInput.addEventListener('change', (e) => handleFileUpload(e));
        }

        // 🔥 新增：保存分析按钮事件
        const saveAnalysisBtn = document.getElementById('saveAnalysisBtn');
        if (saveAnalysisBtn) {
            saveAnalysisBtn.addEventListener('click', () => this.saveAnalysis());
        }

        if (selectFileBtn) {
            selectFileBtn.addEventListener('click', () => fileInput?.click());
        }

        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput?.click());
            uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        }



        // 🔥 新增：监听分析深度选择变化
        const analysisDepthSelect = document.getElementById('analysisDepth');
        if (analysisDepthSelect) {
            analysisDepthSelect.addEventListener('change', (e) => {
                const selectedValue = e.target.value;
                const selectedText = e.target.options[e.target.selectedIndex].text;
                console.log('🎯 分析深度选择变化:', {
                    value: selectedValue,
                    text: selectedText,
                    timestamp: new Date().toLocaleTimeString()
                });
            });
        }

        // 棋盘控制按钮
        this.boardController.setupEventListeners();

        // 🔥 新增：批量分析控制按钮
        const startBatchBtn = document.getElementById('startBatchBtn');
        const clearQueueBtn = document.getElementById('clearQueueBtn');

        if (startBatchBtn) {
            startBatchBtn.addEventListener('click', () => this.startBatchAnalysis());
        }

        if (clearQueueBtn) {
            clearQueueBtn.addEventListener('click', () => this.clearBatchQueue());
        }

        // 初始化测试题生成器
        if (window.TestQuestionGenerator) {
            this.testQuestionGenerator = new TestQuestionGenerator(this);
        }

        // 🔊 音量控制事件监听
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => this.setVolume(parseInt(e.target.value)));
        }

        const volumeIcon = document.getElementById('volumeIcon');
        const volumePopup = document.getElementById('volumePopup');
        if (volumeIcon && volumePopup) {
            volumeIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                volumePopup.style.display = volumePopup.style.display === 'flex' ? 'none' : 'flex';
            });

            document.addEventListener('click', (e) => {
                if (!volumePopup.contains(e.target) && e.target !== volumeIcon) {
                    volumePopup.style.display = 'none';
                }
            });
        }
    }



    // 处理KataGo状态更新
    handleKataGoStatus(detail) {
        this.addLogEntry(detail.message, detail.status.toLowerCase());

        // 更新连接状态
        if (detail.message.includes('连接成功') || detail.message.includes('healthy')) {
            this.updateConnectionStatus('connected');
        } else if (detail.message.includes('连接失败') || detail.message.includes('连接异常') || detail.message.includes('CORS')) {
            this.updateConnectionStatus('error');
        }
    }

    testKataGoConnection = async (isManualSwitch = false) => {
        console.log('开始测试所有 KataGo 引擎连接');

        this.updateConnectionStatus('connecting');

        // 从 CONFIG 获取引擎配置
        const availableEngines = window.getAvailableEngines ? window.getAvailableEngines() : (CONFIG.KATAGO_ENGINES || {});

        const engines = Object.keys(availableEngines).map(key => ({
            name: key,
            url: availableEngines[key].url,
            displayName: availableEngines[key].name
        }));

        if (engines.length === 0) {
            console.error('未配置任何 KataGo 引擎');
            this.updateConnectionStatus('error');
            this.analysisDisplay.addLogEntry('未配置任何 KataGo 引擎', 'error');
            return;
        }

        const currentEngineSelect = document.getElementById('engineSelect');
        const currentEngineName = currentEngineSelect ? currentEngineSelect.value : null;

        // 确定测试顺序：优先当前选中，然后按优先级 (tunnel优先保证prod体验)
        const preferredOrder = ['tunnel', 'cloud', 'devlb', 'custom'];
        let orderedEngines = [];

        // 只有当用户手动在下拉框切换时，才优先测试其选中项
        if (isManualSwitch && currentEngineName) {
            const currentObj = engines.find(e => e.name === currentEngineName);
            if (currentObj) orderedEngines.push(currentObj);
        }

        for (const pref of preferredOrder) {
            const obj = engines.find(e => e.name === pref);
            if (obj && !orderedEngines.some(e => e.name === obj.name)) {
                orderedEngines.push(obj);
            }
        }

        for (const e of engines) {
            if (!orderedEngines.some(o => o.name === e.name)) {
                orderedEngines.push(e);
            }
        }

        let bestEngine = null;

        try {
            for (const engine of orderedEngines) {
                // 如果用户已经开始分析了，跳过后台切换
                if (this.analysisEngine && this.analysisEngine.isAnalyzing) {
                    console.log('⏳ 分析已在进行中，跳过引擎切换检测');
                    return;
                }

                try {
                    console.log(`🔍 测试 ${engine.displayName}: ${engine.url}`);
                    const tempAPI = new KataGoAPI(null, 'katago_gtp_bot', this.katagoAPI.isProxyMode);
                    tempAPI.targetUrl = engine.url;

                    const result = await tempAPI.testConnection();

                    if (result.success) {
                        console.log(`✅ ${engine.displayName} 连接成功`);
                        this.analysisDisplay.addLogEntry(`${engine.displayName} 连接成功`, 'success');
                        bestEngine = engine;
                        break; // 只要连接成功，直接跳出，不再测试其他引擎以免抛出烦人的超时错误
                    } else {
                        console.log(`❌ ${engine.displayName} 连接失败:`, result.error);
                        // 不在 UI 显示测试失败的提示，避免干扰用户
                    }
                } catch (error) {
                    console.error(`❌ ${engine.displayName} 连接异常:`, error);
                }
            }

            if (bestEngine) {
                this.updateConnectionStatus('connected');

                if (currentEngineSelect && currentEngineSelect.value !== bestEngine.name) {
                    currentEngineSelect.value = bestEngine.name;
                    this.analysisDisplay.addLogEntry(`已自动切换到可用的 ${bestEngine.displayName}`, 'info');
                }

                this.katagoAPI.targetUrl = bestEngine.url;
                console.log(`🔥 最终使用引擎: ${bestEngine.displayName} (${bestEngine.url})`);
            } else {
                // 所有引擎都连接失败
                this.updateConnectionStatus('error');
                this.analysisDisplay.addLogEntry('所有 KataGo 引擎连接失败，请检查服务状态', 'error');
            }

        } catch (error) {
            console.error('测试引擎连接时发生异常:', error);
            this.updateConnectionStatus('error');
            this.analysisDisplay.addLogEntry(`引擎连接测试异常: ${error.message}`, 'error');
        }
    }


    // 更新连接状态显示
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;

        statusElement.className = `connection-status ${status}`;

        switch (status) {
            case 'connecting':
                statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在测试所有 KataGo 引擎...';
                break;
            case 'connected':
                statusElement.innerHTML = '<i class="fas fa-check-circle"></i> KataGo 引擎连接正常';
                break;
            case 'error':
                statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 所有 KataGo 引擎连接失败';
                break;
        }
    }
    // SGF 解析
    async parseSGF(sgfContent, filename = 'unknown.sgf') {
        try {
            // 保存 SGF 文件并获取哈希值
            this.currentSGFHash = await this.analysisStorage.saveSGFFile(sgfContent, filename);
            this.analysisEngine.setSGFHash(this.currentSGFHash);

            // 移除重新上传文件时自动清空逻辑，改为在开始分析前提示用户
            this.analysisDisplay.addLogEntry(`已载入棋谱: ${filename}`, 'info');

            // 解析 SGF 内容
            const rawMoves = this.sgfParser.parseSGFMoves(sgfContent);

            // 🔥 新增：计算基于前50手移动的固定 Hash，用于 session sticky
            const sessionHash = this.katagoAPI.computeSGFHash(rawMoves);
            this.katagoAPI.setFixedHash(sessionHash);
            console.log(`🔗 [SGFAnalysis] 解析 SGF 设置 Session Hash: ${sessionHash}`);

            const convertedMoves = this.convertMovesToGoBoard12Format(rawMoves);

            this.gameData = {
                sgfContent: sgfContent,
                filename: filename,
                rawMoves: rawMoves,
                moves: convertedMoves,
                gameInfo: this.sgfParser.extractGameInfo(sgfContent)
            };

            // 设置游戏数据并渲染棋盘
            this.boardController.setGameData(this.gameData);

            // 🔥 调试：设置候选点显示的SGF哈希值
            console.log("🔧 设置 SGF 哈希值给 CandidatePointsDisplay:", this.currentSGFHash);
            this.boardController.candidatePointsDisplay.setSGFHash(this.currentSGFHash);

            // 🔥 新增：确保全局变量也能访问到 SGF 哈希值
            if (window.candidatePointsDisplay) {
                window.candidatePointsDisplay.setSGFHash(this.currentSGFHash);
                console.log("🔧 全局 candidatePointsDisplay 也已设置 SGF 哈希值");
            }

            this.analysisDisplay.addLogEntry(`SGF 解析完成，共 ${this.gameData.moves.length} 手棋`, 'success');

            // 更新文件信息显示
            this.updateFileInfo(filename, this.gameData.moves.length);

            // 重置按钮状态为idle
            this.updateAnalysisButtons('idle');

            // 触发SGF加载完成事件
            document.dispatchEvent(new CustomEvent('sgfLoaded', {
                detail: { sgfHash: this.currentSGFHash, filename: filename }
            }));

        } catch (error) {
            console.error('SGF 解析失败:', error);
            this.analysisDisplay.addLogEntry(`SGF 解析失败: ${error.message}`, 'error');
        }
    }

    // 转换棋谱格式
    // 转换棋谱格式
    convertMovesToGoBoard12Format(moves) {
        if (!Array.isArray(moves)) {
            console.warn('convertMovesToGoBoard12Format received invalid input:', moves);
            return [];
        }

        return moves.map(move => {
            if (!move) return null; // 过滤掉 null/undefined

            // 支持对象格式或数组格式
            let color, position;
            if (Array.isArray(move)) {
                [color, position] = move;
            } else {
                color = move.color;
                position = move.pass ? 'pass' : (move.position || move.coord);
            }

            if (!position) return null;

            if (position === 'pass' || typeof position !== 'string') {
                const normalizedColor = (color && color.toUpperCase() === 'B') || color === 'black' ? 'black' : 'white';
                return { pass: true, color: normalizedColor };
            }

            // 将 KataGo 格式(如 'Q16') 转换为 row/col
            const col = position[0]; // 'Q'
            const rowStr = position.slice(1); // '16'

            // 列坐标转换: A-T (跳过I) -> 0-18
            let colIndex;
            if (col <= 'H') {
                colIndex = col.charCodeAt(0) - 65; // A-H -> 0-7
            } else {
                colIndex = col.charCodeAt(0) - 66; // J-T -> 8-18 (跳过I)
            }

            // 行坐标转换: 1-19 -> 18-0 (SGF中1是底部，但显示时19是顶部)
            const rowIndex = 19 - parseInt(rowStr);

            // 修正颜色格式
            const normalizedColor = (color && (color.toUpperCase() === 'B' || color === 'black')) ? 'black' : 'white';

            return {
                row: rowIndex,
                col: colIndex,
                color: normalizedColor
            };
        });
    }

    // 计算棋盘大小
    calculateBoardSize() {
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        const maxWinSize = 3000;
        const minWinSize = 300;

        let cellSizeFromWidth, cellSizeFromHeight;

        // 根据宽度计算 cellSize
        if (winWidth < 480) {
            cellSizeFromWidth = Math.floor((winWidth - 20) / 20);
            if (winWidth < minWinSize) {
                cellSizeFromWidth = Math.floor((minWinSize - 20) / 20);
            }
        } else if (winWidth > 768) {
            cellSizeFromWidth = Math.floor(winWidth / 28);
            if (winWidth > maxWinSize) {
                cellSizeFromWidth = Math.floor(maxWinSize / 28);
            }
        } else {
            cellSizeFromWidth = 30;
        }

        // 根据高度计算 cellSize
        if (winHeight < 480) {
            cellSizeFromHeight = Math.floor((winHeight - 20) / 20);
            if (winHeight < minWinSize) {
                cellSizeFromHeight = Math.floor((minWinSize - 20) / 20);
            }
        } else if (winHeight > 768) {
            cellSizeFromHeight = Math.floor(winHeight / 25);
            if (winHeight > maxWinSize) {
                cellSizeFromHeight = Math.floor(maxWinSize / 25);
            }
        } else {
            cellSizeFromHeight = 30;
        }

        let cellSize = Math.min(cellSizeFromWidth, cellSizeFromHeight);
        cellSize = Math.max(15, Math.min(cellSize, 50));

        return cellSize;
    }

    // 启用控制按钮
    enableControlButtons() {
        const iconButtons = [
            'logostartBtn', 'logofastBackwardBtn', 'logobackwardBtn',
            'logoforwardBtn', 'logofastForwardBtn', 'logoendBtn', 'logoshowMovesBtn'
        ];

        iconButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        });

        const originalButtons = ['startBtn', 'prevBtn', 'nextBtn', 'endBtn', 'autoPlayBtn'];
        originalButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = false;
            }
        });

        this.analysisDisplay.addLogEntry('控制按钮已启用', 'success');
    }

    // 🔥 新增：解析SGF位置格式（如 "Q16" -> {row: 3, col: 16}）
    parseSGFPosition(sgfPos) {
        if (!sgfPos || sgfPos.length < 2) return null;

        const colChar = sgfPos[0].toUpperCase();
        const rowNum = parseInt(sgfPos.slice(1));

        // 列转换: A-T -> 0-18 (跳过I)
        let col;
        if (colChar <= 'H') {
            col = colChar.charCodeAt(0) - 65; // A-H -> 0-7
        } else if (colChar >= 'J') {
            col = colChar.charCodeAt(0) - 66; // J-T -> 8-18
        } else {
            return null; // I不存在
        }

        // 行转换: 1-19 -> 18-0
        const row = 19 - rowNum;

        if (row >= 0 && row < 19 && col >= 0 && col < 19) {
            return { row, col };
        }

        return null;
    }

    // 更新文件信息显示
    updateFileInfo(filename, moveCount) {
        const fileNameElement = document.getElementById('fileName');
        const fileDetailsElement = document.getElementById('fileDetails');
        const fileInfoElement = document.getElementById('fileInfo');

        if (fileNameElement) {
            fileNameElement.textContent = filename;
        }

        const info = this.gameData.gameInfo || {};
        const blackStr = `${info.blackPlayer || '未知'}${info.blackRank ? ` (${info.blackRank})` : ''}`;
        const whiteStr = `${info.whitePlayer || '未知'}${info.whiteRank ? ` (${info.whiteRank})` : ''}`;

        let detailsHtml = `<div>共 ${moveCount} 手棋</div>`;
        if (info.blackPlayer || info.whitePlayer) {
            detailsHtml += `<div style="margin-top:5px; color:#333; font-weight:bold;">${blackStr} vs ${whiteStr}</div>`;
        }
        if (info.result && info.result !== '未知') {
            detailsHtml += `<div style="font-size:12px; color:#666;">结果: ${info.result}</div>`;
        }
        if (info.date && info.date !== '未知') {
            detailsHtml += `<div style="font-size:12px; color:#666;">日期: ${info.date}</div>`;
        }

        if (fileDetailsElement) {
            fileDetailsElement.innerHTML = detailsHtml;
        }

        if (fileInfoElement) {
            fileInfoElement.classList.add('show');
        }

        // 也更新汇总显示的胜率条标签
        const labelBlack = document.querySelector('.winrate-label-black');
        const labelWhite = document.querySelector('.winrate-label-white');
        if (labelBlack) labelBlack.textContent = info.blackPlayer ? `${info.blackPlayer}${info.blackRank ? `(${info.blackRank})` : ''}` : '黑棋';
        if (labelWhite) labelWhite.textContent = info.whitePlayer ? `${info.whitePlayer}${info.whiteRank ? `(${info.whiteRank})` : ''}` : '白棋';
    }

    // 开始分析
    async startAnalysis() {
        console.log('🚀 开始分析');

        try {
            console.log('🧹 清空日志和重置进度');
            this.analysisDisplay.clearLog();
            this.analysisDisplay.resetProgress();

            console.log('📊 更新状态为：开始分析，正在连接 KataGo 服务...');
            this.analysisDisplay.updateStatus('开始分析，正在连接 KataGo 服务...');

            // 更新按钮状态
            this.updateAnalysisButtons('analyzing');

            // 确保 analysisEngine 有正确的 SGF 哈希值
            if (this.currentSGFHash) {
                this.analysisEngine.setSGFHash(this.currentSGFHash);

                // 🔥 新增：检查是否已有分析结果，如果是手动触发则提示用户
                if (!this.isBatchProcessing) {
                    const existingResults = await this.analysisStorage.loadAnalysisResults(this.currentSGFHash);
                    if (existingResults.length > 0) {
                        const confirmReanalyze = confirm(`发现该棋谱已有 ${existingResults.length} 条分析结果，是否重新分析并覆盖旧结果？`);
                        if (!confirmReanalyze) {
                            this.analysisDisplay.updateStatus('分析已取消');
                            this.updateAnalysisButtons('idle');
                            return;
                        }
                        // 用户确认重新分析，清空旧结果
                        await this.analysisStorage.clearAnalysisResults(this.currentSGFHash);
                        this.analysisDisplay.addLogEntry('历史分析结果已清空，开始重新分析', 'info');
                    }
                }
            }

            // 🔥 获取分析设置
            const analysisDepthSelect = document.getElementById('analysisDepth');
            console.log('🔧 analysisDepthSelect 元素:', analysisDepthSelect);
            if (analysisDepthSelect) {
                console.log('🔧 analysisDepthSelect.value:', analysisDepthSelect.value);
                console.log('🔧 analysisDepthSelect.selectedIndex:', analysisDepthSelect.selectedIndex);
                console.log('🔧 analysisDepthSelect.options:', Array.from(analysisDepthSelect.options).map(opt => ({ value: opt.value, text: opt.text, selected: opt.selected })));
            }
            const analysisDepth = analysisDepthSelect ? analysisDepthSelect.value : 'normal';
            console.log(`🎯 使用分析深度: ${analysisDepth}`);
            console.log('🔧 即将传递给 analysisEngine.startAnalysis 的参数:', {
                gameData: this.gameData ? '已设置' : '未设置',
                analysisDepth: analysisDepth
            });

            console.log('🎯 开始调用 analysisEngine.startAnalysis');
            await this.analysisEngine.startAnalysis(
                this.gameData,
                analysisDepth, // 🔥 使用从UI获取的分析深度
                (current, total) => {
                    // 进度回调
                    this.analysisDisplay.updateProgress(current, total);
                    this.analysisDisplay.updateStatus(`正在分析第 ${current}/${total} 手...`);
                },
                (results) => {
                    // 完成回调
                    const totalTime = results.reduce((sum, r) => sum + (r.analysis.time || 0), 0);
                    this.analysisDisplay.displayAnalysisComplete(results.length, totalTime, this.analysisStorage, this.currentSGFHash);
                    this.analysisDisplay.updateStatus('分析完成');
                    this.updateAnalysisButtons('idle');
                },
                (moveNumber, moveData, analysisData) => {
                    // 每步分析完成回调 - 显示分析结果
                    this.analysisDisplay.displayAnalysisResult(moveNumber, moveData, analysisData);

                    // 🔥 恢复：实时显示棋盘上的候选点
                    // moveNumber 是当前分析的手数（例如1），对应数组索引 0
                    // 我们想要显示 "第1手下完后的候选点（即第2手的建议）"
                    // CandidatePointsDisplay.displayCandidatePoints(index) 会查找 index+1 的建议
                    // 所以传入 moveNumber - 1 (即 index 0) -> 查找 moveNumber 1 的建议？
                    // 不，AnalysisEngine 存的是 moveNumber: 1 (第1手后的局面分析)
                    // CandidatePointsDisplay(0) -> target = 0+1 = 1.
                    // Correct.
                    if (this.boardController && this.boardController.candidatePointsDisplay) {
                        this.boardController.candidatePointsDisplay.displayCandidatePoints(moveNumber - 1);
                    }
                }
            );

        } catch (error) {
            console.error('分析失败:', error);

            // 遍历错误信息，确保显示所有详细信息
            const errorLines = error.message.split('\n');
            errorLines.forEach(line => {
                if (line.trim()) {
                    this.analysisDisplay.addLogEntry(line.trim(), 'error');
                }
            });

            this.analysisDisplay.updateStatus('分析失败');
            this.updateAnalysisButtons('idle');
        }
    }

    // 暂停分析
    async pauseAnalysis() {
        console.log('🛑 暂停分析');

        // 暂停分析引擎
        this.analysisEngine.pauseAnalysis();

        // 更新状态和按钮
        this.analysisDisplay.updateStatus('分析已暂停');
        this.updateAnalysisButtons('paused');

        // 显示当前分析结果
        try {
            await this.analysisDisplay.displayIndexedDBResults(this.analysisStorage, this.currentSGFHash);
            const currentResults = this.analysisEngine.analysisResults;
            this.analysisDisplay.addLogEntry(`分析已暂停，当前已完成 ${currentResults.length} 步分析`, 'info');
        } catch (error) {
            console.error('显示暂停结果失败:', error);
            this.analysisDisplay.addLogEntry(`分析已暂停，显示结果时出错: ${error.message}`, 'warning');
        }
    }

    // 恢复分析
    async resumeAnalysis() {
        console.log('▶️ 恢复分析');

        try {
            // 更新状态和按钮
            this.analysisDisplay.updateStatus('恢复分析中...');
            this.updateAnalysisButtons('analyzing');

            // 恢复分析引擎
            await this.analysisEngine.resumeAnalysis();

        } catch (error) {
            console.error('恢复分析失败:', error);
            this.analysisDisplay.addLogEntry(`恢复分析失败: ${error.message}`, 'error');
            this.analysisDisplay.updateStatus('恢复分析失败');
            this.updateAnalysisButtons('paused');
        }
    }

    // 更新分析按钮状态 - 支持三种状态：idle, analyzing, paused
    updateAnalysisButtons(state) {
        // 🔥 获取所有同名按钮（可能有重复 ID）
        const allBtns = document.querySelectorAll('#analyzeFileBtn');
        const stopBtn = document.getElementById('stopAnalysisBtn');
        const startBatchBtn = document.getElementById('startBatchBtn');
        const clearQueueBtn = document.getElementById('clearQueueBtn');

        console.log('updateAnalysisButtons called with state:', state, ', 找到按钮数:', allBtns.length);

        // 🔥 保存 this 引用，确保在 onclick 中可用
        const self = this;

        allBtns.forEach((btn, index) => {
            // 🔥 直接用 onclick 覆盖，比 cloneNode 更可靠
            switch (state) {
                case 'analyzing':
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-pause-circle"></i> 中断分析';
                    btn.onclick = (e) => {
                        e.preventDefault();
                        console.log(`🔥 [按钮${index}] 点击了"中断分析"`);
                        self.pauseAnalysis();
                    };
                    break;
                case 'paused':
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-play-circle"></i> 恢复分析';
                    btn.onclick = (e) => {
                        e.preventDefault();
                        console.log(`🔥 [按钮${index}] 点击了"恢复分析"`);
                        self.resumeAnalysis();
                    };
                    break;
                case 'idle':
                default:
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-play-circle"></i> 开始分析';
                    btn.onclick = (e) => {
                        e.preventDefault();
                        console.log(`🔥 [按钮${index}] 点击了"开始分析", this=`, self);
                        self.startAnalysis();
                    };
                    break;
            }
        });

        // 管理停止按钮
        if (stopBtn) {
            stopBtn.style.display = (state === 'analyzing' || state === 'paused') ? 'flex' : 'none';
            // 重新绑定停止事件
            const newStopBtn = stopBtn.cloneNode(true);
            stopBtn.parentNode.replaceChild(newStopBtn, stopBtn);
            newStopBtn.onclick = (e) => {
                e.preventDefault();
                this.stopAnalysis();
            };
        }

        // 管理批量分析按钮
        if (startBatchBtn) {
            if (this.isBatchProcessing) {
                startBatchBtn.disabled = true;
                startBatchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 批量分析中...';
                if (clearQueueBtn) clearQueueBtn.disabled = true;
            } else {
                startBatchBtn.disabled = (this.batchQueue.length === 0);
                startBatchBtn.innerHTML = '<i class="fas fa-play"></i> 开始批量分析';
                if (clearQueueBtn) clearQueueBtn.disabled = false;
            }
        }

        // 🔥 处理保存按钮状态
        const saveBtn = document.getElementById('saveAnalysisBtn');
        if (saveBtn) {
            saveBtn.disabled = !this.currentSGFHash;
            saveBtn.style.opacity = this.currentSGFHash ? '1' : '0.5';
            saveBtn.style.pointerEvents = this.currentSGFHash ? 'auto' : 'none';
        }
    }

    // 停止分析
    async stopAnalysis() {
        console.log('🛑 停止分析');
        this.isStopped = true;

        // 停止分析引擎
        this.analysisEngine.stopAnalysis();

        // 更新状态和按钮
        this.analysisDisplay.updateStatus('分析已停止');
        this.updateAnalysisButtons('idle');

        // 立即保存当前分析结果到 MongoDB
        try {
            const currentResults = this.analysisEngine.analysisResults;
            if (currentResults && currentResults.length > 0) {
                await this.saveAnalysis();
                this.analysisDisplay.addLogEntry(`分析已停止，已保存 ${currentResults.length} 条结果`, 'success');
            }
        } catch (error) {
            console.error('保存分析结果失败:', error);
        }
    }

    // 保存分析结果到 MongoDB
    async saveAnalysis() {
        const saveBtn = document.getElementById('saveAnalysisBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        }

        try {
            const analysisResults = await this.analysisStorage.loadAnalysisResults(this.currentSGFHash);
            if (analysisResults.length === 0) return;

            const payload = {
                sgf: {
                    hash: this.currentSGFHash,
                    filename: this.gameData?.filename || 'unknown.sgf',
                    content: this.gameData?.sgfContent || '',
                    uploadTime: new Date().toISOString(),
                    gameInfo: {
                        ...this.gameData?.gameInfo,
                        black: this.gameData?.gameInfo?.black || this.gameData?.gameInfo?.blackPlayer || '',
                        white: this.gameData?.gameInfo?.white || this.gameData?.gameInfo?.whitePlayer || '',
                        result: this.gameData?.gameInfo?.result || '',
                        date: this.gameData?.gameInfo?.date || '',
                        event: this.gameData?.gameInfo?.event || '',
                        komi: this.gameData?.gameInfo?.komi || 6.5
                    }
                },
                analysisConfig: {
                    engine: 'katago',
                    engineVersion: '1.0', // 添加后端必填的 engineVersion 字段
                    visits: 800,
                    time: 30,
                    analysisDate: new Date().toISOString(),
                    totalMoves: analysisResults.length
                },
                analysisResults: analysisResults.map(result => ({
                    moveNumber: result.moveNumber,
                    move: result.move,
                    analysis: {
                        recommendedMove: result.analysis.recommendedMove,
                        winRate: result.analysis.winRate,
                        score: result.analysis.score,
                        visits: result.analysis.visits,
                        time: result.analysis.time,
                        variations: result.analysis.variations?.slice(0, 3) || [],
                        policy: result.analysis.policy?.slice(0, 10) || []
                    }
                })),
                metadata: {
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    analysisStatus: 'completed',
                    version: '1.0'
                }
            };

            const response = await fetch(`${CONFIG.API_BASE_URL}/saveAnalysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.analysisDisplay.showSuccess('分析结果保存成功！');
            if (window.analyzedGamesTable) window.analyzedGamesTable.loadAnalyzedGames();

        } catch (error) {
            console.error('保存失败:', error);
            this.analysisDisplay.showError(`保存失败: ${error.message}`);
            throw error;
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存结果';
            }
        }
    }

    // 处理引擎切换
    handleEngineChange(event) {
        const selectedEngineId = event.target.value;
        const engineConfig = window.getEngineConfig ? window.getEngineConfig(selectedEngineId) : null;

        if (engineConfig && engineConfig.url) {
            this.katagoAPI.setBaseUrl(engineConfig.url);
            this.katagoAPI.targetUrl = engineConfig.url; // 🔥 修复：同步更新代理目标地址
            this.analysisDisplay.addLogEntry(`已切换到引擎: ${engineConfig.name} (${engineConfig.url})`, 'info');
            this.testKataGoConnection(true); // 传入 true 表示手动切换
        }
    }

    // 批量分析相关方法
    async addToBatchQueue(file) {
        if (this.batchQueue.length >= 10) {
            this.analysisDisplay.addLogEntry('队列已满，最多支持10个文件', 'warning');
            return;
        }

        const gibParser = new GIBParser();
        let content, filename = file.name;

        try {
            if (filename.toLowerCase().endsWith('.gib')) {
                const arrayBuffer = await readFileAsArrayBuffer(file);
                content = await gibParser.convertToSGF(arrayBuffer);
                filename = filename.replace(/\.[^/.]+$/, "") + ".sgf";
            } else {
                content = await readFile(file);
            }

            this.batchQueue.push({ file, filename, content, status: 'pending' });
            document.getElementById('batchQueueSection').style.display = 'block';
            this.renderBatchQueue();

            // 🔥 修复：如果是第一个文件，自动解析它，确保 this.gameData 不为 null
            if (this.batchQueue.length === 1) {
                console.log('⚡ 自动解析队列中的第一个文件:', filename);
                await this.parseSGF(content, filename);
            }

            this.updateAnalysisButtons('idle');
        } catch (error) {
            console.error('解析失败:', error);
        }
    }

    renderBatchQueue() {
        const list = document.getElementById('batchQueueList');
        const count = document.getElementById('queueCount');
        if (!list || !count) return;

        count.textContent = this.batchQueue.length;
        list.innerHTML = '';

        this.batchQueue.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = `queue-item ${item.status === 'analyzing' ? 'active' : ''} ${item.status === 'done' ? 'done' : ''}`;
            let statusText = item.status === 'analyzing' ? '分析中' : item.status === 'done' ? '已完成' : item.status === 'error' ? '失败' : '等待中';
            let statusClass = `status-${item.status}`;

            el.innerHTML = `
                <span class="item-name" title="${item.filename}">${index + 1}. ${item.filename}</span>
                <span class="item-status ${statusClass}">${statusText}</span>
            `;
            list.appendChild(el);
        });
    }

    async startBatchAnalysis() {
        if (this.isBatchProcessing || this.batchQueue.length === 0) return;

        this.isBatchProcessing = true;
        this.isStopped = false;
        this.updateAnalysisButtons('analyzing');
        this.analysisDisplay.addLogEntry('🎬 开始批量分析任务', 'info');

        for (let i = 0; i < this.batchQueue.length; i++) {
            if (this.isStopped) break;
            const item = this.batchQueue[i];
            if (item.status === 'done') continue;

            item.status = 'analyzing';
            this.renderBatchQueue();

            try {
                await this.parseSGF(item.content, item.filename);
                await this.startAnalysis();
                this.analysisDisplay.addLogEntry(`💾 正在自动保存 ${item.filename}...`, 'info');
                await this.saveAnalysis();

                // 🔥 检查分析手数，不足60手不标记为done
                // 使用 analysisEngine.analysisResults 获取当前分析任务的手数
                const moveCount = this.analysisEngine.analysisResults.length;
                if (moveCount >= 60) {
                    item.status = 'done';
                    this.analysisDisplay.addLogEntry(`${item.filename} 分析完成 (共 ${moveCount} 手)`, 'success');
                } else {
                    item.status = 'error';
                    this.analysisDisplay.addLogEntry(`${item.filename} 分析结果不足 60 手 (${moveCount} 手)，未标记为完成`, 'warning');
                }
            } catch (error) {
                console.error('分析失败:', error);
                item.status = 'error';
            }
            this.renderBatchQueue();
        }

        this.isBatchProcessing = false;
        this.analysisDisplay.addLogEntry('🏁 批量分析任务结束', 'success');
        this.updateAnalysisButtons('idle');
    }

    clearBatchQueue() {
        if (this.isBatchProcessing) return;
        this.batchQueue = [];
        document.getElementById('batchQueueSection').style.display = 'none';
        this.renderBatchQueue();
        this.updateAnalysisButtons('idle');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.sgfAnalyzer = new SGFAnalyzer();
    }, 100);
});

// 新增：引擎选择事件监听
const engineSelect = document.getElementById('engineSelect');
if (engineSelect) {
    engineSelect.addEventListener('change', (e) => {
        if (window.sgfAnalyzer) {
            window.sgfAnalyzer.handleEngineChange(e);
        }
    });
}
