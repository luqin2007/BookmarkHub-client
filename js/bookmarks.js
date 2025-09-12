// 书签管理模块
class BookmarkManager {
    constructor() {
        this.bookmarks = [];
        this.filteredBookmarks = [];
        this.searchQuery = '';
        this.showHidden = false;
        this.selectedItems = new Set();
        this.draggedItem = null;
        this.configCache = new Map(); // 缓存解析的配置项
        this.hiddenPassword = null; // 从配置项中读取的隐藏密码
    }

    // 加载书签数据
    async loadBookmarks() {
        try {
            this.bookmarks = await window.storageManager.getBookmarks();
            this.parseConfigItems(); // 解析配置项
            this.applyFilters();
            return this.bookmarks;
        } catch (error) {
            console.error('加载书签失败:', error);
            throw error;
        }
    }

    // 保存书签数据
    async saveBookmarks() {
        try {
            await window.storageManager.saveBookmarks(this.bookmarks);
            this.parseConfigItems(); // 重新解析配置项
            return true;
        } catch (error) {
            console.error('保存书签失败:', error);
            throw error;
        }
    }

    // 应用过滤器
    applyFilters() {
        this.filteredBookmarks = this.filterBookmarks(this.bookmarks);
    }

    // 过滤书签（递归）
    filterBookmarks(bookmarks) {
        return bookmarks.map(item => {
            const filteredItem = { ...item };
            
            // 处理子项
            if (item.children) {
                filteredItem.children = this.filterBookmarks(item.children);
            }
            
            // 应用搜索过滤
            if (this.searchQuery) {
                const matchesSearch = this.matchesSearchQuery(item);
                const hasMatchingChildren = filteredItem.children && 
                    filteredItem.children.some(child => this.hasMatchingDescendants(child));
                
                if (!matchesSearch && !hasMatchingChildren) {
                    return null;
                }
            }
            
            // 应用隐藏过滤
            if (!this.showHidden && item.hidden) {
                return null;
            }
            
            return filteredItem;
        }).filter(item => item !== null);
    }

    // 检查是否匹配搜索查询
    matchesSearchQuery(item) {
        if (!this.searchQuery) return true;
        
        const query = this.searchQuery.toLowerCase();
        const title = (item.title || '').toLowerCase();
        const url = (item.url || '').toLowerCase();
        
        return title.includes(query) || url.includes(query);
    }

    // 检查是否有匹配的后代
    hasMatchingDescendants(item) {
        if (this.matchesSearchQuery(item)) {
            return true;
        }
        
        if (item.children) {
            return item.children.some(child => this.hasMatchingDescendants(child));
        }
        
        return false;
    }

    // 搜索书签
    async searchBookmarks(query) {
        this.searchQuery = query;
        this.applyFilters();
        return this.filteredBookmarks;
    }

    // 切换隐藏项显示
    toggleHiddenItems(show) {
        this.showHidden = show;
        this.applyFilters();
        return this.filteredBookmarks;
    }

    // 添加书签
    async addBookmark(parentPath, bookmark) {
        try {
            const parent = this.findItemByPath(parentPath);
            if (!parent || !parent.children) {
                throw new Error('无效的父文件夹');
            }
            
            const newBookmark = {
                ...bookmark,
                id: this.generateId(),
                created: Date.now(),
                modified: Date.now()
            };
            
            parent.children.push(newBookmark);
            await this.saveBookmarks();
            this.applyFilters();
            
            return newBookmark;
        } catch (error) {
            console.error('添加书签失败:', error);
            throw error;
        }
    }

    // 添加文件夹
    async addFolder(parentPath, folderName) {
        try {
            const parent = this.findItemByPath(parentPath);
            if (!parent || !parent.children) {
                throw new Error('无效的父文件夹');
            }
            
            const newFolder = {
                id: this.generateId(),
                title: folderName,
                children: [],
                isFolder: true,
                created: Date.now(),
                modified: Date.now()
            };
            
            parent.children.push(newFolder);
            await this.saveBookmarks();
            this.applyFilters();
            
            return newFolder;
        } catch (error) {
            console.error('添加文件夹失败:', error);
            throw error;
        }
    }

    // 编辑书签/文件夹
    async editItem(itemPath, updates) {
        try {
            const item = this.findItemByPath(itemPath);
            if (!item) {
                throw new Error('找不到指定项目');
            }
            
            Object.assign(item, updates, { modified: Date.now() });
            await this.saveBookmarks();
            this.applyFilters();
            
            return item;
        } catch (error) {
            console.error('编辑项目失败:', error);
            throw error;
        }
    }

    // 删除项目
    async deleteItem(itemPath) {
        try {
            const item = this.findItemByPath(itemPath);
            if (!item) {
                throw new Error('找不到指定项目');
            }
            
            this.removeItemByPath(itemPath);
            await this.saveBookmarks();
            this.applyFilters();
            
            return true;
        } catch (error) {
            console.error('删除项目失败:', error);
            throw error;
        }
    }

    // 批量删除
    async deleteItems(itemPaths) {
        try {
            itemPaths.forEach(path => this.removeItemByPath(path));
            await this.saveBookmarks();
            this.applyFilters();
            
            return true;
        } catch (error) {
            console.error('批量删除失败:', error);
            throw error;
        }
    }

    // 移动项目
    async moveItem(itemPath, newParentPath, newIndex = -1) {
        try {
            const item = this.findItemByPath(itemPath);
            const newParent = this.findItemByPath(newParentPath);
            
            if (!item || !newParent || !newParent.children) {
                throw new Error('无效的移动操作');
            }
            
            // 从原位置移除
            this.removeItemByPath(itemPath);
            
            // 添加到新位置
            if (newIndex >= 0 && newIndex < newParent.children.length) {
                newParent.children.splice(newIndex, 0, item);
            } else {
                newParent.children.push(item);
            }
            
            item.modified = Date.now();
            await this.saveBookmarks();
            this.applyFilters();
            
            return true;
        } catch (error) {
            console.error('移动项目失败:', error);
            throw error;
        }
    }

    // 隐藏/显示项目
    async toggleItemVisibility(itemPath) {
        try {
            const item = this.findItemByPath(itemPath);
            if (!item) {
                throw new Error('找不到指定项目');
            }
            
            item.hidden = !item.hidden;
            item.modified = Date.now();
            
            await this.saveBookmarks();
            this.applyFilters();
            
            return item.hidden;
        } catch (error) {
            console.error('切换可见性失败:', error);
            throw error;
        }
    }

    // 检查链接有效性
    async checkLinkValidity(url) {
        try {
            // 使用 fetch 检查链接（可能会被 CORS 阻止）
            const response = await fetch(url, { 
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache'
            });
            return { valid: true, status: response.status };
        } catch (error) {
            // 如果 fetch 失败，尝试其他方法
            return await this.checkLinkWithImage(url);
        }
    }

    // 使用图片加载检查链接
    async checkLinkWithImage(url) {
        return new Promise((resolve) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                resolve({ valid: false, error: 'timeout' });
            }, 5000);
            
            img.onload = () => {
                clearTimeout(timeout);
                resolve({ valid: true });
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                // 尝试直接访问
                const link = document.createElement('a');
                link.href = url;
                try {
                    // 简单的 URL 格式验证
                    const urlObj = new URL(url);
                    resolve({ valid: urlObj.protocol === 'http:' || urlObj.protocol === 'https:' });
                } catch {
                    resolve({ valid: false, error: 'invalid_url' });
                }
            };
            
            img.src = this.getFaviconUrl(url);
        });
    }

    // 批量检查链接
    async checkAllLinks() {
        const results = [];
        const allBookmarks = this.getAllBookmarks(this.bookmarks);
        
        for (const bookmark of allBookmarks) {
            if (bookmark.url) {
                const result = await this.checkLinkValidity(bookmark.url);
                results.push({
                    bookmark,
                    ...result
                });
            }
        }
        
        return results;
    }

    // 获取所有书签（扁平化）
    getAllBookmarks(bookmarks) {
        const result = [];
        
        bookmarks.forEach(item => {
            if (item.url) {
                result.push(item);
            }
            if (item.children) {
                result.push(...this.getAllBookmarks(item.children));
            }
        });
        
        return result;
    }

    // 获取网站图标
    getFaviconUrl(url) {
        try {
            let host = url;
            if (host.includes('//')) {
                host = host.substring(host.indexOf('//') + 2);
            }
            if (host.includes('/')) {
                host = host.substring(0, host.indexOf('/'));
            }
            
            // 验证主机名格式
            if (!host || host.length === 0 || host.includes(' ')) {
                return this.getDefaultFavicon();
            }
            
            return `https://favicon.pub/api/${encodeURIComponent(host)}`;
        } catch (error) {
            console.warn('获取favicon URL失败:', error);
            return this.getDefaultFavicon();
        }
    }

    // 获取默认图标
    getDefaultFavicon() {
        return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzk5OSIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bS0yIDE1bC01LTUgMS40MS0xLjQxTDEwIDE0LjE3bDcuNTktNy41OUwxOSA4bC05IDl6Ii8+PC9zdmc+';
    }

    // 根据路径查找项目
    findItemByPath(path) {
        if (!path) return null;
        
        const pathParts = path.split('/').filter(part => part.length > 0);
        let current = { children: this.bookmarks };
        
        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            
            if (!current.children) {
                return null;
            }
            
            const found = current.children.find(item => item.title === part);
            if (!found) {
                return null;
            }
            
            current = found;
        }
        
        return current;
    }

    // 根据路径移除项目
    removeItemByPath(path) {
        const pathParts = path.split('/');
        const itemTitle = pathParts.pop();
        const parentPath = pathParts.join('/');
        
        const parent = parentPath ? this.findItemByPath(parentPath) : { children: this.bookmarks };
        if (!parent || !parent.children) return false;
        
        const index = parent.children.findIndex(item => item.title === itemTitle);
        if (index >= 0) {
            parent.children.splice(index, 1);
            return true;
        }
        
        return false;
    }


    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 检查是否为配置项
    isConfigItem(item) {
        return item.url && item.url.startsWith('uiconfig://');
    }

    // 解析配置URL
    parseConfigUrl(url) {
        try {
            const configUrl = new URL(url.replace('uiconfig://', 'config://'));
            const type = configUrl.hostname;
            const params = new URLSearchParams(configUrl.search);
            
            return {
                type,
                params: Object.fromEntries(params.entries())
            };
        } catch (error) {
            console.warn('解析配置URL失败:', url, error);
            return null;
        }
    }

    // 解析所有配置项
    parseConfigItems() {
        this.configCache.clear();
        this.hiddenPassword = null; // 重置密码
        this.processConfigItems(this.bookmarks);
    }

    // 递归处理配置项
    processConfigItems(items) {
        items.forEach(item => {
            if (this.isConfigItem(item)) {
                const config = this.parseConfigUrl(item.url);
                if (config) {
                    this.configCache.set(item.url, config);
                    
                    // 处理特定配置类型
                    this.handleConfigItem(config, item);
                }
            }
            
            if (item.children) {
                this.processConfigItems(item.children);
            }
        });
    }

    // 处理特定配置项
    handleConfigItem(config, item) {
        switch (config.type) {
            case 'hidden':
                if (config.params.pwd) {
                    // 设置隐藏密码
                    this.hiddenPassword = config.params.pwd;
                }
                if (config.params.path) {
                    // 标记指定路径为隐藏
                    this.markItemAsHidden(config.params.path);
                }
                break;
            // 可以添加更多配置类型
        }
    }

    // 标记项目为隐藏
    markItemAsHidden(path) {
        const item = this.findItemByPath(path);
        if (item) {
            item.hidden = true;
        }
    }

    // 检查文件夹是否只包含配置项
    isConfigOnlyFolder(folder) {
        if (!folder.children || folder.children.length === 0) {
            return false;
        }
        
        return folder.children.every(child => {
            if (this.isConfigItem(child)) {
                return true;
            }
            if (child.children) {
                return this.isConfigOnlyFolder(child);
            }
            return false;
        });
    }

    // 获取文件夹图标类型
    getFolderIconType(folder) {
        if (this.isConfigOnlyFolder(folder)) {
            return 'config'; // 配置文件夹
        }
        return 'normal'; // 普通文件夹
    }

    // 获取统计信息
    getStatistics() {
        const allItems = this.getAllItems(this.bookmarks);
        const bookmarks = allItems.filter(item => item.url);
        const folders = allItems.filter(item => item.children);
        const hiddenItems = allItems.filter(item => item.hidden);
        
        return {
            totalItems: allItems.length,
            bookmarks: bookmarks.length,
            folders: folders.length,
            hiddenItems: hiddenItems.length
        };
    }

    // 获取所有项目（包括文件夹）
    getAllItems(bookmarks) {
        const result = [];
        
        bookmarks.forEach(item => {
            result.push(item);
            if (item.children) {
                result.push(...this.getAllItems(item.children));
            }
        });
        
        return result;
    }

    // 导出书签
    exportBookmarks(format = 'json') {
        switch (format) {
            case 'json':
                return JSON.stringify(this.bookmarks, null, 2);
            case 'html':
                return this.exportToHtml();
            default:
                throw new Error('不支持的导出格式');
        }
    }

    // 导出为 HTML 格式
    exportToHtml() {
        const generateHtml = (bookmarks, level = 0) => {
            const indent = '  '.repeat(level);
            let html = `${indent}<DL><p>\n`;
            
            bookmarks.forEach(item => {
                if (item.children) {
                    html += `${indent}  <DT><H3>${item.title}</H3>\n`;
                    html += generateHtml(item.children, level + 1);
                } else {
                    const addDate = item.created ? Math.floor(item.created / 1000) : '';
                    html += `${indent}  <DT><A HREF="${item.url}" ADD_DATE="${addDate}">${item.title}</A>\n`;
                }
            });
            
            html += `${indent}</DL><p>\n`;
            return html;
        };
        
        return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
${generateHtml(this.bookmarks)}`;
    }
}

// 创建全局书签管理器实例
window.bookmarkManager = new BookmarkManager();