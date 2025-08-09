class AnalysisStorage {
    constructor() {
        this.dbName = 'SGFAnalysisDB';
        this.dbVersion = 1;
        this.db = null;
        this.analysisCache = []; // 内存缓存
    }

    // 初始化 IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 创建分析结果存储表
                if (!db.objectStoreNames.contains('analysisResults')) {
                    const store = db.createObjectStore('analysisResults', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    // 创建索引
                    store.createIndex('sgfHash', 'sgfHash', { unique: false });
                    store.createIndex('moveNumber', 'moveNumber', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // 创建 SGF 文件存储表
                if (!db.objectStoreNames.contains('sgfFiles')) {
                    const sgfStore = db.createObjectStore('sgfFiles', { 
                        keyPath: 'hash' 
                    });
                    sgfStore.createIndex('filename', 'filename', { unique: false });
                    sgfStore.createIndex('uploadTime', 'uploadTime', { unique: false });
                }
            };
        });
    }

    // 生成 SGF 内容的哈希值作为唯一标识
    generateSGFHash(sgfContent) {
        let hash = 0;
        for (let i = 0; i < sgfContent.length; i++) {
            const char = sgfContent.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(36);
    }

    // 保存 SGF 文件信息
    async saveSGFFile(sgfContent, filename) {
        const hash = this.generateSGFHash(sgfContent);
        const sgfData = {
            hash: hash,
            filename: filename,
            content: sgfContent,
            uploadTime: new Date().toISOString(),
            analysisCount: 0 // 分析次数
        };

        const transaction = this.db.transaction(['sgfFiles'], 'readwrite');
        const store = transaction.objectStore('sgfFiles');
        
        return new Promise((resolve, reject) => {
            const request = store.put(sgfData);
            request.onsuccess = () => resolve(hash);
            request.onerror = () => reject(request.error);
        });
    }

    // 保存单步分析结果到内存缓存
    addAnalysisResult(sgfHash, moveNumber, moveData, analysisResult) {
        const result = {
            sgfHash: sgfHash,
            moveNumber: moveNumber,
            move: moveData ? {
                row: moveData.row,
                col: moveData.col,
                color: moveData.color,
                position: this.convertToSGFPosition(moveData.row, moveData.col) // 如 "Q16"
            } : null,
            analysis: {
                recommendedMove: analysisResult.recommendedMove || '',
                winRate: analysisResult.winRate || 0,
                score: analysisResult.score || 0,
                visits: analysisResult.visits || 0,
                time: analysisResult.time || 0,
                policy: analysisResult.policy || [],
                variations: analysisResult.variations || [],
                rawData: analysisResult // 完整的原始数据
            },
            timestamp: new Date().toISOString()
        };

        this.analysisCache.push(result);
        console.log(`已添加第${moveNumber}手分析结果到缓存`);
        return result;
    }

    // 批量保存分析结果到 IndexedDB
    async saveAnalysisToIndexedDB() {
        if (this.analysisCache.length === 0) {
            console.log('没有分析结果需要保存');
            return;
        }

        const transaction = this.db.transaction(['analysisResults'], 'readwrite');
        const store = transaction.objectStore('analysisResults');
        
        const promises = this.analysisCache.map(result => {
            return new Promise((resolve, reject) => {
                const request = store.add(result);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });

        try {
            await Promise.all(promises);
            console.log(`已保存 ${this.analysisCache.length} 条分析结果到 IndexedDB`);
            return true;
        } catch (error) {
            console.error('保存到 IndexedDB 失败:', error);
            throw error;
        }
    }

    // 从 IndexedDB 加载指定 SGF 的分析结果
    async loadAnalysisResults(sgfHash) {
        const transaction = this.db.transaction(['analysisResults'], 'readonly');
        const store = transaction.objectStore('analysisResults');
        const index = store.index('sgfHash');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(sgfHash);
            request.onsuccess = () => {
                const results = request.result.sort((a, b) => a.moveNumber - b.moveNumber);
                console.log(`从 IndexedDB 加载了 ${results.length} 条分析结果`);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 清空内存缓存
    clearCache() {
        this.analysisCache = [];
        console.log('已清空分析结果缓存');
    }

    // 获取当前缓存的分析结果
    getCachedResults() {
        return this.analysisCache;
    }

    // 辅助方法：将 row/col 转换为 SGF 位置格式
    convertToSGFPosition(row, col) {
        if (row === undefined || col === undefined) return '';
        
        // 列转换: 0-18 -> A-T (跳过I)
        let colChar;
        if (col <= 7) {
            colChar = String.fromCharCode(65 + col); // A-H
        } else {
            colChar = String.fromCharCode(66 + col); // J-T
        }
        
        // 行转换: 0-18 -> 19-1
        const rowNum = 19 - row;
        
        return colChar + rowNum;
    }
}