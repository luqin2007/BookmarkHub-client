// UI 管理模块
class UIManager {
    constructor() {
        this.notifications = [];
        this.expandedFolders = new Set();
        this.currentSelectedFolder = null;
        this.currentFolderContent = null;
        this.currentFolderPath = ''; // 当前文件夹的完整路径
    }

    // 初始化 UI
    init() {
        this.bindEvents();
        this.loadExpandedState();
        this.initRouting();
    }

    // 绑定事件
    bindEvents() {
        // 设置按钮
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showSettingsPanel();
        });

        document.getElementById('open-settings').addEventListener('click', () => {
            this.showSettingsPanel();
        });

        // 设置面板
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('sync-bookmarks').addEventListener('click', () => {
            this.syncBookmarks();
        });

        document.getElementById('close-settings').addEventListener('click', () => {
            this.hideSettingsPanel();
        });

        // 搜索
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        document.getElementById('clear-search').addEventListener('click', () => {
            this.clearSearch();
        });

        // 工具栏按钮
        document.getElementById('show-hidden').addEventListener('click', () => {
            this.toggleHiddenItems();
        });

        document.getElementById('check-links').addEventListener('click', () => {
            this.checkAllLinks();
        });


        // 密码面板
        document.getElementById('verify-password').addEventListener('click', () => {
            this.verifyPassword();
        });

        document.getElementById('cancel-password').addEventListener('click', () => {
            this.hidePasswordPanel();
        });




        // 键盘快捷键 - 暂时禁用
        // document.addEventListener('keydown', (e) => {
        //     this.handleKeyboard(e);
        // });

        // URL hash 变化监听
        window.addEventListener('hashchange', () => {
            this.handleRouteChange();
        });

    }

    // 初始化路由
    initRouting() {
        this.handleRouteChange();
    }

    // 处理路由变化
    handleRouteChange() {
        const hash = window.location.hash;
        if (hash.startsWith('#/')) {
            const path = decodeURIComponent(hash.substring(2));
            this.navigateToPath(path);
        } else {
            this.navigateToPath('');
        }
    }

    // 更新URL
    updateURL(path) {
        const newHash = path ? `#/${encodeURIComponent(path)}` : '';
        if (window.location.hash !== newHash) {
            window.location.hash = newHash;
        }
    }

    // 导航到指定路径
    navigateToPath(path) {
        this.currentFolderPath = path;
        
        if (!path) {
            // 根目录
            this.currentSelectedFolder = null;
            this.currentFolderContent = null;
        } else {
            // 根据路径找到对应的文件夹
            const folder = this.findFolderByPath(window.bookmarkManager.filteredBookmarks, path);
            if (folder) {
                this.currentSelectedFolder = folder.title;
                this.currentFolderContent = folder.children || [];
            } else {
                // 路径无效，回到根目录
                this.currentFolderPath = '';
                this.currentSelectedFolder = null;
                this.currentFolderContent = null;
                this.updateURL('');
            }
        }
        
        // 重新渲染界面
        this.renderBookmarks();
        
        // 更新文件夹树选中状态
        this.updateFolderTreeSelection();
    }

    // 根据路径查找文件夹
    findFolderByPath(bookmarks, path) {
        if (!path) return null;
        
        const pathParts = path.split('/');
        let current = bookmarks;
        let currentFolder = null;
        
        for (const encodedPart of pathParts) {
            // 解码路径部分
            const part = this.decodeFolderName(encodedPart);
            const found = current.find(item => item.title === part && item.children);
            if (!found) return null;
            
            currentFolder = found;
            current = found.children;
        }
        
        return currentFolder;
    }

    // 获取当前路径的父路径
    getParentFolderPath() {
        if (!this.currentFolderPath) return '';
        
        const pathParts = this.currentFolderPath.split('/');
        pathParts.pop();
        return pathParts.join('/');
    }

    // 编码文件夹名称，避免路径分隔符冲突
    encodeFolderName(name) {
        return encodeURIComponent(name);
    }

    // 解码文件夹名称
    decodeFolderName(encodedName) {
        return decodeURIComponent(encodedName);
    }

    // 显示设置面板
    showSettingsPanel() {
        const panel = document.getElementById('settings-panel');
        const settings = window.storageManager.getSettings();
        
        document.getElementById('github-token').value = settings.githubToken || '';
        document.getElementById('gist-id').value = settings.gistId || '';
        document.getElementById('gist-filename').value = settings.gistFilename || 'BookmarkHub';
        document.getElementById('load-favicons').checked = settings.loadFavicons !== false; // 默认启用
        
        panel.classList.remove('hidden');
    }

    // 隐藏设置面板
    hideSettingsPanel() {
        document.getElementById('settings-panel').classList.add('hidden');
    }

    // 保存设置
    async saveSettings() {
        try {
            const token = document.getElementById('github-token').value.trim();
            const gistId = document.getElementById('gist-id').value.trim();
            const gistFilename = document.getElementById('gist-filename').value.trim() || 'BookmarkHub';

            if (!token || !gistId) {
                this.showNotification('请填写 GitHub Token 和 Gist ID', 'error');
                return;
            }

            // 验证 GitHub Token
            window.githubManager.setCredentials(token, gistId);
            const validation = await window.githubManager.validateToken();
            
            if (!validation.valid) {
                this.showNotification('GitHub Token 验证失败: ' + validation.error, 'error');
                return;
            }

            // 保存设置
            const loadFavicons = document.getElementById('load-favicons').checked;
            const settings = {
                githubToken: token,
                gistId: gistId,
                gistFilename: gistFilename,
                loadFavicons: loadFavicons,
                lastSaved: Date.now()
            };

            window.storageManager.saveSettings(settings);
            this.showNotification('设置保存成功', 'success');
            this.hideSettingsPanel();

        } catch (error) {
            console.error('保存设置失败:', error);
            this.showNotification('保存设置失败: ' + error.message, 'error');
        }
    }

    // 同步书签
    async syncBookmarks() {
        try {
            this.showLoading(true);
            
            const settings = window.storageManager.getSettings();
            if (!settings.githubToken || !settings.gistId) {
                this.showNotification('请先配置 GitHub Token 和 Gist ID', 'error');
                return;
            }

            window.githubManager.setCredentials(settings.githubToken, settings.gistId);
            const result = await window.githubManager.syncBookmarks();
            
            await window.bookmarkManager.loadBookmarks();
            this.renderBookmarks();
            
            this.showNotification('书签同步成功', 'success');
            this.hideSettingsPanel();

        } catch (error) {
            console.error('同步书签失败:', error);
            this.showNotification('同步书签失败: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // 处理搜索
    async handleSearch(query) {
        try {
            const clearBtn = document.getElementById('clear-search');
            
            if (query.trim()) {
                clearBtn.classList.remove('hidden');
                await window.bookmarkManager.searchBookmarks(query);
            } else {
                clearBtn.classList.add('hidden');
                await window.bookmarkManager.searchBookmarks('');
            }
            
            this.renderBookmarks();
        } catch (error) {
            console.error('搜索失败:', error);
        }
    }

    // 清除搜索
    clearSearch() {
        document.getElementById('search-input').value = '';
        document.getElementById('clear-search').classList.add('hidden');
        this.handleSearch('');
    }

    // 切换隐藏项显示
    async toggleHiddenItems() {
        try {
            const btn = document.getElementById('show-hidden');
            const isShowing = btn.classList.contains('active');
            
            if (!isShowing) {
                // 需要密码验证
                if (window.bookmarkManager.hiddenPassword) {
                    this.showPasswordPanel();
                    return;
                }
            }
            
            btn.classList.toggle('active');
            await window.bookmarkManager.toggleHiddenItems(!isShowing);
            this.renderBookmarks();
            
            this.showNotification(isShowing ? '隐藏项已隐藏' : '隐藏项已显示', 'success');
        } catch (error) {
            console.error('切换隐藏项失败:', error);
        }
    }

    // 显示密码面板
    showPasswordPanel() {
        document.getElementById('password-panel').classList.remove('hidden');
        document.getElementById('password-input').focus();
    }

    // 隐藏密码面板
    hidePasswordPanel() {
        document.getElementById('password-panel').classList.add('hidden');
        document.getElementById('password-input').value = '';
    }

    // 验证密码
    verifyPassword() {
        const password = document.getElementById('password-input').value;
        const correctPassword = window.bookmarkManager.hiddenPassword;
        
        if (password === correctPassword) {
            this.hidePasswordPanel();
            document.getElementById('show-hidden').classList.add('active');
            window.bookmarkManager.toggleHiddenItems(true);
            this.renderBookmarks();
            this.showNotification('密码正确，已显示隐藏项', 'success');
        } else {
            this.showNotification('密码错误', 'error');
            document.getElementById('password-input').value = '';
        }
    }

    // 检查所有链接
    async checkAllLinks() {
        try {
            this.showLoading(true, '正在检查链接...');
            
            const results = await window.bookmarkManager.checkAllLinks();
            const invalidLinks = results.filter(r => !r.valid);
            
            if (invalidLinks.length === 0) {
                this.showNotification('所有链接都有效', 'success');
            } else {
                this.showNotification(`发现 ${invalidLinks.length} 个无效链接`, 'warning');
                this.highlightInvalidLinks(invalidLinks);
            }
            
        } catch (error) {
            console.error('检查链接失败:', error);
            this.showNotification('检查链接失败: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // 高亮无效链接
    highlightInvalidLinks(invalidLinks) {
        const invalidUrls = new Set(invalidLinks.map(r => r.bookmark.url));
        
        document.querySelectorAll('.bookmark-item').forEach(item => {
            const url = item.dataset.url;
            if (invalidUrls.has(url)) {
                item.classList.add('invalid-link');
            }
        });
    }




    // 渲染书签
    renderBookmarks() {
        const container = document.getElementById('bookmarks-tree');
        const emptyState = document.getElementById('empty-state');
        
        const bookmarks = window.bookmarkManager.filteredBookmarks;
        
        if (!bookmarks || bookmarks.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'flex';
            this.renderFolderTree([]);
            this.renderNavigation([], []);
            return;
        }
        
        emptyState.style.display = 'none';
        
        // 渲染左侧文件夹树
        this.renderFolderTree(bookmarks);
        
        // 渲染右侧导航 - 显示当前选中文件夹的子目录
        const currentFolderContent = this.currentFolderContent || bookmarks;
        this.renderNavigation(bookmarks, currentFolderContent);
        
        // 渲染主内容区（只显示书签，不显示子目录）
        container.innerHTML = this.renderBookmarksOnly(currentFolderContent);
        
        // 绑定事件
        this.bindBookmarkEvents();
    }

    // 渲染左侧文件夹树
    renderFolderTree(bookmarks) {
        const container = document.getElementById('folder-tree');
        if (!container) return;
        
        const folders = this.extractFolders(bookmarks);
        container.innerHTML = folders.map(folder => this.renderFolderTreeItem(folder, 0)).join('');
        
        // 绑定文件夹树事件
        this.bindFolderTreeEvents();
    }
    
    // 提取文件夹结构
    extractFolders(bookmarks, level = 0, parentPath = '') {
        const folders = [];
        
        bookmarks.forEach(item => {
            if (item.children && Array.isArray(item.children)) {
                // 对文件夹名称进行编码，避免路径分隔符冲突
                const encodedTitle = this.encodeFolderName(item.title);
                const currentPath = parentPath ? `${parentPath}/${encodedTitle}` : encodedTitle;
                const folderItem = {
                    title: item.title,
                    path: currentPath,
                    count: this.countAllItems(item.children),
                    level: level,
                    children: this.extractFolders(item.children, level + 1, currentPath)
                };
                folders.push(folderItem);
            }
        });
        
        return folders;
    }
    
    // 计算文件夹内所有项目数量
    countAllItems(items) {
        let count = 0;
        items.forEach(item => {
            count++;
            if (item.children && Array.isArray(item.children)) {
                count += this.countAllItems(item.children);
            }
        });
        return count;
    }
    
    // 渲染文件夹树项
    renderFolderTreeItem(folder, level) {
        const isExpanded = this.expandedFolders.has(folder.title);
        const activeClass = this.currentSelectedFolder === folder.title ? 'active' : '';
        const hasChildren = folder.children && folder.children.length > 0;
        const childrenClass = hasChildren ? 'has-children' : '';
        
        // 检查是否为配置文件夹
        const folderData = this.findFolderByTitle(window.bookmarkManager.filteredBookmarks, folder.title);
        const isConfigFolder = folderData && window.bookmarkManager.isConfigOnlyFolder(folderData);
        const folderIcon = isConfigFolder ? 'fa-cog' : (hasChildren ? (isExpanded ? 'fa-folder-open' : 'fa-folder') : 'fa-folder');
        
        let html = `
            <div class="folder-tree-item ${activeClass} ${childrenClass}" 
                 data-folder-title="${folder.title}" 
                 data-path="${folder.path}"
                 style="padding-left: ${level * 0.5}rem">
                <i class="fas ${folderIcon}"></i>
                <span class="folder-name">${folder.title}</span>
                <span class="folder-count">${folder.count}</span>
            </div>
        `;
        
        if (hasChildren && isExpanded) {
            html += `<div class="folder-tree-children">`;
            html += folder.children.map(child => this.renderFolderTreeItem(child, level + 1)).join('');
            html += `</div>`;
        }
        
        return html;
    }
    
    // 渲染右侧导航
    renderNavigation(bookmarks, currentFolderContent) {
        this.renderSubdirsNav(currentFolderContent);
    }
    
    
    // 渲染子目录导航
    renderSubdirsNav(items) {
        const container = document.getElementById('subdirs-nav');
        const navSection = container.parentElement;
        const header = navSection.querySelector('h4');
        
        if (!container) return;
        
        // 恢复原来的标题
        header.innerHTML = '<i class="fas fa-folder-open"></i> 子目录';
        
        const folders = items.filter(item => item.children && Array.isArray(item.children));
        
        // 添加返回上级目录选项
        let navItems = '';
        if (this.currentFolderPath) {
            navItems += `
                <div class="nav-item back-to-parent" data-folder-title="..">
                    <i class="fas fa-level-up-alt"></i>
                    <span>..</span>
                </div>
            `;
        }
        
        navItems += folders.map(folder => {
            // 检查是否为配置文件夹
            const isConfigFolder = window.bookmarkManager.isConfigOnlyFolder(folder);
            const folderIcon = isConfigFolder ? 'fa-cog' : 'fa-folder';
            
            return `
                <div class="nav-item" data-folder-title="${folder.title}" data-path="${this.currentFolderPath ? this.currentFolderPath + '/' + this.encodeFolderName(folder.title) : this.encodeFolderName(folder.title)}">
                    <i class="fas ${folderIcon}"></i>
                    <span>${folder.title}</span>
                    <span class="folder-count">${folder.children.length}</span>
                </div>
            `;
        }).join('');
        
        container.innerHTML = navItems;
        
        // 绑定子目录导航事件
        container.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const folderTitle = item.dataset.folderTitle;
                if (folderTitle === '..') {
                    // 返回上级目录
                    this.goToParentFolder();
                } else {
                    this.selectFolder(folderTitle);
                }
            });
        });
    }
    
    // 选择文件夹
    selectFolder(folderTitle) {
        // 编码文件夹名称并构建新的路径
        const encodedTitle = this.encodeFolderName(folderTitle);
        const newPath = this.currentFolderPath ? `${this.currentFolderPath}/${encodedTitle}` : encodedTitle;
        
        // 更新URL并导航
        this.updateURL(newPath);
    }
    
    // 返回上级目录
    goToParentFolder() {
        const parentPath = this.getParentFolderPath();
        this.updateURL(parentPath);
    }
    
    // 根据标题查找文件夹
    findFolderByTitle(bookmarks, title) {
        for (const item of bookmarks) {
            if (item.title === title && item.children) {
                return item;
            }
            if (item.children) {
                const found = this.findFolderByTitle(item.children, title);
                if (found) return found;
            }
        }
        return null;
    }
    
    // 更新文件夹树选中状态
    updateFolderTreeSelection() {
        document.querySelectorAll('.folder-tree-item').forEach(item => {
            const folderPath = item.dataset.path;
            if (folderPath === this.currentFolderPath) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    // 绑定文件夹树事件
    bindFolderTreeEvents() {
        document.querySelectorAll('.folder-tree-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const folderTitle = item.dataset.folderTitle;
                const folderPath = item.dataset.path;
                
                // 如果有子文件夹，切换展开状态
                if (item.classList.contains('has-children')) {
                    this.toggleFolder(folderTitle);
                }
                
                // 导航到文件夹路径
                this.updateURL(folderPath);
            });
        });
    }

    // 只渲染书签（不显示子目录）
    renderBookmarksOnly(items, level = 0, parentPath = '') {
        const bookmarks = [];
        
        // 递归提取所有书签，保持正确的路径
        const extractBookmarks = (items, currentLevel = 0, currentPath = '') => {
            items.forEach(item => {
                if (item.url) {
                    // 这是一个书签，使用getItemPath方法获取正确路径
                    const itemPath = this.getItemPath(item);
                    bookmarks.push(this.renderBookmarkWithPath(item, currentLevel, itemPath));
                } else if (item.children && Array.isArray(item.children)) {
                    // 这是一个文件夹，递归提取其中的书签
                    extractBookmarks(item.children, currentLevel);
                }
            });
        };
        
        extractBookmarks(items, level);
        return bookmarks.join('');
    }
    
    // 渲染书签（带指定路径）
    renderBookmarkWithPath(bookmark, level, itemPath) {
        const hiddenClass = bookmark.hidden ? 'hidden-item' : '';
        const safeUrl = bookmark.url.replace(/'/g, '&apos;');
        const safeTitle = bookmark.title.replace(/'/g, '&apos;').replace(/"/g, '&quot;');
        const safePath = itemPath.replace(/'/g, '&apos;');
        
        // 检查是否为配置项
        const isConfig = window.bookmarkManager.isConfigItem(bookmark);
        const configClass = isConfig ? 'config-item' : '';
        
        // 配置项使用齿轮图标，普通书签使用网站图标
        const defaultFavicon = window.bookmarkManager.getDefaultFavicon();
        const faviconElement = isConfig ? 
            '<i class="fas fa-cog bookmark-favicon config-favicon"></i>' :
            `<img class="bookmark-favicon" 
                 src="${defaultFavicon}" 
                 alt="favicon"
                 data-original-url="${bookmark.url}">`;
        
        return `
            <div class="bookmark-item ${hiddenClass} ${configClass}" 
                 style="margin-left: ${level * 20}px"
                 data-path="${safePath}"
                 data-url="${bookmark.url}"
                 data-is-config="${isConfig}">
                ${faviconElement}
                <div class="bookmark-info">
                    <div class="bookmark-title">${safeTitle}</div>
                    ${isConfig ? '' : `<div class="bookmark-url">${bookmark.url}</div>`}
                </div>
                ${!isConfig ? `
                <div class="bookmark-actions">
                    <button class="bookmark-action" title="新标签页打开" data-action="open-new">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                </div>
                ` : ''}
                ${bookmark.hidden ? '<div class="hidden-indicator">隐藏</div>' : ''}
            </div>
        `;
    }

    // 渲染书签树（保留原有功能，用于其他地方）
    renderBookmarkTree(bookmarks, level = 0) {
        return bookmarks.map(item => {
            // 判断是否为文件夹：有children属性且children是数组，或者有url属性则为书签
            const isFolder = (item.children && Array.isArray(item.children)) || (!item.url && !item.children);
            
            if (isFolder && item.children) {
                return this.renderFolder(item, level);
            } else if (item.url) {
                return this.renderBookmark(item, level);
            } else {
                // 空文件夹的情况
                return this.renderFolder({...item, children: []}, level);
            }
        }).join('');
    }

    // 渲染文件夹
    renderFolder(folder, level) {
        const isExpanded = this.expandedFolders.has(folder.title);
        const hiddenClass = folder.hidden ? 'hidden-item' : '';
        const expandedClass = isExpanded ? 'expanded' : '';
        const collapsedClass = isExpanded ? '' : 'collapsed';
        const itemPath = this.getItemPath(folder);
        const safeTitle = folder.title.replace(/'/g, '&apos;').replace(/"/g, '&quot;');
        
        return `
            <div class="folder" style="margin-left: ${level * 20}px">
                <div class="folder-header ${hiddenClass}" 
                     data-path="${itemPath}"
                     data-folder-title="${folder.title}">
                    <input type="checkbox" class="item-checkbox" data-path="${itemPath}">
                    <i class="fas fa-chevron-right folder-icon ${expandedClass}"></i>
                    <span class="folder-title">${safeTitle}</span>
                    <span class="folder-count">${folder.children ? folder.children.length : 0}</span>
                    ${folder.hidden ? '<div class="hidden-indicator">隐藏</div>' : ''}
                </div>
                <div class="folder-content ${collapsedClass}">
                    ${folder.children ? this.renderBookmarkTree(folder.children, level + 1) : ''}
                </div>
            </div>
        `;
    }

    // 渲染书签
    renderBookmark(bookmark, level) {
        const hiddenClass = bookmark.hidden ? 'hidden-item' : '';
        const itemPath = this.getItemPath(bookmark);
        const safeUrl = bookmark.url.replace(/'/g, '&apos;');
        const safeTitle = bookmark.title.replace(/'/g, '&apos;').replace(/"/g, '&quot;');
        const safePath = itemPath.replace(/'/g, '&apos;');
        
        // 检查是否为配置项
        const isConfig = window.bookmarkManager.isConfigItem(bookmark);
        const configClass = isConfig ? 'config-item' : '';
        
        // 配置项使用齿轮图标，普通书签使用网站图标
        const defaultFavicon = window.bookmarkManager.getDefaultFavicon();
        const faviconElement = isConfig ? 
            '<i class="fas fa-cog bookmark-favicon config-favicon"></i>' :
            `<img class="bookmark-favicon" 
                 src="${defaultFavicon}" 
                 alt="favicon"
                 data-original-url="${bookmark.url}">`;
        
        return `
            <div class="bookmark-item ${hiddenClass} ${configClass}" 
                 style="margin-left: ${level * 20}px"
                 data-path="${itemPath}"
                 data-url="${bookmark.url}"
                 data-is-config="${isConfig}">
                ${faviconElement}
                <div class="bookmark-info">
                    <div class="bookmark-title">${safeTitle}</div>
                    ${isConfig ? '' : `<div class="bookmark-url">${bookmark.url}</div>`}
                </div>
                ${!isConfig ? `
                <div class="bookmark-actions">
                    <button class="bookmark-action" title="新标签页打开" data-action="open-new">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                </div>
                ` : ''}
                ${bookmark.hidden ? '<div class="hidden-indicator">隐藏</div>' : ''}
            </div>
        `;
    }

    // 获取项目路径
    getItemPath(item, bookmarks = null, currentPath = '') {
        if (!bookmarks) {
            bookmarks = window.bookmarkManager.bookmarks || window.bookmarkManager.filteredBookmarks;
        }
        
        // 在当前层级查找项目
        for (const bookmark of bookmarks) {
            const itemPath = currentPath ? `${currentPath}/${bookmark.title}` : bookmark.title;
            
            // 精确匹配：标题相同且类型匹配
            if (bookmark.title === item.title) {
                // 如果是书签，检查URL匹配
                if (item.url && bookmark.url && bookmark.url === item.url) {
                    return itemPath;
                }
                // 如果是文件夹，检查都有children属性
                if (!item.url && !bookmark.url && bookmark.children !== undefined) {
                    return itemPath;
                }
                // 如果只有标题匹配且没有其他区分特征
                if (!item.url && !bookmark.url && bookmark.children === undefined) {
                    return itemPath;
                }
            }
            
            // 递归搜索子文件夹
            if (bookmark.children && bookmark.children.length > 0) {
                const foundPath = this.getItemPath(item, bookmark.children, itemPath);
                if (foundPath) {
                    return foundPath;
                }
            }
        }
        
        // 如果没找到，返回标题作为后备
        return item.title;
    }

    // 绑定书签事件
    bindBookmarkEvents() {
        // 书签项点击事件
        document.querySelectorAll('.bookmark-item').forEach(item => {
            // 单击打开书签
            item.addEventListener('click', (e) => {
                // 忽略图标和按钮点击
                if (e.target.closest('.bookmark-action') || e.target.closest('.selectable-icon')) return;
                e.stopPropagation();
                
                // 配置项不响应点击
                const isConfig = item.dataset.isConfig === 'true';
                if (isConfig) return;
                
                const url = item.dataset.url;
                if (url) {
                    // 默认新窗口打开，Ctrl+点击当前窗口打开
                    if (e.ctrlKey || e.metaKey) {
                        window.open(url, '_self');
                    } else {
                        window.open(url, '_blank');
                    }
                }
            });
            
        });
        
        // 文件夹头部点击事件
        document.querySelectorAll('.folder-header').forEach(item => {
            // 单击展开/折叠
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const folderTitle = item.dataset.folderTitle;
                if (folderTitle) {
                    this.toggleFolder(folderTitle);
                }
            });
        });
        
        // 书签操作按钮事件
        document.querySelectorAll('.bookmark-action').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookmarkItem = e.target.closest('.bookmark-item');
                const url = bookmarkItem.dataset.url;
                const action = button.dataset.action;
                
                switch (action) {
                    case 'open-new':
                        if (url) window.open(url, '_blank');
                        break;
                }
            });
        });
        
        // 可选的图标加载
        this.loadFaviconsIfEnabled();
    }

    // 切换文件夹展开状态
    toggleFolder(folderTitle) {
        if (this.expandedFolders.has(folderTitle)) {
            this.expandedFolders.delete(folderTitle);
        } else {
            this.expandedFolders.add(folderTitle);
        }
        
        this.saveExpandedState();
        this.renderBookmarks();
    }

    // 打开书签
    openBookmark(url) {
        window.open(url, '_self');
    }

    // 保存展开状态
    saveExpandedState() {
        const settings = window.storageManager.getSettings();
        settings.expandedFolders = Array.from(this.expandedFolders);
        window.storageManager.saveSettings(settings);
    }

    // 加载展开状态
    loadExpandedState() {
        const settings = window.storageManager.getSettings();
        if (settings.expandedFolders) {
            this.expandedFolders = new Set(settings.expandedFolders);
        }
    }

    // 显示加载状态
    showLoading(show, message = '加载中...') {
        const loading = document.getElementById('loading');
        const loadingText = loading.querySelector('span');
        
        if (show) {
            loadingText.textContent = message;
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    // 显示通知
    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(notification);
        
        // 自动移除
        setTimeout(() => {
            notification.remove();
        }, 5000);
        
        // 点击移除
        notification.addEventListener('click', () => {
            notification.remove();
        });
    }

    // 获取通知图标
    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }

    // 可选的图标加载
    loadFaviconsIfEnabled() {
        const settings = window.storageManager.getSettings();
        if (settings.loadFavicons !== false) { // 默认启用
            this.loadFavicons();
        }
    }

    // 异步加载网站图标
    async loadFavicons() {
        const faviconImages = document.querySelectorAll('.bookmark-favicon[data-original-url]');
        
        // 限制并发请求数量
        const batchSize = 5;
        const batches = [];
        
        for (let i = 0; i < faviconImages.length; i += batchSize) {
            batches.push(Array.from(faviconImages).slice(i, i + batchSize));
        }
        
        // 逐批加载图标
        for (const batch of batches) {
            await Promise.allSettled(batch.map(img => this.loadSingleFavicon(img)));
            // 批次间稍作延迟，避免过于频繁的请求
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // 加载单个图标
    async loadSingleFavicon(imgElement) {
        return new Promise((resolve) => {
            const originalUrl = imgElement.dataset.originalUrl;
            if (!originalUrl) {
                resolve();
                return;
            }

            const faviconUrl = window.bookmarkManager.getFaviconUrl(originalUrl);
            const testImg = new Image();
            
            // 设置超时
            const timeout = setTimeout(() => {
                resolve(); // 超时时保持默认图标
            }, 3000);

            testImg.onload = () => {
                clearTimeout(timeout);
                imgElement.src = faviconUrl;
                imgElement.classList.add('favicon-loaded');
                resolve();
            };

            testImg.onerror = () => {
                clearTimeout(timeout);
                // 保持默认图标，不输出错误信息
                resolve();
            };

            // 静默加载，不在控制台显示错误
            testImg.src = faviconUrl;
        });
    }

    // 切换图标加载设置
    toggleFaviconLoading() {
        const settings = window.storageManager.getSettings();
        settings.loadFavicons = !settings.loadFavicons;
        window.storageManager.saveSettings(settings);
        
        if (settings.loadFavicons) {
            this.loadFavicons();
            this.showNotification('已启用网站图标加载', 'success');
        } else {
            // 重置所有图标为默认图标
            document.querySelectorAll('.bookmark-favicon').forEach(img => {
                img.src = window.bookmarkManager.getDefaultFavicon();
                img.classList.remove('favicon-loaded');
            });
            this.showNotification('已禁用网站图标加载', 'success');
        }
    }


}

// 创建全局 UI 管理器实例
window.uiManager = new UIManager();