/**
 * 分析引擎类 - 专门处理 KataGo 分析逻辑
 */
class AnalysisEngine {
    constructor(katagoAPI, analysisStorage) {
        this.katagoAPI = katagoAPI;
        this.analysisStorage = analysisStorage;
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
            
            // 设置分析状态
            this.isAnalyzing = true;
            this.isPaused = false;
            
            // 保存分析状态以便恢复
            this.analysisState = {
                gameData,
                analysisDepth,
                onProgress,
                onComplete,
                onMoveAnalyzed,
                currentMoveIndex: this.analysisState.currentMoveIndex || 0
            };
            
            // 清空之前的分析结果（如果是新开始的分析）
            if (this.analysisState.currentMoveIndex === 0) {
                this.analysisResults = [];
                this.analysisStorage.clearCache();
            }
            
            console.log('🔍 测试 KataGo 连接...');
            const connectionTest = await this.katagoAPI.testConnection();
            console.log('🔍 连接测试结果:', connectionTest);
            
            if (!connectionTest.success) {
                let errorMessage = `KataGo 连接失败: ${connectionTest.error}`;
                
                if (connectionTest.error.includes('404')) {
                    errorMessage += '\n\n可能的解决方案:\n1. 检查 KataGo 服务是否正在运行\n2. 确认服务地址是否正确\n3. 检查防火墙设置';
                } else if (connectionTest.error.includes('CORS')) {
                    errorMessage += '\n\n需要在 KataGo 启动时添加 CORS 支持:\n--cors-allowed-origins "*"';
                } else if (connectionTest.error.includes('Failed to fetch')) {
                    errorMessage += '\n\n网络连接失败，请检查:\n1. KataGo 服务是否启动\n2. 网络连接是否正常\n3. 服务地址是否可访问';
                }
                
                throw new Error(errorMessage);
            }
            
            console.log('✅ KataGo 连接成功，开始分析...');
            
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
                    // 分析出错时也要检查是否应该停止
                    if (!this.isAnalyzing || this.isPaused) {
                        return;
                    }
                    // 出错时也要记录，但不跳过延迟
                    console.log(`第${moveIndex}手分析失败，将在延迟后继续下一手`);
                }
                
                // 🔥 无论成功还是失败，都要执行延迟（移到这里确保总是执行）
                const delays = { fast: 2000, normal: 5000, deep: 8000, ultra: 10000 };
                console.log(`第${moveIndex}手分析完成，等待 ${delays[analysisDepth] || 5000}ms 后继续...`);
                await this.sleep(delays[analysisDepth] || 5000);
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
        const currentMove = gameData.moves[moveIndex - 1];
        
        console.log(`分析第${moveIndex}手`);
        
        try {
            // 🔥 检查是否应该停止
            if (!this.isAnalyzing || this.isPaused) {
                throw new Error('分析已被中断');
            }
            
            // 🔥 创建新的 AbortController
            this.abortController = new AbortController();

            // 🔥 传递分析深度参数
            const result = await this.katagoAPI.analyzePosition(
                gameData.rawMoves, 
                moveIndex, 
                this.abortController.signal,
                this.analysisState.analysisDepth // 🔥 添加分析深度参数
            );
            
            if (result.success) {
                // 解析分析结果
                const analysisData = this.parseAnalysisResult(result.data);
                
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
            if (error.name === 'AbortError') {
                console.log(`第${moveIndex}手分析被中断`);
                throw new Error('分析被中断');
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
    parseAnalysisResult(rawData) {
        console.log('parseAnalysisResult 接收到的原始数据:', rawData);
        
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
        
        // 首先尝试从主要字段获取数据
        if (rawData.winrate !== null && rawData.winrate !== undefined) {
            winRate = (rawData.winrate * 100).toFixed(1);
        }
        
        if (rawData.bot_move) {
            recommendedMove = rawData.bot_move;
        }
        
        if (rawData.score !== null && rawData.score !== undefined) {
            score = rawData.score.toFixed(2);
        }
        
        if (rawData.visits) {
            visits = rawData.visits;
        }
        
        // 如果主要字段为空，尝试从 analysis 数组中获取
        if (rawData.analysis && rawData.analysis.length > 0) {
            const firstAnalysis = rawData.analysis[0];
            
            if (!recommendedMove && firstAnalysis.move) {
                recommendedMove = firstAnalysis.move;
            }
            
            if (winRate === 0 && firstAnalysis.winrate !== null && firstAnalysis.winrate !== undefined) {
                winRate = (firstAnalysis.winrate * 100).toFixed(1);
            }
            
            if (score === 0 && (firstAnalysis.scoreLead !== null || firstAnalysis.scoreMean !== null)) {
                score = (firstAnalysis.scoreLead || firstAnalysis.scoreMean || 0).toFixed(2);
            }
            
            if (visits === 0 && firstAnalysis.visits) {
                visits = firstAnalysis.visits;
            }
        }
        
        const result = {
            recommendedMove: recommendedMove || '',
            winRate: winRate,
            score: score,
            visits: visits,
            time: time,
            policy: rawData.analysis?.map(info => ({
                move: info.move,
                probability: info.prior || info.probability
            })) || [],
            variations: rawData.analysis?.slice(0, 5).map(info => ({
                moves: [info.move],
                winRate: info.winrate ? (info.winrate * 100).toFixed(1) : '0.0',
                score: (info.scoreLead || info.scoreMean || 0).toFixed(2),
                visits: info.visits || 0
            })) || [],
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
                analysis: result.analysis
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