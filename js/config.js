// config.js - 智能环境检测配置

// 检测当前运行环境
function detectEnvironment() {
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    console.log(`🔍 环境检测开始:`);
    console.log(`  - hostname: "${hostname}"`);
    console.log(`  - port: "${port}"`);
    console.log(`  - 完整URL: "${window.location.href}"`);
    
    // 本地开发环境检测
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
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
        name: "Local Server",
        url: "http://192.168.0.249:8080",
        description: "本地 KataGo 服务器"
    },
    cloud: {
        name: "BlackRice KataGo Cloud",
        //url: "https://kataengine.blackrice.top",
        url: "https://katago-analysis-939624114433.us-central1.run.app",
        description: "Google Cloud Run 部署的 KataGo 服务 CPU 版本"
    }
};

// 根据环境设置配置
function getConfig() {
    const env = detectEnvironment();
    
    const configs = {
        local: {
            API_BASE_URL: "http://localhost:3000/api",
            API_VERCEL_NEXTJS_BASE_URL: "http://localhost:3000",
            GITHUB_PAGE_FORUM_URL: "http://localhost:8090/Forum11.html",
            FORUM_POST_ENDPOINT: "/forum/Posts",
            // 🔥 修改：使用默认的本地引擎
            KATAGO_BASE_URL: KATAGO_ENGINES.local.url,
            KATAGO_BOT_NAME: "katago_gtp_bot",
            KATAGO_PROXY_URL: "http://localhost:3000/api/katago",
            // 🔥 新增：引擎选项
            KATAGO_ENGINES: KATAGO_ENGINES,
            ENV: "local"
        },
        github: {
            API_BASE_URL: "https://blackricegobackend2-nextjs.vercel.app/api",
            API_VERCEL_NEXTJS_BASE_URL: "https://blackricegobackend2-nextjs.vercel.app",
            GITHUB_PAGE_FORUM_URL: "https://zgbl.github.io/tigergo/Forum11.html",
            FORUM_POST_ENDPOINT: "/forum/Posts",
            // 🔥 修改：使用默认的本地引擎
            KATAGO_BASE_URL: KATAGO_ENGINES.local.url,
            KATAGO_BOT_NAME: "katago_gtp_bot",
            KATAGO_PROXY_URL: "https://blackricegobackend2-nextjs.vercel.app/api/katago",
            // 🔥 新增：引擎选项
            KATAGO_ENGINES: KATAGO_ENGINES,
            ENV: "github"
        },
        production: {
            API_BASE_URL: "https://blackricegobackend2-nextjs.vercel.app/api",
            API_VERCEL_NEXTJS_BASE_URL: "https://blackricegobackend2-nextjs.vercel.app",
            GITHUB_PAGE_FORUM_URL: "https://zgbl.github.io/tigergo/Forum11.html",
            FORUM_POST_ENDPOINT: "/forum/Posts",
            // 🔥 修改：使用默认的本地引擎
            KATAGO_BASE_URL: KATAGO_ENGINES.local.url,
            KATAGO_BOT_NAME: "katago_gtp_bot",
            KATAGO_PROXY_URL: "https://blackricegobackend2-nextjs.vercel.app/api/katago",
            // 🔥 新增：引擎选项
            KATAGO_ENGINES: KATAGO_ENGINES,
            ENV: "production"
        }
    };
    
    console.log(`📋 选择的环境配置: ${env}`);
    console.log(`📋 配置详情:`, configs[env]);
    
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

// 详细调试信息
console.log(`🌍 最终配置:`);
console.log(`  - 当前环境: ${CONFIG.ENV}`);
console.log(`  - API地址: ${CONFIG.API_BASE_URL}`);
console.log(`  - KataGo地址: ${CONFIG.KATAGO_BASE_URL}`);
console.log(`  - KataGo代理地址: ${CONFIG.KATAGO_PROXY_URL}`);
console.log(`  - 当前域名: ${window.location.hostname}:${window.location.port}`);

// 验证配置
if (window.location.hostname === 'localhost' && !CONFIG.API_BASE_URL.includes('localhost')) {
    console.error(`❌ 配置错误！在localhost环境但API_BASE_URL是: ${CONFIG.API_BASE_URL}`);
    console.error(`❌ 应该是: http://localhost:3000`);
} else if (window.location.hostname === 'localhost' && CONFIG.API_BASE_URL.includes('localhost')) {
    console.log(`✅ 配置正确！本地环境使用本地API: ${CONFIG.API_BASE_URL}`);
}

// 兼容旧版本的导出方式
window.CONFIG = CONFIG;

// 最终验证
console.log(`🔧 window.CONFIG 设置完成:`, window.CONFIG);

// 🔥 新增：导出引擎相关函数
window.getAvailableEngines = getAvailableEngines;
window.getEngineConfig = getEngineConfig;
