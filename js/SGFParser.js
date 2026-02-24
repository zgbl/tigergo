// SGF 解析模块 - 基于 Python 脚本的实现

class SGFParser {
    constructor() {
        this.debugMode = false;
    }

    // 解析 SGF 内容中的着法，参考 Python 脚本的实现
    parseSGFMoves(sgfContent) {
        const moves = [];

        // 清理 SGF 内容
        sgfContent = sgfContent.replace(/\s+/g, ' ').trim();

        // SGF 解析正则表达式 - 匹配 ;B[xx] 或 ;W[xx] 格式
        const movePattern = /;([BW])\[([a-t]*)\]/gi;
        const matches = [...sgfContent.matchAll(movePattern)];

        console.log(`🔍 找到 ${matches.length} 个着法匹配项`);

        for (let i = 0; i < matches.length; i++) {
            const [fullMatch, color, pos] = matches[i];
            const colorUpper = color.toUpperCase();
            const posLower = pos.toLowerCase().trim();

            if (posLower && posLower.length === 2) {
                try {
                    const colSgf = posLower[0]; // a-s
                    const rowSgf = posLower[1]; // a-s

                    // 检查坐标范围
                    if (colSgf < 'a' || colSgf > 's' || rowSgf < 'a' || rowSgf > 's') {
                        console.warn(`⚠️ 跳过无效坐标: ${posLower}`);
                        continue;
                    }

                    // 转换列坐标 (a-s -> A-T, 跳过I)
                    const colIndex = colSgf.charCodeAt(0) - 97; // 0-18
                    let colKatago;
                    if (colIndex >= 8) { // i及之后的字母
                        colKatago = String.fromCharCode(65 + colIndex + 1); // 跳过I
                    } else {
                        colKatago = String.fromCharCode(65 + colIndex);
                    }

                    // 转换行坐标 (SGF的a=19行, s=1行)
                    const rowIndex = rowSgf.charCodeAt(0) - 97; // 0-18
                    const rowKatago = String(19 - rowIndex);

                    const katagoPos = colKatago + rowKatago;
                    moves.push([colorUpper, katagoPos]);

                    if (this.debugMode) {
                        console.log(`🔄 转换: ${colorUpper}[${posLower}] -> [${colorUpper}, ${katagoPos}]`);
                    }

                } catch (error) {
                    console.error(`❌ 转换失败 ${posLower}:`, error);
                    continue;
                }
            } else if (!posLower) {
                // 空着法 (pass)
                moves.push([colorUpper, "pass"]);
                if (this.debugMode) {
                    console.log(`🔄 Pass: ${colorUpper}[] -> [${colorUpper}, pass]`);
                }
            } else {
                console.warn(`⚠️ 跳过格式错误的着法: ${posLower}`);
            }
        }

        return moves;
    }

    // 提取游戏信息
    extractGameInfo(sgfContent) {
        if (!sgfContent) return {};

        const info = {
            blackPlayer: '未知',
            whitePlayer: '未知',
            blackRank: '',
            whiteRank: '',
            result: '未知',
            date: '未知',
            komi: 6.5,
            size: 19,
            handicap: 0,
            event: ''
        };

        // Extract using regex for robustness
        // 🔥 增强：使用更健壮的正则表达式，并支持不区分大小写
        const pbMatch = sgfContent.match(/PB\[([^\]]*)\]/i);
        const pwMatch = sgfContent.match(/PW\[([^\]]*)\]/i);
        const brMatch = sgfContent.match(/BR\[([^\]]*)\]/i);
        const wrMatch = sgfContent.match(/WR\[([^\]]*)\]/i);
        const reMatch = sgfContent.match(/RE\[([^\]]*)\]/i);
        const dtMatch = sgfContent.match(/DT\[([^\]]*)\]/i);
        const kmMatch = sgfContent.match(/KM\[([^\]]*)\]/i);
        const szMatch = sgfContent.match(/SZ\[([^\]]*)\]/i);
        const haMatch = sgfContent.match(/HA\[([^\]]*)\]/i);
        const evMatch = sgfContent.match(/EV\[([^\]]*)\]/i);

        if (pbMatch) {
            info.blackPlayer = pbMatch[1].trim();
            info.black = info.blackPlayer; // 🔥 添加：匹配后端和 storage 逻辑
        }
        if (pwMatch) {
            info.whitePlayer = pwMatch[1].trim();
            info.white = info.whitePlayer; // 🔥 添加：匹配后端和 storage 逻辑
        }
        if (brMatch) info.blackRank = brMatch[1].trim();
        if (wrMatch) info.whiteRank = wrMatch[1].trim();
        if (reMatch) info.result = reMatch[1].trim();
        if (dtMatch) info.date = dtMatch[1].trim();
        if (evMatch) info.event = evMatch[1].trim();

        if (kmMatch) {
            const km = parseFloat(kmMatch[1]);
            if (!isNaN(km)) info.komi = km;
        }

        if (szMatch) {
            const sz = parseInt(szMatch[1]);
            if (!isNaN(sz)) info.size = sz;
        }

        if (haMatch) {
            const ha = parseInt(haMatch[1]);
            if (!isNaN(ha)) info.handicap = ha;
        }

        return info;
    }

    // 验证 SGF 格式
    validateSGF(sgfContent) {
        if (!sgfContent || typeof sgfContent !== 'string') {
            return { valid: false, error: 'SGF 内容为空或格式错误' };
        }

        // 检查基本的 SGF 结构
        if (!sgfContent.includes('(;') || !sgfContent.includes(')')) {
            return { valid: false, error: 'SGF 文件缺少基本结构标记' };
        }

        // 检查是否包含围棋游戏标记
        if (!sgfContent.includes('GM[1]') && !sgfContent.includes('GM[')) {
            console.warn('⚠️ 未找到游戏类型标记，假设为围棋');
        }

        return { valid: true };
    }

    // 获取着法预览
    getMovesPreview(moves, count = 5) {
        const preview = [];
        const previewCount = Math.min(count, moves.length);

        for (let i = 0; i < previewCount; i++) {
            const [color, pos] = moves[i];
            preview.push(`第${i + 1}手: ${color} ${pos}`);
        }

        if (moves.length > previewCount) {
            preview.push(`... 还有 ${moves.length - previewCount} 手`);
        }

        return preview;
    }

    // 设置调试模式
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
}

// 导出模块
window.SGFParser = SGFParser;