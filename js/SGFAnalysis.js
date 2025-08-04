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
        // 棋盘渲染占位符
        const boardPlaceholder = document.getElementById('boardPlaceholder');
        if (boardPlaceholder && this.gameData) {
            boardPlaceholder.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-chess-board" style="font-size: 2.5em; color: #8B4513; margin-bottom: 15px;"></i>
                    <h3 style="color: #8B4513; margin-bottom: 10px;">棋谱已加载</h3>
                    <p style="color: #666;">共 ${this.gameData.moves.length} 手棋</p>
                    <p style="color: #666; font-size: 0.9em;">点击"开始分析"按钮进行AI分析</p>
                </div>
            `;
        }
    }

    updateUI() {
        // 更新UI状态
        const hasGameData = this.gameData && this.gameData.moves.length > 0;
        
        // 启用/禁用分析按钮
        const analyzeFileBtn = document.getElementById('analyzeFileBtn');
        if (analyzeFileBtn) {
            analyzeFileBtn.disabled = !hasGameData;
        }
        
        // 启用/禁用控制按钮
        const controlButtons = ['startBtn', 'prevBtn', 'nextBtn', 'endBtn', 'autoPlayBtn'];
        controlButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = !hasGameData;
            }
        });
        
        // 更新状态显示
        const analysisStatus = document.getElementById('analysisStatus');
        if (analysisStatus) {
            if (hasGameData) {
                analysisStatus.textContent = '准备分析';
            } else {
                analysisStatus.textContent = '等待上传';
            }
        }
        
        const currentMove = document.getElementById('currentMove');
        if (currentMove && hasGameData) {
            currentMove.textContent = `${this.currentMoveIndex} / ${this.gameData.moves.length}`;
        }
    }

    // 开始分析 - 实现真正的KataGo分析
    async startAnalysis() {
        if (!this.gameData || this.gameData.moves.length === 0) {
            this.addLogEntry('没有可分析的棋谱数据', 'error');
            return;
        }

        if (this.isAnalyzing) {
            this.addLogEntry('分析正在进行中...', 'warning');
            return;
        }

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
                
                // 分析当前局面
                const currentMove = this.gameData.moves[moveIndex - 1];
                this.addLogEntry(`分析第${moveIndex}手: ${currentMove[0]} ${currentMove[1]}`, 'info');
                
                try {
                    const result = await this.katagoAPI.analyzePosition(this.gameData.moves, moveIndex);
                    
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

    // 更新分析进度
    updateProgress(percentage, currentMove, totalMoves) {
        const progressFill = document.getElementById('progressFill');
        const analysisProgress = document.getElementById('analysisProgress');
        const currentMoveElement = document.getElementById('currentMove');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (analysisProgress) {
            analysisProgress.textContent = `${percentage.toFixed(1)}%`;
        }
        
        if (currentMoveElement) {
            currentMoveElement.textContent = `${currentMove} / ${totalMoves}`;
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

    // 棋盘控制方法 - 占位符实现
    goToMove(index) {
        this.currentMoveIndex = index;
        this.addLogEntry(`跳转到第 ${index} 手`, 'info');
        this.updateUI();
    }

    previousMove() {
        if (this.currentMoveIndex > 0) {
            this.currentMoveIndex--;
            this.addLogEntry(`上一手: 第 ${this.currentMoveIndex} 手`, 'info');
            this.updateUI();
        }
    }

    nextMove() {
        if (this.gameData && this.currentMoveIndex < this.gameData.moves.length) {
            this.currentMoveIndex++;
            this.addLogEntry(`下一手: 第 ${this.currentMoveIndex} 手`, 'info');
            this.updateUI();
        }
    }

    goToLastMove() {
        if (this.gameData) {
            this.currentMoveIndex = this.gameData.moves.length;
            this.addLogEntry(`跳转到最后一手: 第 ${this.currentMoveIndex} 手`, 'info');
            this.updateUI();
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