/**
 * 候选点显示模块 - 负责在棋盘上显示KataGo分析的候选落点
 */
class CandidatePointsDisplay {
    constructor(analysisStorage) {
        this.analysisStorage = analysisStorage;
        this.currentSGFHash = null;
        this.setupEventListeners();
    }

    // 设置事件监听器
    setupEventListeners() {
        // 监听候选点更新事件
        document.addEventListener('updateCandidatePoints', (event) => {
            this.displayCandidatePoints(event.detail.currentMoveIndex);
        });

        // 监听SGF哈希更新事件
        document.addEventListener('sgfHashUpdated', (event) => {
            this.currentSGFHash = event.detail.sgfHash;
        });
    }

    // 设置当前SGF哈希
    setSGFHash(sgfHash) {
        this.currentSGFHash = sgfHash;
    }

    // 显示候选点
    async displayCandidatePoints(currentMoveIndex) {
        // 清除之前的候选点
        this.clearCandidatePoints();
        
        // 如果没有分析结果，不显示候选点
        if (!this.currentSGFHash) return;
        
        try {
            // 从IndexedDB加载分析结果
            const analysisResults = await this.analysisStorage.loadAnalysisResults(this.currentSGFHash);
            
            // 找到当前步的分析结果（注意：分析结果是滞后一步的）
            const targetMoveNumber = currentMoveIndex + 1; // 当前显示的是第N步，要显示第N步的分析结果
            const currentAnalysis = analysisResults.find(result => result.moveNumber === targetMoveNumber);
            
            if (currentAnalysis && currentAnalysis.analysis && currentAnalysis.analysis.variations) {
                console.log(`显示第${targetMoveNumber}手的候选点:`, currentAnalysis.analysis.variations);
                
                // 显示前3个候选点（除了实际落子点）
                const variations = currentAnalysis.analysis.variations.slice(0, 3);
                variations.forEach((variation, index) => {
                    if (variation.moves && variation.moves.length > 0) {
                        const candidateMove = variation.moves[0]; // 取第一个候选手
                        const winRate = variation.winRate || '0.0';
                        
                        // 解析候选手位置（如 "Q16"）
                        const position = this.parseSGFPosition(candidateMove);
                        if (position) {
                            this.addCandidatePointMarker(position.row, position.col, winRate, index);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('显示候选点失败:', error);
        }
    }

    // 清除候选点
    clearCandidatePoints() {
        const candidatePoints = document.querySelectorAll('.candidate-point');
        candidatePoints.forEach(point => point.remove());
    }

    // 添加候选点标记
    addCandidatePointMarker(row, col, winRate, index) {
        const intersection = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (!intersection) {
            console.warn(`未找到交点 (${row}, ${col})`);
            return;
        }

        // 检查该位置是否已有棋子
        const existingStone = intersection.querySelector('.stone');
        if (existingStone) {
            console.log(`位置 (${row}, ${col}) 已有棋子，跳过候选点显示`);
            return;
        }

        // 创建候选点元素
        const candidatePoint = document.createElement('div');
        candidatePoint.className = 'candidate-point';
        candidatePoint.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${window.cellSize * 0.8}px;
            height: ${window.cellSize * 0.8}px;
            border: 2px solid #000;
            background-color: rgba(173, 216, 230, 0.7);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${window.cellSize * 0.25}px;
            font-weight: bold;
            color: #000;
            z-index: 10;
            pointer-events: none;
        `;
        
        // 显示胜率
        candidatePoint.textContent = `${winRate}%`;
        
        // 添加到交点
        intersection.appendChild(candidatePoint);
        
        console.log(`添加候选点 (${row}, ${col}): ${winRate}%`);
    }

    // 解析SGF位置格式（如 "Q16" -> {row: 3, col: 16}）
    parseSGFPosition(sgfPos) {
        if (!sgfPos || sgfPos.length < 2) return null;
        
        const colChar = sgfPos[0].toUpperCase();
        const rowNum = parseInt(sgfPos.slice(1));
        
        // 列转换: A-T -> 0-18 (跳过I)
        let col;
        if (colChar <= 'H') {
            col = colChar.charCodeAt(0) - 65; // A-H -> 0-7
        } else {
            col = colChar.charCodeAt(0) - 66; // J-T -> 8-18 (跳过I)
        }
        
        // 行转换: 1-19 -> 18-0 (SGF中1是底部，但显示时19是顶部)
        const row = 19 - rowNum;
        
        // 验证坐标范围
        if (row >= 0 && row < 19 && col >= 0 && col < 19) {
            return { row, col };
        }
        
        return null;
    }
}

// 创建全局函数供GoBoard12.js调用
function displayCandidatePoints(currentMoveIndex) {
    if (window.candidatePointsDisplay) {
        window.candidatePointsDisplay.displayCandidatePoints(currentMoveIndex);
    }
}