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
        console.log("🎯 CandidatePointsDisplay.displayCandidatePoints() 被调用");
        console.log("  - currentMoveIndex:", currentMoveIndex);
        console.log("  - this.currentSGFHash:", this.currentSGFHash);
        console.log("  - this.analysisStorage:", this.analysisStorage);
        
        // 清除之前的候选点
        this.clearCandidatePoints();
        
        // 如果没有分析结果，不显示候选点
        if (!this.currentSGFHash) {
            console.log("  - 没有 SGF 哈希值，跳过候选点显示");
            return;
        }
        
        // 确定下一手的颜色（即候选点的颜色）
        const nextPlayerColor = this.getNextPlayerColor(currentMoveIndex);
        console.log("  - 下一手颜色:", nextPlayerColor);
        
        try {
            // 从IndexedDB加载分析结果
            console.log("  - 开始从 IndexedDB 加载分析结果");
            const analysisResults = await this.analysisStorage.loadAnalysisResults(this.currentSGFHash);
            console.log("  - 加载到的分析结果数量:", analysisResults.length);
            console.log("  - 分析结果详情:", analysisResults);
            
            // 修复：显示当前手的分析结果，而不是下一手的
            // 分析结果的 moveNumber 是从1开始的，currentMoveIndex 是从0开始的
            const targetMoveNumber = currentMoveIndex + 1; 
            console.log("  - 查找目标步数:", targetMoveNumber);
            
            // 先尝试找当前手的分析结果
            let currentAnalysis = analysisResults.find(result => result.moveNumber === targetMoveNumber);
            
            // 如果没有找到当前手的，尝试找前一手的（显示下一手的候选点）
            if (!currentAnalysis && targetMoveNumber > 1) {
                const previousMoveNumber = targetMoveNumber - 1;
                currentAnalysis = analysisResults.find(result => result.moveNumber === previousMoveNumber);
                console.log(`  - 当前手(${targetMoveNumber})分析结果未找到，尝试使用前一手(${previousMoveNumber})的分析结果`);
            }
            
            console.log("  - 找到的分析结果:", currentAnalysis);
            
            if (currentAnalysis && currentAnalysis.analysis && currentAnalysis.analysis.variations) {
                console.log(`  - 显示第${currentAnalysis.moveNumber}手的候选点:`, currentAnalysis.analysis.variations);
                
                // 显示前5个候选点（改为5个）
                const variations = currentAnalysis.analysis.variations.slice(0, 5);
                console.log("  - 准备显示的候选点数量:", variations.length);
                
                variations.forEach((variation, index) => {
                    console.log(`  - 处理候选点 ${index}:`, variation);
                    if (variation.moves && variation.moves.length > 0) {
                        const candidateMove = variation.moves[0]; // 取第一个候选手
                        let winRate = (variation.winRate * 1).toFixed(1); // 不乘以100，保持你的原设置
                        
                        // 如果下一手是白棋，显示白棋胜率（100 - 黑棋胜率）
                        if (nextPlayerColor === 'white') {
                            winRate = (100 - parseFloat(winRate)).toFixed(1);
                        }
                        
                        console.log(`    - 候选点 ${index}: ${candidateMove}, 原始胜率: ${(variation.winRate * 1).toFixed(1)}%, 显示胜率: ${winRate}% (${nextPlayerColor})`);
                        
                        // 解析候选手位置（如 "Q16"）
                        const position = this.parseSGFPosition(candidateMove);
                        console.log(`    - 解析位置结果:`, position);
                        
                        if (position) {
                            this.addCandidatePointMarker(position.row, position.col, winRate, index, nextPlayerColor);
                        }
                    }
                });
            } else {
                console.log("  - 没有找到可用的分析结果或候选点数据");
                console.log("  - currentAnalysis 存在:", !!currentAnalysis);
                if (currentAnalysis) {
                    console.log("  - currentAnalysis.analysis 存在:", !!currentAnalysis.analysis);
                    if (currentAnalysis.analysis) {
                        console.log("  - currentAnalysis.analysis.variations 存在:", !!currentAnalysis.analysis.variations);
                        console.log("  - variations 内容:", currentAnalysis.analysis.variations);
                    }
                }
            }
        } catch (error) {
            console.error('  - 显示候选点失败:', error);
        }
    }

    // 获取下一手的颜色
    getNextPlayerColor(currentMoveIndex) {
        // 如果没有棋谱数据，默认黑棋先行
        if (!window.currentMoves || window.currentMoves.length === 0) {
            return 'black';
        }
        
        // 如果当前是开局（没有棋子），黑棋先行
        if (currentMoveIndex < 0) {
            return 'black';
        }
        
        // 如果已经到了最后一手，根据总手数判断下一手颜色
        if (currentMoveIndex >= window.currentMoves.length - 1) {
            // 总手数为偶数，下一手是黑棋；总手数为奇数，下一手是白棋
            return (window.currentMoves.length % 2 === 0) ? 'black' : 'white';
        }
        
        // 根据当前手的颜色确定下一手颜色
        const currentMove = window.currentMoves[currentMoveIndex];
        if (currentMove && currentMove.color) {
            const currentColor = currentMove.color.toLowerCase();
            if (currentColor === 'black' || currentColor === 'b') {
                return 'white';
            } else if (currentColor === 'white' || currentColor === 'w') {
                return 'black';
            }
        }
        
        // 默认情况：根据手数奇偶性判断
        return ((currentMoveIndex + 1) % 2 === 1) ? 'black' : 'white';
    }

    // 添加候选点标记
    addCandidatePointMarker(row, col, winRate, index, playerColor) {
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

        // 根据棋子颜色设置样式
        const isWhite = playerColor === 'white';
        const borderColor = isWhite ? '#fff' : '#000';
        const backgroundColor = isWhite ? 'rgba(255, 255, 255, 0.3)' : 'rgba(173, 216, 230, 0.7)';
        const textColor = isWhite ? '#000' : '#000';

        // 创建候选点元素
        const candidatePoint = document.createElement('div');
        candidatePoint.className = 'candidate-point';
        candidatePoint.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${window.cellSize * 0.9}px;
            height: ${window.cellSize * 0.9}px;
            border: 2px solid ${borderColor};
            background-color: ${backgroundColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${window.cellSize * 0.3}px;
            font-weight: bold;
            color: ${textColor};
            z-index: 10;
            pointer-events: none;
        `;
        
        // 显示胜率
        candidatePoint.textContent = `${winRate}`;
        console.log(`候选点显示胜率：${winRate}% (${playerColor})`);  
        
        // 添加到交点
        intersection.appendChild(candidatePoint);
        
        console.log(`添加候选点 (${row}, ${col}): ${winRate}% (${playerColor})`);
    }

    // 清除候选点
    clearCandidatePoints() {
        const candidatePoints = document.querySelectorAll('.candidate-point');
        candidatePoints.forEach(point => point.remove());
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
    console.log("🌟 全局 displayCandidatePoints() 被调用");
    console.log("  - 传入的 currentMoveIndex:", currentMoveIndex);
    console.log("  - 全局 currentMoveIndex:", window.currentMoveIndex);
    console.log("  - window.candidatePointsDisplay:", window.candidatePointsDisplay);
    
    if (window.candidatePointsDisplay) {
        // 如果没有传入 currentMoveIndex，使用全局的
        const moveIndex = currentMoveIndex !== undefined ? currentMoveIndex : window.currentMoveIndex;
        console.log("  - 最终使用的 moveIndex:", moveIndex);
        window.candidatePointsDisplay.displayCandidatePoints(moveIndex);
    } else {
        console.log("  - window.candidatePointsDisplay 不存在");
    }
}