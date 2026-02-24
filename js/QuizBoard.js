// 专门用于答题页面的棋盘显示 - 更新为使用专业 createBoard3 引擎
class QuizBoard {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.boardSize = options.boardSize || 19;
        this.cellSize = options.cellSize || 30; // 默认大小
        this.stoneSize = options.stoneSize || Math.floor(this.cellSize * 0.95);
        this.onOptionClick = options.onOptionClick || null; // 点击选项的回调

        this.initializeBoard();
        this.setupClickListeners();
    }

    setupClickListeners() {
        if (!this.container) return;

        this.container.addEventListener('click', (e) => {
            // 查找点击的是否是候选点或者是包含候选点的交叉点
            const marker = e.target.closest('.candidate-point');
            if (marker) {
                const label = marker.textContent.trim();
                console.log("Clicked board marker:", label);
                if (this.onOptionClick) this.onOptionClick(label);
                return;
            }

            const intersection = e.target.closest('.intersection');
            if (intersection) {
                const candidateMarker = intersection.querySelector('.candidate-point');
                if (candidateMarker) {
                    const label = candidateMarker.textContent.trim();
                    console.log("Clicked intersection with marker:", label);
                    if (this.onOptionClick) this.onOptionClick(label);
                }
            }
        });
    }

    initializeBoard() {
        if (!this.container) return;
        this.container.innerHTML = '';

        console.log("Initializing QuizBoard with createBoard3, cellSize:", this.cellSize);

        // 使用全局定义的 createBoard3 (在 Quiz.html 或 GoBoard12.js 中)
        if (typeof window.createBoard3 === 'function') {
            window.createBoard3({
                domElement: this.container,
                boardSize: this.boardSize,
                cellSize: this.cellSize,
                lineColor: "#000",
                backgroundColor: "#DEB887"
            });
        } else {
            console.error("Critical: window.createBoard3 is not defined!");
            // Fallback (极简版)
            this.container.style.width = `${this.boardSize * this.cellSize}px`;
            this.container.style.height = `${this.boardSize * this.cellSize}px`;
            this.container.style.backgroundColor = "#DEB887";
        }
    }

    // 清空棋盘上的棋子和标记
    clearBoard() {
        const stones = this.container.querySelectorAll('.stone');
        stones.forEach(stone => stone.remove());

        const candidates = this.container.querySelectorAll('.candidate-point');
        candidates.forEach(candidate => candidate.remove());
    }

    // 加载棋盘静态状态 (SGF局面) - 使用GoBoard12的placeStone3实现提子
    loadBoardState(boardStateData) {
        if (!boardStateData || !Array.isArray(boardStateData)) {
            console.error('Invalid boardState data:', boardStateData);
            return;
        }

        this.clearBoard();

        // 🔥 清除旧的三角标记
        document.querySelectorAll('.last-move-triangle').forEach(el => el.remove());

        // 重置GoBoard12的全局boardState（const声明，直接访问，不在window上）
        if (typeof boardState !== 'undefined') {
            for (let i = 0; i < 19; i++) {
                for (let j = 0; j < 19; j++) {
                    boardState[i][j] = null;
                }
            }
        }

        // 使用GoBoard12的placeStone3放子（更新全局boardState + DOM）
        boardStateData.forEach((move) => {
            if (move.row !== undefined && move.col !== undefined && move.color) {
                const color = (move.color.toLowerCase() === 'black' || move.color === 'B') ? 'black' : 'white';
                if (typeof placeStone3 === 'function') {
                    placeStone3(move.row, move.col, color, this.stoneSize);
                } else {
                    this.placeStoneAt(move.row, move.col, move.color);
                }
            }
        });

        // 全盘扫描：移除所有没有气的死子（复用GoBoard12的getGroup/hasLiberties/removeGroup）
        if (typeof getGroup === 'function' && typeof hasLiberties === 'function' && typeof removeGroup === 'function') {
            const checked = new Set();
            for (let r = 0; r < 19; r++) {
                for (let c = 0; c < 19; c++) {
                    if (boardState[r][c] && !checked.has(`${r},${c}`)) {
                        const group = getGroup(r, c);
                        group.forEach(pos => checked.add(pos));
                        if (!hasLiberties(group)) {
                            removeGroup(group);
                        }
                    }
                }
            }
        }
    }

    // 放置棋子 (匹配专业渲染)
    placeStoneAt(row, col, color) {
        const intersection = this.container.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (!intersection) return;

        // 移除旧棋子
        const existingStone = intersection.querySelector('.stone');
        if (existingStone) existingStone.remove();

        const stone = document.createElement('div');
        // color 可能为 'black', 'white', 'B', 'W'
        const stoneClass = (color.toLowerCase() === 'black' || color === 'B') ? 'black' : 'white';
        stone.className = `stone ${stoneClass}`;

        // 样式已通过 Quiz.css 控制，这里只需要设置基本定位和大小
        stone.style.width = `${this.stoneSize}px`;
        stone.style.height = `${this.stoneSize}px`;
        stone.style.left = "50%";
        stone.style.top = "50%";
        stone.style.transform = "translate(-50%, -50%)";

        intersection.appendChild(stone);
    }

    // 显示局面 (静态)
    displayPosition(boardState, candidates, lastMove) {
        this.loadBoardState(boardState);
        this.showCandidatePoints(candidates);

        // 如果有最后一步信息，显示彩色三角标记
        if (lastMove) {
            this.renderLastMoveMarker(lastMove);
        }
    }

    // 显示候选点 (ABCD)
    showCandidatePoints(candidates) {
        const labels = ['A', 'B', 'C', 'D', 'E'];
        const optionClasses = ['option-a', 'option-b', 'option-c', 'option-d', 'option-e'];

        candidates.forEach((candidate, index) => {
            if (index >= 5) return;

            const intersection = this.container.querySelector(`[data-row="${candidate.row}"][data-col="${candidate.col}"]`);
            if (!intersection) return;

            const marker = document.createElement('div');
            marker.className = `candidate-point ${optionClasses[index]}`;
            marker.textContent = candidate.label || labels[index];

            // 样式由 Quiz.css 控制
            marker.style.left = "50%";
            marker.style.top = "50%";
            marker.style.transform = "translate(-50%, -50%)";

            intersection.appendChild(marker);
        });
    }

    // 在棋盘上突出显示选中的候选点
    selectCandidate(label) {
        // 清除旧的选中状态
        const markers = this.container.querySelectorAll('.candidate-point');
        markers.forEach(m => m.classList.remove('selected'));

        // 添加新的选中状态
        markers.forEach(m => {
            if (m.textContent === label) {
                m.classList.add('selected');
            }
        });
    }

    // 🔥 新增：在当前局面的最后一手添加小三角标志
    renderLastMoveMarker(lastMove) {
        if (!lastMove || lastMove.row === undefined || lastMove.col === undefined) {
            console.log("QuizBoard: [Marker] No lastMove data.");
            return;
        }

        const row = lastMove.row;
        const col = lastMove.col;
        const color = lastMove.color;
        console.log(`QuizBoard: [Marker] Rendering triangle at [${row}, ${col}] color: ${color}`);

        // 优先在当前棋盘容器内找交叉点
        let intersection = this.container.querySelector(`[data-row="${row}"][data-col="${col}"]`);

        // 如果没找到，尝试全局找 (防御性)
        if (!intersection) {
            intersection = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        }

        if (intersection) {
            const stone = intersection.querySelector('.stone');
            if (stone) {
                // 如果已经有三角形了，先删掉
                const oldTri = intersection.querySelector('.last-move-triangle');
                if (oldTri) oldTri.remove();

                const triangle = document.createElement('div');
                triangle.className = 'last-move-triangle';

                const isBlack = (color && (color.toLowerCase() === 'black' || color === 'B' || color === 'b'));
                const triColor = isBlack ? '#ffffff' : '#000000';

                // 强制内联样式，确保可见性
                triangle.style.cssText = `
                    position: absolute;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    width: 0; height: 0;
                    border-left: 8px solid transparent;
                    border-right: 8px solid transparent;
                    border-bottom: 14px solid ${triColor};
                    z-index: 100 !important;
                    pointer-events: none;
                    filter: drop-shadow(0 0 1px rgba(0,0,0,0.5));
                `;

                intersection.appendChild(triangle);
                console.log(`QuizBoard: [Marker] SUCCESS - Triangle attached at [${row}, ${col}]`);
            } else {
                console.warn(`QuizBoard: [Marker] FAILED - No stone found at [${row}, ${col}] to attach triangle.`);
            }
        } else {
            console.error(`QuizBoard: [Marker] FAILED - Intersection [${row}, ${col}] not found.`);
        }
    }
}