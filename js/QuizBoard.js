// 专门用于答题页面的静态棋盘显示
class QuizBoard {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.boardSize = options.boardSize || 19;
        this.cellSize = options.cellSize || 28; // 参考GoBoard4C.css的设置
        this.stoneSize = options.stoneSize || 26;
        
        this.initializeBoard();
    }
    
    initializeBoard() {
        this.container.innerHTML = '';
        
        // 创建棋盘容器
        const board = document.createElement('div');
        board.id = 'board';
        board.style.cssText = `
            display: grid;
            grid-template-columns: repeat(${this.boardSize}, 1fr);
            grid-template-rows: repeat(${this.boardSize}, 1fr);
            width: calc(${this.boardSize} * ${this.cellSize}px);
            height: calc(${this.boardSize} * ${this.cellSize}px);
            background-image: url('../images/woodboard1.jpg');
            background-color: #deb887;
            border: 2px solid #000;
            position: relative;
            margin: 20px auto;
        `;
        
        // 创建交叉点
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const intersection = document.createElement('div');
                intersection.className = 'intersection';
                intersection.dataset.row = row;
                intersection.dataset.col = col;
                intersection.style.cssText = `
                    position: relative;
                    width: ${this.cellSize}px;
                    height: ${this.cellSize}px;
                `;
                
                // 添加线条
                this.addLines(intersection, row, col);
                
                board.appendChild(intersection);
            }
        }
        
        // 添加星位
        this.addStarPoints(board);
        
        this.container.appendChild(board);
    }
    
    addLines(intersection, row, col) {
        // 垂直线
        if (col < this.boardSize - 1) {
            const vLine = document.createElement('div');
            vLine.className = 'line vertical';
            vLine.style.cssText = `
                position: absolute;
                width: 1px;
                height: 100%;
                left: 50%;
                background-color: #000;
                transform: translateX(-50%);
            `;
            intersection.appendChild(vLine);
        }
        
        // 水平线
        if (row < this.boardSize - 1) {
            const hLine = document.createElement('div');
            hLine.className = 'line horizontal';
            hLine.style.cssText = `
                position: absolute;
                width: 100%;
                height: 1px;
                top: 50%;
                background-color: #000;
                transform: translateY(-50%);
            `;
            intersection.appendChild(hLine);
        }
    }
    
    addStarPoints(board) {
        const starPoints = [
            [3, 3], [3, 9], [3, 15],
            [9, 3], [9, 9], [9, 15],
            [15, 3], [15, 9], [15, 15]
        ];
        
        starPoints.forEach(([row, col]) => {
            const intersection = board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (intersection) {
                const starPoint = document.createElement('div');
                starPoint.className = 'star-point';
                starPoint.style.cssText = `
                    position: absolute;
                    width: 6px;
                    height: 6px;
                    background-color: #000;
                    border-radius: 50%;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    pointer-events: none;
                    z-index: 2;
                `;
                intersection.appendChild(starPoint);
            }
        });
    }
    
    // 清空棋盘
    clearBoard() {
        const stones = this.container.querySelectorAll('.stone');
        stones.forEach(stone => stone.remove());
        
        const candidates = this.container.querySelectorAll('.candidate-point');
        candidates.forEach(candidate => candidate.remove());
    }
    
    // 加载棋盘状态
    loadBoardState(boardState) {
        console.log('=== 棋盘状态数据 ===');
        console.log('boardState:', boardState);
        console.log('boardState类型:', typeof boardState);
        console.log('boardState是否为数组:', Array.isArray(boardState));
        console.log('boardState长度:', boardState ? boardState.length : 'undefined');
        
        if (!boardState || !Array.isArray(boardState)) {
            console.error('无效的棋盘状态数据:', boardState);
            return;
        }
        
        console.log('开始加载棋盘状态，共', boardState.length, '个棋子:');
        
        boardState.forEach((move, index) => {
            console.log(`棋子 ${index + 1}:`, {
                row: move.row,
                col: move.col,
                color: move.color,
                原始数据: move
            });
            
            if (move.row !== undefined && move.col !== undefined && move.color) {
                this.placeStone(move.row, move.col, move.color);
            } else {
                console.error(`无效的棋子数据 ${index + 1}:`, move);
            }
        });
        
        console.log('=== 棋盘状态加载完成 ===');
    }
    
    // 放置棋子
    placeStone(row, col, color) {
        const intersection = this.container.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (!intersection) {
            console.error(`无效的交叉点: (${row}, ${col})`);
            return;
        }
        
        // 检查是否已有棋子
        const existingStone = intersection.querySelector('.stone');
        if (existingStone) {
            console.warn(`位置 (${row}, ${col}) 已有棋子，将被替换`);
            existingStone.remove();
        }
        
        const stone = document.createElement('div');
        stone.className = `stone ${color}`;
        stone.style.cssText = `
            position: absolute;
            width: ${this.stoneSize}px;
            height: ${this.stoneSize}px;
            border-radius: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 3;
            background-image: url('../images/${color}_64.png');
            background-size: cover;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        
        if (color === 'white') {
            stone.style.border = '1px solid #ccc';
        }
        
        intersection.appendChild(stone);
        
        console.log(`成功放置${color}棋子在位置 (${row}, ${col})`);
    }
    
    // 显示棋盘位置（包含棋子和候选点）
    displayPosition(boardState, candidates) {
        console.log('=== 开始显示棋盘位置 ===');
        console.log('棋盘状态:', boardState);
        console.log('候选点:', candidates);
        
        // 清空现有内容
        this.clearBoard();
        
        // 加载棋盘状态
        if (boardState && Array.isArray(boardState)) {
            this.loadBoardState(boardState);
        }
        
        // 显示候选点
        if (candidates && Array.isArray(candidates)) {
            this.showCandidatePoints(candidates);
        }
        
        console.log('=== 棋盘位置显示完成 ===');
    }
    
    // 显示候选点
    showCandidatePoints(candidates) {
        console.log('=== 候选点数据 ===');
        console.log('candidates:', candidates);
        console.log('candidates类型:', typeof candidates);
        console.log('candidates是否为数组:', Array.isArray(candidates));
        console.log('candidates长度:', candidates ? candidates.length : 'undefined');
        
        if (!candidates || !Array.isArray(candidates)) {
            console.error('无效的候选点数据:', candidates);
            return;
        }
        
        const labels = ['A', 'B', 'C', 'D'];
        const colors = ['#ff4444', '#4444ff', '#44ff44', '#ffaa00']; // 红、蓝、绿、橙
        
        candidates.forEach((candidate, index) => {
            if (index >= 4) return; // 最多显示4个候选点
            
            console.log(`候选点 ${index + 1}:`, {
                row: candidate.row,
                col: candidate.col,
                label: candidate.label || labels[index],
                原始数据: candidate
            });
            
            const intersection = this.container.querySelector(`[data-row="${candidate.row}"][data-col="${candidate.col}"]`);
            if (!intersection) {
                console.error(`无效的候选点位置: (${candidate.row}, ${candidate.col})`);
                return;
            }
            
            const marker = document.createElement('div');
            marker.className = 'candidate-point';
            marker.textContent = candidate.label || labels[index];
            marker.style.cssText = `
                position: absolute;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background-color: ${colors[index]};
                color: white;
                font-weight: bold;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 4;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.5);
            `;
            
            intersection.appendChild(marker);
            
            console.log(`成功显示候选点 ${candidate.label || labels[index]} 在位置 (${candidate.row}, ${candidate.col})`);
        });
        
        console.log('=== 候选点显示完成 ===');
    }
}