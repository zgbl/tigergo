/**
 * 测试题生成器
 * 负责从SGF分析结果中生成围棋测试题
 */
class TestQuestionGenerator {
    constructor(sgfAnalyzer) {
        this.sgfAnalyzer = sgfAnalyzer;
        this.currentQuestions = []; // 🔥 新增：存储当前生成的测试题
        this.currentQuestionIndex = -1; // 🔥 新增：当前选中的测试题索引
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

        // 🔥 新增：导航按钮事件监听
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigateQuestion(-1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigateQuestion(1));
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

            // 🔥 更新当前生成的测试题并显示列表
            this.currentQuestions = testQuestions;
            this.currentQuestionIndex = 0;
            this.renderQuestionList();
            this.showTestPreviewControls(true);

            // 根据保存结果显示不同的状态信息
            if (saveResult.data?.skipped) {
                // 用户选择不覆盖的情况
                this.showTestGenerationStatus(saveResult.message, 'info');
            } else {
                // 正常保存成功的情况
                const insertedCount = saveResult.data?.insertedCount || testQuestions.length;
                this.showTestGenerationStatus(`成功生成 ${insertedCount} 道测试题`, 'success');
                this.updateTestCount(insertedCount);

                // 自动展示第一题
                if (testQuestions.length > 0) {
                    this.showQuestion(0);
                }
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

            // 🔥 修复：使用 moveNumber 作为索引，并添加边界检查
            const moveIndex = currentResult.moveNumber - 1; // moveNumber 从1开始，数组从0开始
            const currentMove = this.sgfAnalyzer.gameData.moves[moveIndex];

            // 🔥 添加边界检查，防止访问undefined
            if (!currentMove) {
                console.warn(`警告：第${currentResult.moveNumber}手的着法数据不存在，跳过`);
                continue;
            }

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

        return criticalMoves.sort((a, b) => b.winRateLoss - a.winRateLoss);
    }

    // 为关键步数创建测试题
    async createTestQuestions(criticalMoves, settings) {
        const testQuestions = [];

        for (const criticalMove of criticalMoves) {
            // 获取该步数的棋盘状态
            const boardState = this.getBoardStateAtMove(criticalMove.moveNumber - 1);

            // 生成候选点
            const candidatePoints = this.generateCandidatePoints(criticalMove, settings);
            const correctAnswerObj = this.findCorrectAnswer(criticalMove.analysis, candidatePoints);

            // 计算题目难度
            const difficulty = this.calculateDifficulty(criticalMove.winRateLoss);

            // 获取上一步着法信息 (用于在棋盘上显示标记)
            let lastMove = null;
            if (criticalMove.moveNumber > 1) {
                const prevMove = this.sgfAnalyzer.gameData.moves[criticalMove.moveNumber - 2];
                if (prevMove && !prevMove.pass && prevMove.row !== undefined && prevMove.col !== undefined) {
                    lastMove = {
                        row: prevMove.row,
                        col: prevMove.col,
                        color: prevMove.color
                    };
                }
            }

            const testQuestion = {
                id: `${this.sgfAnalyzer.currentSGFHash}_${criticalMove.moveNumber}`,
                sgfHash: this.sgfAnalyzer.currentSGFHash,
                sgfFilename: this.sgfAnalyzer.gameData.filename,
                moveNumber: criticalMove.moveNumber,
                lastMove: lastMove, // 🔥 新增：上一步着法信息
                boardState: boardState,
                currentPlayer: criticalMove.actualMove.color,
                candidates: candidatePoints,
                correctAnswer: {
                    label: correctAnswerObj?.label || 'C',
                    position: correctAnswerObj?.position || '',
                    winRate: correctAnswerObj?.winRate || 0,
                    explanation: correctAnswerObj?.explanation || `最佳选点，胜率: ${(correctAnswerObj?.winRate || 0).toFixed(1)}%`
                },
                winrateChange: criticalMove.winRateLoss,
                difficulty: difficulty,
                questionText: `第${criticalMove.moveNumber}手，${criticalMove.actualMove.color === 'black' ? '黑' : '白'}方下一步最佳选择是？`, // 修改字段名
                title: `第${criticalMove.moveNumber}手，${criticalMove.actualMove.color === 'black' ? '黑' : '白'}方下一步最佳选择是？`, // 保留兼容性
                questionNumber: criticalMove.moveNumber,
                source: this.sgfAnalyzer.gameData.filename || '未知',
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
    // 在generateCandidatePoints方法中，需要正确标记哪个是最佳选点
    generateCandidatePoints(criticalMove, settings) {
        const candidates = [];
        const targetCount = settings.candidateCount || 4;

        // 1. 收集所有可能的候选点 (包含实战点和变着)
        // 添加实战选点
        if (settings.actualMoveCount > 0 && criticalMove.actualMove) {
            candidates.push({
                type: 'actual',
                position: `${String.fromCharCode(65 + criticalMove.actualMove.col)}${19 - criticalMove.actualMove.row}`,
                row: criticalMove.actualMove.row,
                col: criticalMove.actualMove.col,
                winRate: parseFloat(criticalMove.analysis?.winRate) || 0,
                description: '实战选点' // 临时，后续重置
            });
        }

        // 添加变着
        if (criticalMove.analysis?.variations) {
            criticalMove.analysis.variations.forEach((variation) => {
                if (variation.moves && variation.moves.length > 0) {
                    const move = this.parseSGFPosition(variation.moves[0]);
                    if (move) {
                        const isDuplicate = candidates.some(candidate =>
                            candidate.row === move.row && candidate.col === move.col
                        );

                        if (!isDuplicate) {
                            candidates.push({
                                type: 'alternate', // 临时，后续重置
                                position: variation.moves[0],
                                row: move.row,
                                col: move.col,
                                winRate: parseFloat(variation.winRate) || 0,
                                description: '候选点' // 临时，后续重置
                            });
                        }
                    }
                }
            });
        }

        // 2. 根据当前走棋方对所有选点进行排序
        const isBlackTurn = criticalMove.actualMove.color === 'black';
        candidates.sort((a, b) => {
            if (isBlackTurn) {
                return b.winRate - a.winRate; // 黑棋选胜率最高的
            } else {
                return a.winRate - b.winRate; // 白棋选黑棋胜率最低的
            }
        });

        // 3. 截取前 N 个，并分配描述与类型
        const finalCandidates = candidates.slice(0, targetCount);
        finalCandidates.forEach((candidate, index) => {
            if (index === 0) {
                candidate.type = 'best';
                candidate.description = '最佳选点';
            } else if (index === 1) {
                candidate.type = 'alternate';
                candidate.description = '次优选点';
            } else {
                candidate.type = 'alternate';
                candidate.description = '';
            }
        });

        // 随机打乱候选点顺序
        const shuffledCandidates = this.shuffleArray(finalCandidates);

        // 重新分配标签并找到最佳选点的新标签
        const labels = ['A', 'B', 'C', 'D'];
        let correctLabel = 'D'; // 默认值

        shuffledCandidates.forEach((candidate, index) => {
            candidate.label = labels[index];
            if (candidate.type === 'best') {
                correctLabel = labels[index]; // 记录最佳选点的标签
            }
        });

        // 将正确答案标签存储到候选点数据中
        shuffledCandidates.correctLabel = correctLabel;

        return shuffledCandidates;
    }

    // 找出正确答案
    findCorrectAnswer(analysis, candidates) {
        // 从候选点中找到最佳选点的标签
        const bestCandidate = candidates.find(c => c.type === 'best');
        if (bestCandidate) {
            return {
                position: bestCandidate.position,
                label: bestCandidate.label, // 使用正确的标签
                winRate: bestCandidate.winRate,
                explanation: `最佳选点，胜率: ${(bestCandidate.winRate * 100).toFixed(1)}%`
            };
        }

        // 备用方案：如果没找到type为'best'的候选点，使用correctLabel
        if (candidates.correctLabel) {
            const correctCandidate = candidates.find(c => c.label === candidates.correctLabel);
            if (correctCandidate) {
                return {
                    position: correctCandidate.position,
                    label: correctCandidate.label,
                    winRate: correctCandidate.winRate,
                    explanation: `最佳选点，胜率: ${(correctCandidate.winRate * 100).toFixed(1)}%`
                };
            }
        }

        // 最后的备用方案：返回第一个候选点
        if (candidates && candidates.length > 0) {
            const firstCandidate = candidates[0];
            return {
                position: firstCandidate.position,
                label: firstCandidate.label,
                winRate: firstCandidate.winRate,
                explanation: `候选选点，胜率: ${(firstCandidate.winRate * 100).toFixed(1)}%`
            };
        }

        return {
            position: '',
            label: 'D',
            winRate: 0,
            explanation: '默认选点'
        };
    }

    // 计算题目难度
    calculateDifficulty(winRateLoss) {
        if (winRateLoss >= 20) return 'hard';
        if (winRateLoss >= 10) return 'medium';
        return 'easy';
    }

    // 保存测试题到后端
    async saveTestQuestions(testQuestions) {
        console.log('=== 开始保存测试题 ===');
        console.log('原始测试题数据:', testQuestions);

        // 验证数据格式
        const validatedQuestions = testQuestions.map((q, index) => {
            console.log(`验证测试题 ${index + 1}...`);

            const validated = {
                ...q,
                winRateLoss: parseFloat(q.winrateChange) || 0,
                candidatePoints: q.candidates ? q.candidates.map(cp => ({
                    ...cp,
                    winRate: parseFloat(cp.winRate) || 0
                })) : [],
                // 确保 correctAnswer 是对象格式且包含 explanation
                correctAnswer: {
                    label: q.correctAnswer?.label || 'C',
                    position: q.correctAnswer?.position || '',
                    winRate: parseFloat(q.correctAnswer?.winRate) || 0,
                    explanation: q.correctAnswer?.explanation || `最佳选点，胜率: ${parseFloat(q.correctAnswer?.winRate || 0).toFixed(1)}%`
                },
                // 确保有 questionText 字段
                questionText: q.questionText || q.title || `第${q.moveNumber}手测试题`
            };

            console.log(`验证后的测试题 ${index + 1}:`, validated);
            return validated;
        });

        const payload = {
            questions: validatedQuestions,
            metadata: {
                sgfHash: this.sgfAnalyzer.currentSGFHash,
                sgfFilename: this.sgfAnalyzer.gameData.filename,
                totalQuestions: validatedQuestions.length,
                createdAt: new Date().toISOString()
            }
        };

        console.log('最终发送的payload:', JSON.stringify(payload, null, 2));

        try {
            const response = await fetch('/api/testQuestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            console.log('响应状态:', response.status, response.statusText);

            if (!response.ok) {
                let errorText = '';
                try {
                    errorText = await response.text();
                    console.log('错误响应体:', errorText);
                } catch (e) {
                    console.log('无法读取错误响应体:', e);
                }

                throw new Error(`保存测试题失败: ${response.status} ${response.statusText}. 响应: ${errorText}`);
            }

            const result = await response.json();
            console.log('保存测试题成功:', result);
            return result;

        } catch (error) {
            console.error('保存测试题时发生错误:', error);
            throw error;
        }
    }

    // 预览测试题
    async previewTestQuestions() {
        try {
            this.showTestGenerationStatus('正在生成预览...', 'info');

            const settings = this.getTestGenerationSettings();

            // 确保已加载分析结果
            if (!this.sgfAnalyzer.gameData || !this.sgfAnalyzer.currentSGFHash) {
                throw new Error('请先加载棋谱');
            }

            const analysisResults = await this.sgfAnalyzer.analysisStorage.loadAnalysisResults(
                this.sgfAnalyzer.currentSGFHash
            );

            if (analysisResults.length === 0) {
                throw new Error('请先完成棋谱分析');
            }

            const criticalMoves = this.findCriticalMoves(analysisResults, settings);

            if (criticalMoves.length === 0) {
                throw new Error('未找到符合条件的关键步数');
            }

            this.showTestGenerationStatus(`预览: 找到 ${criticalMoves.length} 个关键步`, 'info');

            // 生成测试题对象用于预览（但不保存）
            const testQuestions = await this.createTestQuestions(criticalMoves, settings);

            // 🔥 更新当前预览的测试题
            this.currentQuestions = testQuestions;
            this.currentQuestionIndex = 0;
            this.renderQuestionList();
            this.showTestPreviewControls(true);

            // 显示第一题
            this.showQuestion(0);

            console.log('预览测试题:', testQuestions);

        } catch (error) {
            this.showTestGenerationStatus(`预览失败: ${error.message}`, 'error');
        }
    }

    // 🔥 新增：渲染测试题列表
    renderQuestionList() {
        const listContainer = document.getElementById('generatedQuestionsList');
        if (!listContainer) return;

        if (this.currentQuestions.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; color: #999; padding: 10px;">暂无测试题</div>';
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 5px;">';

        this.currentQuestions.forEach((q, index) => {
            const isSelected = index === this.currentQuestionIndex;
            const style = isSelected ?
                'background: #e6f7ff; border: 1px solid #1890ff; color: #1890ff;' :
                'background: white; border: 1px solid #eee; color: #333;';

            html += `
                <div class="question-item" data-index="${index}" 
                     style="${style} padding: 8px 12px; border-radius: 4px; cursor: pointer; transition: all 0.2s;"
                     onclick="window.testQuestionGenerator.showQuestion(${index})">
                    <div style="font-weight: bold; font-size: 14px;">第 ${q.moveNumber} 手</div>
                    <div style="font-size: 12px; color: #666; display: flex; justify-content: space-between;">
                        <span>${q.currentPlayer === 'black' ? '黑方' : '白方'}</span>
                        <span>胜率损失: ${(q.winrateChange || 0).toFixed(1)}%</span>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        listContainer.innerHTML = html;

        // 更新导航按钮状态
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');
        const indicator = document.getElementById('currentQuestionIndicator');

        if (prevBtn) prevBtn.disabled = this.currentQuestionIndex <= 0;
        if (nextBtn) nextBtn.disabled = this.currentQuestionIndex >= this.currentQuestions.length - 1;
        if (indicator) indicator.textContent = `${this.currentQuestionIndex + 1} / ${this.currentQuestions.length}`;

        // 🔥 将实例绑定到window以便onclick调用
        window.testQuestionGenerator = this;
    }

    // 🔥 新增：显示指定索引的题目
    showQuestion(index) {
        if (index < 0 || index >= this.currentQuestions.length) return;

        this.currentQuestionIndex = index;
        const question = this.currentQuestions[index];

        console.log(`显示第 ${index + 1} 题 (Move ${question.moveNumber})`, question);

        // 1. 在棋盘上显示该局面
        // 使用BoardController的updateBoard方法
        if (this.sgfAnalyzer.boardController) {
            // 先通过goToMove跳转到该步数，确保存储了正确的历史记录
            this.sgfAnalyzer.boardController.goToMove(question.moveNumber - 1);

            // 获取并显示候选点
            if (question.candidates && question.candidates.length > 0) {
                // 转换候选点格式以适配CandidatePointsDisplay
                // 需要将标签(A,B,C,D)显示出来
                if (this.sgfAnalyzer.boardController.candidatePointsDisplay) {
                    // 使用setCandidatePoints显示点
                    this.sgfAnalyzer.boardController.candidatePointsDisplay.showTestCandidates(question.candidates);
                }
            }
        }

        // 2. 更新列表选中状态
        this.renderQuestionList(); // 重新渲染以更新高亮

        // 3. 显示题目信息
        this.sgfAnalyzer.analysisDisplay.addLogEntry(
            `预览题目 ${index + 1}: 第${question.moveNumber}手，${question.questionText}`,
            'info'
        );
    }

    // 🔥 新增：导航题目
    navigateQuestion(direction) {
        const newIndex = this.currentQuestionIndex + direction;
        if (newIndex >= 0 && newIndex < this.currentQuestions.length) {
            this.showQuestion(newIndex);
        }
    }

    // 🔥 新增：显示/隐藏预览控件
    showTestPreviewControls(show) {
        const controls = document.getElementById('testPreviewControls');
        if (controls) {
            controls.style.display = show ? 'block' : 'none';
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

    // 在TestQuestionGenerator类中添加
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

// 导出类
window.TestQuestionGenerator = TestQuestionGenerator;
