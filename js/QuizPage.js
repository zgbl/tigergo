class QuizPage {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = { correct: 0, incorrect: 0 };
        this.isQuizActive = false;
        this.usedQuestionIds = new Set(); // 记录已使用的题目ID
        this.allAvailableQuestions = []; // 存储所有可用题目

        // Initialize state
        window.currentMoves = [];
        window.currentMoveIndex = -1;
        window.displayMode = 0;
        window.showingRecentMoves = false;

        this.initializeElements();
        this.bindEvents();
        this.initBoard();
        this.bindResize();
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
        this.stoneSound = document.getElementById('stoneSound');

        // 🔊 音量控制
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        const savedVol = parseInt(localStorage.getItem('quizVolume') ?? '30');
        this.setVolume(savedVol);
    }

    setVolume(pct) {
        const vol = Math.max(0, Math.min(100, pct)) / 100;
        if (this.correctSound) this.correctSound.volume = vol;
        if (this.incorrectSound) this.incorrectSound.volume = vol;
        if (this.stoneSound) this.stoneSound.volume = vol;
        if (this.volumeSlider) this.volumeSlider.value = pct;
        if (this.volumeValue) this.volumeValue.textContent = `${pct}%`;
        localStorage.setItem('quizVolume', pct);
    }

    bindEvents() {
        this.loadQuestionsBtn.addEventListener('click', () => this.loadQuestions());
        this.resetQuizBtn.addEventListener('click', () => this.resetQuiz());
        this.nextGroupBtn.addEventListener('click', () => this.loadNextGroup()); // 新增
        this.submitAnswerBtn.addEventListener('click', () => this.submitAnswer());
        this.nextQuestionBtn.addEventListener('click', () => this.nextQuestion());
        this.restartQuizBtn.addEventListener('click', () => this.restartQuiz());

        // 🔊 音量滑块
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => this.setVolume(parseInt(e.target.value)));
        }
        const volumeIcon = document.getElementById('volumeIcon');
        const volumePopup = document.getElementById('volumePopup');
        if (volumeIcon && volumePopup) {
            volumeIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                volumePopup.style.display = volumePopup.style.display === 'flex' ? 'none' : 'flex';
            });
            document.addEventListener('click', (e) => {
                if (!volumePopup.contains(e.target) && e.target !== volumeIcon) {
                    volumePopup.style.display = 'none';
                }
            });
        }

        // 答题选项变化事件
        this.answerOptions.addEventListener('change', (e) => {
            if (e.target.type === 'radio') {
                this.submitAnswerBtn.disabled = false;

                // 新增：选中右侧时，同步高亮棋盘上的点
                const label = e.target.parentElement.querySelector('.option-marker').textContent.trim();
                if (this.quizBoard) {
                    this.quizBoard.selectCandidate(label);
                }
            }
        });
    }

    initBoard() {
        const { cellSize, stoneSize } = this.calculateBoardSize();
        this.updateStoneSizeCSS(cellSize);

        this.quizBoard = new QuizBoard('board', {
            boardSize: 19,
            cellSize: cellSize,
            stoneSize: stoneSize,
            onOptionClick: (label) => this.handleBoardOptionClick(label)
        });
    }

    handleBoardOptionClick(label) {
        console.log("QuizPage handling board click for:", label);

        // 查找对应的单选按钮
        const radios = document.querySelectorAll('input[name="answer"]');
        let found = false;

        radios.forEach(radio => {
            const radioLabel = radio.parentElement.querySelector('.option-marker').textContent.trim();
            if (radioLabel === label) {
                radio.checked = true;
                found = true;

                // 启用提交按钮
                if (this.submitAnswerBtn) {
                    this.submitAnswerBtn.disabled = false;
                }

                // 在棋盘上突出显示
                if (this.quizBoard) {
                    this.quizBoard.selectCandidate(label);
                }

                // 给右侧卡片添加反馈 (可选，checked 状态已有 CSS 处理)
                console.log("Matched and checked radio for", label);
            }
        });

        if (!found) {
            console.warn("Could not find radio for option label:", label);
        }
    }

    calculateBoardSize() {
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        // 获取主内容区域的大致宽度
        const container = document.querySelector('.main-content');
        const contentWidth = container ? container.clientWidth - 40 : winWidth * 0.6;

        let cellSizeFromWidth = Math.floor(contentWidth / 20);
        let cellSizeFromHeight = Math.floor((winHeight - 200) / 20);

        let cellSize = Math.min(cellSizeFromWidth, cellSizeFromHeight);
        cellSize = Math.max(20, Math.min(cellSize, 60)); // 限制范围

        // 🔥 应用 0.8 缩放系数，防止棋盘过大挤出屏幕
        cellSize = Math.floor(cellSize * 0.8);

        const stoneSize = Math.floor(cellSize * 0.95);
        return { cellSize, stoneSize };
    }

    updateStoneSizeCSS(cellSize) {
        document.documentElement.style.setProperty('--stone-size', `${cellSize}px`);
        document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
        document.documentElement.style.setProperty('--font-size', `${cellSize * 0.4}px`);
    }

    bindResize() {
        window.addEventListener('resize', () => {
            const { cellSize, stoneSize } = this.calculateBoardSize();
            this.updateStoneSizeCSS(cellSize);

            if (this.quizBoard) {
                this.quizBoard.cellSize = cellSize;
                this.quizBoard.stoneSize = stoneSize;
                this.quizBoard.initializeBoard();

                // 重新显示当前题目
                if (this.questions && this.questions[this.currentQuestionIndex]) {
                    const q = this.questions[this.currentQuestionIndex];
                    this.quizBoard.displayPosition(q.boardState, q.candidates, q.lastMove);
                }
            }
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
                    const labels = ['A', 'B', 'C', 'D', 'E'];
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
                    currentPlayer: q.currentPlayer || 'black',
                    lastMove: q.lastMove || null, // 🔥 新增：上一步信息
                    blackPlayer: q.blackPlayer || '',
                    whitePlayer: q.whitePlayer || '',
                    blackRank: q.blackRank || '',
                    whiteRank: q.whiteRank || '',
                    gameDate: q.gameDate || '',
                    result: q.result || '',
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
        const newQuestions = rawQuestions.map((q, index) => {
            // 候选点处理 (与 loadQuestions 逻辑保持一致)
            let candidates = [];
            let correctAnswer = 'A';

            if (q.candidatePoints && Array.isArray(q.candidatePoints)) {
                candidates = this.convertCandidatePoints(q.candidatePoints);
                candidates = this.shuffleArray(candidates);

                // 重新分配 A/B/C/D 标签
                const labels = ['A', 'B', 'C', 'D', 'E'];
                candidates = candidates.map((c, idx) => ({
                    ...c,
                    label: labels[idx]
                }));

                // 通过 position 字段匹配正确答案
                if (q.correctAnswer && q.correctAnswer.position) {
                    const correctCandidate = candidates.find(c => c.position === q.correctAnswer.position);
                    if (correctCandidate) {
                        correctAnswer = correctCandidate.label;
                    } else {
                        const bestCandidate = candidates.find(c => c.type === 'best');
                        if (bestCandidate) correctAnswer = bestCandidate.label;
                    }
                } else {
                    const bestCandidate = candidates.find(c => c.type === 'best');
                    if (bestCandidate) correctAnswer = bestCandidate.label;
                }
            }

            return {
                id: q.id || q._id,
                questionNumber: this.allAvailableQuestions.length + index + 1,
                title: q.questionText || '请选择最佳下法',
                difficulty: q.difficulty || '中等',
                source: q.sgfFilename || '实战对局',
                boardState: this.convertBoardState(q.boardState),
                candidates: candidates,
                correctAnswer: correctAnswer,
                currentPlayer: q.currentPlayer || 'black',
                lastMove: q.lastMove || null, // 🔥 新增：上一步信息
                blackPlayer: q.blackPlayer || '',
                whitePlayer: q.whitePlayer || '',
                blackRank: q.blackRank || '',
                whiteRank: q.whiteRank || '',
                gameDate: q.gameDate || '',
                result: q.result || '',
                winrateChange: q.winRateLoss || 0
            };
        });

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

        // 更新游戏元数据 (紧凑单行显示)
        const gameMetadataEl = document.getElementById('gameMetadata');
        if (gameMetadataEl) {
            const bName = question.blackPlayer || '未知';
            const wName = question.whitePlayer || '未知';
            const parts = [`黑:${bName} vs 白:${wName}`];
            if (question.gameDate && question.gameDate !== '未知') parts.push(question.gameDate);
            if (question.result && question.result !== '未知') parts.push(question.result);
            gameMetadataEl.innerHTML = parts.join(' | ');
        }

        // 更新进度
        this.currentQuestionSpan.textContent = this.currentQuestionIndex + 1;
        const progress = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
        this.progressFill.style.width = `${progress}%`;

        console.log("QuizPage: Preparing to show question", {
            id: question.id,
            num: question.questionNumber,
            lastMove: question.lastMove
        });

        // 显示棋盘
        this.quizBoard.displayPosition(question.boardState, question.candidates, question.lastMove);

        // 生成答题选项
        this.generateAnswerOptions(question.candidates);

        // 重置棋盘上的选中高亮
        if (this.quizBoard && this.quizBoard.selectCandidate) {
            this.quizBoard.selectCandidate(null);
        }

        // 重置按钮状态
        //this.submitAnswerBtn.disabled = true;
        this.nextQuestionBtn.style.display = 'none';
        this.resultPanel.style.display = 'none';
    }

    generateAnswerOptions(candidates) {
        console.log('=== 生成答题选项 ===');
        console.log('candidates长度:', candidates ? candidates.length : 'undefined');

        if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
            console.error('无效的候选点数据:', candidates);
            this.answerOptions.innerHTML = '<p style="color: red;">候选点数据缺失</p>';
            return;
        }

        const question = this.questions[this.currentQuestionIndex];
        const isBlackTurn = question.currentPlayer === 'black';
        const winrates = candidates.map(c => c.winRate || 0);
        const baselineWinRate = isBlackTurn ? Math.max(...winrates) : Math.min(...winrates);

        // 🔥 动态生成选项 HTML，根据实际候选点数量 (支持4选项和5选项)
        const markerClasses = ['a', 'b', 'c', 'd', 'e'];
        let optionsHtml = '';
        candidates.forEach((candidate, index) => {
            const label = candidate.label || String.fromCharCode(65 + index);
            const optionId = `option${label}`;
            const markerClass = markerClasses[index] || '';

            let winRateLossDisp = '0.0';
            if (candidate.winRate !== undefined && candidate.winRate !== null) {
                const wr = candidate.winRate;
                winRateLossDisp = isBlackTurn ?
                    Math.max(0, baselineWinRate - wr).toFixed(1) :
                    Math.max(0, wr - baselineWinRate).toFixed(1);
            }
            const lossValue = parseFloat(winRateLossDisp);
            const lossText = lossValue === 0 ? '0.0%' : `-${winRateLossDisp}%`;
            const descText = candidate.description || '';

            optionsHtml += `
                <div class="answer-option">
                    <input type="radio" id="${optionId}" name="answer" value="${label}" />
                    <label for="${optionId}" class="option-label">
                        <span class="option-marker ${markerClass}">${label}</span>
                        <span class="option-text" data-loss-text="${lossText}" data-desc-text="${descText}">${label}</span>
                    </label>
                </div>`;
        });

        this.answerOptions.innerHTML = optionsHtml;

        // 绑定事件
        this.answerOptions.querySelectorAll('input[type="radio"]').forEach(radio => {
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
            const isBlackTurn = question.currentPlayer === 'black';
            const winrates = question.candidates.map(c => c.winRate || 0);
            const baselineWinRate = isBlackTurn ? Math.max(...winrates) : Math.min(...winrates);

            candidateInfo = question.candidates.map(candidate => {
                // 计算胜率损失
                let winRateLossDisp = '0.0';
                if (candidate.winRate !== undefined && candidate.winRate !== null) {
                    const winRatePercent = candidate.winRate;
                    // 黑棋损失 = 最高 - 当前; 白棋损失 = 当前 - 最低
                    winRateLossDisp = isBlackTurn ?
                        Math.max(0, baselineWinRate - winRatePercent).toFixed(1) :
                        Math.max(0, winRatePercent - baselineWinRate).toFixed(1);
                }

                const isCorrectChoice = candidate.label === question.correctAnswer;
                const style = isCorrectChoice ? 'color: green; font-weight: bold;' : '';
                const lossValue = parseFloat(winRateLossDisp);

                // 如果是正确选项，为了避免红绿冲突，这里可以保持原本的颜色，或者使用暗红色
                const lossColor = isCorrectChoice ? 'inherit' : (lossValue === 0 ? 'inherit' : '#e53e3e');
                const lossText = lossValue === 0 ? `0.0%` : `<span style="color: ${lossColor};">-${winRateLossDisp}%</span>`;
                const descText = candidate.description ? `  ${candidate.description}` : '';

                return `<div style="${style}">选项${candidate.label}: ${lossText}${descText}</div>`;
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
            this.correctSound.play().catch(() => { });
        } else if (!isCorrect && this.incorrectSound) {
            this.incorrectSound.play().catch(() => { });
        }

        // 🔥 答题后：揭示所有选项的胜率损失和描述
        const optionTexts = this.answerOptions.querySelectorAll('.option-text');
        if (question.candidates) {
            question.candidates.forEach((candidate, idx) => {
                if (optionTexts[idx]) {
                    const loss = optionTexts[idx].dataset.lossText || '';
                    const desc = optionTexts[idx].dataset.descText || '';
                    const isCorrectChoice = candidate.label === question.correctAnswer;
                    const lossColor = (loss === '0.0%' || isCorrectChoice) ? 'inherit' : '#e53e3e';
                    const descHtml = desc ? `  ${desc}` : '';
                    optionTexts[idx].innerHTML = `${candidate.label}: <span style="color:${lossColor}">${loss}</span>${descHtml}`;
                    // 高亮正确答案
                    if (isCorrectChoice) {
                        optionTexts[idx].closest('.answer-option')?.style.setProperty('background', '#e6ffed');
                    }
                }
            });
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
                const labels = ['A', 'B', 'C', 'D', 'E'];
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
            const labels = ['A', 'B', 'C', 'D', 'E'];
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
    // 加载公共导航栏
    if (typeof loadNavbar === 'function') {
        loadNavbar();
    }

    window.quizPage = new QuizPage();
});