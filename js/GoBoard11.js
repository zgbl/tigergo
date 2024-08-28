const boardState = Array(19).fill().map(() => Array(19).fill(null));

//const { cellSize, boardSize, stoneSize } = window.globalBoardSize || {};
//const { cellSize, stoneSize } = window.globalBoardSize || {};

function addStarPoints() {
    const starPoints = [
        [3, 3], [3, 9], [3, 15],
        [9, 3], [9, 9], [9, 15],
        [15, 3], [15, 9], [15, 15]
    ];
    starPoints.forEach(([row, col]) => {
        const intersection = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (intersection) {
            const starPoint = document.createElement('div');
            starPoint.className = 'star-point';
            intersection.appendChild(starPoint);
        }
    });
}

/*
function handleClick(event) {
    const row = parseInt(event.target.dataset.row, 10);
    const col = parseInt(event.target.dataset.col, 10);
    //console.log(`Clicked on intersection: (${row}, ${col})`);
    if (isStudyMode) {
        handleStudyClick(row, col);
    } else {
        // 原有的处理逻辑
        // ...
        if (!currentGame) {
            console.log("Game not initialized");
            return; // Game not initialized
        }

        if (!currentGame || currentGame.players[currentGame.currentPlayer].id !== currentPlayer.id) {
        // console.log("currentPlayer.id is:", currentPlayer.id)
        console.log(currentGame.players[currentGame.currentPlayer].id);
        console.log("Not your turn or game not initialized");
            return; // Not your turn
        }

        if (!boardState[row][col]) {
            console.log(`Attempting to place stone at (${row}, ${col})`);
            socket.emit("move", { gameId: currentGame.id, row, col });
            console.log(`Emitting move for gameId: ${currentGame.id}, row: ${row}, col: ${col}`);
        } else {
            console.log(`Position (${row}, ${col}) is already occupied`);
        }
    }
        
}  */ //改写 handleclick， 以在点到星位的时候，不乱。  成功了。现有的可以删。 32024/8/7

function handleClick(event) {  //新版加上了error handle, 点到星位的时候棋谱不乱。8/7/2024
    try {
      const row = parseInt(event.target.dataset.row, 10);
      const col = parseInt(event.target.dataset.col, 10);
  
      // 检查是否点击了有效的交叉点
      if (isNaN(row) || isNaN(col)) {
        console.error("Invalid intersection clicked");
        return; // 直接返回，不做任何操作
      }
  
      //console.log(`Clicked on intersection: (${row}, ${col})`);
      
      if (isStudyMode) {
        handleStudyClick(row, col);
      } else {
        // 原有的处理逻辑
        if (!currentGame) {
          console.log("Game not initialized");
          return; // Game not initialized
        }
        if (currentGame.players[currentGame.currentPlayer].id !== currentPlayer.id) {
          console.log("Not your turn");
          return; // Not your turn
        }
        if (!boardState[row][col]) {
          console.log(`Attempting to place stone at (${row}, ${col})`);
          socket.emit("move", { gameId: currentGame.id, row, col });
          console.log(`Emitting move for gameId: ${currentGame.id}, row: ${row}, col: ${col}`);
        } else {
          console.log(`Position (${row}, ${col}) is already occupied`);
        }
      }
    } catch (error) {
      console.error("Error in handleClick:", error.message);
      // 出错时不执行任何操作，保持游戏状态不变
    }
}

function placeStone(row, col, color) {    // 8/13 正测试是不是可以删
    //这个函数 目前只用于画大棋盘棋子
    //console.log(`Placing stone at (${row}, ${col}), color: ${color}`);
   try{
    const intsection = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!intsection) {
      console.error(`Invalid intersection: (${row}, ${col})`);
      return; //

    
   }
    const stone = document.createElement("div");
    stone.className = `stone ${color}`;
    stone.style.width = `${stoneSize-2}px`;
    //console.log("stone.style.width is:", stone.style.width);
    stone.style.height = `${stoneSize-2}px`;
    const intersection = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    intersection.appendChild(stone);
    boardState[row][col] = color;
    playStoneSound();
    checkCaptures(row, col, color, boardState);
  } catch (error) {
    console.error("Error in placeStone3:", error.message);
    // 不执行任何操作，保持棋谱状态不变
  }
}  

function placeStone3(row, col, color, stoneSize) {
    //console.log(`Placing stone at (${row}, ${col}), color: ${color}`);
    const stone = document.createElement("div");
    stone.className = `stone ${color}`;
    stone.style.width = `${stoneSize}px`;
    console.log("stone.style.width is:", stone.style.width);
    stone.style.height = `${stoneSize}px`;
    const intersection = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    intersection.appendChild(stone);
    boardState[row][col] = color;
    playStoneSound();
    checkCaptures(row, col, color, boardState);
} 

function removeStone(row, col) {
    const intersection = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    const stone = intersection.querySelector('.stone');
    if (stone) {
      intersection.removeChild(stone);
    }
    boardState[row][col] = null;
}

//重写checkCaptures, 加入boardState 参数
function checkCaptures(row, col, color, bdState) {
    const directions = [
        [-1, 0], [1, 0],
        [0, -1], [0, 1]
    ];
    const opponent = color === "black" ? "white" : "black";

    for (const [dx, dy] of directions) {
        const newRow = row + dx;
        const newCol = col + dy;
        if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19) {
            if (bdState[newRow][newCol] === opponent) {
                const group = getGroup(newRow, newCol);
                if (!hasLiberties(group)) {
                    removeGroup(group);
                    //console.log("死子removed:", group);
                }
            }
        }
    }
}

function getGroup(row, col) {
    const color = boardState[row][col];
    const group = new Set();
    const stack = [[row, col]];

    while (stack.length > 0) {
        const [r, c] = stack.pop();
        if (!group.has(`${r},${c}`)) {
            group.add(`${r},${c}`);
            const directions = [
                [-1, 0], [1, 0],
                [0, -1], [0, 1]
            ];
            for (const [dx, dy] of directions) {
                const newRow = r + dx;
                const newCol = c + dy;
                if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19) {
                    if (boardState[newRow][newCol] === color) {
                        stack.push([newRow, newCol]);
                    }
                }
            }
        }
    }

    return group;
}

function hasLiberties(group) {
    for (const pos of group) {
        const [row, col] = pos.split(",").map(Number);
        const directions = [
            [-1, 0], [1, 0],
            [0, -1], [0, 1]
        ];
        for (const [dx, dy] of directions) {
            const newRow = row + dx;
            const newCol = col + dy;
            if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19) {
                if (boardState[newRow][newCol] === null) {
                    return true;
                }
            }
        }
    }
    return false;
}

function removeGroup(group) {
    for (const pos of group) {
        const [row, col] = pos.split(",").map(Number);
        removeStone(row, col);
    }
}

//以下 16-18个functions, added 2024/7/10, 更新棋谱步数和显示
function updateGameInfo() {
    if (currentGame && currentGame.players) {
        const currentPlayerName = currentGame.players[currentGame.currentPlayer].name;
        document.getElementById("gameInfo").textContent = `当前回合: ${currentPlayerName}`;
    }
}

function renderMoves(moves) {
    currentMoves = moves;
    currentMoveIndex = -1;
    clearBoard();
    updateMoveInfo();
}

function renderMove(moves) {
    currentMoves = moves;
    currentMoveIndex = -1;
    clearBoard();
    updateMoveInfo();
}

function updateMoveInfo() {
    //console.log("starting updateMoveInfo()");
    const modeText = isStudyMode ? '研究模式' : '查看模式';
    let stepText = '';
    if (isStudyMode) {
        stepText = `变化图步数：${currentMoveIndex - studyStartMoveIndex} / ${currentMoves.length - studyStartMoveIndex - 1}`;
    } else {
        stepText = `当前步数：${currentMoveIndex + 1} / ${currentMoves.length}`;
    }
    //console.log("updateMoveInfo, line 204, currentMovesIndex is", currentMoveIndex);
    //console.log("updateMoveInfo, currentMoves is", JSON.stringify(currentMoves, null, 2));
    document.getElementById('moveInfo').textContent = `当前步数：${currentMoveIndex + 1} / ${currentMoves.length}`;
}

function addMoveNumber(row, col, number) {
    //console.log(`Adding move number ${number} at row ${row}, col ${col}`);
    
    const intersection = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    //console.log('Intersection found:', intersection);
    
    const stone = intersection.querySelector('.stone');
    //console.log('Stone found:', stone);
    
    if (stone) {
        let numberLabel = stone.querySelector('.move-number');
        //console.log('Existing number label:', numberLabel);
        
        if (!numberLabel) {
            numberLabel = document.createElement('div');
            numberLabel.className = 'move-number';
            stone.appendChild(numberLabel);
            //console.log('New number label created');
        }
        
        numberLabel.textContent = number;
        numberLabel.style.color = stone.classList.contains('black') ? 'white' : 'black';
        numberLabel.style.display = 'block';
        
        //console.log('Number label updated:', numberLabel);
        
        // 添加这行来记录应用的样式
    } else {
        //console.log('No stone found at this intersection');
    }
}

function showRecentMoves(count) { 
    const startIndex = Math.max(0, currentMoveIndex - count + 1);
    for (let i = startIndex; i <= currentMoveIndex; i++) {
        const move = currentMoves[i];
        if (!move.pass) {
            const moveNumber = i + 1;
            addMoveNumber(move.row, move.col, moveNumber);
        }
    }
}

function clearBoard() {
    const intersections = document.querySelectorAll('.intersection');
    intersections.forEach(intersection => {
      const stone = intersection.querySelector('.stone');
      if (stone) {
        intersection.removeChild(stone);
      }
    });
    
    for (let i = 0; i < 19; i++) {
      for (let j = 0; j < 19; j++) {
        boardState[i][j] = null;
      }
    }
}

function moveForward() {
    if (currentMoveIndex < currentMoves.length - 1) {
        currentMoveIndex++;
        const move = currentMoves[currentMoveIndex];
        if (!move.pass) {
           // placeStone(move.row, move.col, move.color, stoneSize);  // 8/13
            placeStone3(move.row, move.col, move.color, stoneSize);
        }
        updateMoveInfo();
        updateMoveDisplay();
    }
}

function moveBackward() {
    if (currentMoveIndex >= 0) {
        const move = currentMoves[currentMoveIndex];
        if (!move.pass) {
            removeStone(move.row, move.col);
        }
        currentMoveIndex--;
        updateMoveInfo();
        updateMoveDisplay();
    }
}
  
function fastForward() {
    for (let i = 0; i < 5; i++) {
      moveForward();
      //console.log("向前",i+1,"步");
    }
}
  
function fastBackward() {
    for (let i = 0; i < 5; i++) {
      moveBackward();
    }
}
  
function moveToStart() {
    while (currentMoveIndex >= 0) {
      moveBackward();
    }
}
  
function moveToEnd() {
    while (currentMoveIndex < currentMoves.length - 1) {
      moveForward();
    }
}

function toggleRecentMoves() {
    showingRecentMoves = !showingRecentMoves;
    if (showingRecentMoves) {
        showRecentMoves();
    } else {
        hideRecentMoves();
    }
}

function hideRecentMoves() {
    const numberLabels = document.querySelectorAll('.move-number');
    numberLabels.forEach(label => label.remove());
}

function toggleMoveDisplay() {
    displayMode = (displayMode + 1) % 4; // 循环切换状态
    updateMoveDisplay();
    updateButtonText();
}

function updateButtonText() {
    const button = document.getElementById('showMovesBtn');
    switch (displayMode) {
        case 0:
            button.textContent = '显示最后1步';
            break;
        case 1:
            button.textContent = '显示最后5步';
            break;
        case 2:
            button.textContent = '显示全部步数';
            break;
        case 3:
            button.textContent = '不显示步数';
            break;
    }
}

function updateMoveDisplay() {
    hideAllMoveNumbers();
    if (isStudyMode) {
        showStudyMoves();
    } else {
        switch (displayMode) {
            //我之前已经自己改成4种case了，Claude不知道，我得自己再改
            case 0: // 不显示任何步数 
                break;
            case 1: // 显示最后1步
                showRecentMoves(1);
                break;
            case 2: // 显示最后5步
                showRecentMoves(5);
                break;
            case 3: // 显示全部步数
                showAllMoves();
                break;
        }
    }
}

function hideAllMoveNumbers() {
    const numberLabels = document.querySelectorAll('.move-number');
    numberLabels.forEach(label => label.remove());
}

function showAllMoves() {
    for (let i = 0; i <= currentMoveIndex; i++) {
        const move = currentMoves[i];
        if (!move.pass) {
            const moveNumber = i + 1;
            addMoveNumber(move.row, move.col, moveNumber);
        }
    }
}

//added 7/11/2024 保存棋谱  
//let currentGame = null;
function saveQipu() {
    console.log("Attempting to save Qipu to MongoDB. currentMoves:", currentMoves);

    if (!currentMoves || currentMoves.length === 0) {
        console.log("No valid game data to save");
        alert("没有有效的棋谱数据可以保存");
        return;
    }

    const qipuData = {
        moves: currentMoves,
        date: new Date(),
        isStudyVariation: isStudyMode
    };

    fetch(`${CONFIG.API_BASE_URL}/save-qipu`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(qipuData),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert('棋谱已成功保存到 MongoDB!');
        } else {
            alert('保存棋谱到 MongoDB 时出错: ' + (data.error || '未知错误'));
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('保存棋谱到 MongoDB 时出错: ' + error.message);
    });
}

/*function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const sgfContent = e.target.result;
            console.log("function handleFileSelect() parseSGFing from GoBoard11.js line 491");
            const parsedMoves = parseSGF(sgfContent);  //应该没有被用到 8.13
            renderMoves(parsedMoves);
        };
        reader.readAsText(file);
    }
}  */

//Add by TXY 7/11/2024, 增加研究功能
let isStudyMode = false;
let originalMoves = [];
let studyStartMoveIndex = -1;

function toggleStudyMode() {
    isStudyMode = !isStudyMode;
    const studyButton = document.getElementById('studyButton');
    const publishBtn = document.getElementById('publishVariationBtn');

    if (isStudyMode) {
        studyButton.textContent = '结束研究';
        originalMoves = [...currentMoves];
        studyStartMoveIndex = currentMoveIndex;
        // 清除从当前步数之后的所有步骤
        currentMoves = currentMoves.slice(0, currentMoveIndex + 1);
        displayMode = 3; // 假设3代表显示全部步数
    } else {
        studyButton.textContent = '研究';
        // 更新主棋盘显示，但不清除变化
        currentMoves = [...originalMoves];
        //console.log("toggleStudyMode, currentMoves = ...originalMoves:", currentMoves);
        //console.log("toggleStudyMode, currentMoves = ...originalMoves:", JSON.stringify(currentMoves, null, 2));

        renderMovesToIndex(studyStartMoveIndex);
        // 恢复小棋盘内容2024/7/20
        if (smallBoards && smallBoards.length > 0) {
            smallBoards.forEach(board => {
                if (board && typeof board.renderBoard === 'function') {
                    board.renderBoard(); // 不需要传递参数，因为boardElement已经在实例中保存了
                }
            });
        }
    }
    updateMoveInfo();
    publishBtn.style.display = isStudyMode ? 'inline-block' : 'none';
}

let indctID = '';
function toggleStudyMode2(indctID) {
    isStudyMode = !isStudyMode;
    const studyButton = document.getElementById('studyButton');
    const publishBtn = document.getElementById('publishVariationBtn');

    if (isStudyMode) {
        studyButton.textContent = '结束研究';
        originalMoves = [...currentMoves];
        studyStartMoveIndex = currentMoveIndex;
        // 清除从当前步数之后的所有步骤
        currentMoves = currentMoves.slice(0, currentMoveIndex + 1);
        displayMode = 3; // 假设3代表显示全部步数
    } else {
        studyButton.textContent = '研究';
        // 更新主棋盘显示，但不清除变化
        currentMoves = [...originalMoves];
        //console.log("toggleStudyMode, currentMoves = ...originalMoves:", currentMoves);
        //console.log("toggleStudyMode, currentMoves = ...originalMoves:", JSON.stringify(currentMoves, null, 2));

        renderMovesToIndex(studyStartMoveIndex);
        // 恢复小棋盘内容2024/7/20
        if (smallBoards && smallBoards.length > 0) {
            smallBoards.forEach(board => {
                if (board && typeof board.renderBoard === 'function') {
                    board.renderBoard(); // 不需要传递参数，因为boardElement已经在实例中保存了
                }
            });
        }
    }
    updateMoveInfo();
    //console.log("toggleStudyMode.updateMoveInto.")
    toggleIndicator(indctID);  //此行只对于有指示灯的情况，
    publishBtn.style.display = isStudyMode ? 'inline-block' : 'none';
}


function handleStudyClick(row, col) {
    if (!isStudyMode) return;

    //const color = currentMoveIndex % 2 === 0 ? 'black' : 'white';
    const color = currentMoveIndex % 2 === 0 ? 'white' : 'black';
    const newMove = { row, col, color };

    // 移除当前移动之后的所有移动
    currentMoves = currentMoves.slice(0, currentMoveIndex + 1);
    
    // 添加新的移动
    currentMoves.push(newMove);
    //console.log("line491, handleStudyClick, newMove is:", newMove);
    //console.log("after newMove pushed, currentMoves is:,", currentMoves);
    //经过验证，newMove 和 currentMoves 解构都是坐标+颜色，没有问题， 2024/7/25
    currentMoveIndex++;

    //placeStone(row, col, color);  // 8/13
    placeStone3(row, col, color);
    updateMoveInfo();
    updateMoveDisplay(); // 更新棋盘显示
}

function showStudyMoves() {
    for (let i = studyStartMoveIndex + 1; i <= currentMoveIndex; i++) {
        const move = currentMoves[i];
        if (!move.pass) {
            const moveNumber = i - studyStartMoveIndex;
            addMoveNumber(move.row, move.col, moveNumber);
        }
    }
}  

//增添变化图小棋盘 2024.7.17
let smallBoards = []; // 存储所有小棋盘的数组

//async function publishVariation() {
async function publishVariation(event) {   //改用submit的时evemt
    event.preventDefault(); // Prevents the default form submission  改用submit的时候加上这行 8/6 

    console.log("publishVaration, from line 610");
    console.log("1. 开始执行publishVariation");

    if (!isStudyMode || currentMoveIndex <= studyStartMoveIndex) {
        console.log("2. 没有可发布的变化图，函数将退出");
        alert('没有可发布的变化图');
        return;
    }

    console.log("3. 准备获取用户评论");
    // 获取用户评论
    const commentTextarea = document.getElementById('comment-content');
    const comment = commentTextarea.value.trim();
    if (comment === '') {
        console.log("4. 用户未输入评论，函数将退出");
        alert('请输入评论');
        return;
    }

    console.log("5. 用户输入的评论内容:", comment);
    console.log("Line 535,publishVariation, 验证这个时候currentMoves is", currentMoves);

    const originalMoves = currentMoves.slice(0, studyStartMoveIndex + 1);
    const variationMoves = currentMoves.slice(studyStartMoveIndex + 1);
    
    console.log("6. 准备创建评论容器");
    // 创建评论容器
    const commentContainer = document.createElement('div');
    commentContainer.className = 'comment-container';

    console.log("7. 准备创建评论元素");
    // ���评论元素
    const commentElement = document.createElement('p');
    commentElement.textContent = comment;
    commentElement.className = 'variation-comment';
    commentContainer.appendChild(commentElement);
    console.log("8. 评论元素已创建，内容为:", commentElement.textContent); 
// 重写结构，保留object形式，保留颜色信息 2024/7/25
    const commentData = {
        postId: postId,
        content: comment,
        originalMoves: originalMoves.map(move => ({
            row: move.row,
            col: move.col,
            color: move.color
        })),
        variationMoves: variationMoves.map(move => ({
            row: move.row,
            col: move.col,
            color: move.color
        }))
    };

    console.log("8B, 保存到DB的Comment信息已经准备好，commentData = ", commentData);

    //保存评论到DB一直有error，改写这段，更详细地分析error. 2024/7/25
    try {
        const savedComment = await saveCommentToDB(commentData);
        console.log("Saved comment:", savedComment);
        //displayComment(comment, originalMoves, variationMoves);   // error 07/25：displayComment is not defined. 改用 displayVariationComment 
        displayVariationComment(comment, originalMoves, variationMoves);  
        commentTextarea.value = '';
        console.log("line 642, publishVariation 执行完毕，这个不能comment。");
    } catch (error) {
        console.error("Error in publishVariation:", error);
        if (error.response) {
            // 服务器响应了，但状态码不在 2xx 范围内
            console.error("Server responded with error:", error.response.status, error.response.data);
        } else if (error.request) {
            // 请求已经发出，但没有收到响应
            console.error("No response received:", error.request);
        } else {
            // 在设置请求时发生了一些错误
            console.error("Error setting up request:", error.message);
        }
        alert(`保存评论失败，请稍后重试。错误: ${error.message}`);
    }

    console.log("8C, 保存comment到DB已完成"); 
    alert("变化图发布成功！");

    console.log("publishVariation执行完毕");
}

function initializeSmallBoard(boardElement, moves) {
    const boardSize = 19;
    const cellSize = 15; // 小棋盘的单元格大小

    // 创建棋盘网格
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j < boardSize; j++) {
            const cell = document.createElement('div');
            cell.className = 'small-board-cell';
            cell.style.width = `${cellSize}px`;
            cell.style.height = `${cellSize}px`;
            cell.style.position = 'absolute';
            cell.style.left = `${j * cellSize}px`;
            cell.style.top = `${i * cellSize}px`;
            boardElement.appendChild(cell);
        }
    }

    // 设置棋盘大小
    boardElement.style.width = `${boardSize * cellSize}px`;
    boardElement.style.height = `${boardSize * cellSize}px`;
    boardElement.style.position = 'relative';

    // 初始化棋盘状态
    let currentMoveIndex = 0;
    const boardState = Array(boardSize).fill().map(() => Array(boardSize).fill(null));

    // 渲染初始状态
    renderSmallBoard();

    // 添加控制按钮事件监听器
    const prevButton = boardElement.parentNode.querySelector('.small-board-prev');
    const nextButton = boardElement.parentNode.querySelector('.small-board-next');
    
    prevButton.addEventListener('click', () => {
        if (currentMoveIndex > 0) {
            currentMoveIndex--;
            renderSmallBoard();
        }
    });

    nextButton.addEventListener('click', () => {
        if (currentMoveIndex < moves.length - 1) {
            currentMoveIndex++;
            renderSmallBoard();
        }
    });

    function renderSmallBoard() {
        // 清除所有棋子
        boardElement.querySelectorAll('.small-stone').forEach(stone => stone.remove());

        // 重新渲染棋盘状态
        for (let i = 0; i <= currentMoveIndex; i++) {
            const move = moves[i];
            const cell = boardElement.children[move.row * boardSize + move.col];
            const stone = document.createElement('div');
            stone.className = `small-stone ${move.color}`;
            stone.style.width = `${cellSize - 2}px`;
            stone.style.height = `${cellSize - 2}px`;
            stone.style.borderRadius = '50%';
            stone.textContent = i + 1; // 显示步数
            cell.appendChild(stone);
        }
    }
}

//把parseSGF函数放在这里
function parseSGF(sgfContent) {
    console.log("Raw SGF content:", sgfContent.substring(0, 200)); // 打印前200个字符以检查内容

    const info = {};
    const moves = [];
    const moveRegex = /;([BW])(\[\]|\[([a-s]{2})\])/g;
    let match;

    // 提取游戏信息
    const extractInfo = (tag) => {
        const regex = new RegExp(tag + "\\[([^\\]]+)\\]");
        const match = sgfContent.match(regex);
        if (match) {
            console.log(`Extracted ${tag}:`, match[1]); // 打印提取的信息
        } else {
            console.log(`Failed to extract ${tag}`); // 打印失败信息
        }
        return match ? match[1] : '';
    };

    info.PB = extractInfo('PB');
    info.PW = extractInfo('PW');
    info.BR = extractInfo('BR');
    //console.log("info.BR when extractInfo is:", info.BR);
    info.WR = extractInfo('WR');
    info.DT = extractInfo('DT');
    info.RE = extractInfo('RE');
    info.KM = extractInfo('KM');
    info.SZ = extractInfo('SZ');
    info.TM = extractInfo('TM');
    info.OT = extractInfo('OT');
    info.RU = extractInfo('RU');

    console.log("Extracted info:", info); // 打印提取的所有信息

    // 提取移动
    while ((match = moveRegex.exec(sgfContent)) !== null) {
        const color = match[1] === "B" ? "black" : "white";
        if (match[2] === "[]") {
            moves.push({ pass: true, color });
        } else {
            const col = match[3].charCodeAt(0) - 97;
            const row = match[3].charCodeAt(1) - 97;
            moves.push({ row, col, color });
        }
    }

    console.log("Extracted moves:", moves.length > 0 ? moves.slice(0, 5) : "No moves found"); // 打印前5个移动或无移动信息
    console.log("blackRank is:", info.BR);
    console.log("暂时用时只显示TM:",info.TM);    
    return {
        gameInfo: {
            blackPlayer: info.PB,
            whitePlayer: info.PW,
            blackRank: info.BR,
            whiteRank: info.WR,
            date: info.DT,
            result: info.RE,
            komi: info.KM,
            boardSize: info.SZ,
            //timeControl: `${info.TM || ''}${info.OT ? ' ' + info.OT : ''}`,
            //timeControl: info.TM,
            timeControl: (info.TM || '') + (info.OT ? ' ' + info.OT : ''),
            rules: info.RU
        },
        moves: moves
    };
    
}


function parseSGF2(sgfContent) {
    const info = {};
    const moves = [];
    const infoRegex = /(\w+)\[(.*?)\]/g;
    const moveRegex = /;([BW])(\[\]|\[([a-s]{2})\])/g;
    let match;

    // Extract game information
    while ((match = infoRegex.exec(sgfContent)) !== null) {
        const [, key, value] = match;
        if (key !== 'B' && key !== 'W') {
            info[key] = value;
        }
    }

    // Extract moves
    while ((match = moveRegex.exec(sgfContent)) !== null) {
        const color = match[1] === "B" ? "black" : "white";
        if (match[2] === "[]") {
            // This is a pass move
            moves.push({ pass: true, color });
        } else {
            const col = match[3].charCodeAt(0) - 97;
            const row = match[3].charCodeAt(1) - 97;
            moves.push({ row, col, color });
        }
    }
    console.log("刚刚parse出来的 moves:", moves);

    return {
        gameInfo: {
            blackPlayer: info.PB || '',
            whitePlayer: info.PW || '',
            blackRank: info.BR || '',
            whiteRank: info.WR || '',
            date: info.DT || '',
            result: info.RE || '',
            komi: info.KM || '',
            boardSize: info.SZ || '',
            timeControl: `${info.TM || ''}${info.OT ? ' ' + info.OT : ''}`,
            rules: info.RU || ''
        },
        moves: moves
    };
}


//恢复棋盘到研究开始时候的步数
function renderMovesToIndex(targetIndex) {
    console.log("renderMovesToIndex, line 811, targetIndex:", targetIndex);
    clearBoard();
    for (let i = 0; i <= targetIndex; i++) {
        const move = currentMoves[i];
        if (!move.pass) {
            //placeStone(move.row, move.col, move.color);  // 8/13
            placeStone3(move.row, move.col, move.color);
        }
    }
    currentMoveIndex = targetIndex;
    updateMoveInfo();
    updateMoveDisplay();
}


function createBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    //console.log('Creating board');

    // Draw board lines
    for (let i = 0; i < 19; i++) {
        const vertical = document.createElement('div');
        vertical.className = 'line vertical';
        vertical.style.left = `${15 + i * 30}px`;
        board.appendChild(vertical);

        const horizontal = document.createElement('div');
        horizontal.className = 'line horizontal';
        horizontal.style.top = `${15 + i * 30}px`;
        board.appendChild(horizontal);
    }

    for (let row = 0; row < 19; row++) {
        for (let col = 0; col < 19; col++) {
            const intersection = document.createElement('div');
            intersection.className = 'intersection';
            intersection.dataset.row = row;
            intersection.dataset.col = col;
            intersection.addEventListener('click', handleClick);
            board.appendChild(intersection);
        }
    }
    addStarPoints();
}

function createBoard3(options) {
    //const { cellSize, boardSize, stoneSize } = calculateBoardSize();
    let {
        domElement,
        boardSize = 19,
        cellSize,
        lineColor = '#000',
        backgroundColor = '#DEB887'
    } = options;

    domElement.innerHTML = '';
    console.log('Line 840, Creating board on element', domElement);
    domElement.style.width = `${boardSize * cellSize}px`;
    domElement.style.height = `${boardSize * cellSize}px`;
    domElement.style.position = 'relative';
    domElement.style.backgroundColor = backgroundColor;

    const fragment = document.createDocumentFragment();

    const starPoints = new Set([
        '3,3', '3,9', '3,15',
        '9,3', '9,9', '9,15',
        '15,3', '15,9', '15,15'
    ]);

    // Draw board lines
    for (let i = 0; i < boardSize; i++) {
        // 创建垂直线
        const vertical = document.createElement('div');
        vertical.className = 'line vertical';
        vertical.style.left = `${cellSize/2 + i * cellSize}px`;
        //console.log("画垂直线：", cellSize/2 + i * cellSize);
        vertical.style.height = `${(boardSize - 1) * cellSize}px`; 
        vertical.style.width = '1px';
        vertical.style.backgroundColor = lineColor;
        vertical.style.position = 'absolute';
        vertical.style.top = `${cellSize/2}px`; 
        fragment.appendChild(vertical);

        // 创建水平线
        const horizontal = document.createElement('div');
        horizontal.className = 'line horizontal';
        horizontal.style.top = `${cellSize/2 + i * cellSize}px`;
        horizontal.style.width = `${(boardSize - 1) * cellSize}px`; // 修改这里
        horizontal.style.height = '1px';
        horizontal.style.backgroundColor = lineColor;
        horizontal.style.position = 'absolute';
        horizontal.style.left = `${cellSize/2}px`; // 添加这行
        fragment.appendChild(horizontal);
    }

    // 创建交叉点
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j < boardSize; j++) {
            const intersection = document.createElement('div');
            intersection.className = 'intersection';
            intersection.dataset.row = i;
            intersection.dataset.col = j;
            intersection.style.position = 'absolute';
            intersection.style.left = `${j * cellSize}px`;
            intersection.style.top = `${i * cellSize}px`;
            intersection.style.width = `${cellSize}px`;
            intersection.style.height = `${cellSize}px`;
            intersection.addEventListener('click', (e) => handleClick(e, domElement));

            // 检查是否是星位点
            if (starPoints.has(`${i},${j}`)) {
                const starPoint = document.createElement('div');
                starPoint.className = 'star-point';
                starPoint.style.width = `${cellSize / 4}px`;
                starPoint.style.height = `${cellSize / 4}px`;
                starPoint.style.borderRadius = '50%';
                starPoint.style.backgroundColor = lineColor;
                starPoint.style.position = 'absolute';
                starPoint.style.top = '50%';
                starPoint.style.left = '50%';
                starPoint.style.transform = 'translate(-50%, -50%)';
                intersection.appendChild(starPoint);
                //console.log("creating 星位：", i, j);
            }

            fragment.appendChild(intersection);
        }
    }
    //console.log("Line 1025,Creating board 创建棋盘,完毕 cellSize is:", cellSize);

    // 将所有元素一次性添加到 DOM
    domElement.appendChild(fragment);
} 


function addStarPoints2(board, boardSize, cellSize) {
    const starPoints = boardSize === 19 ? [
        [3, 3], [3, 9], [3, 15],
        [9, 3], [9, 9], [9, 15],
        [15, 3], [15, 9], [15, 15]
    ] : [
        [3, 3], [3, boardSize - 4],
        [boardSize - 4, 3], [boardSize - 4, boardSize - 4]
    ];

    starPoints.forEach(([row, col]) => {
        const intersection = board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (intersection) {
            const starPoint = document.createElement('div');
            starPoint.className = 'star-point';
            starPoint.style.width = `${cellSize / 5}px`;
            starPoint.style.height = `${cellSize / 5}px`;
            starPoint.style.borderRadius = '50%';
            starPoint.style.backgroundColor = '#000';
            starPoint.style.position = 'absolute';
            starPoint.style.left = '50%';
            starPoint.style.top = '50%';
            starPoint.style.transform = 'translate(-50%, -50%)';
            intersection.appendChild(starPoint);
        }
    });
}

function addStarPoints3(board, boardSize, cellSize) {
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
            //starPoint.style.width = '8px';
            //starPoint.style.height = '8px';
            starPoint.style.zIndex = '1';
            intersection.style.width = `${cellSize - 1}px`;
            intersection.style.height = `${cellSize - 1}px`;
            starPoint.style.borderRadius = '50%';
            starPoint.style.backgroundColor = 'black';
            starPoint.style.position = 'absolute';
            starPoint.style.top = '50%';
            starPoint.style.left = '50%';
            starPoint.style.transform = 'translate(-50%, -50%)';
            intersection.appendChild(starPoint);
            console.log("Creating starPoint:", intersection, row, col);
        }
    });
}

//增加新类，独户存储小棋盘状态
class SmallBoard {
    constructor(originalMoves, variationMoves) {
        this.originalMoves = originalMoves;
        this.variationMoves = variationMoves;
        this.currentIndex = originalMoves.length + variationMoves.length - 1;
        this.boardElement = null;
        // 初始化 smallBoardState 作为类的属性
        this.smallBoardState = Array(19).fill().map(() => Array(19).fill(null));
    }

    renderBoard(boardElement) {
        //console.log("renderBoard()开始渲染小棋盘", boardElement);//8/13 确认这个调用起作用，就是不退回
        // 如果提供了新的 boardElement，就更新它
        if (boardElement) {
            this.boardElement = boardElement;
        }

        // 如果没有 boardElement，就报错并返回
        if (!this.boardElement) {
            console.error('No board element to render on');
            return;
        }

        //console.log("开始画小棋盘之前, 在renderBoard()中，cellSize is:", cellSize);
        let smStoneSize = cellSize /1.5 * 0.95;
        //console.log("开始渲染小棋盘");
        //console.log("原始步骤数:", this.originalMoves.length);
        //console.log("变化步骤数:", this.variationMoves.length);
        //console.log("检查是否后退了， currentIndex is:", this.currentIndex);

        // 清除所有棋子
        this.boardElement.querySelectorAll('.stone').forEach(stone => stone.remove());

        //console.log("originalMoves is:", this.originalMoves);
        // 渲染原始步骤
        //let currentColor = 'black';
        this.originalMoves.forEach((move, index) => {
            if (!move.pass) {
                //console.log("this 原始 move is:", move);
                //const [row, col] = move.split(',').map(Number);
                //this.placeStone(row, col, currentColor);
                //this.placeStone2(move.row, move.col, move.color, smStoneSize);  //8/13
                //console.log("Current context 'this' 是:", this);
                //this.placeStone3(move.row, move.col, move.color, smStoneSize);
                this.placeStone2(move.row, move.col, move.color, smStoneSize);  //try call placeStone3 directly
                //console.log("原始步数：", move.row, move.col, move.color);
                //console.log("0777 原始步数：", row, col);
                //currentColor = (currentColor === 'black') ? 'white' : 'black';
            }
        });

        // 渲染变化图步骤
        this.variationMoves.forEach((move, index) => {
            //console.log("line 1285, variationMove.number is:", index +1);
            //console.log("this.originalMoves.length + index is:", this.originalMoves.length + index);
            //console.log("this.currentIndex is:", this.currentIndex);

            if ((this.originalMoves.length - 1 + index) < this.currentIndex && !move.pass) {
                //this.placeStone2(move.row, move.col, move.color, smStoneSize, index + 1); //8/13
                this.placeStone2(move.row, move.col, move.color, smStoneSize, index + 1); 
                //看看能不能用同一个函数也画变化图棋子
            }    
            
        });

        //console.log("小棋盘渲染完成");
    }

    moveForward() {
        //console.log("小棋盘前进：", this.currentIndex);
        if (this.currentIndex < this.originalMoves.length + this.variationMoves.length - 1) {
            this.currentIndex++;
            if (this.boardElement) {
                this.renderBoard();
            } else {
                console.error('Board element not set');
            }
            //this.renderBoard();
        }
    }

    moveBackward() {
        //console.log("小棋盘后退：", this.currentIndex); // 8/13 确认这个function在起作用，currentIndex正确
        //console.log("变化图起点步长:",this.originalMoves.length);  //8/13确认没问题
        //console.log("检查一下现在who is 'this':", this);
        if (this.currentIndex > this.originalMoves.length - 1) {
            this.currentIndex--;
            //console.log("准备要后退renderBoard()");
            //console.log("再确认一下 this.boardElement存在:", this.boardElement);

            if (this.boardElement) {
                //this.renderBoard();  //这是AI给的写法，无参数 undefined , 不行
                this.renderBoard(this.boardElement);  //这是我尝试的写法，有参数了，但还是没有render成功，不能后退
                //renderBoard(this.boardElement);   //我尝试的第二种写法 结果连变化图都完全显示不出来
            } else {
                console.error('Board element not set');
            }
            //this.renderBoard(); //应该是renderBoard() 出了问题
        }
    }

    placeStone2(row, col, color, smStoneSize, number = null) {  
        //这个函数用于画已有变化图的棋子
        if (!this.boardElement) {
            console.error('No board element to place stone on');
            return;
        }
    
        const intersection = this.boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (intersection) {
            const stone = document.createElement('div');
            stone.className = `stone ${color}`;
            stone.style.width = `${smStoneSize}px`;
            stone.style.height = `${smStoneSize}px`;
            stone.style.borderRadius = '50%';
            stone.style.position = 'absolute'; 
            // 移除固定的left和top值
            stone.style.left = '50%';
            stone.style.top = '50%'; 
            stone.style.transform = 'translate(-50%, -50%)'; // 居中棋子
            
            if (number !== null) {
                stone.textContent = number;
                stone.style.display = 'flex';
                stone.style.justifyContent = 'center';
                stone.style.alignItems = 'center';
                stone.style.fontSize = `${smStoneSize*0.8}px`;
                stone.style.color = color === 'black' ? 'white' : 'black';
            }
            
            intersection.appendChild(stone);
            this.smallBoardState[row][col] = color;
            checkCaptures(row, col, color, this.smallBoardState);
        } else {
            console.log(`未找到交叉点 (${row}, ${col})`);
        }
    }

    placeStone3(row, col, color, stoneSize, moveNumber = null) {
        const stone = document.createElement("div");
        stone.className = `stone ${color}`;
        stone.style.width = `${stoneSize}px`;
        stone.style.height = `${stoneSize}px`;
        if (moveNumber !== null) {
            stone.textContent = moveNumber;
        }
        const intersection = this.boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (intersection) {
            intersection.appendChild(stone);
        } else {
            console.error(`No intersection found for row ${row}, col ${col}`);
        }
    }
}

// 新函数合并变化图发布和评论文本发布，（以后要删掉submitComment() 和 publishVariation()）2024/7/20
// 这个函数是不是被弃用了？2024/7/25
function submitCommentAndVariation(e) {
    //console.log("starting提交评论和变化图");
    e.preventDefault();
    const commentContent = document.getElementById("comment-content").value.trim();
    
    if (commentContent === '') {
        alert('请输入评论');
        return;
    }

    let variationData = null;
    if (isStudyMode && currentMoveIndex > studyStartMoveIndex) {
        const originalMoves = currentMoves.slice(0, studyStartMoveIndex + 1);
        const variationMoves = currentMoves.slice(studyStartMoveIndex + 1);
        variationData = {
            originalMoves: originalMoves,
            variationMoves: variationMoves
        };
        console.log("submitCommentAndVariation, variationData:", variationData);
    }

    const commentData = {
        content: commentContent,
        variation: variationData
    };

    fetch(`${CONFIG.API_BASE_URL}/comments/${postId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(commentData),
    })
    .then((response) => response.json())
    .then((result) => {
        if (result.success) {
            document.getElementById("comment-content").value = "";
            if (variationData) {
                //displayVariationComment(commentContent, variationData);
                //console.log("评论发布成功，这里comment掉了可能是重复的displayVariationComment()");
                displayVariationComment(comment, {
                    originalMoves: originalMoves,
                    variationMoves: variationMoves
                });
            }
            fetchComments(postId);
        }
    })
    .catch((error) => console.error("Error submitting comment:", error));
    console.log("submitCommentAndVariation, fetching /comments/");
}
    //改写displayVariationComment 成有三个参数  2024/7/25
function displayVariationComment(comment, originalMoves, variationMoves) {
    //console.log("displayVariationComment", comment, originalMoves, variationMoves);
    const commentContainer = document.createElement('div');
    commentContainer.className = 'comment-container';

    const commentElement = document.createElement('p');
    commentElement.textContent = comment;
    commentElement.className = 'variation-comment';
    commentContainer.appendChild(commentElement);

    // 只有在存在变化图数据时才创建小棋盘
    if (originalMoves && variationMoves) {
        const smallBoardContainer = document.createElement('div');
        smallBoardContainer.className = 'small-board-container';
        
        const smallBoardElement = document.createElement('div');
        smallBoardElement.className = 'small-board';
        smallBoardContainer.appendChild(smallBoardElement);

        const smallBoard = new SmallBoard(originalMoves, variationMoves);
        smallBoard.boardElement = smallBoardElement;  // 设置 boardElement
        
        //2024/7/25 今天实际是这里在push 评论小棋盘
        smallBoards.push(smallBoard);
        //console.log("GoBoard10.js, line 1321, 完成了smallBoard.push ");

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'small-board-controls';
        controlsDiv.innerHTML = `
            <button class="small-board-prev">后退</button>
            <button class="small-board-next">前进</button>
        `;
        smallBoardContainer.appendChild(controlsDiv);

        commentContainer.appendChild(smallBoardContainer);

        //这里创建评论的小棋盘
        //console.log("DisplayVariatino, line1331处创建小棋盘，cellSize 是", cellSize);
        const smallBoardCellSize = cellSize/1.5; 
        //console.log("准备画小棋盘，cellSize is:", cellSize, "smallBoardCellSize is:", smallBoardCellSize);
        
        
        createBoard3({
            domElement: smallBoardElement,
            boardSize: 19,
            //cellSize: Math.floor(cellSize * 0.7),
            cellSize: smallBoardCellSize,
            lineColor: '#000',
            backgroundColor: '#DEB887'
        });
        //console.log("Line 1344, 画了小棋盘，cellSize is:", cellSize, "smallBoardCellSize is:", smallBoardCellSize);
        //2024/7/25 今天是这句再render 小棋盘
        smallBoard.renderBoard();

        const prevButton = smallBoardContainer.querySelector('.small-board-prev');
        const nextButton = smallBoardContainer.querySelector('.small-board-next');
        
        prevButton.addEventListener('click', () => smallBoard.moveBackward());  // 8/13， 目前是这个监听器，但是functin不存在。
        nextButton.addEventListener('click', () => smallBoard.moveForward());     //以前是用的Post里的 boardElement.parentNode.querySelector(".small-board-prev");
    }

    document.getElementById('comments-list').appendChild(commentContainer);
}

/*function smallBoardMoveBackward() {
    if (currentSmallBoardIndex > 0) {
        currentSmallBoardIndex--;
        smallBoards[currentSmallBoardIndex].renderBoard(smallBoardElement);
    }
} */

async function saveCommentToDB(commentData) {
    try {
        // 确保 originalMoves 和 variationMoves 是正确的格式
        const formattedCommentData = {
            ...commentData,
            originalMoves: commentData.originalMoves.map(move => ({
                row: move.row,
                col: move.col,
                color: move.color
            })),
            variationMoves: commentData.variationMoves.map(move => ({
                row: move.row,
                col: move.col,
                color: move.color
            }))
        };

        const response = await fetch(`${CONFIG.API_BASE_URL}/comments/${commentData.postId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(commentData),
        });
    
        console.log("saveCommentToDB(), response is:", response);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
    
        const data = await response.json();
        console.log("saveCommentToDB, data is:", data);
    
        if (data.success) {
        console.log("评论成功保存到数据库");
        return data;
        } else {
        throw new Error(data.error || "保存评论失败");
        }
    } catch (error) {
        console.error("发送评论时出错:", error);
        throw error;
    }
}

//增加尺寸参数，为棋盘尺寸自适应
function calculateBoardSize2() {    //Post9.html 有重名的函数。暂时把这个改成2, 备用
    //winWidth = Math.max(200, Math.min(winWidth, 1100));
    const winWidth = window.innerWidth;
    console.log("Goboard9.js, Line 1406, winWidth is:", winWidth);
    //let cellSize = 20;
    
    if (winWidth < 480) {
        cellSize = Math.floor(winWidth / 20); // 为边框留出一些空间
    } else if (winWidth > 768) {
        cellSize = Math.floor(winWidth / 22);
        if (winWidth > 1100) {
            cellSize = Math.floor(1100 / 22);
            console.log("棋盘达到最大， cellSize is:", cellSize);
        }
    } else {
        cellSize = 30; // 默认尺寸
    }
    
    const boardSize = 19;
    const stoneDimension = Math.floor(cellSize * 0.95);
    console.log("cellSize is:", cellSize, "boardSize is:", boardSize, "stoneSize is:", stoneSize);

    return { cellSize, boardSize, stoneDimension };
}  

function toggleIndicator(indicatorId) {
    const indicator = document.getElementById(indicatorId);
    if (indicator) {
      indicator.classList.toggle('active');
      console.log(`Indicator ${indicatorId} is now ${indicator.classList.contains('active') ? 'active' : 'inactive'}`);
      console.log('Current classes:', indicator.className);
    } else {
      console.error(`Indicator with id ${indicatorId} not found`);
    }
  }