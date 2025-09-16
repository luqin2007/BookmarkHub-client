// GitHub API 管理模块
class GitHubManager {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        this.token = null;
        this.gistId = null;
    }

    // 设置认证信息
    setCredentials(token, gistId) {
        this.token = token;
        this.gistId = gistId;
    }

    // 验证 GitHub Token
    async validateToken() {
        if (!this.token) {
            throw new Error('GitHub Token 未设置');
        }

        try {
            const response = await fetch(`${this.baseUrl}/user`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`Token 验证失败: ${response.status}`);
            }

            const user = await response.json();
            return {
                valid: true,
                user: user
            };
        } catch (error) {
            console.error('Token 验证失败:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }

    // 获取 Gist 内容
    async getGistContent() {
        if (!this.token || !this.gistId) {
            throw new Error('GitHub Token 或 Gist ID 未设置');
        }

        try {
            const response = await fetch(`${this.baseUrl}/gists/${this.gistId}`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Gist 不存在或无权限访问');
                }
                throw new Error(`获取 Gist 失败: ${response.status}`);
            }

            const gist = await response.json();
            
            // 查找包含书签数据的文件
            const files = Object.values(gist.files);
            let bookmarkFile = null;
            
            // 获取设置中的文件名
            const settings = window.storageManager.getSettings();
            const expectedFilename = (settings.gistFilename || 'BookmarkHub') + '.json';

            // 优先查找设置中指定的文件名
            bookmarkFile = files.find(file => file.filename === expectedFilename);
            
            // 如果没找到，再按照原来的逻辑查找
            if (!bookmarkFile) {
                bookmarkFile = files.find(file => 
                    file.filename.endsWith('.json') || 
                    file.filename.includes('bookmark') ||
                    file.filename.includes('BookmarkHub')
                );
            }

            // 如果没找到，使用第一个文件
            if (!bookmarkFile && files.length > 0) {
                bookmarkFile = files[0];
            }

            if (!bookmarkFile) {
                throw new Error('Gist 中没有找到有效的文件');
            }

            try {
                const bookmarkData = JSON.parse(bookmarkFile.content);
                return {
                    success: true,
                    data: bookmarkData,
                    filename: bookmarkFile.filename,
                    gist: gist
                };
            } catch (parseError) {
                throw new Error('书签数据格式无效，无法解析 JSON');
            }

        } catch (error) {
            console.error('获取 Gist 内容失败:', error);
            throw error;
        }
    }

    // 更新 Gist 内容
    async updateGistContent(bookmarkData, filename = null) {
        // 如果没有提供文件名，从设置中获取
        if (!filename) {
            const settings = window.storageManager.getSettings();
            filename = (settings.gistFilename || 'BookmarkHub') + '.json';
        }
        if (!this.token || !this.gistId) {
            throw new Error('GitHub Token 或 Gist ID 未设置');
        }

        try {
            const content = JSON.stringify(bookmarkData, null, 2);
            
            const response = await fetch(`${this.baseUrl}/gists/${this.gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        [filename]: {
                            content: content
                        }
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`更新 Gist 失败: ${response.status}`);
            }

            const updatedGist = await response.json();
            return {
                success: true,
                gist: updatedGist
            };

        } catch (error) {
            console.error('更新 Gist 内容失败:', error);
            throw error;
        }
    }

    // 创建新的 Gist
    async createGist(bookmarkData, filename = null, description = 'BookmarkHub 书签数据') {
        // 如果没有提供文件名，从设置中获取
        if (!filename) {
            const settings = window.storageManager.getSettings();
            filename = (settings.gistFilename || 'BookmarkHub') + '.json';
        }
        if (!this.token) {
            throw new Error('GitHub Token 未设置');
        }

        try {
            const content = JSON.stringify(bookmarkData, null, 2);
            
            const response = await fetch(`${this.baseUrl}/gists`, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: description,
                    public: false,
                    files: {
                        [filename]: {
                            content: content
                        }
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`创建 Gist 失败: ${response.status}`);
            }

            const newGist = await response.json();
            this.gistId = newGist.id;
            
            return {
                success: true,
                gist: newGist,
                gistId: newGist.id
            };

        } catch (error) {
            console.error('创建 Gist 失败:', error);
            throw error;
        }
    }

    // 获取用户的所有 Gists
    async getUserGists() {
        if (!this.token) {
            throw new Error('GitHub Token 未设置');
        }

        try {
            const response = await fetch(`${this.baseUrl}/gists`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`获取 Gists 失败: ${response.status}`);
            }

            const gists = await response.json();
            
            // 过滤可能包含书签数据的 Gists
            const bookmarkGists = gists.filter(gist => {
                const description = gist.description?.toLowerCase() || '';
                const filenames = Object.keys(gist.files).join(' ').toLowerCase();
                
                return description.includes('bookmark') || 
                       description.includes('书签') ||
                       filenames.includes('bookmark') ||
                       filenames.includes('.json');
            });

            return {
                success: true,
                gists: bookmarkGists,
                allGists: gists
            };

        } catch (error) {
            console.error('获取 Gists 失败:', error);
            throw error;
        }
    }

    // 检查 Gist 是否存在
    async checkGistExists() {
        if (!this.token || !this.gistId) {
            return false;
        }

        try {
            const response = await fetch(`${this.baseUrl}/gists/${this.gistId}`, {
                method: 'HEAD',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            return response.ok;
        } catch (error) {
            console.error('检查 Gist 存在性失败:', error);
            return false;
        }
    }

    // 解析 BookmarkHub 数据格式
    parseBookmarkHubData(data) {
        try {
            // 验证数据格式
            if (!data || !data.bookmarks || !Array.isArray(data.bookmarks)) {
                throw new Error('无效的 BookmarkHub 数据格式');
            }

            // 提取书签数据
            const bookmarks = data.bookmarks;
            const metadata = {
                browser: data.browser || 'Unknown',
                version: data.version || '0.0.0',
                createDate: data.createDate || Date.now(),
                syncDate: Date.now()
            };

            return {
                success: true,
                bookmarks: bookmarks,
                metadata: metadata
            };

        } catch (error) {
            console.error('解析 BookmarkHub 数据失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 格式化书签数据为 BookmarkHub 格式
    formatToBookmarkHub(bookmarks, metadata = {}) {
        return {
            browser: metadata.browser || navigator.userAgent,
            version: metadata.version || '1.0.0',
            createDate: metadata.createDate || Date.now(),
            bookmarks: bookmarks
        };
    }

    // 同步书签数据
    async syncBookmarks() {
        try {
            // 获取远程数据
            const gistResult = await this.getGistContent();
            const parseResult = this.parseBookmarkHubData(gistResult.data);
            
            if (!parseResult.success) {
                throw new Error(parseResult.error);
            }

            // 保存到本地
            await window.storageManager.saveBookmarks(parseResult.bookmarks);
            
            // 保存元数据
            const settings = window.storageManager.getSettings();
            settings.lastSync = Date.now();
            settings.metadata = parseResult.metadata;
            window.storageManager.saveSettings(settings);

            return {
                success: true,
                bookmarks: parseResult.bookmarks,
                metadata: parseResult.metadata
            };

        } catch (error) {
            console.error('同步书签失败:', error);
            throw error;
        }
    }

    // 上传本地书签到 Gist
    async uploadBookmarks() {
        try {
            // 获取本地书签数据
            const bookmarks = await window.storageManager.getBookmarks();
            const settings = window.storageManager.getSettings();
            
            // 格式化数据
            const bookmarkHubData = this.formatToBookmarkHub(bookmarks, settings.metadata);
            
            // 上传到 Gist
            const result = await this.updateGistContent(bookmarkHubData);
            
            // 更新同步时间
            settings.lastUpload = Date.now();
            window.storageManager.saveSettings(settings);

            return result;

        } catch (error) {
            console.error('上传书签失败:', error);
            throw error;
        }
    }

    // 获取同步状态
    getSyncStatus() {
        const settings = window.storageManager.getSettings();
        return {
            hasCredentials: !!(this.token && this.gistId),
            lastSync: settings.lastSync || null,
            lastUpload: settings.lastUpload || null,
            metadata: settings.metadata || null
        };
    }
}

// 创建全局 GitHub 管理器实例
window.githubManager = new GitHubManager();