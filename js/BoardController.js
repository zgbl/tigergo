/**
 * 棋盘控制模块 - 负责棋盘的渲染和控制
 */
class BoardController {
    constructor(analysisDisplay, analysisStorage) {
        console.log("🔧 BoardController 构造函数被调用");
        console.log("  - analysisDisplay:", analysisDisplay);
        console.log("  - analysisStorage:", analysisStorage);
        
        this.analysisDisplay = analysisDisplay;
        this.gameData = null;
        this.currentMoveIndex = -1;

        this.candidatePointsDisplay = new CandidatePointsDisplay(analysisStorage);
        console.log("  - candidatePointsDisplay 初始化完成:", this.candidatePointsDisplay);
    }

    // 设置游戏数据
    setGameData(gameData) {
        this.gameData = gameData;
        console.log("设置游戏数据 BoardContoller.js Line 13:", this.gameData);
        this.renderBoard();
    }

    // 设置事件监听器
    setupEventListeners() {
        const controls = {
            'logostartBtn': () => this.goToMove(0),
            'logofastBackwardBtn': () => this.goToMove(Math.max(0, this.currentMoveIndex - 5)),
            'logobackwardBtn': () => this.previousMove(),
            'logoforwardBtn': () => this.nextMove(),
            'logofastForwardBtn': () => this.goToMove(Math.min(this.gameData?.moves.length || 0, this.currentMoveIndex + 5)),
            'logoendBtn': () => this.goToLastMove(),
            'logoshowMovesBtn': () => this.toggleMoveNumbers(),
            'startBtn': () => this.goToMove(0),
            'prevBtn': () => this.previousMove(),
            'nextBtn': () => this.nextMove(),
            'endBtn': () => this.goToLastMove(),
            'autoPlayBtn': () => this.toggleAutoPlay()
        };

        Object.entries(controls).forEach(([id, handler]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', handler);
            }
        });
    }

    // 渲染棋盘
    renderBoard() {
        const boardElement = document.getElementById('board');
        if (boardElement && this.gameData) {
            console.log("准备渲染棋盘，moves格式:", this.gameData.moves.slice(0, 3));
            
            // 清空现有内容
            boardElement.innerHTML = '';
            
            // 计算棋盘大小
            const cellSize = this.calculateBoardSize();
            
            console.log('开始创建棋盘，cellSize:', cellSize);
            
            // 🔥 关键修复：设置全局变量，确保 GoBoard12.js 中的函数能正常工作
            window.currentMoves = this.gameData.moves;
            window.currentMoveIndex = -1;
            window.displayMode = 0;
            window.showingRecentMoves = false;
            window.globalParsedMoves = {
                moves: this.gameData.moves,
                gameInfo: this.gameData.gameInfo || {}
            };
            
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
                
                this.analysisDisplay.addLogEntry(`棋盘已创建，cellSize: ${cellSize}`, 'success');
                
                // 启用控制按钮
                setTimeout(() => {
                    this.enableControlButtons();
                    this.updateMoveInfo();
                }, 100);
            } else {
                console.error('createBoard3 函数未找到，请确保 GoBoard12.js 已加载');
                this.analysisDisplay.addLogEntry('棋盘创建失败：缺少必要的函数', 'error');
            }
        }
    }

   /* setupBoardControls() {   //listerner重复了
        const controls = {
            'logostartBtn': () => this.goToMove(0),
            'logofastBackwardBtn': () => this.goToMove(Math.max(0, this.currentMoveIndex - 10)),
            'logobackwardBtn': () => this.previousMove(),
            'logoforwardBtn': () => this.nextMove(),
            'logofastForwardBtn': () => this.goToMove(Math.min(this.gameData?.moves.length || 0, this.currentMoveIndex + 10)),
            'logoendBtn': () => this.goToLastMove(),
            'logoshowMovesBtn': () => this.toggleMoveNumbers(),
            'startBtn': () => this.goToMove(0),
            'prevBtn': () => this.previousMove(),
            'nextBtn': () => this.nextMove(),
            'endBtn': () => this.goToLastMove(),
            'autoPlayBtn': () => this.toggleAutoPlay()
        };  

        Object.entries(controls).forEach(([id, handler]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', handler);
            }
        });
    }  */

    updateMoveInfo() {
        const moveInfoElement = document.getElementById('moveInfo');
        if (moveInfoElement && this.gameData) {
            const currentIndex = window.currentMoveIndex !== undefined ? window.currentMoveIndex : this.currentMoveIndex;
            const moveNum = Math.max(0, currentIndex + 1);
            moveInfoElement.textContent = `当前步数：${moveNum} / ${this.gameData.moves.length}`;
            
            // 🔥 调试：添加日志
            console.log("🔍 BoardController.updateMoveInfo() 被调用");
            console.log("  - currentIndex:", currentIndex);
            console.log("  - candidatePointsDisplay:", this.candidatePointsDisplay);
            console.log("  - candidatePointsDisplay.currentSGFHash:", this.candidatePointsDisplay?.currentSGFHash);
            
            // 🔥 新增：显示当前步的候选点
            if (this.candidatePointsDisplay) {
                console.log("  - 准备调用 displayCandidatePoints");
                this.candidatePointsDisplay.displayCandidatePoints(currentIndex);
            } else {
                console.error("  - candidatePointsDisplay 未初始化！");
            }
        }
    }
    

        goToMove(index) {
        console.log("🔍 BoardController.goToMove() 被调用，index:", index);
        this.currentMoveIndex = index;
        console.log("currentMoveIndex:", this.currentMoveIndex);
        if (typeof renderMovesToIndex === 'function') {
            renderMovesToIndex(index);
        }
        console.log("🔍 准备调用 updateMoveInfo()");
        this.updateMoveInfo(); // 这里会调用displayCandidatePoints
    }

    previousMove() {
        if (typeof moveBackward === 'function') {
            moveBackward();
        }
        this.updateMoveInfo(); // 这里会调用displayCandidatePoints
    }

    nextMove() {
        if (typeof moveForward === 'function') {
            moveForward();
        }
        this.updateMoveInfo(); // 这里会调用displayCandidatePoints
    }

    goToLastMove() {
        if (typeof moveToEnd === 'function') {
            moveToEnd();
        }
        this.updateMoveInfo(); // 这里会调用displayCandidatePoints
    }

    // 清空棋盘
    // 清空棋盘
    clearBoard() {
        // 直接实现清空棋盘逻辑，避免调用可能被重写的全局函数
        const intersections = document.querySelectorAll('.intersection');
        intersections.forEach(intersection => {
            const stone = intersection.querySelector('.stone');
            if (stone) {
                intersection.removeChild(stone);
            }
        });
        
        // 清空棋盘状态
        if (typeof boardState !== 'undefined') {
            for (let i = 0; i < 19; i++) {
                for (let j = 0; j < 19; j++) {
                    boardState[i][j] = null;
                }
            }
        }
        
        console.log('BoardController.clearBoard 执行完成');
    }

    // 计算棋盘大小
    calculateBoardSize() {
        if (typeof calculateBoardSize === 'function') {
            const { cellSize } = calculateBoardSize();
            return cellSize;
        }
        return 30; // 默认值
    }

    // 启用控制按钮
    enableControlButtons() {
        // 简单实现，避免额外复杂性
        console.log('控制按钮已启用');
    }

    // 触发候选点显示事件
    dispatchCandidatePointsEvent(currentMoveIndex) {
        const event = new CustomEvent('updateCandidatePoints', {
            detail: { currentMoveIndex }
        });
        document.dispatchEvent(event);
    }
}