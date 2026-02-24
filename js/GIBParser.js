/**
 * GIBParser.js
 * Handles conversion of Fox (野狐) and Tygem (弈城) GIB files to SGF.
 */

class GIBParser {
    constructor() {
        this.debugMode = false;
    }

    /**
     * Detects if the content is a GIB file.
     * @param {ArrayBuffer|string} content 
     * @returns {boolean}
     */
    isGIB(content) {
        if (content instanceof ArrayBuffer) {
            const view = new Uint8Array(content.slice(0, 10));
            const header = String.fromCharCode(...view);
            return header.startsWith('\\HS');
        }
        if (typeof content === 'string') {
            return content.startsWith('\\HS');
        }
        return false;
    }

    /**
     * Converts GIB content to SGF.
     * @param {ArrayBuffer} arrayBuffer 
     * @returns {Promise<string>}
     */
    async convertToSGF(arrayBuffer) {
        // Try to detect encoding or try both gb18030 (Fox) and euc-kr (Tygem)
        let converted = await this._tryConvert(arrayBuffer, 'gb18030');

        // Simple heuristic: if black player name is empty or looks like gibberish, try euc-kr
        // But better yet, check the content for specific markers or just try to extract info.
        if (!converted.includes('PB[') || converted.includes('PB[]')) {
            const krConverted = await this._tryConvert(arrayBuffer, 'euc-kr');
            // If KR version has more info, use it.
            if (krConverted.includes('PB[') && !krConverted.includes('PB[]')) {
                return krConverted;
            }
        }

        return converted;
    }

    async _tryConvert(arrayBuffer, encoding) {
        const decoder = new TextDecoder(encoding);
        const decodedContent = decoder.decode(arrayBuffer);

        let lines = decodedContent.split(/\r?\n/);
        let header = lines.shift();
        if (!header || !header.startsWith('\\HS')) {
            throw new Error("Invalid GIB file format");
        }

        let blackPlayer = "",
            whitePlayer = "",
            blackRank = "",
            whiteRank = "",
            result = "",
            date = "",
            komi = "6.5",
            mainTime = "",
            byoyomi = "";
        let handicap = 0;
        let moves = "";

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // 🔥 增强：支持多种可能的棋手名称标签 (Fox, Tygem, 弈城等不同版本可能不同)
            if (line.match(/\[GAME(BLACK|B)(NICK|NAME|PLAYER)=/i)) {
                const bName = this._extractInfo(line, /\[GAME(?:BLACK|B)(?:NICK|NAME|PLAYER)=(.*?)\]/i);
                if (bName) blackPlayer = bName;
            }
            if (line.match(/\[GAME(WHITE|W)(NICK|NAME|PLAYER)=/i)) {
                const wName = this._extractInfo(line, /\[GAME(?:WHITE|W)(?:NICK|NAME|PLAYER)=(.*?)\]/i);
                if (wName) whitePlayer = wName;
            }

            if (line.includes("[GAMEBLACKLEVEL="))
                blackRank = this._convertRank(this._extractInfo(line, /\[GAMEBLACKLEVEL=(.*?)\]/));
            if (line.includes("[GAMEWHITELEVEL="))
                whiteRank = this._convertRank(this._extractInfo(line, /\[GAMEWHITELEVEL=(.*?)\]/));

            if (line.includes("[GAMERESULT=")) {
                const rawResult = this._extractInfo(line, /\[GAMERESULT=(.*?)\]/);
                result = this._normalizeResult(rawResult);
            }

            if (line.includes("[GAMECONDITION=")) {
                const cond = this._extractInfo(line, /\[GAMECONDITION=(.*?)\]/);
                // Komi is often stored as integer (e.g. 650 for 6.5)
                if (cond) {
                    const num = parseInt(cond);
                    komi = (num / 100).toString();
                }
            }

            if (line.includes("[GAMEDATE=")) {
                date = line.split("=")[1].replace(/[^0-9]/g, "-");
                if (date.startsWith("-")) date = date.substring(1);
                if (date.endsWith("-")) date = date.substring(0, date.length - 1);
            }

            if (line.includes("GAMETIME")) {
                let match = line.match(/限制时间\s(\d+分)/);
                if (match && match[1]) mainTime = match[1];
            }

            if (line.includes("秒")) {
                let match = line.match(/(.*?)(?=\\])/);
                if (match && match[1]) byoyomi = match[1];
            }

            if (line.includes("INI")) {
                const parts = line.split(" ");
                if (parts.length >= 4) handicap = parseInt(parts[3]);
            }

            if (line.startsWith("STO")) {
                let parts = line.split(" ");
                if (parts.length >= 6) {
                    let color = parts[3] === "1" ? "B" : "W";
                    let x = String.fromCharCode(parseInt(parts[4]) + 97);
                    let y = String.fromCharCode(parseInt(parts[5]) + 97);
                    moves += `;${color}[${x}${y}]`;
                }
            }
        }

        let sgf = `(;GM[1]FF[4]CA[UTF-8]AP[GIBParser]SZ[19]KM[${komi}]PB[${blackPlayer}]BR[${blackRank}]PW[${whitePlayer}]WR[${whiteRank}]TM[${mainTime}]OT[${byoyomi}]DT[${date}]RE[${result}]`;
        if (handicap > 0) {
            sgf += `HA[${handicap}]`;
        }
        sgf += moves + ")";

        return sgf;
    }

    _extractInfo(line, pattern) {
        const match = line.match(pattern);
        if (match) {
            return match[1].replace(/[\]\\\s]+$/, "").trim();
        }
        return "";
    }

    _convertRank(numericRank) {
        const numRank = parseInt(numericRank);
        if (isNaN(numRank)) return "";

        if (numRank >= 18) {
            return `${numRank - 17}D`;
        } else {
            return `${18 - numRank}K`;
        }
    }

    _normalizeResult(rawResult) {
        // Simple normalization for GIB result strings
        if (rawResult.includes("黑中盘胜")) return "B+Resign";
        if (rawResult.includes("白中盘胜")) return "W+Resign";
        if (rawResult.includes("黑胜")) return "B+R"; // Default to R if not specified
        if (rawResult.includes("白胜")) return "W+R";
        return rawResult;
    }
}

// Export to window
window.GIBParser = GIBParser;
