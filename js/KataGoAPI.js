// KataGo API 调用模块 - 支持直连和代理两种模式

class KataGoAPI {
    constructor(baseUrl = null, botName = 'katago_gtp_bot', useProxy = false) {
        // 根据 useProxy 参数选择使用直连还是代理
        if (useProxy) {
            this.baseUrl = (baseUrl || window.CONFIG?.KATAGO_PROXY_URL || 'http://localhost:3000/api/katago').replace(/\/$/, '');
            this.isProxyMode = true;
            // 🔥 新增：从配置获取目标地址和备用地址
            this.targetUrl = window.CONFIG?.KATAGO_BASE_URL || 'http://192.168.0.162:8080';
            this.fallbackUrls = window.CONFIG?.KATAGO_FALLBACK_URLS || [];
        } else {
            this.baseUrl = (baseUrl || window.CONFIG?.KATAGO_BASE_URL || 'http://192.168.0.249:8080').replace(/\/$/, '');
            this.isProxyMode = false;
            this.fallbackUrls = [];
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
        if (this.isProxyMode) {
            console.log(`  - 目标: ${this.targetUrl}`);
            if (this.fallbackUrls.length > 0) {
                console.log(`  - 备用: ${this.fallbackUrls.join(', ')}`);
            }
        }
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

    // 内部通用请求方法，支持备用地址自动切换
    async _fetchWithFallback(endpoint, options = {}) {
        const urlsToTry = this.isProxyMode ? [this.targetUrl, ...this.fallbackUrls] : [null];

        // 允许从 options 中提取超时时间，分析请求通常较慢，默认给 30s，其他 15s
        const defaultTimeout = endpoint.includes('select-move') || endpoint.includes('analyze') ? 45000 : 15000;
        const timeoutMs = options.timeout || defaultTimeout;
        let lastError = null;

        for (const targetUrl of urlsToTry) {
            // 如果全局信号已经中断，直接退出
            if (options.signal && options.signal.aborted) {
                throw options.signal.reason || new Error('AbortError');
            }

            try {
                const requestHeaders = { ...this.headers, ...(options.headers || {}) };
                if (this.isProxyMode && targetUrl) {
                    requestHeaders['x-target-server'] = targetUrl;
                }

                // 创建包含超时的控制器（每个请求独立计时）
                const controller = new AbortController();
                const tid = setTimeout(() => controller.abort('timeout'), timeoutMs);

                // 如果有传入的 signal，监听它以同步中断
                if (options.signal) {
                    const abortHandler = () => controller.abort(options.signal.reason || 'manual');
                    options.signal.addEventListener('abort', abortHandler, { once: true });
                }

                try {
                    const response = await fetch(`${this.baseUrl}${endpoint}`, {
                        ...options,
                        headers: requestHeaders,
                        signal: controller.signal
                    });

                    if (response.ok) {
                        if (this.isProxyMode && targetUrl !== this.targetUrl) {
                            this.printStatus(`⚠️ 主引擎连接失败，已成功切换到备用引擎: ${targetUrl}`, "WARNING");
                        }
                        return response;
                    }

                    lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
                } finally {
                    clearTimeout(tid);
                }

                this.debugPrint(`请求失败 [${targetUrl || 'direct'}]: ${lastError.message}`);

            } catch (error) {
                lastError = error;
                const reason = (error.name === 'AbortError') ? (error.reason || 'timeout') : error.message;
                this.debugPrint(`请求异常 [${targetUrl || 'direct'}]: ${reason}`);

                // 如果是手动中止（非超时），则不再尝试后续地址
                if (error.name === 'AbortError' && (!options.signal || !options.signal.aborted)) {
                    // 说明是内部 timeout 触发的，且外部没有中止，继续尝试下一个
                    continue;
                } else if (error.name === 'AbortError') {
                    throw error; // 全局中断
                }
            }
        }

        throw lastError || new Error('All engines failed');
    }

    // 测试服务器连接 - 修复CORS问题
    async testConnection() {
        try {
            this.printStatus("测试 KataGo 服务器连接...", "INFO");

            const response = await this._fetchWithFallback('/health', {
                method: 'GET',
                mode: 'cors',
                signal: AbortSignal.timeout(12000)
            });

            const data = await response.json();
            this.printStatus(`服务器连接成功: ${data.status || 'OK'}`, "SUCCESS");
            return { success: true, data };

        } catch (error) {
            console.error('❌ KataGo 连接异常:', error);
            const errorMsg = error.message.includes('fetch')
                ? '网络连接失败 - 核心和备用引擎均不可用'
                : error.message;
            this.printStatus(errorMsg, "ERROR");
            return { success: false, error: errorMsg };
        }
    }

    // 获取服务器信息 - 修复CORS问题
    async getServerInfo() {
        try {
            const response = await this._fetchWithFallback('/info', {
                method: 'GET',
                mode: 'cors',
                signal: AbortSignal.timeout(10000)
            });

            const data = await response.json();
            this.printStatus(`服务器: ${data.name || 'Unknown'} v${data.version || 'Unknown'}`, "INFO");
            if (data.model_file) {
                this.printStatus(`模型: ${data.model_file}`, "INFO");
            }
            return { success: true, data };
        } catch (error) {
            this.printStatus(`获取服务器信息失败: ${error.message}`, "WARNING");
            return { success: false, error: error.message, skippable: true };
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

            const response = await this._fetchWithFallback(`/select-move/${this.botName}`, {
                method: 'POST',
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
            const fullUrl = `${this.baseUrl}/select-move/${this.botName}`;
            this.printStatus(`API调用异常 (${fullUrl}): ${error.message}`, "ERROR");
            if (error.message.includes('fetch')) {
                this.printStatus("💡 提示: 这通常是 CORS 跨域问题或服务器未启动。请检查后端连接。", "WARNING");
            }
            return { success: false, error: error.message };
        }
    }

    // 分析指定手数的局面
    async analyzePosition(moves, moveIndex, signal = null, analysisDepth = 'normal') {
        try {
            // 只取到指定手数的着法
            const moveNumber = moveIndex;
            const apiMoves = moves.slice(0, moveNumber);

            this.debugPrint(`分析第 ${moveNumber} 手，使用着法`, apiMoves);

            // 🔥 根据分析深度设置访问次数和其他参数
            const analysisConfig = this.getAnalysisConfig(analysisDepth);
            console.log(`🔍 分析配置 (${analysisDepth}):`, analysisConfig);

            // 如果提供了 explicitMaxTime，优先使用，否则使用配置中的
            const maxTimeSeconds = analysisConfig.maxTime || 30;

            // 🔥 增强的请求体格式，包含分析参数
            const payload = {
                board_size: 19,
                moves: apiMoves,
                // 🔥 添加分析参数以获取更多候选变化
                maxVisits: analysisConfig.maxVisits,
                maxTime: maxTimeSeconds, // 🔥 发送 maxTime 给后端/KataGo
                analysisWideRootNoise: analysisConfig.wideRootNoise,
                includeOwnership: true,
                includeMovesOwnership: false,
                includePVVisits: true,
                // 🔥 显式请求更多候选变化（默认通常是5）
                reportAnalysisWinratesAsRoot: true,
                reportAnalysisWinrates: true,
                // 某些版本的KataGo可能使用 overrideSettings
                overrideSettings: {
                    reportAnalysisWinratesAsRoot: true,
                    // 确保返回足够多的变化
                },
                reportDuringSearchEvery: analysisConfig.reportInterval
            };

            console.log(`🔍 分析配置 (${analysisDepth}):`, analysisConfig);
            console.log(`🔍 API 请求 payload:`, payload);

            let finalSignal;
            // 🔥 使用配置中的 maxTime 加上缓冲区作为网络超时
            const buffer = 15000;
            const timeoutMs = (maxTimeSeconds * 1000) + buffer;

            // 🔥 增强：由于某些环境下 AbortSignal.timeout 可能不被支持，使用更兼容的方案
            const createTimeoutSignal = (ms) => {
                if (AbortSignal.timeout) {
                    return AbortSignal.timeout(ms);
                }
                const controller = new AbortController();
                setTimeout(() => controller.abort(), ms);
                return controller.signal;
            };

            if (signal && signal.aborted) {
                // 🔥 信号已中断，直接返回失败，不要 throw
                console.warn('⚠️ 外部信号已中断，跳过本次分析');
                return { success: false, error: '分析已被取消', errorType: 'AbortError' };
            } else if (signal) {
                // 有外部信号且未中断：创建组合信号（超时 + 手动中断）
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    console.warn(`🕒 分析超时 (${timeoutMs}ms) for move ${moveIndex + 1}`);
                    controller.abort();
                }, timeoutMs);

                signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                    controller.abort(signal.reason || 'manual');
                }, { once: true });
                finalSignal = controller.signal;
            } else {
                // 无外部信号：只用超时
                finalSignal = createTimeoutSignal(timeoutMs);
            }

            const requestHeaders = { ...this.headers };

            // 🔥 修复：如果是在代理模式且设置了目标地址，则发送 Header 告诉后端去哪里
            if (this.isProxyMode && this.targetUrl) {
                requestHeaders['x-target-server'] = this.targetUrl;
            }

            const requestOptions = {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify(payload),
                signal: finalSignal
            };

            const apiUrl = `${this.baseUrl}/select-move/${this.botName}`;
            console.log(`🔍 API 请求地址: ${apiUrl}`);
            console.log(`🔍 信号状态: aborted=${finalSignal.aborted}, timeout=${timeoutMs}ms`);

            const startTime = Date.now();

            // 发请求到 KataGo API (带备用重试)
            const response = await this._fetchWithFallback(`/select-move/${this.botName}`, requestOptions);

            this.debugPrint(`API响应状态: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                this.printStatus(`API错误: ${response.status}`, "ERROR");
                this.printStatus(`错误内容: ${errorText}`, "ERROR");
                throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const elapsedTime = (Date.now() - startTime) / 1000;
            data.analysis_time = elapsedTime;

            this.debugPrint("API响应数据", data);

            // 🔥 修复：直接返回数据，不需要检查 result.success
            return { success: true, data };

        } catch (error) {
            // 🔥 改进错误处理 - 区分不同类型的错误
            if (error.name === 'AbortError') {
                this.printStatus(`分析已中断 (手数: ${moveIndex + 1})`, "INFO");
            } else if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
                this.printStatus(`分析超时 (手数: ${moveIndex + 1}) - 请检查KataGo服务状态`, "ERROR");
            } else if (error.message.includes('500')) {
                this.printStatus(`KataGo服务内部错误 (手数: ${moveIndex + 1}) - 服务可能过载`, "ERROR");
            } else {
                this.printStatus(`分析异常: ${error.message}`, "ERROR");
            }
            return { success: false, error: error.message, errorType: error.name };
        }
    }

    // 🔥 新增：根据分析深度获取分析配置
    getAnalysisConfig(analysisDepth) {
        // 优先从全局配置获取
        const modes = window.CONFIG?.KATAGO_ANALYSIS_MODES;
        if (modes && modes[analysisDepth]) {
            return modes[analysisDepth];
        }

        // 后备本地默认配置 (以防 CONFIG 未加载)
        const defaultConfigs = {
            fast: { maxVisits: 400, maxTime: 5, wideRootNoise: 0.02, reportInterval: 100 },
            normal: { maxVisits: 800, maxTime: 10, wideRootNoise: 0.04, reportInterval: 200 },
            deep: { maxVisits: 1600, maxTime: 20, wideRootNoise: 0.06, reportInterval: 400 },
            ultra: { maxVisits: 3200, maxTime: 30, wideRootNoise: 0.08, reportInterval: 800 },
            extreme: { maxVisits: 50000, maxTime: 60, wideRootNoise: 0.10, reportInterval: 1000 }
        };

        const config = modes && modes[analysisDepth] ? { ...modes[analysisDepth] } : { ...defaultConfigs[analysisDepth] || defaultConfigs.normal };

        // 🔥 生产环境特殊处理：Vercel 有 10s 的函数运行超时限制
        // 如果在黑米围棋域名下，且 maxTime 超过了 8s，强制截断为 8s
        const isProduction = window.location.hostname.includes('blackrice.top') || window.location.hostname.includes('github.io');
        if (isProduction && config.maxTime > 8) {
            console.warn(`⚠️ 生产环境限制：将分析时长从 ${config.maxTime}s 截断为 8s 以防止 Vercel 504 超时`);
            config.maxTime = 8;
        }

        return config;
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