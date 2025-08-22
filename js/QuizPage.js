class QuizPage {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = { correct: 0, incorrect: 0 };
        this.isQuizActive = false;
        this.usedQuestionIds = new Set(); // 记录已使用的题目ID
        this.allAvailableQuestions = []; // 存储所有可用题目
        
        this.initializeElements();
        this.bindEvents();
        
        // 修复：使用正确的容器ID 'board' 而不是 'boardPlaceholder'
        this.quizBoard = new QuizBoard('board', {
            boardSize: 19,
            cellSize: 28,
            stoneSize: 26
        });
        
    }
    
    initializeElements() {
        // 设置元素
        this.questionSourceSelect = document.getElementById('questionSource');
        this.questionCountInput = document.getElementById('questionCount');
        this.randomOrderCheckbox = document.getElementById('randomOrder');
        this.loadQuestionsBtn = document.getElementById('loadQuestionsBtn');
        this.resetQuizBtn = document.getElementById('resetQuizBtn');
        this.nextGroupBtn = document.getElementById('nextGroupBtn'); // 新增
        
        // 进度元素
        this.quizProgress = document.getElementById('quizProgress');
        this.progressFill = document.getElementById('progressFill');
        this.currentQuestionSpan = document.getElementById('currentQuestion');
        this.totalQuestionsSpan = document.getElementById('totalQuestions');
        this.correctCountSpan = document.getElementById('correctCount');
        this.incorrectCountSpan = document.getElementById('incorrectCount');
        this.accuracyRateSpan = document.getElementById('accuracyRate');
        
        // 题目信息元素
        this.questionInfo = document.getElementById('questionInfo');
        this.questionTitle = document.getElementById('questionTitle');
        this.questionNumber = document.getElementById('questionNumber'); // 新增
        this.questionDifficulty = document.getElementById('questionDifficulty');
        this.questionSourceSpan = document.getElementById('questionSource');
        
        // 棋盘元素
        this.boardContainer = document.getElementById('board');
        this.candidateLegend = document.getElementById('candidateLegend');
        this.loadingState = document.getElementById('loadingState');
        
        // 答题元素
        this.answerOptions = document.getElementById('answerOptions');
        this.submitAnswerBtn = document.getElementById('submitAnswerBtn');
        this.nextQuestionBtn = document.getElementById('nextQuestionBtn');
        
        // 结果元素
        this.resultPanel = document.getElementById('resultPanel');
        this.resultContent = document.getElementById('resultContent');
        this.finalScore = document.getElementById('finalScore');
        this.scoreSummary = document.getElementById('scoreSummary');
        this.restartQuizBtn = document.getElementById('restartQuizBtn');
        
        // 音效元素
        this.correctSound = document.getElementById('correctSound');
        this.incorrectSound = document.getElementById('incorrectSound');
    }
    
    bindEvents() {
        this.loadQuestionsBtn.addEventListener('click', () => this.loadQuestions());
        this.resetQuizBtn.addEventListener('click', () => this.resetQuiz());
        this.nextGroupBtn.addEventListener('click', () => this.loadNextGroup()); // 新增
        this.submitAnswerBtn.addEventListener('click', () => this.submitAnswer());
        this.nextQuestionBtn.addEventListener('click', () => this.nextQuestion());
        this.restartQuizBtn.addEventListener('click', () => this.restartQuiz());
        
        // 答题选项变化事件
        this.answerOptions.addEventListener('change', (e) => {
            if (e.target.type === 'radio') {
                this.submitAnswerBtn.disabled = false;
            }
        });
    }
    
    initializeBoard() {
        this.createBoard();
    }
    
    createBoard() {
        this.boardContainer.innerHTML = '';
        
        const board = document.createElement('div');
        board.className = 'go-board';
        board.style.width = `${this.boardSize * this.cellSize}px`;
        board.style.height = `${this.boardSize * this.cellSize}px`;
        board.style.position = 'relative';
        board.style.background = '#DEB887';
        board.style.border = '2px solid #8B4513';
        
        // 创建网格线
        for (let i = 0; i < this.boardSize; i++) {
            // 垂直线
            const vLine = document.createElement('div');
            vLine.style.position = 'absolute';
            vLine.style.left = `${i * this.cellSize + this.cellSize/2}px`;
            vLine.style.top = `${this.cellSize/2}px`;
            vLine.style.width = '1px';
            vLine.style.height = `${(this.boardSize-1) * this.cellSize}px`;
            vLine.style.background = '#000';
            board.appendChild(vLine);
            
            // 水平线
            const hLine = document.createElement('div');
            hLine.style.position = 'absolute';
            hLine.style.left = `${this.cellSize/2}px`;
            hLine.style.top = `${i * this.cellSize + this.cellSize/2}px`;
            hLine.style.width = `${(this.boardSize-1) * this.cellSize}px`;
            hLine.style.height = '1px';
            hLine.style.background = '#000';
            board.appendChild(hLine);
        }
        
        // 创建交叉点
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const intersection = document.createElement('div');
                intersection.className = 'intersection';
                intersection.dataset.row = row;
                intersection.dataset.col = col;
                intersection.style.position = 'absolute';
                intersection.style.left = `${col * this.cellSize}px`;
                intersection.style.top = `${row * this.cellSize}px`;
                intersection.style.width = `${this.cellSize}px`;
                intersection.style.height = `${this.cellSize}px`;
                intersection.style.cursor = 'pointer';
                
                board.appendChild(intersection);
            }
        }
        
        // 添加星位
        this.addStarPoints(board);
        
        this.boardContainer.appendChild(board);
    }
    
    addStarPoints(board) {
        const starPoints = [
            [3, 3], [3, 9], [3, 15],
            [9, 3], [9, 9], [9, 15],
            [15, 3], [15, 9], [15, 15]
        ];
        
        starPoints.forEach(([row, col]) => {
            const starPoint = document.createElement('div');
            starPoint.className = 'star-point';
            starPoint.style.position = 'absolute';
            starPoint.style.left = `${col * this.cellSize + this.cellSize/2 - 3}px`;
            starPoint.style.top = `${row * this.cellSize + this.cellSize/2 - 3}px`;
            starPoint.style.width = '6px';
            starPoint.style.height = '6px';
            starPoint.style.borderRadius = '50%';
            starPoint.style.background = '#000';
            board.appendChild(starPoint);
        });
    }
    
    async loadQuestions(count = 10, random = true, source = 'all') {
        try {
            this.loadQuestionsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';

            const apiUrl = `${CONFIG.API_VERCEL_NEXTJS_BASE_URL}/api/testQuestions`;
            const params = new URLSearchParams({
                limit: count.toString(),
                sortBy: 'createdAt',
                sortOrder: 'desc',
                includeDetails: 'true'
            });

            if (source && source !== 'all') {
                if (source.startsWith('difficulty-')) {
                    params.append('difficulty', source.replace('difficulty-', ''));
                }
            }

            console.log('正在从MongoDB加载题目:', `${apiUrl}?${params}`);

            const response = await fetch(`${apiUrl}?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || '加载题目失败');
            }

            const rawQuestions = data.data?.questions || [];

            if (rawQuestions.length === 0) {
                throw new Error('MongoDB中没有找到测试题目，请先生成题目');
            }

            // Fisher-Yates 洗牌函数
            const shuffleArray = (array) => {
                const shuffled = [...array]; // 创建副本
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
            };

            // 转换数据格式
            this.allAvailableQuestions = rawQuestions.map((q, index) => {
                // 棋盘状态
                let boardState = [];
                if (q.boardState && Array.isArray(q.boardState)) {
                    boardState = this.convertBoardState(q.boardState);
                } else {
                    console.warn(`题目 ${q.id} 缺少棋盘状态数据`);
                    boardState = [];
                }

                // 候选点处理
                // 候选点处理
                let candidates = [];
                let correctAnswer = 'C'; // 默认正确答案

                if (q.candidatePoints && Array.isArray(q.candidatePoints)) {
                    // 先转换候选点格式，添加label字段
                    candidates = this.convertCandidatePoints(q.candidatePoints);
                    
                    // 如果需要随机顺序，打乱候选点
                    if (random) {
                        candidates = shuffleArray(candidates);
                        console.log(`题目 ${q.id || q._id} 打乱后的候选点:`, candidates.map(c => `${c.label}:(${c.row},${c.col})`));
                    }
                    
                    // 重新分配 A/B/C/D 标签
                    const labels = ['A', 'B', 'C', 'D'];
                    candidates = candidates.map((c, idx) => ({
                        ...c,
                        label: labels[idx]
                    }));
                    
                    // 根据correctAnswer.position找到正确答案
                    if (q.correctAnswer && q.correctAnswer.position) {
                        const correctPosition = q.correctAnswer.position;
                        console.log(`题目 ${q.id || q._id} 正确答案位置:`, correctPosition);
                        
                        // 通过position字段匹配正确答案
                        const correctCandidate = candidates.find(c => c.position === correctPosition);
                        
                        if (correctCandidate) {
                            correctAnswer = correctCandidate.label;
                            console.log(`题目 ${q.id || q._id} 找到正确答案:`, correctAnswer, correctCandidate);
                        } else {
                            console.error(`题目 ${q.id || q._id} 无法找到位置为 ${correctPosition} 的候选点`);
                            // 备用方案：查找type为'best'的候选点
                            const bestCandidate = candidates.find(c => c.type === 'best');
                            if (bestCandidate) {
                                correctAnswer = bestCandidate.label;
                                console.log(`题目 ${q.id || q._id} 使用最佳选点作为正确答案:`, correctAnswer);
                            }
                        }
                    } else {
                        console.error(`题目 ${q.id || q._id} 缺少correctAnswer.position字段`);
                        // 备用方案：查找type为'best'的候选点
                        const bestCandidate = candidates.find(c => c.type === 'best');
                        if (bestCandidate) {
                            correctAnswer = bestCandidate.label;
                            console.log(`题目 ${q.id || q._id} 使用最佳选点作为正确答案:`, correctAnswer);
                        }
                    }
                } else {
                    console.warn(`题目 ${q.id || q._id} 缺少候选点数据，创建默认选项`);
                    candidates = [
                        { row: 3, col: 3, label: 'A', type: 'default', description: '默认选项' },
                        { row: 3, col: 15, label: 'B', type: 'default', description: '默认选项' },
                        { row: 15, col: 3, label: 'C', type: 'default', description: '默认选项' },
                        { row: 15, col: 15, label: 'D', type: 'default', description: '默认选项' }
                    ];
                    correctAnswer = 'B';
                }

                console.log(`题目 ${q.id || q._id} 最终数据:`, {
                    correctAnswer,
                    candidates: candidates.map(c => ({ label: c.label, row: c.row, col: c.col, type: c.type, position: c.position }))
                });

                return {
                    id: q.id || q._id,
                    questionNumber: index + 1,
                    title: q.questionText || '请选择最佳下法',
                    difficulty: q.difficulty || '中等',
                    source: q.sgfFilename || '实战对局',
                    boardState: boardState,
                    candidates: candidates,
                    correctAnswer: correctAnswer,
                    winrateChange: q.winRateLoss || 0
                };
            });

            console.log('成功加载题目数量:', this.allAvailableQuestions.length);
            console.log('题目数据示例:', this.allAvailableQuestions[0]);

            // 获取未使用的题目
            const availableQuestions = this.allAvailableQuestions.filter(
                question => !this.usedQuestionIds.has(question.id)
            );

            if (availableQuestions.length === 0) {
                throw new Error('没有更多可用题目，请重置后重新开始');
            }

            let selectedQuestions = [...availableQuestions];

            if (random) {
                selectedQuestions = shuffleArray(selectedQuestions);
            }

            const requestedCount = Math.min(count, selectedQuestions.length);
            this.questions = selectedQuestions.slice(0, requestedCount);

            // 记录已使用的题目ID
            this.questions.forEach(question => {
                this.usedQuestionIds.add(question.id);
            });

            if (this.questions.length === 0) {
                throw new Error('没有找到符合条件的题目');
            }

            this.startQuiz();

        } catch (error) {
            console.error('加载题目失败:', error);
            alert(`加载题目失败: ${error.message}`);
        } finally {
            this.loadQuestionsBtn.disabled = false;
            this.loadQuestionsBtn.innerHTML = '<i class="fas fa-download"></i> 加载题目';
        }
    }
    
    async loadNextGroup() {
        try {
            this.nextGroupBtn.disabled = true;
            this.nextGroupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
            
            const count = parseInt(this.questionCountInput.value) || 10;
            const random = this.randomOrderCheckbox.checked;
            
            // 如果本地缓存的题目不够，从API加载更多
            const availableQuestions = this.allAvailableQuestions.filter(
                question => !this.usedQuestionIds.has(question.id)
            );
            
            if (availableQuestions.length < count) {
                await this.loadMoreQuestionsFromAPI();
            }
            
            const updatedAvailableQuestions = this.allAvailableQuestions.filter(
                question => !this.usedQuestionIds.has(question.id)
            );
            
            if (updatedAvailableQuestions.length === 0) {
                alert('没有更多可用题目，请重置后重新开始');
                return;
            }
            
            let selectedQuestions = [...updatedAvailableQuestions];
            
            if (random) {
                selectedQuestions = this.shuffleArray(selectedQuestions);
            }
            
            const requestedCount = Math.min(count, selectedQuestions.length);
            this.questions = selectedQuestions.slice(0, requestedCount);
            
            // 记录已使用的题目ID
            this.questions.forEach(question => {
                this.usedQuestionIds.add(question.id);
            });
            
            // 重置当前测验状态
            this.currentQuestionIndex = 0;
            this.userAnswers = [];
            this.score = { correct: 0, incorrect: 0 };
            
            this.totalQuestionsSpan.textContent = this.questions.length;
            this.showCurrentQuestion();
            this.updateScoreDisplay();
            
        } catch (error) {
            console.error('加载下一组题目失败:', error);
            alert(`加载下一组题目失败: ${error.message}`);
        } finally {
            this.nextGroupBtn.disabled = false;
            this.nextGroupBtn.innerHTML = '<i class="fas fa-forward"></i> 下一组';
        }
    }
    
    async loadMoreQuestionsFromAPI() {
        const apiUrl = `${CONFIG.API_VERCEL_NEXTJS_BASE_URL}/api/testQuestions`;
        const params = new URLSearchParams({
            limit: '50',
            sortBy: 'createdAt',
            sortOrder: 'desc',
            includeDetails: 'true' 
        });
        
        const response = await fetch(`${apiUrl}?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || '加载更多题目失败');
        }
        
        const rawQuestions = data.data?.questions || [];
        const newQuestions = rawQuestions.map((q, index) => ({
            id: q.id || q._id,
            questionNumber: this.allAvailableQuestions.length + index + 1,
            title: q.questionText || '请选择最佳下法',
            difficulty: q.difficulty || '中等',
            source: q.sgfFilename || '实战对局',
            boardState: this.convertBoardState(q.boardState),
            candidates: q.candidatePoints || [],
            correctAnswer: q.correctAnswer?.label || 'A',
            winrateChange: q.winRateLoss || 0
        }));
        
        // 合并新题目，避免重复
        const existingIds = new Set(this.allAvailableQuestions.map(q => q.id));
        const uniqueNewQuestions = newQuestions.filter(q => !existingIds.has(q.id));
        
        this.allAvailableQuestions.push(...uniqueNewQuestions);
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    convertBoardState(boardState) {
        console.log('转换棋盘状态数据:', boardState);
        
        if (!boardState) {
            console.warn('棋盘状态数据为空');
            return [];
        }
        
        const stones = [];
        
        // 如果是二维数组格式
        if (Array.isArray(boardState) && Array.isArray(boardState[0])) {
            for (let row = 0; row < boardState.length; row++) {
                for (let col = 0; col < boardState[row].length; col++) {
                    if (boardState[row][col]) {
                        stones.push({
                            row: row,
                            col: col,
                            color: boardState[row][col]
                        });
                    }
                }
            }
        }
        // 如果是对象数组格式 [{row, col, color}, ...]
        else if (Array.isArray(boardState)) {
            boardState.forEach(move => {
                if (move && typeof move === 'object' && move.row !== undefined && move.col !== undefined) {
                    stones.push({
                        row: move.row,
                        col: move.col,
                        color: move.color || move.player
                    });
                }
            });
        }
        // 如果是字符串格式（SGF格式）
        else if (typeof boardState === 'string') {
            // 这里需要解析SGF格式，暂时返回空数组
            console.warn('SGF格式的棋盘状态暂不支持:', boardState);
        }
        
        console.log('转换后的棋盘状态:', stones);
        return stones;
    }
    
    startQuiz() {
        this.isQuizActive = true;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = { correct: 0, incorrect: 0 };
        
        // 显示测验界面
        this.questionInfo.style.display = 'block';
        this.quizProgress.style.display = 'block';
        this.answerOptions.style.display = 'block';
        this.loadingState.style.display = 'none';
        
        // 更新总题目数
        this.totalQuestionsSpan.textContent = this.questions.length;
        
        // 显示第一题
        this.showCurrentQuestion();
        this.updateScoreDisplay();
    }
    
    showCurrentQuestion() {
        if (this.currentQuestionIndex >= this.questions.length) {
            this.endQuiz();
            return;
        }
        
        const question = this.questions[this.currentQuestionIndex];
        
        // 更新题目信息
        this.questionTitle.textContent = question.title;
        this.questionNumber.textContent = `第${question.questionNumber}题`;
        this.questionDifficulty.textContent = question.difficulty;
        this.questionSourceSpan.textContent = question.source;
        
        // 更新进度
        this.currentQuestionSpan.textContent = this.currentQuestionIndex + 1;
        const progress = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
        this.progressFill.style.width = `${progress}%`;
        
        // 显示棋盘
        this.quizBoard.displayPosition(question.boardState, question.candidates);
        
        // 生成答题选项
        this.generateAnswerOptions(question.candidates);
        
        // 重置按钮状态
        //this.submitAnswerBtn.disabled = true;
        this.nextQuestionBtn.style.display = 'none';
        this.resultPanel.style.display = 'none';
    }
    
    generateAnswerOptions(candidates) {
        console.log('=== 生成答题选项 ===');
        console.log('candidates:', candidates);
        console.log('candidates长度:', candidates ? candidates.length : 'undefined');
        
        if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
            console.error('无效的候选点数据，无法生成答题选项:', candidates);
            this.answerOptions.innerHTML = '<p style="color: red;">无法加载答题选项，候选点数据缺失</p>';
            return;
        }
        
        // 不再动态生成选项，只更新静态选项的文本内容
        const optionTexts = this.answerOptions.querySelectorAll('.option-text');
        candidates.forEach((candidate, index) => {
            if (optionTexts[index]) {
                // 计算胜率损失
                let winRateLoss = '未知';
                if (candidate.winRate !== undefined && candidate.winRate !== null) {
                    // 数据库中的winRate已经是百分比形式（如35表示35%）
                    const winRatePercent = candidate.winRate;
                    winRateLoss = (100 - winRatePercent).toFixed(1);
                }
                
                optionTexts[index].textContent = `${candidate.label}: ${candidate.description || '候选点'} (胜率损失: ${winRateLoss}%)`;
            }
        });
        
        // 添加事件监听器，当选择答案时启用提交按钮
        const radioButtons = this.answerOptions.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
                this.submitAnswerBtn.disabled = false;
            });
        });
    }
    
    submitAnswer() {
        const selectedAnswer = document.querySelector('input[name="answer"]:checked');
        if (!selectedAnswer) return;
        
        const question = this.questions[this.currentQuestionIndex];
        const userAnswer = selectedAnswer.value;
        const isCorrect = userAnswer === question.correctAnswer;
        
        // 记录答案
        this.userAnswers.push({
            questionIndex: this.currentQuestionIndex,
            userAnswer: userAnswer,
            correctAnswer: question.correctAnswer,
            isCorrect: isCorrect,
            winrateChange: question.winrateChange
        });
        
        // 更新分数
        if (isCorrect) {
            this.score.correct++;
        } else {
            this.score.incorrect++;
        }
        
        // 显示结果
        this.showAnswerResult(isCorrect, question);
        
        // 更新分数显示
        this.updateScoreDisplay();
        
        // 禁用提交按钮，显示下一题按钮
        //this.submitAnswerBtn.disabled = true;
        this.nextQuestionBtn.style.display = 'inline-block';
    }
    
    showAnswerResult(isCorrect, question) {
        this.resultPanel.style.display = 'block';
        
        const resultText = isCorrect ? 
            `<span class="correct">✓ 回答正确！</span>` : 
            `<span class="incorrect">✗ 回答错误</span>`;
        
        // 生成所有选点的胜率损失信息
        let candidateInfo = '';
        if (question.candidates && Array.isArray(question.candidates)) {
            candidateInfo = question.candidates.map(candidate => {
                // 计算胜率损失
                let winRateLoss = '未知';
                if (candidate.winRate !== undefined && candidate.winRate !== null) {
                    // 数据库中的winRate已经是百分比形式
                    const winRatePercent = candidate.winRate;
                    winRateLoss = (100 - winRatePercent).toFixed(1);
                }
                
                const isCorrectChoice = candidate.label === question.correctAnswer;
                const style = isCorrectChoice ? 'color: green; font-weight: bold;' : '';
                return `<div style="${style}">选项${candidate.label}: ${candidate.description || '候选点'} (胜率损失: ${winRateLoss}%)</div>`;
            }).join('');
        }
        
        this.resultContent.innerHTML = `
            ${resultText}<br>
            正确答案：${question.correctAnswer}<br><br>
            <strong>各选点分析：</strong><br>
            ${candidateInfo}
        `;
        
        // 播放音效
        if (isCorrect && this.correctSound) {
            this.correctSound.play().catch(() => {});
        } else if (!isCorrect && this.incorrectSound) {
            this.incorrectSound.play().catch(() => {});
        }
    }
    
    nextQuestion() {
        this.currentQuestionIndex++;
        this.showCurrentQuestion();
    }
    
    updateScoreDisplay() {
        this.correctCountSpan.textContent = this.score.correct;
        this.incorrectCountSpan.textContent = this.score.incorrect;
        
        const total = this.score.correct + this.score.incorrect;
        const accuracy = total > 0 ? (this.score.correct / total * 100).toFixed(1) : 0;
        this.accuracyRateSpan.textContent = `${accuracy}%`;
    }
    
    // 在endQuiz方法中添加（第638行后）
    endQuiz() {
        this.isQuizActive = false;
        
        // 显示最终结果
        this.questionInfo.style.display = 'none';
        this.answerOptions.style.display = 'none';
        this.resultPanel.style.display = 'none';
        
        const total = this.score.correct + this.score.incorrect;
        const accuracy = total > 0 ? (this.score.correct / total * 100).toFixed(1) : 0;
        
        this.finalScore.innerHTML = `
            <h3>测验完成！</h3>
            <p>总题数：${total}</p>
            <p>正确：${this.score.correct}</p>
            <p>错误：${this.score.incorrect}</p>
            <p>正确率：${accuracy}%</p>
        `;
        
        this.finalScore.style.display = 'block';
        
        // 启用重新开始按钮
        this.resetQuizBtn.disabled = false;
    }
    
    resetQuiz() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = { correct: 0, incorrect: 0 };
        this.isQuizActive = false;
        this.usedQuestionIds.clear();
        
        // 隐藏所有界面
        this.questionInfo.style.display = 'none';
        this.quizProgress.style.display = 'none';
        this.answerOptions.style.display = 'none';
        this.resultPanel.style.display = 'none';
        this.finalScore.style.display = 'none';
        this.loadingState.style.display = 'block';
        
        // 清空棋盘
        this.quizBoard.clearBoard();
        
        // 重置分数显示
        this.updateScoreDisplay();
    }
    
    restartQuiz() {
        this.resetQuiz();
        this.loadQuestions();
    }

    convertCandidatePoints(candidatePoints) {
    console.log('转换候选点数据:', candidatePoints);
    
    if (!candidatePoints) {
        console.warn('候选点数据为空');
        return [];
    }
    
    // 如果是数组格式
    if (Array.isArray(candidatePoints)) {
        return candidatePoints.map((point, index) => {
            const labels = ['A', 'B', 'C', 'D'];
            return {
                // 保留所有原始字段
                ...point,
                // 确保基本字段存在
                row: point.row || point.y,
                col: point.col || point.x,
                label: point.label || labels[index],
                // 保留数据库字段
                type: point.type,
                position: point.position,
                winRate: point.winRate,
                description: point.description
            };
        });
    }
    
    // 如果是对象格式
    if (typeof candidatePoints === 'object') {
        const labels = ['A', 'B', 'C', 'D'];
        return Object.keys(candidatePoints).map((key, index) => {
            const point = candidatePoints[key];
            return {
                // 保留所有原始字段
                ...point,
                // 确保基本字段存在
                row: point.row || point.y,
                col: point.col || point.x,
                label: point.label || labels[index],
                // 保留数据库字段
                type: point.type,
                position: point.position,
                winRate: point.winRate,
                description: point.description
            };
        });
    }
    
    console.warn('无法识别的候选点格式:', candidatePoints);
    return [];
}
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.quizPage = new QuizPage();
});