/**
 * 分析引擎类 - 专门处理 KataGo 分析逻辑
 */
class AnalysisEngine {
    constructor(katagoAPI, analysisStorage) {
        this.katagoAPI = katagoAPI;
        this.analysisStorage = analysisStorage;
        this.isAnalyzing = false;
        this.analysisResults = [];
        this.currentSGFHash = null;
        this.gameData = null; // 添加 gameData 属性
    }

    // 开始分析
    async startAnalysis(gameData, analysisDepth = 'normal', onProgress = null, onComplete = null, onMoveAnalyzed = null) {
        this.gameData = gameData; // 设置 gameData
        this.isAnalyzing = true;
        this.analysisResults = [];
        
        // 清空缓存
        this.analysisStorage.clearCache();
        
        try {
            console.log(`开始分析棋谱，共 ${gameData.moves.length} 手`);
            
            // 首先测试 KataGo 连接
            console.log('🔍 测试 KataGo 连接...');
            const connectionTest = await this.katagoAPI.testConnection();
            console.log('🔍 连接测试结果:', connectionTest);
            
            if (!connectionTest.success) {
                // 提供更详细的错误信息
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
            
            for (let moveIndex = 1; moveIndex <= gameData.moves.length; moveIndex++) {
                // 检查是否被停止
                if (!this.isAnalyzing) {
                    console.log('分析被用户停止');
                    break;
                }
                
                // 更新进度
                if (onProgress) {
                    onProgress(moveIndex, gameData.moves.length);
                }

                // 同步显示棋盘状态到当前分析的步数
                if (typeof renderMovesToIndex === 'function') {
                    renderMovesToIndex(moveIndex - 1);
                    console.log(`棋盘已同步到第${moveIndex}手`);
                }

                // 分析当前局面
                const analysisData = await this.analyzeMove(gameData, moveIndex);
                
                // 调用分析结果回调，显示分析结果
                if (onMoveAnalyzed && analysisData) {
                    const currentMove = gameData.moves[moveIndex - 1];
                    console.log('调用 onMoveAnalyzed 回调:', { moveIndex, currentMove, analysisData });
                    onMoveAnalyzed(moveIndex, currentMove, analysisData);
                }
                
                // 检查是否被停止
                if (!this.isAnalyzing) {
                    console.log('分析被用户停止');
                    break;
                }
                
                // 根据分析深度添加延迟
                const delays = { fast: 1000, normal: 2000, deep: 3000, ultra: 4000 };
                await this.sleep(delays[analysisDepth] || 2000);
            }

            // 分析完成后保存
            if (this.isAnalyzing) {
                await this.saveResults();
                
                if (onComplete) {
                    onComplete(this.analysisResults);
                }
            }

        } catch (error) {
            console.error('分析过程中出错:', error);
            throw error;
        } finally {
            this.isAnalyzing = false;
        }
    }

    // 停止分析
    stopAnalysis() {
        console.log('AnalysisEngine: 停止分析');
        this.isAnalyzing = false;
    }

    // 分析单步
    async analyzeMove(gameData, moveIndex) {
        const currentMove = gameData.moves[moveIndex - 1];
        
        console.log(`分析第${moveIndex}手`);
        
        try {
            const result = await this.katagoAPI.analyzePosition(gameData.rawMoves, moveIndex);
            
            if (result.success) {
                // 解析分析结果
                const analysisData = this.parseAnalysisResult(result.data);
                
                // 添加到缓存
                this.analysisStorage.addAnalysisResult(
                    this.currentSGFHash,
                    moveIndex,
                    currentMove,
                    analysisData
                );

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
            console.error(`分析第${moveIndex}手失败:`, error);
            throw error;
        }
    }

    // 解析 KataGo 分析结果
    parseAnalysisResult(rawData) {
        return {
            recommendedMove: rawData.moveInfos?.[0]?.move || '',
            winRate: rawData.rootInfo?.winrate ? (rawData.rootInfo.winrate * 100).toFixed(1) : 0,
            score: rawData.rootInfo?.scoreMean?.toFixed(2) || 0,
            visits: rawData.rootInfo?.visits || 0,
            time: rawData.time || 0,
            policy: rawData.moveInfos?.map(info => ({
                move: info.move,
                probability: info.prior
            })) || [],
            variations: rawData.moveInfos?.slice(0, 5).map(info => ({
                moves: [info.move],
                winRate: (info.winrate * 100).toFixed(1),
                score: info.scoreMean?.toFixed(2) || 0,
                visits: info.visits
            })) || [],
            rawData: rawData
        };
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

        const payload = {
            sgf: {
                hash: this.currentSGFHash,
                filename: this.gameData?.filename || 'unknown.sgf',
                content: this.gameData?.sgfContent || '',
                uploadTime: new Date().toISOString(),
                gameInfo: this.gameData?.gameInfo || {}
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

        try {
            const response = await fetch('/api/analysis/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('分析结果已保存到数据库');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

    // 停止分析
    stopAnalysis() {
        this.isAnalyzing = false;
    }

    // 获取分析状态
    getAnalysisStatus() {
        return {
            isAnalyzing: this.isAnalyzing,
            resultsCount: this.analysisResults.length
        };
    }

    // 工具方法：延迟
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}