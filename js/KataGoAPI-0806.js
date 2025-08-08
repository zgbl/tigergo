// KataGo API 调用模块 - 支持直连和代理两种模式

class KataGoAPI {
    constructor(baseUrl = null, botName = 'katago_gtp_bot', useProxy = false) {
        // 根据 useProxy 参数选择使用直连还是代理
        if (useProxy) {
            this.baseUrl = (baseUrl || window.CONFIG?.KATAGO_PROXY_URL || 'http://localhost:3000/api/katago').replace(/\/$/, '');
            this.isProxyMode = true;
        } else {
            this.baseUrl = (baseUrl || window.CONFIG?.KATAGO_BASE_URL || 'http://192.168.0.249:8080').replace(/\/$/, '');
            this.isProxyMode = false;
        }
        
        this.botName = botName;
        this.debugMode = false;
        
        // 创建专用的 fetch 会话
        this.headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'SGF-Analysis-Frontend/1.0'
        };
        
        console.log(`🔧 KataGoAPI 初始化:`);
        console.log(`  - 模式: ${this.isProxyMode ? '代理模式' : '直连模式'}`);
        console.log(`  - 地址: ${this.baseUrl}`);
        console.log(`  - 机器人名称: ${this.botName}`);
    }

    // 打印状态信息
    printStatus(message, status = "INFO") {
        const timestamp = new Date().toLocaleTimeString();
        const statusSymbols = {
            'INFO': '🔵',
            'SUCCESS': '✅',
            'ERROR': '❌',
            'WARNING': '⚠️',
            'ANALYSIS': '🧠',
            'MOVE': '🎯',
            'DEBUG': '🐛'
        };
        const symbol = statusSymbols[status] || '🔵';
        const logMessage = `[${timestamp}] ${symbol} ${message}`;
        
        console.log(logMessage);
        
        // 触发自定义事件，让主应用可以监听
        window.dispatchEvent(new CustomEvent('katagoStatus', {
            detail: { message, status, timestamp }
        }));
    }

    // 调试打印
    debugPrint(message, data = null) {
        if (this.debugMode) {
            this.printStatus(`DEBUG: ${message}`, "DEBUG");
            if (data !== null) {
                console.log(data);
            }
        }
    }

    // 测试服务器连接 - 修复CORS问题
    async testConnection() {
        try {
            this.printStatus("测试 KataGo 服务器连接...", "INFO");
            
            // 先尝试简单的连接测试，避免CORS预检请求
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                mode: 'cors', // 明确指定CORS模式
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(10000)
            });
            
            if (response.ok) {
                const data = await response.json();
                this.printStatus(`服务器连接成功: ${data.status || 'OK'}`, "SUCCESS");
                return { success: true, data };
            } else {
                this.printStatus(`服务器连接失败: HTTP ${response.status}`, "ERROR");
                return { success: false, error: `HTTP ${response.status}` };
            }
        } catch (error) {
            // 处理CORS错误
            if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                this.printStatus(`CORS错误: KataGo服务器需要配置CORS头`, "ERROR");
                this.printStatus(`建议: 在KataGo启动时添加 --cors-allowed-origins "*"`, "WARNING");
                return { success: false, error: 'CORS配置错误' };
            } else {
                this.printStatus(`服务器连接异常: ${error.message}`, "ERROR");
                return { success: false, error: error.message };
            }
        }
    }

    // 获取服务器信息 - 修复CORS问题
    async getServerInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/info`, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(10000)
            });
            
            if (response.ok) {
                const data = await response.json();
                this.printStatus(`服务器: ${data.name || 'Unknown'} v${data.version || 'Unknown'}`, "INFO");
                if (data.model_file) {
                    this.printStatus(`模型: ${data.model_file}`, "INFO");
                }
                return { success: true, data };
            } else if (response.status === 404) {
                this.printStatus(`服务器不支持 /info API，跳过服务器信息获取`, "WARNING");
                return { success: false, error: 'API not supported', skippable: true };
            } else {
                this.printStatus(`获取服务器信息失败: HTTP ${response.status}`, "ERROR");
                return { success: false, error: `HTTP ${response.status}` };
            }
        } catch (error) {
            if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                this.printStatus(`CORS错误: 无法获取服务器信息`, "ERROR");
                return { success: false, error: 'CORS配置错误' };
            } else {
                this.printStatus(`获取服务器信息异常: ${error.message}`, "ERROR");
                return { success: false, error: error.message };
            }
        }
    }

    // 调用 KataGo 分析 API
    async selectMove(moves, boardSize = 19) {
        const payload = {
            board_size: boardSize,
            moves: moves
        };
        
        this.debugPrint("API请求payload", payload);
        
        try {
            const startTime = Date.now();
            
            const response = await fetch(`${this.baseUrl}/select-move/${this.botName}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(30000)
            });
            
            this.debugPrint(`API响应状态: ${response.status}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                this.printStatus(`API错误: ${response.status}`, "ERROR");
                this.printStatus(`错误内容: ${errorText}`, "ERROR");
                return { success: false, error: `HTTP ${response.status}: ${errorText}` };
            }
            
            const data = await response.json();
            const elapsedTime = (Date.now() - startTime) / 1000;
            data.analysis_time = elapsedTime;
            
            this.debugPrint("API响应数据", data);
            
            return { success: true, data };
            
        } catch (error) {
            this.printStatus(`API调用异常: ${error.message}`, "ERROR");
            return { success: false, error: error.message };
        }
    }

    // 分析指定手数的局面
    async analyzePosition(moves, moveNumber) {
        try {
            // 只取到指定手数的着法
            const apiMoves = moves.slice(0, moveNumber);
            
            this.debugPrint(`分析第${moveNumber}手，使用着法`, apiMoves);
            
            const result = await this.selectMove(apiMoves, 19);
            
            if (result.success) {
                return { success: true, data: result.data };
            } else {
                return { success: false, error: result.error };
            }
                
        } catch (error) {
            this.printStatus(`分析异常: ${error.message}`, "ERROR");
            return { success: false, error: error.message };
        }
    }

    // 格式化分析结果
    formatAnalysisResult(result, moveNumber, currentMove) {
        if (!result || !result.success) {
            return "分析失败";
        }
        
        const data = result.data;
        const analysisTime = data.analysis_time || 0;
        
        // 提取关键信息
        let botMove = data.bot_move || 'N/A';
        let winrate = data.winrate;
        let score = data.score;
        let visits = data.visits || 'N/A';
        const analysis = data.analysis || [];
        
        // 如果主要字段为空，尝试从analysis数组中获取
        if (analysis && analysis.length > 0) {
            const firstMove = analysis[0];
            if (!botMove || botMove === 'N/A') {
                botMove = firstMove.move || 'N/A';
            }
            if (winrate === null || winrate === undefined) {
                winrate = firstMove.winrate;
            }
            if (score === null || score === undefined) {
                score = firstMove.scoreLead || firstMove.scoreMean;
            }
            if (visits === 'N/A') {
                visits = firstMove.visits || 'N/A';
            }
        }
        
        // 格式化胜率
        const winrateStr = (typeof winrate === 'number') ? `${(winrate * 100).toFixed(1)}%` : "N/A";
        
        // 格式化分数
        const scoreStr = (typeof score === 'number') ? score.toFixed(2) : "N/A";
        
        // 构建输出
        const output = [];
        output.push(`第${moveNumber}手: ${currentMove[0]} ${currentMove[1]}`);
        output.push(`推荐: ${botMove}`);
        output.push(`胜率: ${winrateStr}`);
        output.push(`分数: ${scoreStr}`);
        output.push(`访问: ${visits}`);
        output.push(`用时: ${analysisTime.toFixed(2)}s`);
        
        return output.join(" | ");
    }

    // 格式化详细分析结果
    formatDetailedAnalysis(result, moveNumber, currentMove) {
        if (!result || !result.success) {
            this.printStatus("分析失败", "ERROR");
            return null;
        }
        
        const data = result.data;
        
        // 打印基本信息
        const basicInfo = this.formatAnalysisResult(result, moveNumber, currentMove);
        this.printStatus(basicInfo, "SUCCESS");
        
        // 打印候选手信息
        const analysis = data.analysis || [];
        if (analysis && analysis.length > 0) {
            const candidates = [];
            for (let i = 0; i < Math.min(5, analysis.length); i++) {
                const moveInfo = analysis[i];
                const move = moveInfo.move || 'N/A';
                const winrate = moveInfo.winrate || 0;
                candidates.push(`${move}(${(winrate * 100).toFixed(1)}%)`);
            }
            
            const candidatesStr = candidates.join(' ');
            this.printStatus(`候选手: ${candidatesStr}`, "INFO");
        }
        
        return {
            basicInfo,
            candidates: analysis.slice(0, 5),
            fullData: data
        };
    }

    // 设置调试模式
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    // 设置服务器地址
    setBaseUrl(url) {
        this.baseUrl = url.replace(/\/$/, '');
    }

    // 设置机器人名称
    setBotName(name) {
        this.botName = name;
    }

    // 切换到代理模式
    switchToProxyMode() {
        this.baseUrl = window.CONFIG?.KATAGO_PROXY_URL || 'http://localhost:3000/api/katago';
        this.isProxyMode = true;
        console.log(`🔄 切换到代理模式: ${this.baseUrl}`);
    }

    // 切换到直连模式
    switchToDirectMode() {
        this.baseUrl = window.CONFIG?.KATAGO_BASE_URL || 'http://192.168.0.249:8080';
        this.isProxyMode = false;
        console.log(`🔄 切换到直连模式: ${this.baseUrl}`);
    }
}

// 导出模块
window.KataGoAPI = KataGoAPI;