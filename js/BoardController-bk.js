/**
 * 棋盘控制模块 - 负责棋盘的渲染和控制
 */
class BoardController {
    constructor(analysisDisplay) {
        this.analysisDisplay = analysisDisplay;
        this.gameData = null;
        this.currentMoveIndex = -1;
    }

    // 设置游戏数据
    setGameData(gameData) {
        this.gameData = gameData;
    }

    // 设置事件监听器
    setupEventListeners() {
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
            
            // 设置全局变量
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

    // 计算棋盘大小
    calculateBoardSize() {
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        const maxWinSize = 3000;
        const minWinSize = 300;
        
        let cellSizeFromWidth, cellSizeFromHeight;
        
        // 根据宽度计算 cellSize
        if (winWidth < 480) {
            cellSizeFromWidth = Math.floor((winWidth - 20) / 20);
            if (winWidth < minWinSize) {
                cellSizeFromWidth = Math.floor((minWinSize - 20) / 20);
            }
        } else if (winWidth > 768) {
            cellSizeFromWidth = Math.floor(winWidth / 25);
            if (winWidth > maxWinSize) {
                cellSizeFromWidth = Math.floor(maxWinSize / 25);
            }
        } else {
            cellSizeFromWidth = 30;
        }

        // 根据高度计算 cellSize
        if (winHeight < 480) {
            cellSizeFromHeight = Math.floor((winHeight - 20) / 20);
            if (winHeight < minWinSize) {
                cellSizeFromHeight = Math.floor((minWinSize - 20) / 20);
            }
        } else if (winHeight > 768) {
            cellSizeFromHeight = Math.floor(winHeight / 25);
            if (winHeight > maxWinSize) {
                cellSizeFromHeight = Math.floor(maxWinSize / 25);
            }
        } else {
            cellSizeFromHeight = 30;
        }

        let cellSize = Math.min(cellSizeFromWidth, cellSizeFromHeight);
        cellSize = Math.max(15, Math.min(cellSize, 50));
        
        return cellSize;
    }

    // 启用控制按钮
    enableControlButtons() {
        const iconButtons = [
            'logostartBtn', 'logofastBackwardBtn', 'logobackwardBtn', 
            'logoforwardBtn', 'logofastForwardBtn', 'logoendBtn', 'logoshowMovesBtn'
        ];
        
        iconButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        });
        
        const originalButtons = ['startBtn', 'prevBtn', 'nextBtn', 'endBtn', 'autoPlayBtn'];
        originalButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = false;
            }
        });
        
        this.analysisDisplay.addLogEntry('控制按钮已启用', 'success');
    }

    // 棋盘控制方法
    goToMove(index) {
        this.currentMoveIndex = index;
        if (typeof renderMovesToIndex === 'function') {
            renderMovesToIndex(index);
        }
        this.updateMoveInfo();
    }

    previousMove() {
        if (typeof moveBackward === 'function') {
            moveBackward();
        }
        this.updateMoveInfo();
    }

    nextMove() {
        if (typeof moveForward === 'function') {
            moveForward();
        }
        this.updateMoveInfo();
    }

    goToLastMove() {
        if (typeof moveToEnd === 'function') {
            moveToEnd();
        }
        this.updateMoveInfo();
    }

    toggleMoveNumbers() {
        this.analysisDisplay.addLogEntry('显示步数功能开发中...', 'warning');
    }

    toggleAutoPlay() {
        this.analysisDisplay.addLogEntry('自动播放功能开发中...', 'warning');
    }

    // 更新移动信息
    updateMoveInfo() {
        const moveInfoElement = document.getElementById('moveInfo');
        if (moveInfoElement && this.gameData) {
            const currentIndex = window.currentMoveIndex !== undefined ? window.currentMoveIndex : this.currentMoveIndex;
            const moveNum = Math.max(0, currentIndex + 1);
            moveInfoElement.textContent = `当前步数：${moveNum} / ${this.gameData.moves.length}`;
            
            // 触发候选点显示事件
            this.dispatchCandidatePointsEvent(currentIndex);
        }
    }

    // 触发候选点显示事件
    dispatchCandidatePointsEvent(currentMoveIndex) {
        const event = new CustomEvent('updateCandidatePoints', {
            detail: { currentMoveIndex }
        });
        document.dispatchEvent(event);
    }
}