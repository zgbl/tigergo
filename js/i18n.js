/**
 * i18n.js - TigerGo Internationalization Module
 * Supports: ZH (Chinese), EN (English), JA (Japanese), KO (Korean)
 */

window.Translations = {
    zh: {
        "nav_home": "主页",
        "nav_desktop": "桌面版",
        "header_analysis": "实时分析",
        "header_no_sgf": "未加载棋谱 (SGF/GIB)",
        "winrate": "胜率",
        "score_lead": "目数",
        "upload": "上传",
        "upload_prompt_title": "未加载棋谱",
        "upload_prompt_hint": "点击此处选择文件",
        "upload_prompt_format": "支持格式: .sgf, .gib",
        "btn_analyze": "开始分析",
        "btn_stop": "停止分析",
        "suggested_moves": "建议落点",
        "engine_log": "引擎日志",
        "log_ready": "准备就绪",
        "log_waiting": "> 等待加载棋谱...",
        "notify_select_file": "已选择文件: ",
        "notify_success": "成功",
        "footer_analysis": "分析",
        "footer_variations": "变化",
        "footer_history": "历史",
        "footer_desktop": "桌面版",
        "lang_name": "中文"
    },
    en: {
        "nav_home": "Home",
        "nav_desktop": "Desktop",
        "header_analysis": "Live Analysis",
        "header_no_sgf": "No SGF/GIB Loaded",
        "winrate": "Win Rate",
        "score_lead": "Lead",
        "upload": "Upload",
        "upload_prompt_title": "No SGF/GIB Loaded",
        "upload_prompt_hint": "Tap here to select file",
        "upload_prompt_format": "Format: .sgf, .gib",
        "btn_analyze": "Analyze",
        "btn_stop": "Stop",
        "suggested_moves": "AI Suggested Moves",
        "engine_log": "Engine Log",
        "log_ready": "Ready",
        "log_waiting": "> Waiting for SGF...",
        "notify_select_file": "File selected: ",
        "notify_success": "Success",
        "footer_analysis": "Analysis",
        "footer_variations": "Variations",
        "footer_history": "History",
        "footer_desktop": "Desktop",
        "lang_name": "EN"
    },
    ja: {
        "nav_home": "ホーム",
        "nav_desktop": "デスクトップ",
        "header_analysis": "リアルタイム分析",
        "header_no_sgf": "棋譜未読み込み (SGF/GIB)",
        "winrate": "勝率",
        "score_lead": "リード",
        "upload": "アップロード",
        "upload_prompt_title": "棋譜未読み込み",
        "upload_prompt_hint": "タップしてファイルを選択",
        "upload_prompt_format": "形式: .sgf, .gib",
        "btn_analyze": "分析開始",
        "btn_stop": "分析停止",
        "suggested_moves": "AI 推奨の一手",
        "engine_log": "エンジンログ",
        "log_ready": "準備完了",
        "log_waiting": "> 棋譜を待機中...",
        "notify_select_file": "ファイル選択済: ",
        "notify_success": "成功",
        "footer_analysis": "分析",
        "footer_variations": "変化図",
        "footer_history": "履歴",
        "footer_desktop": "デスクトップ",
        "lang_name": "日本語"
    },
    ko: {
        "nav_home": "홈",
        "nav_desktop": "데스크톱",
        "header_analysis": "실시간 분석",
        "header_no_sgf": "기보 로드되지 않음 (SGF/GIB)",
        "winrate": "승률",
        "score_lead": "차이",
        "upload": "업로드",
        "upload_prompt_title": "기보 로드되지 않음",
        "upload_prompt_hint": "여기을 탭하여 파일 선택",
        "upload_prompt_format": "형식: .sgf, .gib",
        "btn_analyze": "분석 시작",
        "btn_stop": "분석 중지",
        "suggested_moves": "AI 추천 수",
        "engine_log": "엔진 로그",
        "log_ready": "준비 완료",
        "log_waiting": "> 기보 대기 중...",
        "notify_select_file": "파일 선택됨: ",
        "notify_success": "성공",
        "footer_analysis": "분석",
        "footer_variations": "변화도",
        "footer_history": "히스토리",
        "footer_desktop": "데스크톱",
        "lang_name": "한국어"
    }
};

window.I18n = {
    currentLang: localStorage.getItem('tigergo_lang') || 'zh',

    init() {
        this.updateContent();
        this.setupSwitcher();
    },

    getLocale() {
        return this.currentLang;
    },

    setLocale(lang) {
        if (!window.Translations[lang]) return;
        this.currentLang = lang;
        localStorage.setItem('tigergo_lang', lang);
        this.updateContent();

        // Custom event for reactive components
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    },

    t(key) {
        return window.Translations[this.currentLang][key] || key;
    },

    updateContent() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation) {
                // If it's an input with placeholder, translate placeholder
                if (el.tagName === 'INPUT' && el.placeholder) {
                    el.placeholder = translation;
                } else {
                    el.textContent = translation;
                }
            }
        });

        // Update document title if needed
        const siteTitle = this.t('header_analysis');
        if (siteTitle) document.title = `TigerGo - ${siteTitle}`;
    },

    setupSwitcher() {
        const switcher = document.getElementById('langSwitcher');
        if (switcher) {
            switcher.value = this.currentLang;
            switcher.addEventListener('change', (e) => {
                this.setLocale(e.target.value);
            });
        }
    }
};

// Auto-init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    window.I18n.init();
});
