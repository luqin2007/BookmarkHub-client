// 本地存储管理模块
class StorageManager {
    constructor() {
        this.dbName = 'BookmarkHubDB';
        this.dbVersion = 1;
        this.db = null;
        this.initDB();
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
                
                // 创建书签存储
                if (!db.objectStoreNames.contains('bookmarks')) {
                    const bookmarkStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
                    bookmarkStore.createIndex('url', 'url', { unique: false });
                    bookmarkStore.createIndex('title', 'title', { unique: false });
                }
                
                // 创建设置存储
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                
                // 创建历史记录存储（用于撤销功能）
                if (!db.objectStoreNames.contains('history')) {
                    const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // 保存设置到 localStorage（敏感信息）
    saveSettings(settings) {
        try {
            localStorage.setItem('bookmarkhub_settings', JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('保存设置失败:', error);
            return false;
        }
    }

    // 获取设置
    getSettings() {
        try {
            const settings = localStorage.getItem('bookmarkhub_settings');
            return settings ? JSON.parse(settings) : {};
        } catch (error) {
            console.error('获取设置失败:', error);
            return {};
        }
    }

    // 保存书签数据到 IndexedDB
    async saveBookmarks(bookmarks) {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['bookmarks'], 'readwrite');
            const store = transaction.objectStore('bookmarks');
            
            // 清空现有数据
            store.clear();
            
            // 保存新数据
            const flatBookmarks = this.flattenBookmarks(bookmarks);
            flatBookmarks.forEach(bookmark => {
                store.add(bookmark);
            });
            
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // 获取书签数据
    async getBookmarks() {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['bookmarks'], 'readonly');
            const store = transaction.objectStore('bookmarks');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const flatBookmarks = request.result;
                const bookmarks = this.reconstructBookmarks(flatBookmarks);
                resolve(bookmarks);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // 扁平化书签数据（用于存储）
    flattenBookmarks(bookmarks, parentId = null, path = '') {
        const result = [];
        
        bookmarks.forEach((item, index) => {
            const id = this.generateId();
            const currentPath = path ? `${path}/${item.title}` : item.title;
            
            // 判断是否为文件夹：有children属性或者没有url属性
            const isFolder = (item.children && Array.isArray(item.children)) || (!item.url && item.title);
            
            const flatItem = {
                id: id,
                title: item.title,
                url: item.url || null,
                parentId: parentId,
                index: index,
                path: currentPath,
                isFolder: isFolder,
                hidden: item.hidden || false,
                dateLastUsed: item.dateLastUsed || null,
                syncing: item.syncing || false,
                folderType: item.folderType || null,
                created: Date.now(),
                modified: Date.now()
            };
            
            result.push(flatItem);
            
            // 如果有子项，递归处理
            if (item.children && Array.isArray(item.children)) {
                result.push(...this.flattenBookmarks(item.children, id, currentPath));
            }
        });
        
        return result;
    }

    // 重构书签树结构
    reconstructBookmarks(flatBookmarks) {
        const itemMap = new Map();
        const rootItems = [];
        
        // 创建项目映射，根据isFolder属性决定是否添加children数组
        flatBookmarks.forEach(item => {
            const reconstructedItem = { ...item };
            
            // 只有文件夹才有children属性
            if (item.isFolder) {
                reconstructedItem.children = [];
            } else {
                // 确保书签没有children属性
                delete reconstructedItem.children;
            }
            
            // 清理存储相关的属性
            delete reconstructedItem.id;
            delete reconstructedItem.parentId;
            delete reconstructedItem.index;
            delete reconstructedItem.path;
            delete reconstructedItem.isFolder;
            
            itemMap.set(item.id, reconstructedItem);
        });
        
        // 构建树结构
        flatBookmarks.forEach(item => {
            const currentItem = itemMap.get(item.id);
            
            if (item.parentId && itemMap.has(item.parentId)) {
                const parent = itemMap.get(item.parentId);
                // 只有文件夹才能包含子项
                if (parent.children) {
                    parent.children.push(currentItem);
                }
            } else {
                rootItems.push(currentItem);
            }
        });
        
        // 按索引排序
        const sortByIndex = (items) => {
            items.sort((a, b) => {
                const aIndex = flatBookmarks.find(f => itemMap.get(f.id) === a)?.index || 0;
                const bIndex = flatBookmarks.find(f => itemMap.get(f.id) === b)?.index || 0;
                return aIndex - bIndex;
            });
            
            items.forEach(item => {
                if (item.children && item.children.length > 0) {
                    sortByIndex(item.children);
                }
            });
        };
        
        sortByIndex(rootItems);
        return rootItems;
    }

    // 搜索书签
    async searchBookmarks(query) {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['bookmarks'], 'readonly');
            const store = transaction.objectStore('bookmarks');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const bookmarks = request.result;
                const results = bookmarks.filter(bookmark => {
                    const titleMatch = bookmark.title.toLowerCase().includes(query.toLowerCase());
                    const urlMatch = bookmark.url && bookmark.url.toLowerCase().includes(query.toLowerCase());
                    return titleMatch || urlMatch;
                });
                resolve(results);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // 保存操作历史（用于撤销）
    async saveHistory(action, data) {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['history'], 'readwrite');
            const store = transaction.objectStore('history');
            
            const historyItem = {
                action: action,
                data: data,
                timestamp: Date.now()
            };
            
            const request = store.add(historyItem);
            
            request.onsuccess = () => {
                // 只保留最近50条历史记录
                this.cleanupHistory();
                resolve(request.result);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // 获取最近的历史记录
    async getLatestHistory() {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['history'], 'readonly');
            const store = transaction.objectStore('history');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');
            
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    resolve(cursor.value);
                } else {
                    resolve(null);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // 删除历史记录
    async deleteHistory(id) {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['history'], 'readwrite');
            const store = transaction.objectStore('history');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // 清理旧的历史记录
    async cleanupHistory() {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['history'], 'readwrite');
            const store = transaction.objectStore('history');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');
            
            let count = 0;
            const maxHistory = 50;
            
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    count++;
                    if (count > maxHistory) {
                        cursor.delete();
                    }
                    cursor.continue();
                } else {
                    resolve(true);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 导出数据
    async exportData() {
        const bookmarks = await this.getBookmarks();
        const settings = this.getSettings();
        
        return {
            bookmarks: bookmarks,
            settings: settings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
    }

    // 导入数据
    async importData(data) {
        try {
            if (data.bookmarks) {
                await this.saveBookmarks(data.bookmarks);
            }
            
            if (data.settings) {
                this.saveSettings(data.settings);
            }
            
            return true;
        } catch (error) {
            console.error('导入数据失败:', error);
            return false;
        }
    }

    // 清空所有数据
    async clearAllData() {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['bookmarks', 'history'], 'readwrite');
            
            transaction.objectStore('bookmarks').clear();
            transaction.objectStore('history').clear();
            
            transaction.oncomplete = () => {
                localStorage.removeItem('bookmarkhub_settings');
                resolve(true);
            };
            
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

// 创建全局存储管理器实例
window.storageManager = new StorageManager();