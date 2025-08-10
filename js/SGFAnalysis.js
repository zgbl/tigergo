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
        } catch (error) {
            console.error('初始化失败:', error);
            this.analysisDisplay.addLogEntry('系统初始化失败', 'error');
        }

                // 延迟测试连接
        setTimeout(() => {
            this.testKataGoConnection();
        }, 1000);
    }

    setupEventListeners() {
        // 文件上传相关
        const fileInput = document.getElementById('fileInput');
        const selectFileBtn = document.getElementById('selectFileBtn');
        const analyzeFileBtn = document.getElementById('analyzeFileBtn');
        const uploadArea = document.getElementById('uploadArea');

        //console.log('🔧 设置事件监听器:');
       // console.log('  - fileInput:', fileInput);
        //console.log('  - selectFileBtn:', selectFileBtn);
        console.log('  - analyzeFileBtn:', analyzeFileBtn);
        //console.log('  - uploadArea:', uploadArea);

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        if (selectFileBtn) {
            selectFileBtn.addEventListener('click', () => fileInput?.click());
        }

        /*if (analyzeFileBtn) {
            analyzeFileBtn.addEventListener('click', () => {
                console.log('🎯 分析按钮被点击！');
                this.startAnalysis();
            });
        } */

        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput?.click());
            uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        }

        // 棋盘控制按钮
        this.setupBoardControls();
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

        // 测试 KataGo 连接
    /*async testKataGoConnection() {
        console.log("开始测试KataGo连接");
        this.updateConnectionStatus('connecting');
        const result = await this.katagoAPI.testConnection();
        
        if (result.success) {
            // 尝试获取服务器信息，但不强制要求成功
            try {
                await this.katagoAPI.getServerInfo();
            } catch (error) {
                this.addLogEntry('获取服务器详细信息失败，但基本连接正常', 'warning');
            }
        } else {
            // 如果是CORS错误，提供解决方案
            if (result.error.includes('CORS')) {
                this.addLogEntry('解决方案: 启动KataGo时添加参数 --cors-allowed-origins "*"', 'warning');
                this.addLogEntry('或者使用代理服务器解决跨域问题', 'warning');
            }
        }
    } */

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
                    console.log('成功获取服务器信息:', serverInfo);
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

    setupBoardControls() {
        const controls = {
            'logostartBtn': () => this.goToMove(0),
            'logofastBackwardBtn': () => this.goToMove(Math.max(0, this.currentMoveIndex - 10)),
            'logobackwardBtn': () => this.previousMove(),
            'logoforwardBtn': () => this.nextMove(),
            'logofastForwardBtn': () => this.goToMove(Math.min(this.gameData?.moves.length || 0, this.currentMoveIndex + 10)),
            'logoendBtn': () => this.goToLastMove(),
            'logoshowMovesBtn': () => this.toggleMoveNumbers(),
            'startBtn': () => this.goToMove(0),
            'prevBtn': () => this.previousMove(),
            'nextBtn': () => this.nextMove(),
            'endBtn': () => this.goToLastMove(),
            'autoPlayBtn': () => this.toggleAutoPlay()
        };

        Object.entries(controls).forEach(([id, handler]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', handler);
            }
        });
    }

    // 文件处理方法
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const sgfContent = await this.readFile(file);
            await this.parseSGF(sgfContent, file.name);
            this.analysisDisplay.addLogEntry(`文件 ${file.name} 上传成功`, 'success');
            
            // 启用分析按钮，确保停止按钮隐藏
            this.updateAnalysisButtons(false);
        } catch (error) {
            console.error('文件上传失败:', error);
            this.analysisDisplay.addLogEntry(`文件上传失败: ${error.message}`, 'error');
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drag-over');
    }

    async handleDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.sgf')) {
                const sgfContent = await this.readFile(file);
                await this.parseSGF(sgfContent, file.name);
            } else {
                this.analysisDisplay.addLogEntry('请选择 SGF 格式的文件', 'error');
            }
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
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

            // 渲染棋盘
            this.renderBoard();
            this.analysisDisplay.addLogEntry(`SGF 解析完成，共 ${this.gameData.moves.length} 手棋`, 'success');
            
            // 更新文件信息显示
            this.updateFileInfo(filename, this.gameData.moves.length);
            
            // 重置按钮状态为idle
            this.updateAnalysisButtons('idle');
            
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

    // 渲染棋盘
    renderBoard() {
        const boardElement = document.getElementById('board');
        if (boardElement && this.gameData) {
            console.log("准备渲染棋盘，moves格式:", this.gameData.moves.slice(0, 3));
            
            // 清空现有内容
            boardElement.innerHTML = '';
            
            // 计算棋盘大小
            const cellSize = this.calculateBoardSize();
            
            console.log('开始创建棋盘，cellSize:', cellSize);
            
            // 设置全局变量
            window.currentMoves = this.gameData.moves;
            window.currentMoveIndex = -1;
            window.displayMode = 0;
            window.showingRecentMoves = false;
            window.globalParsedMoves = {
                moves: this.gameData.moves,
                gameInfo: this.gameData.gameInfo || {}
            };
            
            // 更新CSS变量
            if (typeof updateStoneSizeCSS === 'function') {
                updateStoneSizeCSS(cellSize);
            }
            
            // 使用 createBoard3 函数创建棋盘
            if (typeof createBoard3 === 'function') {
                window.cellSize = cellSize;
                window.stoneSize = Math.floor(cellSize * 0.95);
                
                createBoard3({
                    domElement: boardElement,
                    boardSize: 19,
                    cellSize: cellSize,
                    lineColor: '#000',
                    backgroundColor: '#DEB887'
                });
                
                this.analysisDisplay.addLogEntry(`棋盘已创建，cellSize: ${cellSize}`, 'success');
                
                // 启用控制按钮
                setTimeout(() => {
                    this.enableControlButtons();
                    this.updateMoveInfo();
                }, 100);
            } else {
                console.error('createBoard3 函数未找到，请确保 GoBoard12.js 已加载');
                this.analysisDisplay.addLogEntry('棋盘创建失败：缺少必要的函数', 'error');
            }
        }
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

    // 棋盘控制方法
    goToMove(index) {
        this.currentMoveIndex = index;
        if (typeof renderMovesToIndex === 'function') {
            renderMovesToIndex(index);
        }
        this.updateMoveInfo();
    }

    previousMove() {
        if (typeof moveBackward === 'function') {
            moveBackward();
        }
        this.updateMoveInfo();
    }

    nextMove() {
        if (typeof moveForward === 'function') {
            moveForward();
        }
        this.updateMoveInfo();
    }

    goToLastMove() {
        if (typeof moveToEnd === 'function') {
            moveToEnd();
        }
        this.updateMoveInfo();
    }

    toggleMoveNumbers() {
        this.analysisDisplay.addLogEntry('显示步数功能开发中...', 'warning');
    }

    toggleAutoPlay() {
        this.analysisDisplay.addLogEntry('自动播放功能开发中...', 'warning');
    }

    // 更新移动信息
    updateMoveInfo() {
        const moveInfoElement = document.getElementById('moveInfo');
        if (moveInfoElement && this.gameData) {
            const currentIndex = window.currentMoveIndex !== undefined ? window.currentMoveIndex : this.currentMoveIndex;
            const moveNum = Math.max(0, currentIndex + 1);
            moveInfoElement.textContent = `当前步数：${moveNum} / ${this.gameData.moves.length}`;
        }
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
                analysisResults: analysisResults,
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
