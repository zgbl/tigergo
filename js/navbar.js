// navbar.js - 智能环境检测导航条

// 检测当前运行环境
function detectNavEnvironment() {
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    console.log(`🧭 导航条环境检测:`);
    console.log(`  - hostname: "${hostname}"`);
    console.log(`  - port: "${port}"`);
    
    // 本地开发环境检测
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
        console.log(`✅ 导航条: LOCAL 环境`);
        return 'local';
    }
    
    // GitHub Pages 环境检测
    if (hostname.includes('github.io')) {
        console.log(`✅ 导航条: GITHUB 环境`);
        return 'github';
    }
    
    // 其他情况默认为生产环境
    console.log(`✅ 导航条: PRODUCTION 环境`);
    return 'production';
}

// 根据环境获取基础URL
function getNavBaseUrl() {
    const env = detectNavEnvironment();
    
    const baseUrls = {
        local: `http://localhost:${window.location.port || '8090'}`,
        github: 'https://zgbl.github.io/tigergo',
        production: 'https://zgbl.github.io/tigergo'
    };
    
    const baseUrl = baseUrls[env];
    console.log(`🧭 导航条基础URL: ${baseUrl}`);
    
    return baseUrl;
}

function loadNavbar() {
    const baseUrl = getNavBaseUrl();
    
    // 构建完整的链接
    const links = {
        home: `${baseUrl}/index.html`,
        play: `${baseUrl}/WeiqiPlay10.html`,
        sgfAnalysis: `${baseUrl}/SGFAnalysis.html`,  // 更新为棋谱分析页面
        tournament: `${baseUrl}/Tournament2.html`,
        news: `${baseUrl}/News.html`,
        forum: `${baseUrl}/Forum11.html`,
        register: `${baseUrl}/Register1.html`
    };
    
    console.log(`🧭 导航条链接配置:`, links);
    
    const navbar = `
    <div class="container">
      <header>
        <a href="${links.home}" class="logo">
            <img src="${baseUrl}/images/BlackRiceLogo25.webp" alt="黑米围棋 Logo" />
        </a>
        <nav>
          <a href="${links.play}">
            <img src="${baseUrl}/images/Play.png" class="icon" alt="对弈" /> 对弈
          </a>
          <a href="${links.sgfAnalysis}">
            <img src="${baseUrl}/images/GameRecords.png" class="icon" alt="棋谱分析" /> 棋谱分析
          </a>
          <a href="${links.tournament}">
            <img src="${baseUrl}/images/Match.png" class="icon" alt="比赛" /> 比赛
          </a>
          <a href="${links.news}">
            <img src="${baseUrl}/images/News.png" class="icon" alt="新闻" /> 新闻
          </a>
          <a href="${links.forum}">
            <img src="${baseUrl}/images/Forum.png" class="icon" alt="论坛" /> 论坛
          </a>
          <a href="${links.register}">
            <img src="${baseUrl}/images/Register.png" class="icon" alt="注册" /> 注册
          </a>
        </nav>
      </header>
    </div>
    `;
    
    document.getElementById('navbar-placeholder').innerHTML = navbar;
    
    console.log(`✅ 导航条加载完成，环境: ${detectNavEnvironment()}`);
}