/**
 * 测试题生成器
 * 负责从SGF分析结果中生成围棋测试题
 */
class TestQuestionGenerator {
    constructor(sgfAnalyzer) {
        this.sgfAnalyzer = sgfAnalyzer;
        this.setupEventListeners();
        // 🔥 立即检查按钮状态
        this.updateTestGenerationButtons();
    }

    // 设置事件监听器
    setupEventListeners() {
        const generateBtn = document.getElementById('generateTestBtn');
        const previewBtn = document.getElementById('previewTestBtn');
        
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateTestQuestions();
            });
        }
        
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                this.previewTestQuestions();
            });
        }

        // 监听SGF加载完成事件
        document.addEventListener('sgfLoaded', () => {
            this.updateTestGenerationButtons();
        });
        
        // 🔥 新增：监听游戏数据变化
        document.addEventListener('gameDataChanged', () => {
            this.updateTestGenerationButtons();
        });
    }

    // 更新生成测试题按钮状态
    updateTestGenerationButtons() {
        const generateBtn = document.getElementById('generateTestBtn');
        const previewBtn = document.getElementById('previewTestBtn');
        
        // 🔥 修复：更宽松的条件判断
        const hasGameData = this.sgfAnalyzer && 
                           this.sgfAnalyzer.gameData && 
                           this.sgfAnalyzer.gameData.moves && 
                           this.sgfAnalyzer.gameData.moves.length > 0;
        
        const hasSGFHash = this.sgfAnalyzer && this.sgfAnalyzer.currentSGFHash;
        
        // 🔥 只要有棋谱数据就启用按钮，不需要等待分析完成
        const shouldEnable = hasGameData || hasSGFHash;
        
        console.log('🔧 更新测试题按钮状态:', {
            hasGameData,
            hasSGFHash,
            shouldEnable,
            gameData: this.sgfAnalyzer?.gameData,
            currentSGFHash: this.sgfAnalyzer?.currentSGFHash
        });
        
        if (generateBtn) {
            generateBtn.disabled = !shouldEnable;
            generateBtn.style.opacity = shouldEnable ? '1' : '0.5';
            console.log('🔧 生成按钮状态:', generateBtn.disabled ? '禁用' : '启用');
        }
        if (previewBtn) {
            previewBtn.disabled = !shouldEnable;
            previewBtn.style.opacity = shouldEnable ? '1' : '0.5';
            console.log('🔧 预览按钮状态:', previewBtn.disabled ? '禁用' : '启用');
        }
    }

    // 生成测试题的主方法
    async generateTestQuestions() {
        try {
            this.showTestGenerationStatus('正在生成测试题...', 'info');
            
            // 1. 检查是否有棋谱和分析结果
            if (!this.sgfAnalyzer.gameData || !this.sgfAnalyzer.currentSGFHash) {
                throw new Error('请先加载棋谱');
            }
            
            // 2. 获取用户设置
            const settings = this.getTestGenerationSettings();
            
            // 3. 加载分析结果
            const analysisResults = await this.sgfAnalyzer.analysisStorage.loadAnalysisResults(
                this.sgfAnalyzer.currentSGFHash
            );
            if (analysisResults.length === 0) {
                throw new Error('请先完成棋谱分析');
            }
            
            // 4. 筛选关键步数（胜率损失最大的步数）
            const criticalMoves = this.findCriticalMoves(analysisResults, settings);
            
            if (criticalMoves.length === 0) {
                throw new Error('未找到符合条件的关键步数');
            }
            
            // 5. 为关键步数创建测试题
            const testQuestions = await this.createTestQuestions(criticalMoves, settings);
            
            // 6. 保存到数据库
            const saveResult = await this.saveTestQuestions(testQuestions);
            
            // 根据保存结果显示不同的状态信息
            if (saveResult.data?.skipped) {
                // 用户选择不覆盖的情况
                this.showTestGenerationStatus(saveResult.message, 'info');
            } else {
                // 正常保存成功的情况
                const insertedCount = saveResult.data?.insertedCount || testQuestions.length;
                this.showTestGenerationStatus(`成功生成 ${insertedCount} 道测试题`, 'success');
                this.updateTestCount(insertedCount);
            }
            
        } catch (error) {
            console.error('生成测试题失败:', error);
            this.showTestGenerationStatus(`生成失败: ${error.message}`, 'error');
        }
    }

    // 获取用户设置
    getTestGenerationSettings() {
        const candidateCount = parseInt(document.getElementById('testCandidateCount')?.value) || 4;
        
        return {
            playerColor: document.getElementById('testPlayerSide')?.value || 'black',
            topMovesCount: parseInt(document.getElementById('testTopN')?.value) || 10,
            candidateCount: candidateCount,
            minWinRateLoss: parseFloat(document.getElementById('testMinWinrateLoss')?.value) || 0.05,
            // 根据candidateCount动态设置
            actualMoveCount: 1, // 总是包含实战选点
            bestMoveCount: 1,   // 总是包含最佳选点
            alternateMoveCount: Math.max(0, candidateCount - 2) // 剩余的作为次选点
        };
    }

    // 找出关键步数（胜率损失最大的步数）
    findCriticalMoves(analysisResults, settings) {
        const criticalMoves = [];
        
        for (let i = 0; i < analysisResults.length - 1; i++) {
            const currentResult = analysisResults[i];
            const nextResult = analysisResults[i + 1];
            
            // 检查是否是目标颜色的步数
            const currentMove = this.sgfAnalyzer.gameData.moves[i];
            if (settings.playerColor !== 'mixed') {
                const isBlackMove = currentMove.color === 'black';
                if ((settings.playerColor === 'black' && !isBlackMove) || 
                    (settings.playerColor === 'white' && isBlackMove)) {
                    continue;
                }
            }
            
            // 计算胜率损失
            const currentWinRate = currentResult.analysis?.winRate || 0;
            const nextWinRate = nextResult.analysis?.winRate || 0;
            const winRateLoss = Math.abs(currentWinRate - nextWinRate);
            
            if (winRateLoss >= settings.minWinRateLoss) {
                criticalMoves.push({
                    moveNumber: currentResult.moveNumber,
                    move: currentResult.move,
                    winRateLoss: winRateLoss,
                    analysis: currentResult.analysis,
                    actualMove: currentMove
                });
            }
        }
        
        // 按胜率损失排序，取前N名
        return criticalMoves
            .sort((a, b) => b.winRateLoss - a.winRateLoss)
            .slice(0, settings.topMovesCount);
    }

    // 为关键步数创建测试题
    async createTestQuestions(criticalMoves, settings) {
        const testQuestions = [];
        
        for (const criticalMove of criticalMoves) {
            // 获取该步数的棋盘状态
            const boardState = this.getBoardStateAtMove(criticalMove.moveNumber - 1);
            
            // 生成候选点
            const candidatePoints = this.generateCandidatePoints(criticalMove, settings);
            
            // 找出正确答案
            const correctAnswer = this.findCorrectAnswer(criticalMove.analysis);
            
            // 计算题目难度
            const difficulty = this.calculateDifficulty(criticalMove.winRateLoss);
            
            const testQuestion = {
                id: `${this.sgfAnalyzer.currentSGFHash}_${criticalMove.moveNumber}`,
                sgfHash: this.sgfAnalyzer.currentSGFHash,
                sgfFilename: this.sgfAnalyzer.gameData.filename,
                moveNumber: criticalMove.moveNumber,
                boardState: boardState,
                currentPlayer: criticalMove.actualMove.color,
                candidatePoints: candidatePoints,
                correctAnswer: correctAnswer,
                winRateLoss: criticalMove.winRateLoss,
                difficulty: difficulty,
                questionText: `第${criticalMove.moveNumber}手，${criticalMove.actualMove.color === 'black' ? '黑' : '白'}方下一步最佳选择是？`,
                createdAt: new Date().toISOString()
            };
            
            testQuestions.push(testQuestion);
        }
        
        return testQuestions;
    }

    // 获取指定步数的棋盘状态
    getBoardStateAtMove(moveIndex) {
        const board = Array(19).fill(null).map(() => Array(19).fill(null));
        
        // 重放到指定步数
        for (let i = 0; i <= moveIndex && i < this.sgfAnalyzer.gameData.moves.length; i++) {
            const move = this.sgfAnalyzer.gameData.moves[i];
            if (!move.pass && move.row !== undefined && move.col !== undefined) {
                board[move.row][move.col] = move.color;
            }
        }
        
        return board;
    }

    // 生成候选点
    generateCandidatePoints(criticalMove, settings) {
        const candidates = [];
        const targetCount = settings.candidateCount || 4; // 目标候选点数量
        
        // 添加实战选点
        if (settings.actualMoveCount > 0 && criticalMove.actualMove) {
            candidates.push({
                type: 'actual',
                position: `${String.fromCharCode(65 + criticalMove.actualMove.col)}${19 - criticalMove.actualMove.row}`,
                row: criticalMove.actualMove.row,
                col: criticalMove.actualMove.col,
                winRate: parseFloat(criticalMove.analysis?.winRate) || 0,
                description: '实战选点'
            });
        }
        
        // 添加最佳选点和次选点
        if (criticalMove.analysis?.variations) {
            // 计算还需要多少个候选点
            const remainingCount = targetCount - candidates.length;
            
            // 从分析结果中取足够的变招
            const variations = criticalMove.analysis.variations.slice(0, remainingCount);
            
            variations.forEach((variation, index) => {
                if (variation.moves && variation.moves.length > 0) {
                    const move = this.parseSGFPosition(variation.moves[0]);
                    if (move) {
                        // 检查是否与已有候选点重复
                        const isDuplicate = candidates.some(candidate => 
                            candidate.row === move.row && candidate.col === move.col
                        );
                        
                        if (!isDuplicate) {
                            candidates.push({
                                type: index === 0 ? 'best' : 'alternate',
                                position: variation.moves[0],
                                row: move.row,
                                col: move.col,
                                winRate: parseFloat(variation.winRate) || 0,
                                description: index === 0 ? '最佳选点' : '次选点'
                            });
                        }
                    }
                }
            });
        }
        
        // 如果候选点不够，可以添加一些随机的合理选点
        if (candidates.length < targetCount) {
            console.warn(`候选点数量不足，目标: ${targetCount}, 实际: ${candidates.length}`);
        }
        
        return candidates;
    }

    // 找出正确答案
    findCorrectAnswer(analysis) {
        if (analysis?.variations && analysis.variations.length > 0) {
            const bestVariation = analysis.variations[0];
            if (bestVariation.moves && bestVariation.moves.length > 0) {
                // 确保 winRate 是数字类型
                const winRate = parseFloat(bestVariation.winRate) || 0;
                return {
                    position: bestVariation.moves[0],
                    winRate: winRate,
                    explanation: `最佳选点，胜率: ${winRate.toFixed(1)}%`
                };
            }
        }
        return null;
    }

    // 计算题目难度
    calculateDifficulty(winRateLoss) {
        if (winRateLoss >= 20) return 'hard';
        if (winRateLoss >= 10) return 'medium';
        return 'easy';
    }

    // 保存测试题到后端
    async saveTestQuestions(testQuestions) {
        // 添加数据验证和调试日志
        console.log('准备发送的测试题数据:', testQuestions);
        
        // 验证数据格式
        const validatedQuestions = testQuestions.map(q => ({
            ...q,
            winRateLoss: parseFloat(q.winRateLoss) || 0,
            candidatePoints: q.candidatePoints.map(cp => ({
                ...cp,
                winRate: parseFloat(cp.winRate) || 0
            })),
            correctAnswer: q.correctAnswer ? {
                ...q.correctAnswer,
                winRate: parseFloat(q.correctAnswer.winRate) || 0
            } : null
        }));
        
        const payload = {
            questions: validatedQuestions,
            metadata: {
                sgfHash: this.sgfAnalyzer.currentSGFHash,
                sgfFilename: this.sgfAnalyzer.gameData.filename,
                totalQuestions: validatedQuestions.length,
                createdAt: new Date().toISOString()
            }
        };
        
        console.log('发送到后端的数据:', JSON.stringify(payload, null, 2));
        
        const response = await fetch('/api/testQuestions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // 特殊处理 409 冲突 - 测试题已存在
            if (response.status === 409) {
                console.log('检测到测试题已存在:', errorData);
                
                // 显示友好的提示信息
                const duplicateCount = errorData.data?.duplicateCount || 0;
                const message = `检测到 ${duplicateCount} 道测试题已存在。是否要覆盖现有的测试题？`;
                
                // 询问用户是否覆盖
                const shouldOverwrite = confirm(message);
                
                if (shouldOverwrite) {
                    // 用户选择覆盖，添加覆盖参数重新发送
                    const overwritePayload = {
                        ...payload,
                        overwrite: true
                    };
                    
                    const overwriteResponse = await fetch('/api/testQuestions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(overwritePayload)
                    });
                    
                    if (!overwriteResponse.ok) {
                        const overwriteErrorData = await overwriteResponse.json().catch(() => ({}));
                        throw new Error(`覆盖失败: HTTP ${overwriteResponse.status} - ${overwriteErrorData.message || overwriteResponse.statusText}`);
                    }
                    
                    return await overwriteResponse.json();
                } else {
                    // 用户选择不覆盖，返回成功状态但不实际保存
                    this.showTestGenerationStatus(`已取消保存，${duplicateCount} 道测试题已存在`, 'info');
                    return {
                        success: true,
                        message: '用户取消覆盖',
                        data: {
                            insertedCount: 0,
                            duplicateCount: duplicateCount,
                            skipped: true
                        }
                    };
                }
            }
            
            // 其他错误正常处理
            console.error('后端错误详情:', errorData);
            throw new Error(`保存失败: HTTP ${response.status} - ${errorData.message || response.statusText}`);
        }
        
        return await response.json();
    }

    // 预览测试题
    async previewTestQuestions() {
        try {
            const settings = this.getTestGenerationSettings();
            const analysisResults = await this.sgfAnalyzer.analysisStorage.loadAnalysisResults(
                this.sgfAnalyzer.currentSGFHash
            );
            const criticalMoves = this.findCriticalMoves(analysisResults, settings);
            
            console.log('预览测试题:', criticalMoves);
            this.showTestGenerationStatus(`预览: 将生成 ${criticalMoves.length} 道测试题`, 'info');
            
            // 显示预览详情
            const previewDetails = criticalMoves.map(move => 
                `第${move.moveNumber}手 (胜率损失: ${move.winRateLoss.toFixed(1)}%)`
            ).join(', ');
            
            this.sgfAnalyzer.analysisDisplay.addLogEntry(
                `预览详情: ${previewDetails}`, 'info'
            );
            
        } catch (error) {
            this.showTestGenerationStatus(`预览失败: ${error.message}`, 'error');
        }
    }

    // 显示生成状态
    showTestGenerationStatus(message, type) {
        this.updateTestStatus(message);
        this.sgfAnalyzer.analysisDisplay.addLogEntry(message, type);
    }

    // 更新测试状态显示
    updateTestStatus(status) {
        const statusElement = document.getElementById('testGenerationStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    // 更新测试题数量显示
    updateTestCount(count) {
        const countElement = document.getElementById('testQuestionCount');
        if (countElement) {
            countElement.textContent = count;
        }
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
        } else if (colChar >= 'J') {
            col = colChar.charCodeAt(0) - 66; // J-T -> 8-18
        } else {
            return null; // I不存在
        }
        
        // 行转换: 1-19 -> 18-0
        const row = 19 - rowNum;
        
        return { row, col };
    }
}

// 导出类
window.TestQuestionGenerator = TestQuestionGenerator;