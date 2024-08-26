const fs = require('fs');
const readline = require('readline');



/*function parseGIB(gibContent) {
    const info = {};
    const moves = [];
    const infoRegex = /(\w+)\[(.*?)\]/g;
    const moveRegex = /;([BW])(\[\]|\[([a-s]{2})\])/g;
    let match;


    return {
        gameInfo: {
            blackPlayer: info.PB || '',
            whitePlayer: info.PW || '',
            blackRank: info.BR || '',
            whiteRank: info.WR || '',
            date: info.DT || '',
            result: info.RE || '',
            komi: info.KM || '',
            boardSize: info.SZ || '',
            timeControl: `${info.TM || ''}${info.OT ? ' ' + info.OT : ''}`,
            rules: info.RU || ''
        },
        moves: moves
    };

}  */

/*function parseSGF3(sgfContent) {
    const info = {};
    const moves = [];
    const infoRegex = /(\w+)\[(.*?)\]/g;
    const moveRegex = /;([BW])(\[\]|\[([a-s]{2})\])/g;
    let match;

    // Extract game information
    while ((match = infoRegex.exec(sgfContent)) !== null) {
        const [, key, value] = match;
        if (key !== 'B' && key !== 'W') {
            info[key] = value;
        }
    }

    // Extract moves
    while ((match = moveRegex.exec(sgfContent)) !== null) {
        const color = match[1] === "B" ? "black" : "white";
        if (match[2] === "[]") {
            // This is a pass move
            moves.push({ pass: true, color });
        } else {
            const col = match[3].charCodeAt(0) - 97;
            const row = match[3].charCodeAt(1) - 97;
            moves.push({ row, col, color });
        }
    }
    console.log("刚刚parse出来的 moves:", moves);

    return {
        gameInfo: {
            blackPlayer: info.PB || '',
            whitePlayer: info.PW || '',
            blackRank: info.BR || '',
            whiteRank: info.WR || '',
            date: info.DT || '',
            result: info.RE || '',
            komi: info.KM || '',
            boardSize: info.SZ || '',
            timeControl: `${info.TM || ''}${info.OT ? ' ' + info.OT : ''}`,
            rules: info.RU || ''
        },
        moves: moves
    };
}  */

async function convertGIBtoSGF(file) {
    if (!file.endsWith('.gib')) {
        throw new Error('Expecting a .gib file');
    }

    const fileStream = fs.createReadStream(file);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let info = {};
    let moves = '';
    let Hcap = 0;

    for await (const line of rl) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('\\HS')) {
            continue; // Header line, skip it
        }

        if (/GAMEWHITELEVEL/.test(trimmedLine)) {
            info.wr = trimmedLine.split('=')[1].trim();
        } else if (/GAMEBLACKLEVEL/.test(trimmedLine)) {
            info.br = trimmedLine.split('=')[1].trim();
        } else if (/GAMEBLACKNICK/.test(trimmedLine)) {
            info.bp = trimmedLine.split('=')[1].trim();
        } else if (/GAMEWHITENICK/.test(trimmedLine)) {
            info.wp = trimmedLine.split('=')[1].trim();
        } else if (/GAMERESULT/.test(trimmedLine)) {
            info.res = trimmedLine.split('=')[1].trim();
        } else if (/GAMEWHITENAME/.test(trimmedLine)) {
            info.wname = trimmedLine.split('=')[1].trim();
        } else if (/GAMEBLACKNAME/.test(trimmedLine)) {
            info.bname = trimmedLine.split('=')[1].trim();
        } else if (/GAMEDATE/.test(trimmedLine)) {
            const [_, yr, mn, dy] = trimmedLine.match(/GAMEDATE=(\d{4})(\d{2})(\d{2})/);
            info.date = `${yr}-${mn}-${dy}`;
        } else if (/GAMETAG/.test(trimmedLine)) {
            break;
        } else if (/INI\s+[\d]+\s+[\d]+\s+[\d]+/.test(trimmedLine)) {
            const [_, , , hcap] = trimmedLine.match(/INI\s+[\d]+\s+[\d]+\s+([\d]+)/);
            Hcap = parseInt(hcap);
        } else if (/STO/.test(trimmedLine)) {
            const [_, , , colorCode, x, y] = trimmedLine.match(/STO\s+[\d]+\s+[\d]+\s+([\d]+)\s+([\d]+)\s+([\d]+)/);
            const col = String.fromCharCode(parseInt(x) + 96);
            const row = String.fromCharCode(parseInt(y) + 96);
            const color = colorCode == 1 ? 'B' : 'W';
            moves += `;${color}[${col}${row}]`;
        }
    }

    const wp = info.wp || info.wname || '';
    const bp = info.bp || info.bname || '';
    const wr = info.wp ? info.wr || '' : '';
    const br = info.bp ? info.br || '' : '';
    const res = info.res || '';
    const date = info.date || '';

    let sgfContent = `(;GM[1]FF[4]CA[UTF-8]AP[gokifu.com]SO[http://gokifu.com]ST[1]
SZ[19]PW[${wp}]WR[${wr}]PB[${bp}]BR[${br}]RE[${res}]DT[${date}]
`;

    if (Hcap > 0) {
        sgfContent += `HA[${Hcap}]`;
    }

    const handicapPositions = {
        2: 'AB[pd][dp]',
        3: 'AB[pd][dp][pp]',
        4: 'AB[dd][pd][dp][pp]',
        5: 'AB[dd][pd][jj][dp][pp]',
        6: 'AB[dd][pd][dj][pj][dp][pp]',
        7: 'AB[dd][pd][dj][jj][pj][dp][pp]',
        8: 'AB[dd][jd][pd][dj][pj][dp][jp][pp]',
        9: 'AB[dd][jd][pd][dj][jj][pj][dp][jp][pp]'
    };

    if (Hcap >= 2 && Hcap <= 9) {
        sgfContent += handicapPositions[Hcap];
    }

    sgfContent += moves;
    sgfContent += ')';

    const outputFileName = `${file}.sgf`;
    fs.writeFileSync(outputFileName, sgfContent, { encoding: 'utf-8' });

    console.log("sgfContent is:", sgfContent);

    console.log(`Converted ${file} to ${outputFileName}`);
}

async function parseGIB(gibContent) {
    // Step 1: Convert GIB to SGF
    let lines = gibContent.split("\n");
    let header = lines.shift();
    if (!header.startsWith("\\HS")) {
        throw new Error("Invalid GIB file format");
    }

    let blackPlayer = "", whitePlayer = "", blackRank = "", whiteRank = "", result = "", date = "";
    let handicap = 0;
    let moves = "";

    for (let line of lines) {
        line = line.trim();
        if (line.startsWith("GAMEBLACKNICK=")) blackPlayer = line.split("=")[1];
        if (line.startsWith("GAMEWHITENICK=")) whitePlayer = line.split("=")[1];
        if (line.startsWith("GAMEBLACKLEVEL=")) blackRank = line.split("=")[1];
        if (line.startsWith("GAMEWHITELEVEL=")) whiteRank = line.split("=")[1];
        if (line.startsWith("GAMERESULT=")) result = line.split("=")[1];
        if (line.startsWith("GAMEDATE=")) date = line.split("=")[1].replace(/[^0-9]/g, "-");

        if (line.startsWith("INI")) {
            handicap = parseInt(line.split(" ")[3]);
        }

        if (line.startsWith("STO")) {
            let parts = line.split(" ");
            let color = parts[3] === "1" ? "B" : "W";
            let x = String.fromCharCode(parseInt(parts[4]) + 97);
            let y = String.fromCharCode(parseInt(parts[5]) + 97);
            moves += `;${color}[${x}${y}]`;
        }
    }

    let sgf = `(;GM[1]FF[4]CA[UTF-8]AP[GIBtoSGF]SZ[19]PB[${blackPlayer}]BR[${blackRank}]PW[${whitePlayer}]WR[${whiteRank}]RE[${result}]DT[${date}]`;
    if (handicap > 0) {
        sgf += `HA[${handicap}]`;
    }
    sgf += moves + ")";

    // Step 2: Parse the SGF content (using the parseSGF2 logic)
    const info = {};
    const parsedMoves = [];
    const infoRegex = /(\w+)\[(.*?)\]/g;
    const moveRegex = /;([BW])(\[\]|\[([a-s]{2})\])/g;
    let match;

    // Extract game information
    while ((match = infoRegex.exec(sgf)) !== null) {
        const [, key, value] = match;
        if (key !== 'B' && key !== 'W') {
            info[key] = value;
        }
    }

    // Extract moves
    while ((match = moveRegex.exec(sgf)) !== null) {
        const color = match[1] === "B" ? "black" : "white";
        if (match[2] === "[]") {
            // This is a pass move
            parsedMoves.push({ pass: true, color });
        } else {
            const col = match[3].charCodeAt(0) - 97;
            const row = match[3].charCodeAt(1) - 97;
            parsedMoves.push({ row, col, color });
        }
    }

    // Step 3: Return the parsed structure
    return {
        gameInfo: {
            blackPlayer: info.PB || '',
            whitePlayer: info.PW || '',
            blackRank: info.BR || '',
            whiteRank: info.WR || '',
            date: info.DT || '',
            result: info.RE || '',
            komi: info.KM || '',
            boardSize: info.SZ || '',
            timeControl: `${info.TM || ''}${info.OT ? ' ' + info.OT : ''}`,
            rules: info.RU || ''
        },
        moves: parsedMoves
    };
}

// Usage example:
// convertGIBtoSGF('1.gib');

//module.exports = convertGIBtoSGF;
