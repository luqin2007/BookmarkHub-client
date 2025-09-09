// 主应用程序
class BookmarkHubApp {
    constructor() {
        this.initialized = false;
        this.syncInterval = null;
    }

    // 初始化应用
    async init() {
        try {
            console.log('初始化 BookmarkHub Manager...');
            
            // 等待存储管理器初始化
            await window.storageManager.initDB();
            
            // 初始化 UI
            window.uiManager.init();
            
            // 加载设置
            await this.loadSettings();
            
            // 加载书签数据
            await this.loadBookmarks();
            
            // 设置自动同步
            this.setupAutoSync();
            
            this.initialized = true;
            console.log('BookmarkHub Manager 初始化完成');
            
        } catch (error) {
            console.error('应用初始化失败:', error);
            window.uiManager.showNotification('应用初始化失败: ' + error.message, 'error');
        }
    }

    // 加载设置
    async loadSettings() {
        try {
            const settings = window.storageManager.getSettings();
            
            if (settings.githubToken && settings.gistId) {
                window.githubManager.setCredentials(settings.githubToken, settings.gistId);
                
                // 验证凭据
                const validation = await window.githubManager.validateToken();
                if (!validation.valid) {
                    console.warn('GitHub 凭据验证失败:', validation.error);
                    window.uiManager.showNotification('GitHub 凭据无效，请重新配置', 'warning');
                }
            }
            
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    // 加载书签数据
    async loadBookmarks() {
        try {
            window.uiManager.showLoading(true, '加载书签数据...');
            
            await window.bookmarkManager.loadBookmarks();
            window.uiManager.renderBookmarks();
            
            const stats = window.bookmarkManager.getStatistics();
            console.log('书签统计:', stats);
            
        } catch (error) {
            console.error('加载书签失败:', error);
            window.uiManager.showNotification('加载书签失败: ' + error.message, 'error');
        } finally {
            window.uiManager.showLoading(false);
        }
    }

    // 设置自动同步
    setupAutoSync() {
        const settings = window.storageManager.getSettings();
        
        if (settings.autoSync && settings.githubToken && settings.gistId) {
            // 每30分钟自动同步一次
            this.syncInterval = setInterval(() => {
                this.autoSync();
            }, 30 * 60 * 1000);
            
            console.log('自动同步已启用');
        }
    }

    // 自动同步
    async autoSync() {
        try {
            const settings = window.storageManager.getSettings();
            const lastSync = settings.lastSync || 0;
            const now = Date.now();
            
            // 如果距离上次同步超过30分钟，则执行同步
            if (now - lastSync > 30 * 60 * 1000) {
                console.log('执行自动同步...');
                await window.githubManager.syncBookmarks();
                await window.bookmarkManager.loadBookmarks();
                window.uiManager.renderBookmarks();
                
                console.log('自动同步完成');
            }
            
        } catch (error) {
            console.error('自动同步失败:', error);
        }
    }

    // 停止自动同步
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('自动同步已停止');
        }
    }

    // 导出数据
    async exportData(format = 'json') {
        try {
            const data = await window.storageManager.exportData();
            const filename = `bookmarks_${new Date().toISOString().split('T')[0]}.${format}`;
            
            let content;
            let mimeType;
            
            switch (format) {
                case 'json':
                    content = JSON.stringify(data, null, 2);
                    mimeType = 'application/json';
                    break;
                case 'html':
                    content = window.bookmarkManager.exportBookmarks('html');
                    mimeType = 'text/html';
                    break;
                default:
                    throw new Error('不支持的导出格式');
            }
            
            // 创建下载链接
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            URL.revokeObjectURL(url);
            window.uiManager.showNotification('数据导出成功', 'success');
            
        } catch (error) {
            console.error('导出数据失败:', error);
            window.uiManager.showNotification('导出数据失败: ' + error.message, 'error');
        }
    }

    // 导入数据
    async importData(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            const success = await window.storageManager.importData(data);
            if (success) {
                await window.bookmarkManager.loadBookmarks();
                window.uiManager.renderBookmarks();
                window.uiManager.showNotification('数据导入成功', 'success');
            } else {
                throw new Error('导入数据失败');
            }
            
        } catch (error) {
            console.error('导入数据失败:', error);
            window.uiManager.showNotification('导入数据失败: ' + error.message, 'error');
        }
    }

    // 清空所有数据
    async clearAllData() {
        if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) {
            return;
        }
        
        try {
            await window.storageManager.clearAllData();
            window.bookmarkManager.bookmarks = [];
            window.bookmarkManager.filteredBookmarks = [];
            window.uiManager.renderBookmarks();
            
            this.stopAutoSync();
            window.uiManager.showNotification('所有数据已清空', 'success');
            
        } catch (error) {
            console.error('清空数据失败:', error);
            window.uiManager.showNotification('清空数据失败: ' + error.message, 'error');
        }
    }

    // 检查更新
    async checkForUpdates() {
        try {
            // 这里可以实现检查应用更新的逻辑
            console.log('检查更新...');
            
            // 模拟检查更新
            setTimeout(() => {
                window.uiManager.showNotification('当前已是最新版本', 'success');
            }, 1000);
            
        } catch (error) {
            console.error('检查更新失败:', error);
            window.uiManager.showNotification('检查更新失败: ' + error.message, 'error');
        }
    }

    // 获取应用信息
    getAppInfo() {
        return {
            name: 'BookmarkHub Manager',
            version: '1.0.0',
            author: 'BookmarkHub Team',
            description: '一个功能强大的书签管理工具',
            features: [
                'GitHub Gist 同步',
                '本地存储',
                '书签搜索',
                '文件夹管理',
                '隐藏书签',
                '链接检查',
                '撤销操作',
                '批量操作',
                '导入导出'
            ]
        };
    }

    // 显示应用信息
    showAppInfo() {
        const info = this.getAppInfo();
        const stats = window.bookmarkManager.getStatistics();
        
        const message = `
            <div style="text-align: left;">
                <h3>${info.name} v${info.version}</h3>
                <p>${info.description}</p>
                <br>
                <h4>统计信息:</h4>
                <ul>
                    <li>总项目数: ${stats.totalItems}</li>
                    <li>书签数: ${stats.bookmarks}</li>
                    <li>文件夹数: ${stats.folders}</li>
                    <li>隐藏项目数: ${stats.hiddenItems}</li>
                </ul>
                <br>
                <h4>主要功能:</h4>
                <ul>
                    ${info.features.map(feature => `<li>${feature}</li>`).join('')}
                </ul>
            </div>
        `;
        
        // 这里可以显示一个模态对话框
        console.log('应用信息:', info);
        window.uiManager.showNotification('应用信息已输出到控制台', 'info');
    }

    // 处理错误
    handleError(error, context = '') {
        console.error(`错误 [${context}]:`, error);
        
        let message = error.message || '未知错误';
        if (context) {
            message = `${context}: ${message}`;
        }
        
        window.uiManager.showNotification(message, 'error');
    }

    // 应用销毁
    destroy() {
        this.stopAutoSync();
        
        // 清理事件监听器
        document.removeEventListener('keydown', window.uiManager.handleKeyboard);
        document.removeEventListener('click', window.uiManager.hideContextMenu);
        document.removeEventListener('contextmenu', window.uiManager.showContextMenu);
        
        console.log('BookmarkHub Manager 已销毁');
    }
}

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    if (window.app) {
        window.app.handleError(event.error, '全局错误');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的 Promise 拒绝:', event.reason);
    if (window.app) {
        window.app.handleError(event.reason, 'Promise 拒绝');
    }
});

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.app = new BookmarkHubApp();
        await window.app.init();
    } catch (error) {
        console.error('应用启动失败:', error);
        document.body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; color: #666;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem; color: #f56565;"></i>
                <h2>应用启动失败</h2>
                <p>错误信息: ${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    重新加载
                </button>
            </div>
        `;
    }
});

// 页面卸载前保存状态
window.addEventListener('beforeunload', () => {
    if (window.app) {
        // 保存当前状态
        const settings = window.storageManager.getSettings();
        settings.lastExit = Date.now();
        window.storageManager.saveSettings(settings);
    }
});

// 导出全局函数供 HTML 使用
window.exportData = (format) => window.app?.exportData(format);
window.importData = (file) => window.app?.importData(file);
window.clearAllData = () => window.app?.clearAllData();
window.showAppInfo = () => window.app?.showAppInfo();
window.checkForUpdates = () => window.app?.checkForUpdates();