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
        
        // 使用新的棋盘显示类
        this.quizBoard = new QuizBoard('boardPlaceholder', {
            boardSize: 19,
            cellSize: 28,
            stoneSize: 26
        });
        
        // 添加模拟数据用于测试
        this.mockQuestions = this.createMockQuestions();
        this.allAvailableQuestions = [...this.mockQuestions];
    }
    
    // 添加创建模拟题目数据的方法
    createMockQuestions() {
        return [
            {
                id: "mock_question_1",
                questionNumber: 1,
                title: "请选择最佳下法",
                difficulty: "中等",
                source: "实战对局",
                boardState: [
                    {row: 3, col: 3, color: "black"},
                    {row: 3, col: 4, color: "white"},
                    {row: 4, col: 3, color: "white"},
                    {row: 4, col: 4, color: "black"},
                    {row: 5, col: 5, color: "black"},
                    {row: 6, col: 6, color: "white"},
                    {row: 7, col: 7, color: "black"},
                    {row: 8, col: 8, color: "white"},
                    {row: 9, col: 9, color: "black"},
                    {row: 10, col: 10, color: "white"},
                    {row: 11, col: 11, color: "black"},
                    {row: 12, col: 12, color: "white"}
                ],
                candidates: [
                    {row: 5, col: 4, label: "A"},
                    {row: 6, col: 5, label: "B"},
                    {row: 7, col: 6, label: "C"},
                    {row: 8, col: 7, label: "D"}
                ],
                correctAnswer: "A",
                winrateChange: -5.2
            },
            {
                id: "mock_question_2",
                questionNumber: 2,
                title: "选择最佳应对",
                difficulty: "困难",
                source: "职业对局",
                boardState: [
                    {row: 15, col: 15, color: "black"},
                    {row: 15, col: 16, color: "white"},
                    {row: 16, col: 15, color: "white"},
                    {row: 16, col: 16, color: "black"},
                    {row: 14, col: 14, color: "black"},
                    {row: 13, col: 13, color: "white"},
                    {row: 12, col: 12, color: "black"},
                    {row: 11, col: 11, color: "white"},
                    {row: 10, col: 10, color: "black"},
                    {row: 9, col: 9, color: "white"}
                ],
                candidates: [
                    {row: 14, col: 15, label: "A"},
                    {row: 15, col: 14, label: "B"},
                    {row: 17, col: 17, label: "C"},
                    {row: 13, col: 14, label: "D"}
                ],
                correctAnswer: "B",
                winrateChange: -8.7
            },
            {
                id: "mock_question_3",
                questionNumber: 3,
                title: "寻找最强手段",
                difficulty: "简单",
                source: "定式练习",
                boardState: [
                    {row: 2, col: 2, color: "black"},
                    {row: 2, col: 3, color: "white"},
                    {row: 3, col: 2, color: "white"},
                    {row: 3, col: 3, color: "black"},
                    {row: 1, col: 1, color: "black"},
                    {row: 1, col: 2, color: "white"},
                    {row: 2, col: 1, color: "white"},
                    {row: 4, col: 4, color: "black"},
                    {row: 5, col: 5, color: "white"}
                ],
                candidates: [
                    {row: 1, col: 3, label: "A"},
                    {row: 3, col: 1, label: "B"},
                    {row: 4, col: 2, label: "C"},
                    {row: 2, col: 4, label: "D"}
                ],
                correctAnswer: "C",
                winrateChange: -3.1
            },
            // 添加更多模拟题目以便测试下一组功能
            {
                id: "mock_question_4",
                questionNumber: 4,
                title: "攻击要点",
                difficulty: "中等",
                source: "实战对局",
                boardState: [
                    {row: 6, col: 6, color: "black"},
                    {row: 6, col: 7, color: "white"},
                    {row: 7, col: 6, color: "white"},
                    {row: 7, col: 7, color: "black"}
                ],
                candidates: [
                    {row: 5, col: 6, label: "A"},
                    {row: 6, col: 5, label: "B"},
                    {row: 8, col: 8, label: "C"},
                    {row: 5, col: 8, label: "D"}
                ],
                correctAnswer: "A",
                winrateChange: -4.5
            },
            {
                id: "mock_question_5",
                questionNumber: 5,
                title: "防守要点",
                difficulty: "困难",
                source: "职业对局",
                boardState: [
                    {row: 8, col: 8, color: "white"},
                    {row: 8, col: 9, color: "black"},
                    {row: 9, col: 8, color: "black"},
                    {row: 9, col: 9, color: "white"}
                ],
                candidates: [
                    {row: 7, col: 8, label: "A"},
                    {row: 8, col: 7, label: "B"},
                    {row: 10, col: 10, label: "C"},
                    {row: 7, col: 10, label: "D"}
                ],
                correctAnswer: "B",
                winrateChange: -6.8
            }
        ];
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
            this.loadQuestionsBtn.disabled = true;
            this.loadQuestionsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
            
            const apiUrl = `${CONFIG.API_VERCEL_NEXTJS_BASE_URL}/api/testQuestions`;
            const params = new URLSearchParams({
                limit: count.toString(),
                sortBy: 'createdAt',
                sortOrder: 'desc'
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
            
            // 调试信息
            console.log('原始题目数据示例:', rawQuestions[0]);
            console.log('原始boardState:', rawQuestions[0]?.boardState);
            console.log('原始candidatePoints:', rawQuestions[0]?.candidatePoints);
            
            // 转换数据格式以匹配前端需求
            this.allAvailableQuestions = rawQuestions.map((q, index) => {
                console.log(`处理题目 ${index + 1}:`, {
                    id: q.id || q._id,
                    boardState: q.boardState,
                    candidatePoints: q.candidatePoints
                });
                
                // 处理棋盘状态 - 如果数据库中没有，创建空棋盘
                let boardState = [];
                if (q.boardState && Array.isArray(q.boardState)) {
                    boardState = this.convertBoardState(q.boardState);
                } else {
                    console.warn(`题目 ${q.id} 缺少棋盘状态数据`);
                    boardState = []; // 空棋盘
                }
                
                // 处理候选点 - 如果数据库中没有，创建默认选项
                let candidates = [];
                if (q.candidatePoints && Array.isArray(q.candidatePoints)) {
                    candidates = this.convertCandidatePoints(q.candidatePoints);
                } else {
                    console.warn(`题目 ${q.id} 缺少候选点数据，创建默认选项`);
                    // 创建默认的A、B、C、D选项
                    candidates = [
                        { row: 3, col: 3, label: 'A' },
                        { row: 3, col: 15, label: 'B' },
                        { row: 15, col: 3, label: 'C' },
                        { row: 15, col: 15, label: 'D' }
                    ];
                }
                
                return {
                    id: q.id || q._id,
                    questionNumber: index + 1,
                    title: q.questionText || '请选择最佳下法',
                    difficulty: q.difficulty || '中等',
                    source: q.sgfFilename || '实战对局',
                    boardState: boardState,
                    candidates: candidates,
                    correctAnswer: q.correctAnswer?.label || candidates[0]?.label || 'A',
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
                selectedQuestions = this.shuffleArray(selectedQuestions);
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
            sortOrder: 'desc'
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
        this.submitAnswerBtn.disabled = true;
        this.nextQuestionBtn.style.display = 'none';
        this.resultPanel.style.display = 'none';
    }
    
    generateAnswerOptions(candidates) {
        this.answerOptions.innerHTML = '';
        
        candidates.forEach(candidate => {
            const option = document.createElement('div');
            option.className = 'answer-option';
            option.innerHTML = `
                <input type="radio" id="option${candidate.label}" name="answer" value="${candidate.label}">
                <label for="option${candidate.label}">${candidate.label}</label>
            `;
            this.answerOptions.appendChild(option);
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
        this.submitAnswerBtn.disabled = true;
        this.nextQuestionBtn.style.display = 'inline-block';
    }
    
    showAnswerResult(isCorrect, question) {
        this.resultPanel.style.display = 'block';
        
        const resultText = isCorrect ? 
            `<span class="correct">✓ 回答正确！</span>` : 
            `<span class="incorrect">✗ 回答错误</span>`;
        
        this.resultContent.innerHTML = `
            ${resultText}<br>
            正确答案：${question.correctAnswer}<br>
            胜率损失：${Math.abs(question.winrateChange).toFixed(1)}%
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
                row: point.row || point.y,
                col: point.col || point.x,
                label: point.label || labels[index]
            };
        });
    }
    
    // 如果是对象格式
    if (typeof candidatePoints === 'object') {
        const labels = ['A', 'B', 'C', 'D'];
        return Object.keys(candidatePoints).map((key, index) => {
            const point = candidatePoints[key];
            return {
                row: point.row || point.y,
                col: point.col || point.x,
                label: point.label || labels[index]
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