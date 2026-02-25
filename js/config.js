// config.js - 智能环境检测配置

// 检测当前运行环境
function detectEnvironment() {
    const hostname = window.location.hostname;
    const port = window.location.port;

    console.log(`🔍 环境检测开始:`);
    console.log(`  - hostname: "${hostname}"`);
    console.log(`  - port: "${port}"`);
    console.log(`  - 完整URL: "${window.location.href}"`);

    // 🔥 新增：支持 URL 参数强制指定环境（方便调试）
    const urlParams = new URLSearchParams(window.location.search);
    const forceEnv = urlParams.get('env');
    if (forceEnv === 'local' || forceEnv === 'github' || forceEnv === 'production') {
        console.log(`🔧 通过 URL 参数强制使用环境: ${forceEnv.toUpperCase()}`);
        console.log(`💡 提示: 移除 ?env=${forceEnv} 参数可恢复自动检测`);
        return forceEnv;
    }

    // 本地开发环境检测 - 支持多种场景
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '') {  // file:// 协议
        console.log(`✅ 检测结果: LOCAL 环境`);
        return 'local';
    }

    // GitHub Pages 环境检测
    if (hostname.includes('github.io')) {
        console.log(`✅ 检测结果: GITHUB 环境`);
        return 'github';
    }

    // 其他情况默认为生产环境
    console.log(`✅ 检测结果: PRODUCTION 环境`);
    return 'production';
}

// 🔥 新增：KataGo 引擎配置选项
const KATAGO_ENGINES = {
    local: {
        name: "Local Server (K8s)",
        url: "http://192.168.0.162:8081",
        description: "本地 Kubernetes 部署的 KataGo 服务器"
    },
    tunnel: {
        name: "Cloudflare Tunnel (K8s Pod 2)",
        url: "https://katagoengine2.blackrice.top",
        fallbackUrls: ["https://katagoengine1.blackrice.top"],
        description: "通过 Cloudflare Tunnel 访问的家用 GPU 引擎 (优先选择 Pod 2)"
    },
    cloud: {
        name: "BlackRice KataGo Cloud",
        url: "https://katago-analysis-939624114433.us-central1.run.app",
        description: "Google Cloud Run 部署的 KataGo 服务 CPU 版本"
    },
    custom: {
        name: "Custom Server",
        url: localStorage.getItem('katago_custom_url') || "http://192.168.0.162:8080",
        description: "用户自定义 KataGo 服务器"
    }
};

// 🔥 新增：KataGo 分析深度配置 (统一管理 hardcoded 参数)
const KATAGO_ANALYSIS_MODES = {
    fast: {
        maxVisits: 400,
        maxTime: 5,
        minDuration: 2000, // UI 最小展示时长 (ms)
        wideRootNoise: 0.02,
        reportInterval: 100,
        delay: 2000 // AnalysisEngine 步间延迟 (ms)
    },
    normal: {
        maxVisits: 800,
        maxTime: 10,
        minDuration: 5000,
        wideRootNoise: 0.04,
        reportInterval: 200,
        delay: 5000
    },
    deep: {
        maxVisits: 1600,
        maxTime: 20,
        minDuration: 10000,
        wideRootNoise: 0.06,
        reportInterval: 400,
        delay: 8000
    },
    ultra: {
        maxVisits: 3200,
        maxTime: 30,
        minDuration: 15000,
        wideRootNoise: 0.08,
        reportInterval: 800,
        delay: 10000
    },
    extreme: {
        maxVisits: 50000,
        maxTime: 60,
        minDuration: 15000,
        wideRootNoise: 0.10,
        reportInterval: 1000,
        delay: 15000
    }
};

// 根据环境设置配置
function getConfig() {
    const env = detectEnvironment();
    const hostname = window.location.hostname;

    // 获取用户偏好的引擎 ID，默认为 local
    const preferredEngine = localStorage.getItem('katago_preferred_engine') || 'local';
    const preferredEngineConfig = KATAGO_ENGINES[preferredEngine] || KATAGO_ENGINES.local;
    const katagoUrl = preferredEngineConfig.url;
    const fallbackUrls = preferredEngineConfig.fallbackUrls || [];

    const configs = {
        local: {
            API_BASE_URL: "http://localhost:3000/api",
            API_VERCEL_NEXTJS_BASE_URL: "http://localhost:3000",
            GITHUB_PAGE_FORUM_URL: "http://localhost:8090/Forum11.html",
            FORUM_POST_ENDPOINT: "/forum/Posts",
            KATAGO_BASE_URL: katagoUrl,
            KATAGO_FALLBACK_URLS: fallbackUrls,
            KATAGO_BOT_NAME: "katago_gtp_bot",
            KATAGO_PROXY_URL: "http://localhost:3000/api/katago",
            KATAGO_ENGINES: KATAGO_ENGINES,
            KATAGO_ANALYSIS_MODES: KATAGO_ANALYSIS_MODES,
            ENV: "local"
        },
        github: {
            API_BASE_URL: "https://blackricegobackend2-nextjs.vercel.app/api",
            API_VERCEL_NEXTJS_BASE_URL: "https://blackricegobackend2-nextjs.vercel.app",
            GITHUB_PAGE_FORUM_URL: "https://zgbl.github.io/tigergo/Forum11.html",
            FORUM_POST_ENDPOINT: "/forum/Posts",
            KATAGO_BASE_URL: katagoUrl,
            KATAGO_FALLBACK_URLS: fallbackUrls,
            KATAGO_BOT_NAME: "katago_gtp_bot",
            KATAGO_PROXY_URL: "https://blackricegobackend2-nextjs.vercel.app/api/katago",
            KATAGO_ENGINES: KATAGO_ENGINES,
            KATAGO_ANALYSIS_MODES: KATAGO_ANALYSIS_MODES,
            ENV: "github"
        },
        production: {
            // 🔥 增加：优先使用当前域名的 API 如果在 blackrice.top 下
            API_BASE_URL: hostname.includes('blackrice.top')
                ? "https://blackricegobackend2-nextjs.vercel.app/api"
                : "https://blackricegobackend2-nextjs.vercel.app/api",
            API_VERCEL_NEXTJS_BASE_URL: "https://blackricegobackend2-nextjs.vercel.app",
            GITHUB_PAGE_FORUM_URL: "https://brweiqi.blackrice.top/Forum11.html",
            FORUM_POST_ENDPOINT: "/forum/Posts",
            KATAGO_BASE_URL: katagoUrl,
            KATAGO_FALLBACK_URLS: fallbackUrls,
            KATAGO_BOT_NAME: "katago_gtp_bot",
            KATAGO_PROXY_URL: "https://blackricegobackend2-nextjs.vercel.app/api/katago",
            KATAGO_ENGINES: KATAGO_ENGINES,
            KATAGO_ANALYSIS_MODES: KATAGO_ANALYSIS_MODES,
            ENV: "production"
        }
    };

    console.log(`📋 环境配置: ${env.toUpperCase()}`);
    console.log(`📋 代理地址: ${configs[env].KATAGO_PROXY_URL}`);
    return configs[env];
}

// 🔥 新增：获取可用的 KataGo 引擎列表
function getAvailableEngines() {
    return KATAGO_ENGINES;
}

// 🔥 新增：根据引擎 ID 获取引擎配置
function getEngineConfig(engineId) {
    return KATAGO_ENGINES[engineId] || KATAGO_ENGINES.local;
}

// 导出配置
const CONFIG = getConfig();

// 🔥 改进：更清晰的日志输出
console.log(`🌍 ========== 环境配置信息 ==========`);
console.log(`📍 当前环境: ${CONFIG.ENV.toUpperCase()}`);
console.log(`🔗 后端 API: ${CONFIG.API_BASE_URL}`);
console.log(`🏠 前端地址: ${window.location.origin}`);
console.log(`🤖 KataGo: ${CONFIG.KATAGO_PROXY_URL}`);
console.log(`${CONFIG.ENV === 'local' ? '💻 开发模式 - 使用本地后端' : '🚀 生产模式 - 使用 Vercel 后端'}`);
console.log(`=====================================`);

// 验证配置一致性
if (window.location.hostname === 'localhost' && !CONFIG.API_BASE_URL.includes('localhost')) {
    console.error(`❌ 配置错误！在 localhost 环境但 API_BASE_URL 指向: ${CONFIG.API_BASE_URL}`);
    console.error(`❌ 应该是: http://localhost:3000/api`);
    console.error(`💡 提示: 检查 detectEnvironment() 函数是否正确返回 'local'`);
} else if (window.location.hostname === 'localhost' && CONFIG.API_BASE_URL.includes('localhost')) {
    console.log(`✅ 配置正确！本地环境使用本地后端`);
} else if (window.location.hostname.includes('github.io') && CONFIG.API_BASE_URL.includes('vercel')) {
    console.log(`✅ 配置正确！GitHub Pages 使用 Vercel 后端`);
}

// 兼容旧版本的导出方式
window.CONFIG = CONFIG;

// 最终验证
console.log(`🔧 window.CONFIG 设置完成:`, window.CONFIG);

// 🔥 新增：导出引擎相关函数
window.getAvailableEngines = getAvailableEngines;
window.getEngineConfig = getEngineConfig;
