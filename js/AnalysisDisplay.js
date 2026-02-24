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

    // 显示成功信息
    showSuccess(message) {
        this.addLogEntry(message, 'success');
        this.updateStatus(message);
    }

    // 显示错误信息
    showError(message) {
        this.addLogEntry(message, 'error');
        this.updateStatus('发生错误');
    }

    // 显示提示信息
    showInfo(message) {
        this.addLogEntry(message, 'info');
        this.updateStatus(message);
    }

    // 显示警示信息
    showWarning(message) {
        this.addLogEntry(message, 'warning');
    }

    // 显示分析结果
    displayAnalysisResult(moveNumber, moveData, analysisData) {
        console.log('displayAnalysisResult 被调用:', { moveNumber, moveData, analysisData });

        if (!analysisData) {
            console.error('analysisData 为空');
            this.addLogEntry(`第${moveNumber}手: 分析数据为空`, 'error');
            return;
        }

        // 🔥 增加：处理携带错误的分析结果
        if (analysisData.isError) {
            const errorMsg = `第${moveNumber}手: 分析失败 - ${analysisData.error || '未知错误'}`;
            this.addLogEntry(errorMsg, 'error');
            this.updateStatus(`第 ${moveNumber} 手分析失败，跳过...`);
            return;
        }

        // 详细的调试信息
        console.log('胜率数据详情:', {
            winRate: analysisData.winRate,
            winRateType: typeof analysisData.winRate,
            rawWinRate: analysisData.rawData?.winrate,
            analysisArray: analysisData.rawData?.analysis
        });

        const displayColor = moveData && moveData.color === 'white' ? '白' : '黑';
        const sgfPos = moveData ? this.convertToSGFPosition(moveData.row, moveData.col) : '未知';

        const moveInfo = moveData ?
            `${sgfPos} ${displayColor}` :
            '未知着法';

        // 调试：显示坐标转换过程
        if (moveData) {
            console.log(`[COORD_SYNC] 转换为SGF: (${moveData.row}, ${moveData.col}) -> ${sgfPos}`);
        }

        const recommendedMove = analysisData.recommendedMove || '无';
        const winRate = analysisData.winRate || '0.0';
        const score = analysisData.score || '0.00';
        const visits = analysisData.visits || '0';
        const time = analysisData.time || '0.0';

        const message = `第${moveNumber}手: ${moveInfo} | 推荐: ${recommendedMove} | ` +
            `胜率: ${winRate}% | 分数: ${score} | ` +
            `访问: ${visits} | 用时: ${time}s`;

        console.log('添加分析结果到日志:', message);
        this.addLogEntry(message, 'analysis-result');

        this.addLogEntry(message, 'analysis-result');

        // 更新胜率条，传入手数和着法数据以确定颜色
        this.updateWinRateBar(winRate, moveNumber, moveData);

        // 🔥 新增：实时更新分析结果列表
        this.appendAnalysisResultToTable(moveNumber, moveData, analysisData);
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

    // 显示分析完成信息并展示IndexedDB数据
    async displayAnalysisComplete(totalMoves, totalTime, analysisStorage, sgfHash) {
        const avgTime = totalTime / totalMoves;
        this.addLogEntry(`分析完成！共分析 ${totalMoves} 手，总用时 ${totalTime.toFixed(1)}s，平均 ${avgTime.toFixed(2)}s/手`, 'success');
        this.updateStatus('分析完成');

        // 显示IndexedDB中的数据
        if (analysisStorage && sgfHash) {
            await this.displayIndexedDBResults(analysisStorage, sgfHash);
        }
    }

    // 显示IndexedDB中的分析结果
    async displayIndexedDBResults(analysisStorage, sgfHash) {
        if (!analysisStorage || !sgfHash) {
            console.log('缺少必要参数，无法显示IndexedDB结果');
            return;
        }

        try {
            // 从IndexedDB加载分析结果
            const results = await analysisStorage.loadAnalysisResults(sgfHash);

            if (results.length === 0) {
                this.addLogEntry('暂无分析结果', 'info');
                return;
            }

            // 显示原始数据（前10行和最后20行）
            this.displayRawAnalysisData(results);

        } catch (error) {
            console.error('显示IndexedDB结果失败:', error);
            this.addLogEntry(`显示结果失败: ${error.message}`, 'error');
        }
    }

    // 显示原始分析数据
    displayRawAnalysisData(results) {
        const analysisResultsDiv = document.getElementById('analysisResults');
        if (!analysisResultsDiv) return;

        // 清空现有内容
        analysisResultsDiv.innerHTML = '';

        // 创建标题
        const title = document.createElement('h4');
        title.innerHTML = '<i class="fas fa-database"></i> 当前分析结果';
        title.style.marginBottom = '15px';
        title.style.color = '#2c3e50';
        analysisResultsDiv.appendChild(title);

        // 显示统计信息
        const statsDiv = document.createElement('div');
        statsDiv.className = 'analysis-stats';
        statsDiv.innerHTML = `
            <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                <strong>统计信息：</strong> 已完成 ${results.length} 步分析
            </div>
        `;
        analysisResultsDiv.appendChild(statsDiv);

        // 确定要显示的数据
        const showFirst = Math.min(10, results.length);
        const showLast = Math.min(20, results.length);

        // 显示前10条
        if (results.length > 0) {
            const firstSection = document.createElement('div');
            firstSection.innerHTML = '<h5><i class="fas fa-arrow-up"></i> 前 ' + showFirst + ' 步分析：</h5>';
            analysisResultsDiv.appendChild(firstSection);

            for (let i = 0; i < showFirst; i++) {
                const entry = this.createRawDataEntry(results[i], i + 1);
                analysisResultsDiv.appendChild(entry);
            }
        }

        // 如果数据超过30条，显示省略号
        if (results.length > 30) {
            const ellipsis = document.createElement('div');
            ellipsis.innerHTML = '<div style="text-align: center; padding: 10px; color: #6c757d;">... 省略中间部分 ...</div>';
            analysisResultsDiv.appendChild(ellipsis);
        }

        // 显示最后20条（如果总数超过10条）
        if (results.length > 10) {
            const lastSection = document.createElement('div');
            lastSection.innerHTML = '<h5><i class="fas fa-arrow-down"></i> 最后 ' + showLast + ' 步分析：</h5>';
            lastSection.style.marginTop = '20px';
            analysisResultsDiv.appendChild(lastSection);

            const startIndex = Math.max(showFirst, results.length - showLast);
            for (let i = startIndex; i < results.length; i++) {
                const entry = this.createRawDataEntry(results[i], i + 1);
                analysisResultsDiv.appendChild(entry);
            }
        }
    }

    // 🔥 新增：将单条分析结果添加到列表中
    appendAnalysisResultToTable(moveNumber, moveData, analysisData) {
        const analysisResultsDiv = document.getElementById('analysisResults');
        if (!analysisResultsDiv) return;

        // 如果是第一条结果，或者刚好是清空状态（包含提示文本），则清空容器
        if (moveNumber === 1 || analysisResultsDiv.querySelector('.fa-info-circle')) {
            analysisResultsDiv.innerHTML = '';

            // 重新添加标题（如果需要的话，但我们在HTML中移动了标题）
            // 这里我们只添加统计信息容器，如果还没有的话
            let statsDiv = analysisResultsDiv.querySelector('.analysis-stats');
            if (!statsDiv) {
                statsDiv = document.createElement('div');
                statsDiv.className = 'analysis-stats';
                statsDiv.style.marginBottom = '10px';
                analysisResultsDiv.appendChild(statsDiv);
            }
        }

        // 更新统计信息
        const statsDiv = analysisResultsDiv.querySelector('.analysis-stats');
        if (statsDiv) {
            statsDiv.innerHTML = `
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">
                    <strong>实时分析：</strong> 当前第 ${moveNumber} 步
                </div>
            `;
        }

        // 创建新的结果条目
        const result = {
            moveNumber: moveNumber,
            move: moveData,
            analysis: analysisData
        };

        const entry = this.createRawDataEntry(result, moveNumber);

        // 将新条目插入到统计信息之后，或者列表的最前面（如果是倒序显示）
        // 这里我们选择顺序显示，直接追加
        analysisResultsDiv.appendChild(entry);

        // 自动滚动到底部
        analysisResultsDiv.scrollTop = analysisResultsDiv.scrollHeight;
    }

    // 创建原始数据条目
    createRawDataEntry(result, index) {
        const entry = document.createElement('div');
        entry.className = 'raw-data-entry';
        entry.style.cssText = `
            background: #ffffff;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 8px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        `;

        const analysis = result.analysis || {};
        const move = result.move || {};

        // 🔥 修复：使用实际存储的颜色，而不是根据手数强行判断
        const displayColor = move.color === 'white' ? '白' : '黑';
        const displayPos = move.position || '未知位置';

        entry.innerHTML = `
            <div style="font-weight: bold; color: #495057; margin-bottom: 5px;">
                第 ${result.moveNumber} 手: ${displayColor}${displayPos}
            </div>
            <div style="color: #6c757d;">
                胜率: ${analysis.winRate || '未知'}% | 
                推荐: ${analysis.recommendedMove || '无'} | 
                分数: ${analysis.score || '0'} | 
                访问: ${analysis.visits || '0'}
            </div>
        `;

        return entry;
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

    // 更新胜率条
    updateWinRateBar(winRate, moveNumber, moveData) {
        const winrateBlack = document.getElementById('winrateBlack');
        const winrateWhite = document.getElementById('winrateWhite');
        const winratePercentage = document.getElementById('winratePercentage');

        if (!winrateBlack || !winrateWhite || !winratePercentage) {
            console.log('胜率条元素未找到');
            return;
        }

        const percentage = parseFloat(winRate) || 50.0;
        console.log('更新胜率条:', { winRate, percentage, moveNumber, moveData });

        // 关键修正：分析第N手时，实际是分析下第N手之前的局面
        // 所以KataGo返回的胜率是即将下子方的胜率
        // 🔥 修复：使用实际着法颜色确定下一位落子方，而不是依赖硬编码的奇偶性
        let nextPlayerColor;
        if (moveData && moveData.color) {
            nextPlayerColor = moveData.color === 'black' ? 'white' : 'black';
        } else if (moveNumber) {
            nextPlayerColor = moveNumber % 2 === 1 ? 'white' : 'black';
        } else {
            nextPlayerColor = 'black';
        }

        // KataGo 返回的胜率是即将下子方的胜率
        let blackWinRate, whiteWinRate;

        //console.log("nextPlayerColor", nextPlayerColor);

        /*if (nextPlayerColor === 'black') {
            // 即将下子的是黑棋，胜率就是黑棋胜率
            blackWinRate = percentage;
            whiteWinRate = 100 - percentage;
        } else {
            // 即将下子的是白棋，胜率就是白棋胜率
            blackWinRate = 100 - percentage;
            whiteWinRate = percentage;
        } */
        blackWinRate = percentage;
        whiteWinRate = 100 - percentage;
        //console.log("黑胜率是：", blackWinRate, "白胜率是：", whiteWinRate);
        // 确保胜率在合理范围内
        blackWinRate = Math.max(0, Math.min(100, blackWinRate));
        whiteWinRate = Math.max(0, Math.min(100, whiteWinRate));


        // 更新胜率条的宽度
        winrateBlack.style.width = `${blackWinRate}%`;
        winrateWhite.style.width = `${whiteWinRate}%`;

        // 更新百分比显示
        winratePercentage.textContent = `${blackWinRate.toFixed(1)}% - ${whiteWinRate.toFixed(1)}%`;

        // 添加过渡动画效果
        winrateBlack.style.transition = 'width 0.5s ease-in-out';
        winrateWhite.style.transition = 'width 0.5s ease-in-out';

        console.log('胜率条更新完成:', {
            nextPlayerColor,
            moveNumber,
            blackWinRate: blackWinRate.toFixed(1),
            whiteWinRate: whiteWinRate.toFixed(1)
        });
    }

    // 重置胜率条到初始状态
    resetWinRateBar() {
        const winrateBlack = document.getElementById('winrateBlack');
        const winrateWhite = document.getElementById('winrateWhite');
        const winratePercentage = document.getElementById('winratePercentage');

        if (winrateBlack && winrateWhite && winratePercentage) {
            winrateBlack.style.width = '50%';
            winrateWhite.style.width = '50%';
            winratePercentage.textContent = '50.0% - 50.0%';
        }
    }
}