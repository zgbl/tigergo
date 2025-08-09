/**
 * 分析结果显示类 - 专门处理UI显示和交互
 */
class AnalysisDisplay {
    constructor() {
        this.logContainer = null;
        this.progressBar = null;
        this.statusElement = null;
        this.init();
    }

    init() {
        this.logContainer = document.getElementById('analysisLog');
        this.progressBar = document.getElementById('analysisProgress');
        this.statusElement = document.getElementById('analysisStatus');
    }

    // 添加日志条目
    addLogEntry(message, type = 'info') {
        if (!this.logContainer) return;

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
        
        this.logContainer.appendChild(logEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;

        // 限制日志条目数量
        const maxEntries = 100;
        while (this.logContainer.children.length > maxEntries) {
            this.logContainer.removeChild(this.logContainer.firstChild);
        }
    }

    // 更新分析进度
    updateProgress(current, total) {
        if (this.progressBar) {
            const percentage = Math.round((current / total) * 100);
            this.progressBar.style.width = `${percentage}%`;
            this.progressBar.textContent = `${current}/${total} (${percentage}%)`;
        }

        this.addLogEntry(`分析进度: ${current}/${total} (${Math.round((current / total) * 100)}%)`, 'info');
    }

    // 显示分析结果
    displayAnalysisResult(moveNumber, moveData, analysisData) {
        console.log('displayAnalysisResult 被调用:', { moveNumber, moveData, analysisData });
        
        if (!analysisData) {
            console.error('analysisData 为空');
            this.addLogEntry(`第${moveNumber}手: 分析数据为空`, 'error');
            return;
        }
        
        const moveInfo = moveData ? 
            `${this.convertToSGFPosition(moveData.row, moveData.col)} ${moveData.color}` : 
            '未知着法';
        
        const recommendedMove = analysisData.recommendedMove || '无';
        const winRate = analysisData.winRate || '0';
        const score = analysisData.score || '0';
        const visits = analysisData.visits || '0';
        const time = analysisData.time || '0';
        
        const message = `第${moveNumber}手: ${moveInfo} | 推荐: ${recommendedMove} | ` +
                       `胜率: ${winRate}% | 分数: ${score} | ` +
                       `访问: ${visits} | 用时: ${time}s`;
        
        console.log('添加分析结果到日志:', message);
        this.addLogEntry(message, 'analysis-result');
    }

    // 显示错误信息
    displayError(moveNumber, error) {
        this.addLogEntry(`分析第${moveNumber}手失败: ${error}`, 'error');
    }

    // 更新状态显示
    updateStatus(status) {
        console.log("AnalysisDisplay, updateStatus, line 68")
        if (this.statusElement) {
            this.statusElement.textContent = status;
        }
    }

    // 显示分析完成信息
    displayAnalysisComplete(totalMoves, totalTime) {
        const avgTime = totalTime / totalMoves;
        this.addLogEntry(`分析完成！共分析 ${totalMoves} 手，总用时 ${totalTime.toFixed(1)}s，平均 ${avgTime.toFixed(2)}s/手`, 'success');
        this.updateStatus('分析完成');
    }

    // 清空日志
    clearLog() {
        if (this.logContainer) {
            this.logContainer.innerHTML = '';
        }
    }

    // 重置进度条
    resetProgress() {
        if (this.progressBar) {
            this.progressBar.style.width = '0%';
            this.progressBar.textContent = '0%';
        }
    }

    // 辅助方法：将 row/col 转换为 SGF 位置格式
    convertToSGFPosition(row, col) {
        if (row === undefined || col === undefined) return '';
        
        // 列转换: 0-18 -> A-T (跳过I)
        let colChar;
        if (col <= 7) {
            colChar = String.fromCharCode(65 + col); // A-H
        } else {
            colChar = String.fromCharCode(66 + col); // J-T
        }
        
        // 行转换: 0-18 -> 19-1
        const rowNum = 19 - row;
        
        return colChar + rowNum;
    }

    // 显示已有分析结果提示
    showExistingAnalysisPrompt(existingResults) {
        const message = `发现已有 ${existingResults.length} 条分析结果，是否使用已有结果？`;
        if (confirm(message)) {
            this.loadExistingResults(existingResults);
        }
    }

    // 加载已有分析结果
    loadExistingResults(results) {
        this.clearLog();
        this.addLogEntry(`正在加载已有的 ${results.length} 条分析结果...`, 'info');
        
        results.forEach(result => {
            this.displayAnalysisResult(result.moveNumber, result.move, result.analysis);
        });
        
        this.addLogEntry('已有分析结果加载完成', 'success');
        this.updateStatus('已加载历史分析');
    }
}