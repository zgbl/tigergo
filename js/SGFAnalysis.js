/**
 * SGF 分析主类 - 重构后只负责核心功能
 */
class SGFAnalyzer {
    constructor() {
        this.gameData = null;
        this.currentMoveIndex = -1;
        this.sgfParser = new SGFParser();
        this.katagoAPI = new KataGoAPI();
        
        // 初始化新的模块
        this.analysisStorage = new AnalysisStorage();
        this.analysisEngine = new AnalysisEngine(this.katagoAPI, this.analysisStorage);
        this.analysisDisplay = new AnalysisDisplay();
        this.boardController = new BoardController(this.analysisDisplay, this.analysisStorage);
        
        // 初始化测试题生成器
        this.testQuestionGenerator = null;
        
        // 🔥 新增：设置全局变量，供 GoBoard12.js 中的全局函数调用
        window.candidatePointsDisplay = this.boardController.candidatePointsDisplay;
        console.log("🔧 设置全局 candidatePointsDisplay:", window.candidatePointsDisplay);
        
        this.currentSGFHash = null;
        this.isAnalyzing = false;
        this.analysisResults = [];
        
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
            window.clearBoard = function() {
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
            
            window.goToStart = function() {
                console.log('全局goToStart被调用');
                if (self.boardController && typeof self.boardController.goToMove === 'function') {
                    self.boardController.goToMove(0);
                }
            };
            
            // 🔥 设置全局的SGF解析和加载函数
            window.loadSGFGame = function(sgfContent, filename, gameId) {
                return self.loadSGFFromTable(sgfContent, filename, gameId);
            };
            
            // 🔥 新增：初始化已分析棋谱表格
            if (window.analyzedGamesTable) {
                await window.analyzedGamesTable.init(this.analysisStorage);
                console.log('已分析棋谱表格初始化完成');
            }
        } catch (error) {
            console.error('初始化失败:', error);
            this.analysisDisplay.addLogEntry('系统初始化失败', 'error');
        }

                        // 延迟测试连接
        setTimeout(() => {
            this.testKataGoConnection();
        }, 1000);
    }

    // 🔥 新增：从表格加载SGF的方法
    async loadSGFFromTable(sgfContent, filename, gameId) {
        try {
            console.log(`从表格加载棋谱: ${filename}`);
            
            // 设置当前SGF哈希
            this.currentSGFHash = gameId;
            this.analysisEngine.setSGFHash(this.currentSGFHash);
            
            // 解析 SGF 内容
            const rawMoves = this.sgfParser.parseSGFMoves(sgfContent);
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
            
            // 清空棋盘并回到开始
            this.boardController.clearBoard();
            this.boardController.goToMove(0);
            
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

        if (selectFileBtn) {
            selectFileBtn.addEventListener('click', () => fileInput?.click());
        }

        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput?.click());
            uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        }

        // 棋盘控制按钮
        this.boardController.setupEventListeners();
        
        // 初始化测试题生成器
        if (window.TestQuestionGenerator) {
            this.testQuestionGenerator = new TestQuestionGenerator(this);
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

    testKataGoConnection = async () => {
        console.log('开始测试KataGo连接');

        // 1. 立即更新UI，显示“正在连接...”
        this.updateConnectionStatus('connecting');

        try {
            // 2. 调用 KataGoAPI 的测试连接方法
            const result = await this.katagoAPI.testConnection();

            if (result.success) {
                // 连接成功，获取服务器信息（这一步即使失败也不影响连接状态）
                try {
                    const serverInfo = await this.katagoAPI.getServerInfo();
                    console.log('服务器信息:', serverInfo);
                } catch (infoError) {
                    console.warn('警告: 获取服务器信息失败，但连接是正常的。', infoError);
                }

                // 3. 连接成功，更新UI
                this.updateConnectionStatus('connected');

            } else {
                // 连接测试返回 false，更新UI为失败
                console.error('KataGo 连接测试失败:', result.error);
                this.updateConnectionStatus('error');
            }

        } catch (error) {
            // 4. 如果发生任何异常（如网络错误），更新UI为失败
            console.error('测试KataGo连接时发生异常:', error);
            this.updateConnectionStatus('error');
        }
    }
    

    // 更新连接状态显示
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;
        
        statusElement.className = `connection-status ${status}`;
        
        switch (status) {
            case 'connecting':
                statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在连接 KataGo 服务...';
                break;
            case 'connected':
                statusElement.innerHTML = '<i class="fas fa-check-circle"></i> KataGo 服务连接正常';
                break;
            case 'error':
                statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> KataGo 服务连接失败';
                break;
        }
    }
    // SGF 解析
    async parseSGF(sgfContent, filename = 'unknown.sgf') {
        try {
            // 保存 SGF 文件并获取哈希值
            this.currentSGFHash = await this.analysisStorage.saveSGFFile(sgfContent, filename);
            this.analysisEngine.setSGFHash(this.currentSGFHash);
            
            // 重新上传文件时，直接清空已有的分析结果，不再提示
            const existingResults = await this.analysisStorage.loadAnalysisResults(this.currentSGFHash);
            if (existingResults.length > 0) {
                console.log(`发现已有 ${existingResults.length} 条分析结果，重新上传文件时自动清空`);
                // 清空IndexedDB中的分析结果
                await this.analysisStorage.clearAnalysisResults(this.currentSGFHash);
                this.analysisDisplay.addLogEntry(`已清空 ${existingResults.length} 条历史分析结果`, 'info');
            }

            // 解析 SGF 内容
            const rawMoves = this.sgfParser.parseSGFMoves(sgfContent);
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
    convertMovesToGoBoard12Format(moves) {
        return moves.map(move => {
            const [color, position] = move;
            
            if (position === 'pass') {
                const normalizedColor = color === 'B' ? 'black' : 'white';
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
            const normalizedColor = (color && color.toUpperCase() === 'B') ? 'black' : 'white';
            
            return {
                row: rowIndex,
                col: colIndex,
                color: normalizedColor  // 使用正确的颜色格式
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
        
        if (fileNameElement) {
            fileNameElement.textContent = filename;
        }
        
        if (fileDetailsElement) {
            fileDetailsElement.textContent = `共 ${moveCount} 手棋`;
        }
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
            }
            
            // 🔥 获取分析设置
            const analysisDepthSelect = document.getElementById('analysisDepth');
            const analysisDepth = analysisDepthSelect ? analysisDepthSelect.value : 'normal';
            console.log(`🎯 使用分析深度: ${analysisDepth}`);
            
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
        const analyzeBtn = document.getElementById('analyzeFileBtn');
        const stopBtn = document.getElementById('stopAnalysisBtn');
        
        console.log('updateAnalysisButtons called with state:', state);
        
        if (analyzeBtn) {
            // 移除之前的事件监听器
            //analyzeBtn.onclick = null;
            const newBtn = analyzeBtn.cloneNode(true);
            analyzeBtn.parentNode.replaceChild(newBtn, analyzeBtn);
            const refreshedBtn = document.getElementById('analyzeFileBtn');
            
            switch (state) {
                case 'analyzing':
                    refreshedBtn.disabled = false;
                    refreshedBtn.innerHTML = '<i class="fas fa-pause-circle"></i> 中断分析';
                    refreshedBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.pauseAnalysis();
                    });
                    break;
                case 'paused':
                    refreshedBtn.disabled = false;
                    refreshedBtn.innerHTML = '<i class="fas fa-play-circle"></i> 恢复分析';
                    refreshedBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.resumeAnalysis();
                    });
                    break;
                case 'idle':
                default:
                    refreshedBtn.disabled = false;
                    refreshedBtn.innerHTML = '<i class="fas fa-play-circle"></i> 开始分析';
                    refreshedBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.startAnalysis();
                    });
                    break;
            }
        }
        
        if (stopBtn) {
            stopBtn.disabled = (state === 'idle');
            stopBtn.textContent = (state === 'idle') ? '停止分析' : '结束分析';
            
            // 为停止分析按钮添加事件监听器
            if (state !== 'idle') {
                // 移除之前的事件监听器
                const newStopBtn = stopBtn.cloneNode(true);
                stopBtn.parentNode.replaceChild(newStopBtn, stopBtn);
                const refreshedStopBtn = document.getElementById('stopAnalysisBtn');
                
                refreshedStopBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.stopAnalysis();
                });
            }
        }
    }

    // 停止分析
    async stopAnalysis() {
        console.log('🛑 停止分析');
        
        // 停止分析引擎
        this.analysisEngine.stopAnalysis();
        
        // 更新状态和按钮
        this.analysisDisplay.updateStatus('分析已停止');
        this.updateAnalysisButtons('idle');
        
        // 立即保存当前分析结果到 MongoDB
        try {
            const currentResults = this.analysisEngine.analysisResults;
            if (currentResults && currentResults.length > 0) {
                await this.saveAnalysisToMongoDB();
                this.analysisDisplay.addLogEntry(`分析已停止，已保存 ${currentResults.length} 条结果`, 'success');
            } else {
                this.analysisDisplay.addLogEntry('分析已停止，没有结果可保存', 'info');
            }
        } catch (error) {
            console.error('保存分析结果失败:', error);
            this.analysisDisplay.addLogEntry(`保存失败: ${error.message}`, 'error');
        }
    }

    // 保存分析结果到 MongoDB
    async saveAnalysisToMongoDB() {
        try {
            // 从 IndexedDB 加载分析结果
            const analysisResults = await this.analysisStorage.loadAnalysisResults(this.currentSGFHash);
            
            if (analysisResults.length === 0) {
                throw new Error('没有分析结果可保存');
            }

            // 🔥 添加详细的数据大小分析
            console.log(`🔍 准备保存 ${analysisResults.length} 条分析结果到 MongoDB`);
            
            let totalSize = 0;
            let rawDataTotalSize = 0;
            let maxSingleResultSize = 0;
            let maxSingleRawDataSize = 0;
            
            analysisResults.forEach((result, index) => {
                const resultSize = JSON.stringify(result).length;
                totalSize += resultSize;
                maxSingleResultSize = Math.max(maxSingleResultSize, resultSize);
                
                if (result.analysis && result.analysis.rawData) {
                    const rawDataSize = JSON.stringify(result.analysis.rawData).length;
                    rawDataTotalSize += rawDataSize;
                    maxSingleRawDataSize = Math.max(maxSingleRawDataSize, rawDataSize);
                    
                    if (index < 3) { // 只显示前3条的详细信息
                        console.log(`🔍 第${result.moveNumber}手分析结果:`);
                        console.log(`  - 总大小: ${(resultSize / 1024).toFixed(2)} KB`);
                        console.log(`  - rawData大小: ${(rawDataSize / 1024).toFixed(2)} KB (${((rawDataSize / resultSize) * 100).toFixed(1)}%)`);
                        
                        // 检查 rawData 中的具体字段
                        if (result.analysis.rawData.analysis) {
                            const analysisArraySize = JSON.stringify(result.analysis.rawData.analysis).length;
                            console.log(`  - rawData.analysis数组大小: ${(analysisArraySize / 1024).toFixed(2)} KB`);
                            console.log(`  - rawData.analysis包含 ${result.analysis.rawData.analysis.length} 个变化`);
                            
                            // 检查第一个变化的详细字段
                            if (result.analysis.rawData.analysis[0]) {
                                const firstVariation = result.analysis.rawData.analysis[0];
                                Object.keys(firstVariation).forEach(key => {
                                    if (firstVariation[key] && typeof firstVariation[key] === 'object') {
                                        const fieldSize = JSON.stringify(firstVariation[key]).length;
                                        if (fieldSize > 500) { // 只显示大于500字节的字段
                                            console.log(`    - ${key}: ${(fieldSize / 1024).toFixed(2)} KB`);
                                        }
                                    }
                                });
                            }
                        }
                    }
                }
            });
            
            console.log(`🔍 分析结果数据统计:`);
            console.log(`  - 总记录数: ${analysisResults.length}`);
            console.log(`  - 所有结果总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  - rawData总大小: ${(rawDataTotalSize / 1024 / 1024).toFixed(2)} MB (${((rawDataTotalSize / totalSize) * 100).toFixed(1)}%)`);
            console.log(`  - 单条结果最大: ${(maxSingleResultSize / 1024).toFixed(2)} KB`);
            console.log(`  - 单条rawData最大: ${(maxSingleRawDataSize / 1024).toFixed(2)} KB`);

            const payload = {
                sgf: {
                    hash: this.currentSGFHash,
                    filename: this.gameData?.filename || 'unknown.sgf',
                    content: this.gameData?.sgfContent || '',
                    uploadTime: new Date().toISOString(),
                    gameInfo: this.gameData?.gameInfo || {}
                },
                analysisConfig: {
                    engine: 'katago',
                    engineVersion: '1.0',
                    visits: 800,
                    time: 30,
                    analysisDate: new Date().toISOString(),
                    totalMoves: analysisResults.length
                },
                // 🔥 关键修复：移除 rawData，只保留核心分析数据
                analysisResults: analysisResults.map(result => ({
                    moveNumber: result.moveNumber,
                    move: result.move,
                    analysis: {
                        recommendedMove: result.analysis.recommendedMove,
                        winRate: result.analysis.winRate,
                        score: result.analysis.score,
                        visits: result.analysis.visits,
                        time: result.analysis.time,
                        // 只保留前3个变化，减少数据量
                        variations: result.analysis.variations?.slice(0, 3) || [],
                        // 只保留前10个策略，减少数据量
                        policy: result.analysis.policy?.slice(0, 10) || []
                        // 🔥 完全移除 rawData！这是数据量大的罪魁祸首
                    }
                })),
                metadata: {
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    analysisStatus: 'completed',
                    totalAnalysisTime: analysisResults.reduce((sum, r) => sum + (r.analysis.time || 0), 0),
                    averageTime: analysisResults.length > 0 ? 
                        (analysisResults.reduce((sum, r) => sum + (r.analysis.time || 0), 0) / analysisResults.length).toFixed(2) : 0,
                    version: '1.0'
                }
            };

            // 🔥 分析 payload 各部分的大小
            const sgfSize = JSON.stringify(payload.sgf).length;
            const configSize = JSON.stringify(payload.analysisConfig).length;
            const resultsSize = JSON.stringify(payload.analysisResults).length;
            const metadataSize = JSON.stringify(payload.metadata).length;
            const totalPayloadSize = JSON.stringify(payload).length;
            
            console.log(`🔍 最终 Payload 大小分析:`);
            console.log(`  - SGF部分: ${(sgfSize / 1024).toFixed(2)} KB (${((sgfSize / totalPayloadSize) * 100).toFixed(1)}%)`);
            console.log(`  - 配置部分: ${(configSize / 1024).toFixed(2)} KB (${((configSize / totalPayloadSize) * 100).toFixed(1)}%)`);
            console.log(`  - 分析结果部分: ${(resultsSize / 1024).toFixed(2)} KB (${((resultsSize / totalPayloadSize) * 100).toFixed(1)}%)`);
            console.log(`  - 元数据部分: ${(metadataSize / 1024).toFixed(2)} KB (${((metadataSize / totalPayloadSize) * 100).toFixed(1)}%)`);
            console.log(`  - 🚨 总大小: ${(totalPayloadSize / 1024 / 1024).toFixed(2)} MB`);
            
            // 🔥 根据大小给出警告
            if (totalPayloadSize > 50 * 1024 * 1024) { // 50MB
                console.error(`❌ 数据量极大 (${(totalPayloadSize / 1024 / 1024).toFixed(2)} MB)，必须优化！`);
            } else if (totalPayloadSize > 16 * 1024 * 1024) { // 16MB
                console.error(`❌ 数据量过大 (${(totalPayloadSize / 1024 / 1024).toFixed(2)} MB)，可能会导致 HTTP 413 错误`);
            } else if (totalPayloadSize > 10 * 1024 * 1024) { // 10MB
                console.warn(`⚠️ 数据量较大 (${(totalPayloadSize / 1024 / 1024).toFixed(2)} MB)，建议优化`);
            } else {
                console.log(`✅ 数据量正常 (${(totalPayloadSize / 1024 / 1024).toFixed(2)} MB)`);
            }

            const response = await fetch('/api/saveAnalysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('分析结果已成功保存到 MongoDB');
            
        } catch (error) {
            console.error('保存到 MongoDB 失败:', error);
            throw error;
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.sgfAnalyzer = new SGFAnalyzer();
    }, 100);
});
