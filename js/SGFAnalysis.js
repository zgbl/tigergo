// SGF 分析页面主控制器 - 修复版本
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
            this.currentMoveIndex = 1;
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

            // 控制按钮 - 使用原始按钮
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

    // 带调试信息的 parseSGF 方法
    parseSGF(sgfContent) {
        console.log("🔥 parseSGF 方法被调用了！");
        
        try {
            console.log("🔥 开始验证SGF格式...");
            // 验证SGF格式
            const validation = this.sgfParser.validateSGF(sgfContent);
            if (!validation.valid) {
                console.log("❌ SGF验证失败:", validation.error);
                throw new Error(validation.error);
            }
            console.log("✅ SGF格式验证通过");
            
            console.log("🔥 开始解析SGF moves...");
            // 解析SGF内容
            const rawMoves = this.sgfParser.parseSGFMoves(sgfContent);
            console.log("✅ SGF moves解析完成，rawMoves数量:", rawMoves.length);
            console.log("rawMoves前3手:", rawMoves.slice(0, 3));
            
            console.log("🔥 准备调用 convertMovesToGoBoard12Format...");
            // 转换为GoBoard12.js期望的格式
            const convertedMoves = this.convertMovesToGoBoard12Format(rawMoves);
            console.log("✅ convertMovesToGoBoard12Format 调用完成");
            console.log("convertedMoves前3手:", convertedMoves.slice(0, 3));
            
            this.gameData = {
                moves: convertedMoves, // 用于棋盘显示的格式
                rawMoves: rawMoves,    // 保存原始KataGo格式用于API调用
                gameInfo: this.sgfParser.extractGameInfo(sgfContent)
            };
            
            console.log(`✅ SGF 解析完成，共 ${this.gameData.moves.length} 手棋`);
            console.log('最终gameData.moves格式:', this.gameData.moves.slice(0, 3)); // 显示前3手
            console.log('rawMoves格式:', this.gameData.rawMoves.slice(0, 3)); // 显示前3手
            
            this.addLogEntry(`SGF 解析完成，共 ${this.gameData.moves.length} 手棋`, 'success');
            
            // 显示游戏信息
            if (this.gameData.gameInfo.blackPlayer) {
                this.addLogEntry(`黑方: ${this.gameData.gameInfo.blackPlayer}`, 'info');
            }
            if (this.gameData.gameInfo.whitePlayer) {
                this.addLogEntry(`白方: ${this.gameData.gameInfo.whitePlayer}`, 'info');
            }
            
            console.log("🔥 准备调用 renderBoard...");
            this.renderBoard();
            console.log("✅ renderBoard 调用完成");
            
        } catch (error) {
            console.error('❌ SGF 解析错误:', error);
            console.error('错误发生在:', error.stack);
            this.addLogEntry(`SGF 解析失败: ${error.message}`, 'error');
            alert('SGF 文件解析失败，请检查文件格式');
        }
    }

    // 添加这个辅助函数来转换坐标格式  2025.8.7
    convertMovesToGoBoard12Format(moves) {
        console.log("调用了convertMovesToGoBoard12Format")
        return moves.map(move => {
            const [color, position] = move;
            
            if (position === 'pass') {
                const normalizedColor = color === 'B' ? 'black' : 'white';  //颜色用black/white 表示 2025.8.7
                return { pass: true, color: color.toLowerCase() };
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

            // 修改这里：将 B/W 转换为 black/white 而不是 b/w
            //const normalizedColor = color === 'B' ? 'black' : 'white';
            const normalizedColor = (color && color.toUpperCase() === 'B') ? 'black' : 'white';
            //console.log("convertMovesToGoBoard12Format, color =", color,) 
            console.log("convertMovesToGoBoard12Format, color =", color, "normalizedColor =", normalizedColor) 
            
            return {
                row: rowIndex,
                col: colIndex,
                //color: color.toLowerCase()  //b，w 问题的罪魁祸首
                color: normalizedColor  //这里应该是 black/white
            };
        });
    }


    // 同时修改 renderBoard 方法中设置全局变量的部分  2025.8.7
    renderBoard() {
        const boardElement = document.getElementById('board');
        if (boardElement && this.gameData) {
            console.log("准备渲染棋盘，moves格式:", this.gameData.moves.slice(0, 3));
            
            // 清空现有内容
            boardElement.innerHTML = '';
            
            // 计算棋盘大小
            const cellSize = this.calculateBoardSize();
            
            console.log('开始创建棋盘，cellSize:', cellSize);
            
            // 🔥 重要：在创建棋盘之前设置全局变量
            window.currentMoves = this.gameData.moves; // 这里的color 有问题。
            console.log("可能这里的move 格式有问题，SGFAnalysis.js line 400", this.gameData.moves)
            window.currentMoveIndex = -1; // 2025.8.7 还是应该 -1
            window.displayMode = 0;
            window.showingRecentMoves = false;
            window.globalParsedMoves = {
                moves: this.gameData.moves,
                gameInfo: this.gameData.gameInfo || {}
            };
            
            // 调试输出
            console.log('设置的全局变量:');
            console.log('window.currentMoves:', window.currentMoves);
            console.log('window.currentMoveIndex:', window.currentMoveIndex);
            console.log('棋谱总手数:', this.gameData.moves.length);
            
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
                
                this.addLogEntry(`棋盘已创建，cellSize: ${cellSize}`, 'success');
                
                // 渲染棋谱 - 但不要调用 renderMoves，因为我们要通过控制按钮逐步显示
                if (this.gameData.moves && this.gameData.moves.length > 0) {
                    setTimeout(() => {
                        // 验证全局变量是否正确设置
                        if (window.currentMoves && window.currentMoves.length > 0) {
                            this.addLogEntry(`棋谱数据已加载，共 ${this.gameData.moves.length} 手棋`, 'success');
                            
                            // 启用控制按钮
                            this.enableControlButtons();
                            
                            // 显示第一手棋的信息（但不在棋盘上显示）
                            this.updateMoveInfo();
                        } else {
                            this.addLogEntry('全局变量设置失败', 'error');
                            console.error('window.currentMoves:', window.currentMoves);
                        }
                    }, 100);
                }
            } else {
                console.error('createBoard3 函数未找到，请确保 GoBoard12.js 已加载');
                this.addLogEntry('棋盘创建失败：缺少必要的函数', 'error');
            }
        } else {
            console.error('board元素未找到或gameData为空');
            this.addLogEntry('棋盘容器未找到', 'error');
        }
    }

    // 添加一个更新手数信息的方法
    updateMoveInfo() {
        const currentMoveElement = document.getElementById('currentMove');
        if (currentMoveElement && this.gameData) {
            const moveNum = Math.max(0, window.currentMoveIndex + 1);
            currentMoveElement.textContent = `${moveNum} / ${this.gameData.moves.length}`;
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

    // 添加启用控制按钮的方法  2025.8.7
    enableControlButtons() {
        // 启用icon控制按钮
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
        
        // 启用原始控制按钮
        const originalButtons = ['startBtn', 'prevBtn', 'nextBtn', 'endBtn', 'autoPlayBtn'];
        originalButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = false;
            }
        });
        
        this.addLogEntry('控制按钮已启用', 'success');
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
        console.log("SGFAnalysis.js nextMove() 被调用, Line 655");
        console.log("当前 currentMoveIndex:", window.currentMoveIndex);
        console.log("当前 currentMoves 长度:", window.currentMoves ? window.currentMoves.length : 'undefined');
        
        if (window.currentMoves && window.currentMoves.length > 0) {
            if (window.currentMoveIndex < window.currentMoves.length - 1) {
                // 调用 GoBoard12.js 的 moveForward 函数
                if (typeof moveForward === 'function') {
                    moveForward();
                    
                    // 更新本地索引（moveForward会更新window.currentMoveIndex）
                    this.currentMoveIndex = window.currentMoveIndex;
                    
                    this.addLogEntry(`下一手: 第 ${this.currentMoveIndex + 1} 手`, 'info');
                    this.updateMoveInfo();
                } else {
                    this.addLogEntry('moveForward 函数未找到', 'error');
                }
            } else {
                this.addLogEntry('已经是最后一手了', 'warning');
            }
        } else {
            this.addLogEntry('没有棋谱数据或数据为空', 'error');
            console.error('window.currentMoves:', window.currentMoves);
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

    // 开始分析功能
    async startAnalysis() {
        if (!this.gameData || this.gameData.moves.length === 0) {
            this.addLogEntry('没有可分析的棋谱数据', 'error');
        } else {
            console.log("📊 this.gameData.moves.length =", this.gameData.moves.length);
        }

        if (!this.gameData || this.gameData.moves.length === 0) {
            this.addLogEntry('没有可分析的棋谱数据', 'error');
            console.warn("⛔ 提前 return，因为 gameData 为空或 moves.length=0");
            return;
        }

        if (this.isAnalyzing) {
            this.addLogEntry('分析正在进行中...', 'warning');
            return;
        }

        console.log("✅ 通过了初始检查");

        try {
            this.isAnalyzing = true;
            this.analysisAborted = false;
            this.analysisResults = [];
            
            // 获取分析设置
            const analysisDepth = document.getElementById('analysisDepth').value;
            const analysisRange = document.getElementById('analysisRange').value;
            
            // 计算分析范围
            let startMove = 1;
            let endMove = this.gameData.moves.length;
            
            switch (analysisRange) {
                case 'opening':
                    endMove = Math.min(50, this.gameData.moves.length);
                    break;
                case 'middle':
                    startMove = 51;
                    endMove = Math.min(150, this.gameData.moves.length);
                    break;
                case 'endgame':
                    startMove = 151;
                    break;
                case 'custom':
                    startMove = parseInt(document.getElementById('startMove').value) || 1;
                    endMove = parseInt(document.getElementById('endMove').value) || this.gameData.moves.length;
                    break;
            }
            
            // 确保范围有效
            startMove = Math.max(1, Math.min(startMove, this.gameData.moves.length));
            endMove = Math.max(startMove, Math.min(endMove, this.gameData.moves.length));
            
            this.addLogEntry(`开始分析: 第${startMove}-${endMove}手 (${analysisDepth}模式)`, 'success');
            
            // 更新状态
            const analysisStatus = document.getElementById('analysisStatus');
            if (analysisStatus) analysisStatus.textContent = '正在分析...';
            
            // 逐步分析每一手
            for (let moveIndex = startMove; moveIndex <= endMove; moveIndex++) {
                if (this.analysisAborted) {
                    this.addLogEntry('分析已中止', 'warning');
                    break;
                }
                
                // 更新进度
                const progress = ((moveIndex - startMove + 1) / (endMove - startMove + 1)) * 100;
                this.updateProgress(progress, moveIndex, endMove);

                // 同步显示棋盘状态到当前分析的步数
                console.log("typeof renderMovesToIndex is:",typeof renderMovesToIndex , "是不是 = function ?");
                if (typeof renderMovesToIndex === 'function') {
                    renderMovesToIndex(moveIndex - 1); // moveIndex是1-based，renderMovesToIndex需要0-based
                    console.log('应该renderMOveToIndex 到 第', moveIndex -1, '步')
                    this.addLogEntry(`棋盘已同步到第${moveIndex}手`, 'info');
                }

                // 分析当前局面
                const currentMove = this.gameData.moves[moveIndex - 1];
                this.addLogEntry(`分析第${moveIndex}手: ${currentMove[0]} ${currentMove[1]}`, 'info');
                
                try {

                    console.log("this.gameData.rawMoves:", this.gameData.rawMoves);  // 调试确认move 格式， 2025.8.6
                    const result = await this.katagoAPI.analyzePosition(this.gameData.rawMoves, moveIndex);
                    
                    if (result.success) {
                        this.analysisResults.push({
                            moveNumber: moveIndex,
                            move: currentMove,
                            analysis: result.data
                        });
                        
                        // 显示分析结果
                        const formattedResult = this.katagoAPI.formatAnalysisResult(result, moveIndex, currentMove);
                        this.addLogEntry(formattedResult, 'success');
                        this.updateAnalysisResults(result.data, moveIndex, currentMove);
                    } else {
                        this.addLogEntry(`第${moveIndex}手分析失败: ${result.error}`, 'error');
                    }
                } catch (error) {
                    this.addLogEntry(`第${moveIndex}手分析异常: ${error.message}`, 'error');
                }
                
                // 根据分析深度添加延迟
                const delays = { fast: 1000, normal: 2000, deep: 3000, ultra: 4000 };
                await this.sleep(delays[analysisDepth] || 2000);
            }
            
            this.addLogEntry('分析完成！', 'success');
            if (analysisStatus) analysisStatus.textContent = '分析完成';
            
        } catch (error) {
            this.addLogEntry(`分析失败: ${error.message}`, 'error');
        } finally {
            this.isAnalyzing = false;
        }
    }


    // 模拟分析功能（后续替换为真实的KataGo调用）
    async simulateAnalysis(move, depth) {
        const analysisTime = {
            'fast': 1000,
            'normal': 2000,
            'deep': 3000,
            'ultra': 5000
        };
        
        await new Promise(resolve => setTimeout(resolve, analysisTime[depth] || 2000));
        
        // 模拟分析结果
        const result = {
            move: move,
            evaluation: Math.random() * 0.4 - 0.2, // -0.2 到 0.2 的随机评估
            bestMoves: [
                { move: 'D4', visits: 1000, winRate: 0.52 },
                { move: 'Q16', visits: 800, winRate: 0.51 },
                { move: 'D16', visits: 600, winRate: 0.50 }
            ]
        };
        
        this.analysisResults.push(result);
        return result;
    }

    // 更新进度显示
    updateProgress(percentage, current, total) {
        const progressFill = document.getElementById('progressFill');
        const analysisProgress = document.getElementById('analysisProgress');
        const currentMove = document.getElementById('currentMove');
        const estimatedTime = document.getElementById('estimatedTime');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (analysisProgress) {
            analysisProgress.textContent = `${percentage}%`;
        }
        
        if (currentMove) {
            currentMove.textContent = `${current} / ${total}`;
        }
        
        // 估算剩余时间（简单计算）
        if (estimatedTime && percentage > 0 && percentage < 100) {
            const elapsed = Date.now() - (this.analysisStartTime || Date.now());
            const remainingTime = Math.round((elapsed / percentage) * (100 - percentage) / 1000);
            estimatedTime.textContent = `约 ${remainingTime} 秒`;
        } else if (estimatedTime && percentage >= 100) {
            estimatedTime.textContent = '已完成';
        }
    }

        // 更新分析结果显示
    updateAnalysisResults(analysisData, moveNumber, currentMove) {
        const resultsContainer = document.getElementById('analysisResults');
        if (!resultsContainer) return;
        
        // 创建结果条目
        const resultEntry = document.createElement('div');
        resultEntry.className = 'result-entry';
        resultEntry.style.cssText = 'margin-bottom: 10px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 0.85em;';
        
        const winrate = analysisData.winrate ? `${(analysisData.winrate * 100).toFixed(1)}%` : 'N/A';
        const botMove = analysisData.bot_move || 'N/A';
        
        resultEntry.innerHTML = `
            <strong>第${moveNumber}手:</strong> ${currentMove[0]} ${currentMove[1]}<br>
            <span style="color: #28a745;">推荐:</span> ${botMove} | 
            <span style="color: #007bff;">胜率:</span> ${winrate}
        `;
        
        resultsContainer.appendChild(resultEntry);
        
        // 保持最多显示最近10个结果
        const entries = resultsContainer.querySelectorAll('.result-entry');
        if (entries.length > 10) {
            entries[0].remove();
        }
        
        // 自动滚动到底部
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
    }

        // 工具函数
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
                    if (this.isAnalyzing) {
                        analyzeFileBtn.disabled = true;
                        analyzeFileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';
                    } else {
                        analyzeFileBtn.disabled = false;
                        analyzeFileBtn.innerHTML = '<i class="fas fa-play-circle"></i> 开始分析';
                    }
                }
            } else {
                if (analyzeFileBtn) {
                    analyzeFileBtn.disabled = true;
                    analyzeFileBtn.innerHTML = '<i class="fas fa-upload"></i> 请先上传SGF文件';
                }
            }
            
            // 更新棋盘控制按钮状态
            const buttons = ['startBtn', 'prevBtn', 'nextBtn', 'endBtn'];
            const hasGameData = this.gameData && this.gameData.moves && this.gameData.moves.length > 0;
            
            buttons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.disabled = !hasGameData || this.isAnalyzing;
                }
            });
            
            // 更新当前手数显示
            if (hasGameData) {
                const currentMoveElement = document.getElementById('currentMove');
                if (currentMoveElement) {
                    currentMoveElement.textContent = `${this.currentMoveIndex} / ${this.gameData.moves.length}`;
                }
            }
            
            // 更新分析状态显示
            const analysisStatus = document.getElementById('analysisStatus');
            if (analysisStatus) {
                if (this.isAnalyzing) {
                    analysisStatus.textContent = '正在分析中...';
                } else if (this.analysisResults.length > 0) {
                    analysisStatus.textContent = '分析完成';
                } else if (this.gameData) {
                    analysisStatus.textContent = '准备就绪';
                } else {
                    analysisStatus.textContent = '等待上传';
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
