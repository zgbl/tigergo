/**
 * 分析引擎类 - 专门处理 KataGo 分析逻辑
 */
class AnalysisEngine {
    constructor(katagoAPI, analysisStorage, analysisDisplay) {
        this.katagoAPI = katagoAPI;
        this.analysisStorage = analysisStorage;
        this.analysisDisplay = analysisDisplay;
        this.isAnalyzing = false;
        this.isPaused = false; // 新增：暂停状态
        this.analysisResults = [];
        this.currentSGFHash = null;
        this.gameData = null;
        this.abortController = null; // 🔥 新增：用于中断HTTP请求 2025.8.8
        // 新增：保存分析状态以便恢复
        this.analysisState = {
            gameData: null,
            analysisDepth: 'normal',
            currentMoveIndex: 0,
            onProgress: null,
            onComplete: null,
            onMoveAnalyzed: null
        };
    }

    // 开始分析
    async startAnalysis(gameData, analysisDepth = 'normal', onProgress = null, onComplete = null, onMoveAnalyzed = null) {
        try {
            console.log('🚀 开始分析，深度:', analysisDepth);

            // 🔥 如果正在分析，强制停止旧任务（可能是上次卡住的）
            if (this.isAnalyzing) {
                console.warn('⚠️ 发现残留的分析状态，强制重置...');
                this.stopAnalysis();
            }

            // 设置分析状态
            this.isAnalyzing = true;
            this.isPaused = false;
            this.abortController = null; // 🔥 确保干净的起始状态

            // 🔥 始终从头开始，清空旧结果
            this.analysisResults = [];
            this.analysisStorage.clearCache();

            // 保存分析状态以便恢复
            this.analysisState = {
                gameData,
                analysisDepth,
                onProgress,
                onComplete,
                onMoveAnalyzed,
                currentMoveIndex: 0
            };

            console.log('🔍 测试 KataGo 连接...');
            const connectionTest = await this.katagoAPI.testConnection();
            console.log('🔍 连接测试结果:', connectionTest);

            if (!connectionTest.success) {
                console.warn(`⚠️ KataGo 连接测试显示异常: ${connectionTest.error}。尝试继续分析...`);
                if (this.analysisDisplay) {
                    this.analysisDisplay.addLogEntry(`提示: KataGo 连接检查异常 (${connectionTest.error})，尝试继续分析...`, 'warning');
                }
            } else {
                console.log('✅ KataGo 连接成功，开始分析...');
            }

            // 开始分析循环
            await this.continueAnalysis();

        } catch (error) {
            console.error('分析过程中出错:', error);
            this.isAnalyzing = false;
            this.isPaused = false;
            throw error;
        }
    }

    // 暂停分析
    pauseAnalysis() {
        console.log('AnalysisEngine: 暂停分析');
        this.isPaused = true;

        // 🔥 中断当前的HTTP请求
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    // 恢复分析
    async resumeAnalysis() {
        console.log('AnalysisEngine: 恢复分析');
        if (!this.isAnalyzing) {
            console.log('没有正在进行的分析，无法恢复');
            return;
        }

        if (!this.isPaused) {
            console.log('分析未暂停，无需恢复');
            return;
        }

        // 取消暂停状态
        this.isPaused = false;
        console.log(`从第${this.analysisState.currentMoveIndex + 1}手继续分析`);

        // 🔥 重新启动分析循环
        await this.continueAnalysis();
    }

    // 继续分析的内部方法
    async continueAnalysis() {
        try {
            const { gameData, analysisDepth, onProgress, onComplete, onMoveAnalyzed } = this.analysisState;

            if (!gameData || !gameData.moves) {
                throw new Error('分析数据失效或未加载 (gameData.moves is null)');
            }

            // 从当前位置继续分析
            const startIndex = this.analysisState.currentMoveIndex + 1;

            for (let moveIndex = startIndex; moveIndex <= gameData.moves.length; moveIndex++) {
                // 检查是否被停止或暂停
                if (!this.isAnalyzing) {
                    console.log('分析被停止');
                    return;
                }

                if (this.isPaused) {
                    console.log('分析被暂停');
                    // 🔥 暂停时保存当前位置
                    this.analysisState.currentMoveIndex = moveIndex - 1;
                    return;
                }

                // 更新当前分析位置
                this.analysisState.currentMoveIndex = moveIndex;

                // 更新进度
                if (onProgress) {
                    onProgress(moveIndex, gameData.moves.length);
                }

                // 同步显示棋盘状态到当前分析的步数
                if (typeof renderMovesToIndex === 'function') {
                    renderMovesToIndex(moveIndex - 1);
                    console.log(`棋盘已同步到第${moveIndex}手`);
                }

                try {
                    // 🔥 分析前再次检查状态
                    if (!this.isAnalyzing || this.isPaused) {
                        console.log(this.isPaused ? '分析在分析单步前被暂停' : '分析在分析单步前被停止');
                        return;
                    }

                    // 分析当前局面
                    const analysisData = await this.analyzeMove(gameData, moveIndex);

                    // 🔥 分析完成后再次检查状态
                    if (!this.isAnalyzing || this.isPaused) {
                        console.log(this.isPaused ? '分析在分析单步后被暂停' : '分析在分析单步后被停止');
                        return;
                    }

                    // 调用分析结果回调，显示分析结果
                    if (onMoveAnalyzed && analysisData) {
                        const currentMove = gameData.moves[moveIndex - 1];
                        console.log('调用 onMoveAnalyzed 回调:', { moveIndex, currentMove, analysisData });
                        onMoveAnalyzed(moveIndex, currentMove, analysisData);
                    }

                } catch (error) {
                    console.error(`分析第${moveIndex}手时出错:`, error);

                    // 🔥 改进：即便分析出错（如超时），也要反馈给 UI，避免看起来像卡住了
                    if (onMoveAnalyzed) {
                        const currentMove = gameData.moves[moveIndex - 1];
                        // 传入一个特殊的错误标记数据
                        onMoveAnalyzed(moveIndex, currentMove, {
                            error: error.message,
                            isError: true,
                            time: 0,
                            winRate: 0,
                            score: 0,
                            visits: 0
                        });
                    }

                    // 分析出错时也要检查是否应该停止
                    if (!this.isAnalyzing || this.isPaused) {
                        return;
                    }
                    // 出错时也要记录，但不跳过延迟
                    console.log(`第${moveIndex}手分析失败，将在延迟后继续下一手`);
                }

                // 🔥 获取分析深度对应的延迟配置
                const analysisConfig = this.katagoAPI.getAnalysisConfig(analysisDepth);
                const delayMs = analysisConfig.delay || 5000;

                console.log(`第${moveIndex}手分析完成，根据配置 (${analysisDepth}) 等待 ${delayMs}ms 后继续...`);
                await this.sleep(delayMs);
            }

            // 分析完成后保存
            if (this.isAnalyzing && !this.isPaused) {
                await this.saveResults();

                if (onComplete) {
                    onComplete(this.analysisResults);
                }

                // 分析完成，重置状态
                this.isAnalyzing = false;
                this.isPaused = false;
            }

        } catch (error) {
            console.error('继续分析过程中出错:', error);
            this.isAnalyzing = false;
            this.isPaused = false;
            throw error;
        }
    }

    // 停止分析
    stopAnalysis() {
        console.log('AnalysisEngine: 停止分析');
        this.isAnalyzing = false;
        this.isPaused = false;

        // 🔥 中断当前的HTTP请求
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        // 重置分析状态
        this.analysisState.currentMoveIndex = 0;
    }

    // 获取分析状态
    getAnalysisStatus() {
        return {
            isAnalyzing: this.isAnalyzing,
            isPaused: this.isPaused,
            resultsCount: this.analysisResults.length,
            currentMoveIndex: this.analysisState.currentMoveIndex
        };
    }

    // 分析单步
    async analyzeMove(gameData, moveIndex) {
        // 🔥 增加同步检查日志
        console.log(`[COORD_SYNC] 分析第${moveIndex}手检查:`);
        console.log(`  - rawMoves 长度: ${gameData.rawMoves.length}`);
        console.log(`  - moves 长度: ${gameData.moves.length}`);

        if (gameData.rawMoves.length !== gameData.moves.length) {
            console.error(`[COORD_SYNC] ⚠️ 警告：数据长度不一致！可能会导致坐标偏移。`);
        }

        const currentMove = gameData.moves[moveIndex - 1];
        const rawMove = gameData.rawMoves[moveIndex - 1];

        console.log(`  - 原始着法 (rawMoves[${moveIndex - 1}]):`, rawMove);
        console.log(`  - 转换后着法 (moves[${moveIndex - 1}]):`, currentMove);

        try {
            // 🔥 检查是否应该停止
            if (!this.isAnalyzing || this.isPaused) {
                throw new Error('分析已被中断');
            }

            // 🔥 为每次分析请求创建全新的 AbortController（不要 abort 旧的）
            this.abortController = new AbortController();
            console.log(`🔍 创建新的 AbortController for move ${moveIndex}`);

            // 🔥 传递分析深度参数
            const result = await this.katagoAPI.analyzePosition(
                gameData.rawMoves,
                moveIndex,
                this.abortController.signal,
                this.analysisState.analysisDepth // 🔥 添加分析深度参数
            );

            if (result.success) {
                // 确定当前落子方
                let nextPlayer = 'black';
                if (moveIndex > 0) {
                    const lastMove = gameData.moves[moveIndex - 1]; // 注意：gameData.moves是已经转换过的
                    // 或者更简单的：偶数步是黑棋下(0, 2...)，奇数步是白棋下(1, 3...)
                    // moveIndex 是"当前要分析的局面是第几手之后"。
                    // moveIndex=0 (空盘) -> Next: Black
                    // moveIndex=1 (黑下了) -> Next: White
                    nextPlayer = (moveIndex % 2 === 0) ? 'black' : 'white';
                }

                // 解析分析结果
                const analysisData = this.parseAnalysisResult(result.data, nextPlayer);

                // 立即保存到IndexedDB（单条记录）
                const analysisResult = this.analysisStorage.addAnalysisResult(
                    this.currentSGFHash,
                    moveIndex,
                    currentMove,
                    analysisData
                );

                // 立即保存到IndexedDB
                await this.saveCurrentAnalysisToIndexedDB(analysisResult);

                // 添加到本地结果数组
                this.analysisResults.push({
                    moveNumber: moveIndex,
                    move: currentMove,
                    analysis: analysisData
                });

                return analysisData;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message.includes('aborted')) {
                console.log(`第${moveIndex}手分析被中断或超时: ${error.message}`);
                throw new Error('分析被中止');
            }
            console.error(`分析第${moveIndex}手失败:`, error);
            throw error;
        }
    }

    // 立即保存单条分析结果到IndexedDB
    async saveCurrentAnalysisToIndexedDB(analysisResult) {
        try {
            const transaction = this.analysisStorage.db.transaction(['analysisResults'], 'readwrite');
            const store = transaction.objectStore('analysisResults');

            return new Promise((resolve, reject) => {
                const request = store.add(analysisResult);
                request.onsuccess = () => {
                    console.log(`第${analysisResult.moveNumber}手分析结果已保存到IndexedDB`);
                    resolve(request.result);
                };
                request.onerror = () => {
                    console.error(`保存第${analysisResult.moveNumber}手到IndexedDB失败:`, request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('保存到IndexedDB失败:', error);
            throw error;
        }
    }

    // 解析 KataGo 分析结果
    parseAnalysisResult(rawData, explicitSideToMove = null) {

        console.log('🔥 [DEBUG] KataGo原始返回数据(Full):', JSON.stringify(rawData, null, 2));
        console.log(`🔥 [DEBUG] analysis 数组是否存在: ${!!rawData.analysis}`);
        console.log(`🔥 [DEBUG] analysis 数组长度: ${rawData.analysis ? rawData.analysis.length : 'N/A'}`);

        // 如果数量少于3个，打印警告
        if (rawData.analysis && rawData.analysis.length < 3) {
            console.warn('⚠️ KataGo返回的Variations数量少于3个！可能是引擎配置限制。');
        }

        // 🔥 添加原始数据大小检查
        const rawDataSize = JSON.stringify(rawData).length;
        console.log(`🔍 原始 rawData 大小: ${(rawDataSize / 1024).toFixed(2)} KB`);

        // 🔥 检查 rawData 的主要字段大小
        if (rawData.analysis) {
            const analysisSize = JSON.stringify(rawData.analysis).length;
            console.log(`🔍 rawData.analysis 大小: ${(analysisSize / 1024).toFixed(2)} KB, 包含 ${rawData.analysis.length} 个变化`);

            // 检查每个 analysis 项的大小
            rawData.analysis.slice(0, 3).forEach((item, index) => {
                const itemSize = JSON.stringify(item).length;
                console.log(`🔍 analysis[${index}] 大小: ${(itemSize / 1024).toFixed(2)} KB`);

                // 检查具体字段
                Object.keys(item).forEach(key => {
                    if (item[key] && typeof item[key] === 'object') {
                        const fieldSize = JSON.stringify(item[key]).length;
                        if (fieldSize > 1000) { // 只显示大于1KB的字段
                            console.log(`🔍   - ${key}: ${(fieldSize / 1024).toFixed(2)} KB`);
                        }
                    }
                });
            });
        }

        // 参考老版本的正确数据路径
        let winRate = 0;
        let recommendedMove = '';
        let score = 0;
        let visits = 0;
        let time = rawData.analysis_time || 0;

        // 1. 确定当前落子方 (Side to move)
        // 优先使用传入的 explicitSideToMove，否则尝试从 rootInfo 获取，最后默认 black
        let sideToMove = explicitSideToMove;
        if (!sideToMove) {
            sideToMove = (rawData.rootInfo && rawData.rootInfo.currentPlayer === 'W') ? 'white' : 'black';
        }
        console.log(`🔥 [DEBUG] 当前落子方: ${sideToMove} (explicit: ${explicitSideToMove}, rootInfo: ${rawData.rootInfo?.currentPlayer})`);

        // 2. 确定推荐步
        if (rawData.bot_move) {
            recommendedMove = rawData.bot_move;
        }

        // 3. 确定胜率 (归一化为黑棋胜率 0-100)
        if (rawData.rootInfo && rawData.rootInfo.winrate !== undefined) {
            // 注意: KataGo rootInfo.winrate 已经是黑棋胜率了（无论谁下）
            winRate = (rawData.rootInfo.winrate * 100).toFixed(1);
        } else if (rawData.winrate !== null && rawData.winrate !== undefined) {
            winRate = (rawData.winrate * 100).toFixed(1);
        }

        if (rawData.rootInfo && rawData.rootInfo.scoreLead !== undefined) {
            score = rawData.rootInfo.scoreLead.toFixed(2);
        } else if (rawData.score !== null && rawData.score !== undefined) {
            score = rawData.score.toFixed(2);
        }

        if (rawData.rootInfo && rawData.rootInfo.visits) {
            visits = rawData.rootInfo.visits;
        } else if (rawData.visits) {
            visits = rawData.visits;
        }

        // 4. 处理候选变化 (Variations)
        let variationsSource = [];
        if (rawData.full_analysis && rawData.full_analysis.moveInfos) {
            variationsSource = rawData.full_analysis.moveInfos;
        } else if (rawData.moveInfos) {
            variationsSource = rawData.moveInfos;
        } else {
            variationsSource = rawData.analysis || [];
        }

        console.log(`🔥 [DEBUG] 原始候选点数量: ${variationsSource.length}`);

        // 5. 归一化并显式排序
        // 关键：KataGo 的 moveInfos.winrate 通常也是相对于黑棋的（取决于配置，但习惯上是黑棋）
        // 如果不是，我们需要在这里进行 100-x 的处理。经过分析，KataGo 返回通常是黑棋胜率。

        const processedVariations = variationsSource.map(info => {
            let wr = (info.winrate !== undefined) ? parseFloat(info.winrate) : 0;
            // 转换为 0-100
            if (wr <= 1.0) wr *= 100;

            return {
                move: info.move,
                winrate: wr,
                scoreLead: info.scoreLead || info.scoreMean || 0,
                visits: info.visits || 0
            };
        });

        // 🔥 显式按当前方利益排序
        processedVariations.sort((a, b) => {
            if (sideToMove === 'black') {
                return b.winrate - a.winrate; // 黑棋选胜率最高的
            } else {
                return a.winrate - b.winrate; // 白棋选黑棋胜率最低的
            }
        });

        const result = {
            recommendedMove: recommendedMove || (processedVariations[0] ? processedVariations[0].move : ''),
            winRate: winRate,
            score: score,
            visits: visits,
            time: time,
            policy: rawData.analysis?.map(info => ({
                move: info.move,
                probability: info.prior || info.probability
            })) || [],
            variations: processedVariations.slice(0, 10).map(v => ({
                moves: [v.move],
                winRate: v.winrate.toFixed(1), // 存储格式：0-100 字符串
                score: v.scoreLead.toFixed(2),
                visits: v.visits
            })),
            rawData: rawData
        };

        // 🔥 检查解析后结果的大小
        const resultSize = JSON.stringify(result).length;
        console.log(`🔍 解析后结果大小: ${(resultSize / 1024).toFixed(2)} KB`);
        console.log(`🔍 其中 rawData 占用: ${(rawDataSize / 1024).toFixed(2)} KB (${((rawDataSize / resultSize) * 100).toFixed(1)}%)`);

        console.log('parseAnalysisResult 解析后的结果:', result);
        return result;
    }

    // 保存分析结果
    async saveResults() {
        try {
            // 保存到 IndexedDB
            await this.analysisStorage.saveAnalysisToIndexedDB();
            console.log('分析结果已保存到本地缓存');

            // 发送到后端数据库
            await this.saveToMongoDB();

        } catch (error) {
            console.error('保存分析结果失败:', error);
            throw error;
        }
    }

    // 发送到 MongoDB
    async saveToMongoDB() {
        const analysisResults = this.analysisStorage.getCachedResults();
        if (analysisResults.length === 0) return;

        // 🔥 详细分析 analysisResults 的数据大小
        console.log(`🔍 准备保存 ${analysisResults.length} 条分析结果`);

        let totalSize = 0;
        let rawDataTotalSize = 0;

        analysisResults.forEach((result, index) => {
            const resultSize = JSON.stringify(result).length;
            totalSize += resultSize;

            if (result.analysis && result.analysis.rawData) {
                const rawDataSize = JSON.stringify(result.analysis.rawData).length;
                rawDataTotalSize += rawDataSize;

                if (index < 3) { // 只显示前3条的详细信息
                    console.log(`🔍 第${result.moveNumber}手分析结果:`);
                    console.log(`  - 总大小: ${(resultSize / 1024).toFixed(2)} KB`);
                    console.log(`  - rawData大小: ${(rawDataSize / 1024).toFixed(2)} KB (${((rawDataSize / resultSize) * 100).toFixed(1)}%)`);

                    // 检查 rawData 中的大字段
                    if (result.analysis.rawData.analysis) {
                        const analysisArraySize = JSON.stringify(result.analysis.rawData.analysis).length;
                        console.log(`  - rawData.analysis数组大小: ${(analysisArraySize / 1024).toFixed(2)} KB`);
                        console.log(`  - rawData.analysis包含 ${result.analysis.rawData.analysis.length} 个变化`);
                    }
                }
            }
        });

        console.log(`🔍 所有分析结果总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`🔍 其中 rawData 总大小: ${(rawDataTotalSize / 1024 / 1024).toFixed(2)} MB (${((rawDataTotalSize / totalSize) * 100).toFixed(1)}%)`);

        // 🔥 从正确的位置获取gameData
        const gameData = this.analysisState.gameData;
        if (!gameData) {
            console.error('gameData 不存在，无法保存到MongoDB');
            return;
        }

        // 🔥 添加调试信息，检查sgfContent
        console.log('gameData检查:', {
            hasGameData: !!gameData,
            hasSgfContent: !!gameData.sgfContent,
            sgfContentLength: gameData.sgfContent?.length || 0,
            filename: gameData.filename
        });

        const payload = {
            sgf: {
                hash: this.currentSGFHash,
                filename: gameData.filename || 'unknown.sgf',
                content: gameData.sgfContent || '', // 🔥 使用正确的gameData
                uploadTime: new Date().toISOString(),
                gameInfo: gameData.gameInfo || {}
            },
            analysisConfig: {
                engine: 'katago',
                engineVersion: '1.0',
                visits: 800,
                time: 30,
                analysisDate: new Date().toISOString(),
                totalMoves: analysisResults.length
            },
            analysisResults: analysisResults.map(result => ({
                moveNumber: result.moveNumber,
                move: result.move,
                analysis: {
                    recommendedMove: result.analysis.recommendedMove,
                    winRate: result.analysis.winRate,
                    score: result.analysis.score,
                    visits: result.analysis.visits,
                    time: result.analysis.time,
                    // 保存所有变化 -> 恢复为只保存前10个
                    variations: result.analysis.variations ? result.analysis.variations.slice(0, 10) : [],
                    policy: result.analysis.policy || []
                    // 🔥 完全移除 rawData！这是数据量大的罪魁祸首
                }
            })),
            metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                analysisStatus: 'completed',
                totalAnalysisTime: analysisResults.reduce((sum, r) => sum + (r.analysis.time || 0), 0),
                averageTime: analysisResults.length > 0 ?
                    (analysisResults.reduce((sum, r) => sum + (r.analysis.time || 0), 0) / analysisResults.length).toFixed(2) : 0,
                version: '1.0'
            }
        };

        // 🔥 详细分析 payload 各部分的大小
        const sgfSize = JSON.stringify(payload.sgf).length;
        const configSize = JSON.stringify(payload.analysisConfig).length;
        const resultsSize = JSON.stringify(payload.analysisResults).length;
        const metadataSize = JSON.stringify(payload.metadata).length;
        const totalPayloadSize = JSON.stringify(payload).length;

        console.log(`🔍 Payload 各部分大小分析:`);
        console.log(`  - SGF部分: ${(sgfSize / 1024).toFixed(2)} KB (${((sgfSize / totalPayloadSize) * 100).toFixed(1)}%)`);
        console.log(`  - 配置部分: ${(configSize / 1024).toFixed(2)} KB (${((configSize / totalPayloadSize) * 100).toFixed(1)}%)`);
        console.log(`  - 分析结果部分: ${(resultsSize / 1024 / 1024).toFixed(2)} MB (${((resultsSize / totalPayloadSize) * 100).toFixed(1)}%)`);
        console.log(`  - 元数据部分: ${(metadataSize / 1024).toFixed(2)} KB (${((metadataSize / totalPayloadSize) * 100).toFixed(1)}%)`);
        console.log(`  - 总大小: ${(totalPayloadSize / 1024 / 1024).toFixed(2)} MB`);

        // 🔥 如果超过一定大小，给出警告
        if (totalPayloadSize > 16 * 1024 * 1024) { // 16MB
            console.error(`❌ 数据量过大 (${(totalPayloadSize / 1024 / 1024).toFixed(2)} MB)，可能会导致 HTTP 413 错误`);
        } else if (totalPayloadSize > 10 * 1024 * 1024) { // 10MB
            console.warn(`⚠️ 数据量较大 (${(totalPayloadSize / 1024 / 1024).toFixed(2)} MB)，建议优化`);
        }

        // 🔥 检查sgf.content是否存在
        if (!payload.sgf.content) {
            console.error('警告: sgf.content 为空，这将导致后端验证失败');
            console.log('gameData详细信息:', gameData);
        }

        try {
            const response = await fetch('/api/saveAnalysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('分析结果已保存到数据库');
            } else {
                // 🔥 获取详细的错误信息
                const errorText = await response.text();
                console.error('后端返回的错误信息:', errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }
        } catch (error) {
            console.error('保存到 MongoDB 失败:', error);
            throw error;
        }
    }

    // 设置当前 SGF 哈希值
    setSGFHash(hash) {
        this.currentSGFHash = hash;
    }

    // 工具方法：延迟
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}