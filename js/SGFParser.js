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
        const info = {};
        
        const patterns = {
            blackPlayer: /PB\[([^\]]*)\]/,
            whitePlayer: /PW\[([^\]]*)\]/,
            result: /RE\[([^\]]*)\]/,
            date: /DT\[([^\]]*)\]/,
            komi: /KM\[([^\]]*)\]/,
            size: /SZ\[([^\]]*)\]/,
            gameComment: /GC\[([^\]]*)\]/,
            gameName: /GN\[([^\]]*)\]/,
            place: /PC\[([^\]]*)\]/,
            timeLimit: /TM\[([^\]]*)\]/,
            overtime: /OT\[([^\]]*)\]/
        };
        
        for (const [key, pattern] of Object.entries(patterns)) {
            const match = sgfContent.match(pattern);
            info[key] = match ? match[1] : '';
        }
        
        // 处理棋盘大小，默认19路
        info.boardSize = parseInt(info.size) || 19;
        
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