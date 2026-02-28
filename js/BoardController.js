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
            'logostartBtn': () => this.goToMove(-1), // 回到最初 (空棋盘)
            'logofastBackwardBtn': () => {
                const currentIndex = window.currentMoveIndex !== undefined ? window.currentMoveIndex : this.currentMoveIndex;
                this.goToMove(Math.max(-1, currentIndex - 10)); // 快退10步
            },
            'logobackwardBtn': () => this.previousMove(),
            'logoforwardBtn': () => this.nextMove(),
            'logofastForwardBtn': () => {
                const currentIndex = window.currentMoveIndex !== undefined ? window.currentMoveIndex : this.currentMoveIndex;
                this.goToMove(Math.min((this.gameData?.moves.length || 0) - 1, currentIndex + 10)); // 快进10步
            },
            'logoendBtn': () => this.goToLastMove(),
            'logoshowMovesBtn': () => this.toggleMoveNumbers(),
            'startBtn': () => this.goToMove(-1),
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
            // window.currentMoveIndex = -1; // 移除这行，由调用方决定
            window.displayMode = window.displayMode || 0;
            window.showingRecentMoves = window.showingRecentMoves || false;
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
                // 标准化为 0.95
                window.stoneSize = Math.floor(cellSize * 0.95);

                createBoard3({
                    domElement: boardElement,
                    boardSize: 19,
                    cellSize: cellSize,
                    lineColor: '#000',
                    backgroundColor: '#DEB887'
                });

                if (this.analysisDisplay && typeof this.analysisDisplay.addLogEntry === 'function') {
                    this.analysisDisplay.addLogEntry(`棋盘已创建，cellSize: ${cellSize}`, 'success');
                }

                // 启用控制按钮
                setTimeout(() => {
                    this.enableControlButtons();
                    this.updateMoveInfo();
                }, 100);
            } else {
                console.error('createBoard3 函数未找到，请确保 GoBoard12.js 已加载');
                if (this.analysisDisplay && typeof this.analysisDisplay.addLogEntry === 'function') {
                    this.analysisDisplay.addLogEntry('棋盘创建失败：缺少必要的函数', 'error');
                }
            }
        }
    }

    // 刷新棋盘展示 (用于 resize 等场景，不重置进度)
    refreshBoard() {
        const boardElement = document.getElementById('board');
        if (!boardElement || !this.gameData) return;

        const currentIndex = window.currentMoveIndex !== undefined ? window.currentMoveIndex : this.currentMoveIndex;
        console.log(`🔄 BoardController.refreshBoard(), 当前步数: ${currentIndex}`);

        // 重新渲染基础棋盘
        this.renderBoard();

        // 恢复到当前步
        if (currentIndex >= -1) {
            this.goToMove(currentIndex);
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

            // 🔥 新增：显示最后一步的三角标记
            this.renderLastMoveMarker();
        }
    }

    /**
     * 渲染最后一步的三角标记
     */
    renderLastMoveMarker() {
        // 清除旧的三角标记
        document.querySelectorAll('.last-move-triangle').forEach(el => el.remove());

        // 🔥 使用更鲁棒的方式获取当前步数，确保与全局同步
        let currentIndex = -1;
        if (typeof window.currentMoveIndex !== 'undefined' && window.currentMoveIndex !== null) {
            currentIndex = window.currentMoveIndex;
        } else if (typeof currentMoveIndex !== 'undefined' && currentMoveIndex !== null) {
            // 某些旧脚本可能直接定义了全局 currentMoveIndex 而不是在 window 上
            currentIndex = currentMoveIndex;
        } else {
            currentIndex = this.currentMoveIndex;
        }

        console.log(`📐 renderLastMoveMarker: currentIndex=${currentIndex}`);

        if (!this.gameData || !this.gameData.moves || currentIndex < 0) return;

        const lastMove = this.gameData.moves[currentIndex];
        if (lastMove && lastMove.row !== undefined && lastMove.col !== undefined && !lastMove.pass) {
            const intersection = document.querySelector(`[data-row="${lastMove.row}"][data-col="${lastMove.col}"]`);
            if (intersection && intersection.querySelector('.stone')) {
                const triangle = document.createElement('div');
                triangle.className = 'last-move-triangle';

                // 判断颜色，选择合适的三角颜色
                const isBlack = lastMove.color === 'black' || lastMove.color === 'B';
                const triColor = isBlack ? '#ffffff' : '#000000';

                triangle.style.cssText = `
                    position: absolute;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    width: 0; height: 0;
                    border-left: calc(var(--cell-size, 30px) * 0.22) solid transparent;
                    border-right: calc(var(--cell-size, 30px) * 0.22) solid transparent;
                    border-bottom: calc(var(--cell-size, 30px) * 0.38) solid ${triColor};
                    z-index: 15;
                    pointer-events: none;
                    filter: drop-shadow(0 0 1px rgba(0,0,0,0.5));
                `;
                intersection.appendChild(triangle);
            }
        }
    }



    goToMove(index) {
        console.log(`🔍 BoardController.goToMove(${index})`);
        this.currentMoveIndex = index;
        window.currentMoveIndex = index; // 确保全局同步

        if (typeof renderMovesToIndex === 'function') {
            renderMovesToIndex(index);
        } else {
            console.error("❌ renderMovesToIndex function not found!");
        }

        this.updateMoveInfo();
    }

    previousMove() {
        console.log("🔍 BoardController.previousMove()");
        if (typeof moveBackward === 'function') {
            moveBackward();
            this.currentMoveIndex = window.currentMoveIndex; // 反向同步
        } else {
            console.error("❌ moveBackward function not found!");
        }
        this.updateMoveInfo();
    }

    nextMove() {
        console.log("🔍 BoardController.nextMove()");
        if (typeof moveForward === 'function') {
            moveForward();
            this.currentMoveIndex = window.currentMoveIndex; // 反向同步
        } else {
            console.error("❌ moveForward function not found!");
        }
        this.updateMoveInfo();
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