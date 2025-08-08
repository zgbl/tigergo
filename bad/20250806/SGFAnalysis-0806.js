// SGF 分析页面主控制器 - 完整功能版本

class SGFAnalyzer {
    constructor() {
        // 等待DOM和所有依赖加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        try {
            // 检查依赖是否加载
            if (typeof SGFParser === 'undefined') {
                throw new Error('SGFParser模块未加载');
            }
            if (typeof KataGoAPI === 'undefined') {
                throw new Error('KataGoAPI模块未加载');
            }
            if (typeof CONFIG === 'undefined') {
                throw new Error('CONFIG配置未加载');
            }

            // 初始化模块
            this.sgfParser = new SGFParser();
            this.katagoAPI = new KataGoAPI(CONFIG.KATAGO_BASE_URL, CONFIG.KATAGO_BOT_NAME);
            
            // 初始化状态
            this.sgfContent = null;
            this.gameData = null;
            this.analysisResults = [];
            this.currentMoveIndex = 0;
            this.isAnalyzing = false;
            this.analysisAborted = false;
            this.logEntries = [];
            this.selectedFile = null;
            
            // 添加初始化日志
            this.addLogEntry('SGF分析器初始化完成', 'success');
            this.addLogEntry(`KataGo服务地址: ${CONFIG.KATAGO_BASE_URL}`, 'info');
            
            this.initializeEventListeners();
            this.updateUI();
            
            // 延迟测试连接
            setTimeout(() => {
                this.testKataGoConnection();
            }, 1000);
            
            console.log('✅ SGF分析器初始化完成');
        } catch (error) {
            console.error('❌ SGF分析器初始化失败:', error);
            const logContainer = document.getElementById('analysisLog');
            if (logContainer) {
                this.addLogEntry(`初始化失败: ${error.message}`, 'error');
            } else {
                alert(`初始化失败: ${error.message}`);
            }
        }
    }

    initializeEventListeners() {
        try {
            // 文件上传相关
            const fileInput = document.getElementById('fileInput');
            const uploadArea = document.getElementById('uploadArea');
            const selectFileBtn = document.getElementById('selectFileBtn');
            const analyzeFileBtn = document.getElementById('analyzeFileBtn');
            
            if (!fileInput || !uploadArea || !selectFileBtn || !analyzeFileBtn) {
                throw new Error('文件上传元素未找到');
            }
            
            // 文件选择事件
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
            
            // 选择文件按钮
            selectFileBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            // 开始分析按钮
            analyzeFileBtn.addEventListener('click', () => {
                if (this.selectedFile && this.gameData) {
                    this.startAnalysis();
                }
            });
            
            // 拖拽上传
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFile(files[0]);
                }
            });
            
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });

            // 分析设置
            const analysisRange = document.getElementById('analysisRange');
            if (analysisRange) {
                analysisRange.addEventListener('change', (e) => {
                    const customGroup = document.getElementById('customRangeGroup');
                    if (customGroup) {
                        customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
                    }
                });
            }

            // 控制按钮
            const buttons = [
                { id: 'startBtn', handler: () => this.goToMove(0) },
                { id: 'prevBtn', handler: () => this.previousMove() },
                { id: 'nextBtn', handler: () => this.nextMove() },
                { id: 'endBtn', handler: () => this.goToLastMove() },
                { id: 'autoPlayBtn', handler: () => this.toggleAutoPlay() }
            ];

            buttons.forEach(({ id, handler }) => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.addEventListener('click', handler);
                } else {
                    console.warn(`按钮 ${id} 未找到`);
                }
            });

            // 监听KataGo状态事件
            window.addEventListener('katagoStatus', (e) => {
                this.handleKataGoStatus(e.detail);
            });

            this.addLogEntry('事件监听器初始化完成', 'success');
        } catch (error) {
            console.error('事件监听器初始化失败:', error);
            this.addLogEntry(`事件监听器初始化失败: ${error.message}`, 'error');
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

    // 测试 KataGo 连接
    async testKataGoConnection() {
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

    // 添加日志条目
    addLogEntry(message, type = 'info') {
        const logContainer = document.getElementById('analysisLog');
        if (!logContainer) {
            console.log(`[LOG-${type.toUpperCase()}] ${message}`);
            return;
        }
        
        const timestamp = new Date().toLocaleTimeString();
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        logContainer.appendChild(logEntry);
        
        // 保持最多50条日志
        const entries = logContainer.querySelectorAll('.log-entry');
        if (entries.length > 50) {
            entries[0].remove();
        }
        
        // 自动滚动到底部
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    handleFile(file) {
        try {
            if (!file.name.toLowerCase().endsWith('.sgf')) {
                this.addLogEntry('请选择 SGF 格式的棋谱文件', 'error');
                alert('请选择 SGF 格式的棋谱文件');
                return;
            }

            this.selectedFile = file;
            this.addLogEntry(`文件已选择: ${file.name}`, 'success');

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    this.sgfContent = e.target.result;
                    this.parseSGF(this.sgfContent);
                    this.showFileInfo(file);
                    this.updateUI();
                } catch (error) {
                    this.addLogEntry(`文件读取失败: ${error.message}`, 'error');
                }
            };
            
            reader.onerror = () => {
                this.addLogEntry('文件读取失败', 'error');
            };
            
            reader.readAsText(file);
        } catch (error) {
            this.addLogEntry(`文件处理失败: ${error.message}`, 'error');
        }
    }

    showFileInfo(file) {
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileDetails = document.getElementById('fileDetails');
        
        if (fileName) fileName.textContent = file.name;
        if (fileDetails) {
            fileDetails.textContent = `文件大小: ${(file.size / 1024).toFixed(1)} KB | 上传时间: ${new Date().toLocaleString()}`;
        }
        if (fileInfo) fileInfo.classList.add('show');
    }

    parseSGF(sgfContent) {
        try {
            // 验证SGF格式
            const validation = this.sgfParser.validateSGF(sgfContent);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            // 解析SGF内容
            this.gameData = {
                moves: this.sgfParser.parseSGFMoves(sgfContent),
                gameInfo: this.sgfParser.extractGameInfo(sgfContent)
            };
            
            console.log(`✅ SGF 解析完成，共 ${this.gameData.moves.length} 手棋`);
            this.addLogEntry(`SGF 解析完成，共 ${this.gameData.moves.length} 手棋`, 'success');
            
            // 显示游戏信息
            if (this.gameData.gameInfo.blackPlayer) {
                this.addLogEntry(`黑方: ${this.gameData.gameInfo.blackPlayer}`, 'info');
            }
            if (this.gameData.gameInfo.whitePlayer) {
                this.addLogEntry(`白方: ${this.gameData.gameInfo.whitePlayer}`, 'info');
            }
            
            // 显示着法预览
            const preview = this.sgfParser.getMovesPreview(this.gameData.moves, 3);
            preview.forEach(line => {
                this.addLogEntry(line, 'info');
            });
            
            this.renderBoard();
            
        } catch (error) {
            console.error('SGF 解析错误:', error);
            this.addLogEntry(`SGF 解析失败: ${error.message}`, 'error');
            alert('SGF 文件解析失败，请检查文件格式');
        }
    }

    renderBoard() {
        // 使用 Post11.html 的棋盘绘制方法
        const boardPlaceholder = document.getElementById('boardPlaceholder');
        if (boardPlaceholder && this.gameData) {
            // 清空占位符内容
            boardPlaceholder.innerHTML = '<div id="board"></div>';
            
            // 获取棋盘容器
            const boardElement = document.getElementById('board');
            if (boardElement) {
                // 计算棋盘大小
                const cellSize = this.calculateBoardSize();
                
                // 使用 createBoard3 函数创建棋盘
                if (typeof createBoard3 === 'function') {
                    // 设置全局 cellSize 变量供 GoBoard12.js 使用
                    window.cellSize = cellSize;
                    
                    createBoard3({
                        domElement: boardElement,
                        boardSize: 19,
                        cellSize: cellSize,
                        lineColor: '#000',
                        backgroundColor: '#DEB887'
                    });
                    
                    this.addLogEntry(`棋盘已创建，cellSize: ${cellSize}`, 'success');
                    
                    // 如果有棋谱数据，渲染棋谱
                    if (this.gameData.moves && this.gameData.moves.length > 0) {
                        // 设置全局变量供 GoBoard12.js 使用
                        window.globalParsedMoves = {
                            moves: this.gameData.moves,
                            gameInfo: this.gameData.gameInfo || {}
                        };
                        
                        // 延迟一下再渲染棋子，确保棋盘已经创建完成
                        setTimeout(() => {
                            if (typeof renderMoves === 'function') {
                                renderMoves(this.gameData.moves);
                                this.addLogEntry(`棋谱已渲染，共 ${this.gameData.moves.length} 手棋`, 'success');
                            } else {
                                this.addLogEntry('renderMoves 函数未找到', 'warning');
                            }
                        }, 100);
                    }
                } else {
                    console.error('createBoard3 函数未找到，请确保 GoBoard12.js 已加载');
                    this.addLogEntry('棋盘创建失败：缺少必要的函数', 'error');
                }
            }
        }
    }

    // 计算棋盘大小的函数（完全参考 Post11.html 的实现）
    calculateBoardSize() {
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        const maxWinSize = 3000;
        const minWinSize = 300;
        
        let cellSizeFromWidth, cellSizeFromHeight;
        
        // 根据宽度计算 cellSize
        if (winWidth < 480) {
            cellSizeFromWidth = Math.floor((winWidth - 20) / 20); // 为边框留出一些空间
            if (winWidth < minWinSize) {
                cellSizeFromWidth = Math.floor((minWinSize - 20) / 20);
            }
        } else if (winWidth > 768) {
            cellSizeFromWidth = Math.floor(winWidth / 28);
            if (winWidth > maxWinSize) {
                cellSizeFromWidth = Math.floor(maxWinSize / 28);
            }
        } else {
            cellSizeFromWidth = 30; // 默认尺寸
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
            cellSizeFromHeight = 30; // 默认尺寸
        }

        // 取宽度和高度计算结果中的较小值
        let cellSize = Math.min(cellSizeFromWidth, cellSizeFromHeight);
        
        // 确保 cellSize 在合理范围内
        cellSize = Math.max(15, Math.min(cellSize, 50));
        
        console.log('计算的 cellSize:', cellSize);
        return cellSize;
    }

    renderBoard() {
        const boardPlaceholder = document.getElementById('boardPlaceholder');
        if (boardPlaceholder && this.gameData) {
            // 清空占位符内容
            boardPlaceholder.innerHTML = '<div id="board"></div>';
            
            // 获取棋盘容器
            const boardElement = document.getElementById('board');
            if (boardElement) {
                // 计算棋盘大小
                const cellSize = this.calculateBoardSize();
                
                console.log('开始创建棋盘，cellSize:', cellSize);
                
                // 使用 createBoard3 函数创建棋盘
                if (typeof createBoard3 === 'function') {
                    // 设置全局 cellSize 变量供 GoBoard12.js 使用
                    window.cellSize = cellSize;
                    
                    createBoard3({
                        domElement: boardElement,
                        boardSize: 19,
                        cellSize: cellSize,
                        lineColor: '#000',
                        backgroundColor: '#DEB887'
                    });
                    
                    this.addLogEntry(`棋盘已创建，cellSize: ${cellSize}`, 'success');
                    
                    // 如果有棋谱数据，渲染棋谱
                    if (this.gameData.moves && this.gameData.moves.length > 0) {
                        // 设置全局变量供 GoBoard12.js 使用
                        window.globalParsedMoves = {
                            moves: this.gameData.moves,
                            gameInfo: this.gameData.gameInfo || {}
                        };
                        
                        // 渲染棋谱
                        if (typeof renderMoves === 'function') {
                            renderMoves(this.gameData.moves);
                        }
                    }
                    
                    this.addLogEntry(`棋盘已创建，共 ${this.gameData.moves.length} 手棋`, 'success');
                } else {
                    console.error('createBoard3 函数未找到，请确保 GoBoard12.js 已加载');
                    this.addLogEntry('棋盘创建失败：缺少必要的函数', 'error');
                }
            }
        }
    }

    // 棋盘控制方法 - 使用 GoBoard12.js 的函数
    goToMove(index) {
        this.currentMoveIndex = index;
        if (typeof moveToStart === 'function' && index === 0) {
            moveToStart();
        } else if (typeof goToMove === 'function') {
            // 如果 GoBoard12.js 有 goToMove 函数
            goToMove(index);
        }
        this.addLogEntry(`跳转到第 ${index} 手`, 'info');
        this.updateUI();
    }

    previousMove() {
        if (this.currentMoveIndex > 0) {
            this.currentMoveIndex--;
            if (typeof moveBackward === 'function') {
                moveBackward();
            }
            this.addLogEntry(`上一手: 第 ${this.currentMoveIndex} 手`, 'info');
            this.updateUI();
        }
    }

    nextMove() {
        if (this.gameData && this.currentMoveIndex < this.gameData.moves.length) {
            this.currentMoveIndex++;
            if (typeof moveForward === 'function') {
                moveForward();
            }
            this.addLogEntry(`下一手: 第 ${this.currentMoveIndex} 手`, 'info');
            this.updateUI();
        }
    }

    goToLastMove() {
        if (this.gameData) {
            this.currentMoveIndex = this.gameData.moves.length;
            if (typeof moveToEnd === 'function') {
                moveToEnd();
            }
            this.addLogEntry(`跳转到最后一手: 第 ${this.currentMoveIndex} 手`, 'info');
            this.updateUI();
        }
    }

    // 更新UI状态
    updateUI() {
        try {
            // 更新文件信息显示
            const fileInfo = document.getElementById('fileInfo');
            const analyzeFileBtn = document.getElementById('analyzeFileBtn');
            
            if (this.selectedFile && this.gameData) {
                if (fileInfo) fileInfo.classList.add('show');
                if (analyzeFileBtn) {
                    analyzeFileBtn.disabled = false;
                    analyzeFileBtn.textContent = '开始分析';
                }
            } else {
                if (analyzeFileBtn) {
                    analyzeFileBtn.disabled = true;
                    analyzeFileBtn.textContent = '请先上传SGF文件';
                }
            }
            
            // 更新棋盘控制按钮状态
            const buttons = ['startBtn', 'prevBtn', 'nextBtn', 'endBtn'];
            const hasGameData = this.gameData && this.gameData.moves && this.gameData.moves.length > 0;
            
            buttons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.disabled = !hasGameData;
                }
            });
            
            // 更新当前手数显示
            if (hasGameData) {
                const currentMoveDisplay = document.getElementById('currentMoveDisplay');
                if (currentMoveDisplay) {
                    currentMoveDisplay.textContent = `第 ${this.currentMoveIndex} / ${this.gameData.moves.length} 手`;
                }
            }
            
            // 更新分析状态
            const analysisStatus = document.getElementById('analysisStatus');
            if (analysisStatus) {
                if (this.isAnalyzing) {
                    analysisStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在分析中...';
                    analysisStatus.className = 'analysis-status analyzing';
                } else if (this.analysisResults.length > 0) {
                    analysisStatus.innerHTML = '<i class="fas fa-check-circle"></i> 分析完成';
                    analysisStatus.className = 'analysis-status completed';
                } else {
                    analysisStatus.innerHTML = '<i class="fas fa-clock"></i> 等待分析';
                    analysisStatus.className = 'analysis-status waiting';
                }
            }
            
        } catch (error) {
            console.error('更新UI失败:', error);
        }
    }

    toggleAutoPlay() {
        this.addLogEntry('自动播放功能开发中...', 'warning');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 确保所有依赖都已加载
    setTimeout(() => {
        window.sgfAnalyzer = new SGFAnalyzer();
    }, 100);
});