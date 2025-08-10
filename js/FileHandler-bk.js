/**
 * 文件处理模块 - 负责SGF文件的上传、读取和解析
 */
class FileHandler {
    constructor(analysisStorage, sgfParser, analysisDisplay) {
        this.analysisStorage = analysisStorage;
        this.sgfParser = sgfParser;
        this.analysisDisplay = analysisDisplay;
        this.currentSGFHash = null;
        this.gameData = null;
    }

    // 设置事件监听器
    setupEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const selectFileBtn = document.getElementById('selectFileBtn');
        const uploadArea = document.getElementById('uploadArea');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        if (selectFileBtn) {
            selectFileBtn.addEventListener('click', () => fileInput?.click());
        }

        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput?.click());
            uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        }
    }

    // 处理文件上传
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const sgfContent = await this.readFile(file);
            await this.parseSGF(sgfContent, file.name);
            this.analysisDisplay.addLogEntry(`文件 ${file.name} 上传成功`, 'success');
            
            // 触发文件上传完成事件
            this.dispatchFileUploadEvent();
        } catch (error) {
            console.error('文件上传失败:', error);
            this.analysisDisplay.addLogEntry(`文件上传失败: ${error.message}`, 'error');
        }
    }

    // 处理拖拽悬停
    handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drag-over');
    }

    // 处理文件拖拽放置
    async handleDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.sgf')) {
                const sgfContent = await this.readFile(file);
                await this.parseSGF(sgfContent, file.name);
                this.dispatchFileUploadEvent();
            } else {
                this.analysisDisplay.addLogEntry('请选择 SGF 格式的文件', 'error');
            }
        }
    }

    // 读取文件内容
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }

    // 解析SGF文件
    async parseSGF(sgfContent, filename = 'unknown.sgf') {
        try {
            // 保存 SGF 文件并获取哈希值
            this.currentSGFHash = await this.analysisStorage.saveSGFFile(sgfContent, filename);
            
            // 重新上传文件时，直接清空已有的分析结果
            const existingResults = await this.analysisStorage.loadAnalysisResults(this.currentSGFHash);
            if (existingResults.length > 0) {
                console.log(`发现已有 ${existingResults.length} 条分析结果，重新上传文件时自动清空`);
                await this.analysisStorage.clearAnalysisResults(this.currentSGFHash);
                this.analysisDisplay.addLogEntry(`已清空 ${existingResults.length} 条历史分析结果`, 'info');
            }

            // 解析 SGF 内容
            const rawMoves = this.sgfParser.parseSGFMoves(sgfContent);
            const convertedMoves = this.convertMovesToGoBoard12Format(rawMoves);
            
            this.gameData = {
                sgfContent: sgfContent,
                filename: filename,
                rawMoves: rawMoves,
                moves: convertedMoves,
                gameInfo: this.sgfParser.extractGameInfo(sgfContent)
            };

            this.analysisDisplay.addLogEntry(`SGF 解析完成，共 ${this.gameData.moves.length} 手棋`, 'success');
            
            // 更新文件信息显示
            this.updateFileInfo(filename, this.gameData.moves.length);
            
        } catch (error) {
            console.error('SGF 解析失败:', error);
            this.analysisDisplay.addLogEntry(`SGF 解析失败: ${error.message}`, 'error');
        }
    }

    // 转换棋谱格式
    convertMovesToGoBoard12Format(moves) {
        return moves.map(move => {
            const [color, position] = move;
            
            if (position === 'pass') {
                const normalizedColor = color === 'B' ? 'black' : 'white';
                return { pass: true, color: normalizedColor };
            }
            
            // 将 KataGo 格式(如 'Q16') 转换为 row/col
            const col = position[0]; // 'Q'
            const rowStr = position.slice(1); // '16'
            
            // 列坐标转换: A-T (跳过I) -> 0-18
            let colIndex;
            if (col <= 'H') {
                colIndex = col.charCodeAt(0) - 65; // A-H -> 0-7
            } else {
                colIndex = col.charCodeAt(0) - 66; // J-T -> 8-18 (跳过I)
            }
            
            // 行坐标转换: 1-19 -> 18-0 (SGF中1是底部，但显示时19是顶部)
            const rowIndex = 19 - parseInt(rowStr);

            // 修正颜色格式
            const normalizedColor = (color && color.toUpperCase() === 'B') ? 'black' : 'white';
            
            return {
                row: rowIndex,
                col: colIndex,
                color: normalizedColor
            };
        });
    }

    // 更新文件信息显示
    updateFileInfo(filename, moveCount) {
        const fileInfoElement = document.getElementById('fileInfo');
        if (fileInfoElement) {
            fileInfoElement.textContent = `文件: ${filename} (${moveCount} 手)`;
        }
    }

    // 触发文件上传完成事件
    dispatchFileUploadEvent() {
        const event = new CustomEvent('fileUploaded', {
            detail: {
                gameData: this.gameData,
                sgfHash: this.currentSGFHash
            }
        });
        document.dispatchEvent(event);
    }

    // 获取当前游戏数据
    getGameData() {
        return this.gameData;
    }

    // 获取当前SGF哈希
    getCurrentSGFHash() {
        return this.currentSGFHash;
    }
}