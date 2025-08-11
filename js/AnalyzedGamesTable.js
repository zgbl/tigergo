// 已分析棋谱表格管理类
class AnalyzedGamesTable {
    constructor() {
        this.tableBody = null;
        this.refreshBtn = null;
        this.clearBtn = null;
        this.analysisStorage = null;
        this.currentGames = [];
    }

    // 初始化表格
    async init(analysisStorage) {
        this.analysisStorage = analysisStorage;
        this.tableBody = document.getElementById('analyzedGamesTableBody');
        this.refreshBtn = document.getElementById('refreshAnalyzedGames');
        this.clearBtn = document.getElementById('clearAnalyzedGames');

        if (!this.tableBody) {
            console.error('找不到已分析棋谱表格元素');
            return;
        }

        // 绑定事件
        this.bindEvents();
        
        // 加载数据
        await this.loadAnalyzedGames();
    }

    // 绑定事件
    bindEvents() {
        if (this.refreshBtn) {
            this.refreshBtn.addEventListener('click', () => {
                this.loadAnalyzedGames();
            });
        }

        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => {
                this.clearAllGames();
            });
        }
    }

    // 加载已分析的棋谱
    async loadAnalyzedGames() {
        try {
            console.log('正在加载已分析的棋谱...');
            this.currentGames = await this.analysisStorage.getAllAnalyzedGames();
            console.log(`加载了 ${this.currentGames.length} 个已分析的棋谱`);
            this.renderTable();
        } catch (error) {
            console.error('加载已分析棋谱失败:', error);
            this.showError('加载失败');
        }
    }

    // 渲染表格
    renderTable() {
        if (!this.tableBody) return;

        if (this.currentGames.length === 0) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #6c757d; padding: 20px;">
                        <i class="fas fa-info-circle"></i>
                        <p>暂无已分析的棋谱</p>
                    </td>
                </tr>
            `;
            return;
        }

        this.tableBody.innerHTML = this.currentGames.map(game => `
            <tr data-game-id="${game.id}" class="game-row">
                <td class="game-id" title="${game.id}">${game.id.substring(0, 8)}...</td>
                <td class="game-filename" title="${game.filename}">${this.truncateText(game.filename, 12)}</td>
                <td class="game-player" title="${game.blackPlayer}">${this.truncateText(game.blackPlayer, 8)}</td>
                <td class="game-player" title="${game.whitePlayer}">${this.truncateText(game.whitePlayer, 8)}</td>
                <td class="game-date">${this.formatDate(game.analysisTime)}</td>
                <td class="game-actions">
                    <button class="action-btn load-btn" data-game-id="${game.id}" title="加载棋谱">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="action-btn delete-btn" data-game-id="${game.id}" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // 绑定行点击事件
        this.bindRowEvents();
    }

    // 绑定行事件
    bindRowEvents() {
        // 行点击事件（加载棋谱）
        const gameRows = this.tableBody.querySelectorAll('.game-row');
        gameRows.forEach(row => {
            row.addEventListener('click', (e) => {
                // 如果点击的是按钮，不触发行点击事件
                if (e.target.closest('.action-btn')) return;
                
                const gameId = row.dataset.gameId;
                this.loadGame(gameId);
            });
        });

        // 加载按钮事件
        const loadBtns = this.tableBody.querySelectorAll('.load-btn');
        loadBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const gameId = btn.dataset.gameId;
                this.loadGame(gameId);
            });
        });

        // 删除按钮事件
        const deleteBtns = this.tableBody.querySelectorAll('.delete-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const gameId = btn.dataset.gameId;
                this.deleteGame(gameId);
            });
        });
    }

    // 加载指定的棋谱
    async loadGame(gameId) {
        try {
            const game = this.currentGames.find(g => g.id === gameId);
            if (!game) {
                console.error('找不到指定的棋谱');
                return;
            }

            console.log(`正在加载棋谱: ${game.filename}`);
            
            // 使用全局的加载函数
            if (typeof window.loadSGFGame === 'function') {
                const success = await window.loadSGFGame(game.sgfContent, game.filename, gameId);
                if (success) {
                    // 更新文件信息显示
                    this.updateFileInfo(game);
                    
                    console.log(`已加载棋谱: ${game.filename}`);
                    
                    // 显示成功消息
                    this.showSuccess(`已加载棋谱: ${game.filename}`);
                } else {
                    console.error('加载棋谱失败');
                    this.showError('加载棋谱失败');
                }
            } else {
                console.error('SGF加载函数未初始化');
                this.showError('SGF加载函数未初始化');
            }
        } catch (error) {
            console.error('加载棋谱失败:', error);
            this.showError('加载棋谱失败');
        }
    }

    // 更新文件信息显示
    updateFileInfo(game) {
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileDetails = document.getElementById('fileDetails');
        
        if (fileInfo && fileName && fileDetails) {
            fileName.textContent = game.filename;
            fileDetails.innerHTML = `
                <div>黑棋: ${game.blackPlayer}</div>
                <div>白棋: ${game.whitePlayer}</div>
                <div>分析时间: ${this.formatDate(game.analysisTime)}</div>
                <div>分析步数: ${game.analysisCount}</div>
            `;
            fileInfo.classList.add('show');
        }
    }

    // 删除指定的棋谱
    async deleteGame(gameId) {
        const game = this.currentGames.find(g => g.id === gameId);
        if (!game) return;

        if (!confirm(`确定要删除棋谱 "${game.filename}" 及其分析结果吗？`)) {
            return;
        }

        try {
            const success = await this.analysisStorage.deleteAnalyzedGame(gameId);
            if (success) {
                this.showSuccess('删除成功');
                await this.loadAnalyzedGames(); // 重新加载表格
            } else {
                this.showError('删除失败');
            }
        } catch (error) {
            console.error('删除棋谱失败:', error);
            this.showError('删除失败');
        }
    }

    // 清空所有棋谱
    async clearAllGames() {
        if (this.currentGames.length === 0) {
            this.showInfo('没有需要清空的棋谱');
            return;
        }

        if (!confirm(`确定要清空所有 ${this.currentGames.length} 个已分析的棋谱吗？此操作不可恢复！`)) {
            return;
        }

        try {
            const success = await this.analysisStorage.clearAllAnalyzedGames();
            if (success) {
                this.showSuccess('清空成功');
                await this.loadAnalyzedGames(); // 重新加载表格
            } else {
                this.showError('清空失败');
            }
        } catch (error) {
            console.error('清空棋谱失败:', error);
            this.showError('清空失败');
        }
    }

    // 工具方法：截断文本
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    // 工具方法：格式化日期
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '未知';
        }
    }

    // 显示消息
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showInfo(message) {
        this.showMessage(message, 'info');
    }

    showMessage(message, type) {
        // 可以在这里实现消息提示功能
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 简单的alert实现，后续可以改为更好的UI
        if (type === 'error') {
            alert(`错误: ${message}`);
        } else if (type === 'success') {
            // 可以实现一个临时的成功提示
            console.log(`成功: ${message}`);
        }
    }

    // 显示错误状态
    showError(message) {
        if (this.tableBody) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #dc3545; padding: 20px;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${message}</p>
                    </td>
                </tr>
            `;
        }
    }
}

// 创建全局实例
window.analyzedGamesTable = new AnalyzedGamesTable();