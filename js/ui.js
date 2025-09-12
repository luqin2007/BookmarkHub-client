// UI 管理模块
class UIManager {
    constructor() {
        this.currentEditingItem = null;
        this.contextMenuTarget = null;
        this.notifications = [];
        this.expandedFolders = new Set();
        this.selectedItems = new Set();
        this.draggedItem = null;
        this.dropZone = null;
        this.clipboard = null;
        this.clipboardAction = null; // 'cut' or 'copy'
        this.batchMode = false;
        this.currentSelectedFolder = null;
        this.currentFolderContent = null;
        this.currentFolderPath = ''; // 当前文件夹的完整路径
    }

    // 初始化 UI
    init() {
        this.bindEvents();
        this.loadExpandedState();
        this.updateUndoButton();
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

        document.getElementById('undo-action').addEventListener('click', () => {
            this.undoLastAction();
        });

        // 密码面板
        document.getElementById('verify-password').addEventListener('click', () => {
            this.verifyPassword();
        });

        document.getElementById('cancel-password').addEventListener('click', () => {
            this.hidePasswordPanel();
        });


        // 全局事件
        document.addEventListener('click', (e) => {
            this.hideContextMenu();
        });

        document.addEventListener('contextmenu', (e) => {
            const target = e.target.closest('.bookmark-item') || e.target.closest('.folder-header');
            if (target) {
                e.preventDefault();
                this.showContextMenu(e);
            }
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });

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
        document.getElementById('hidden-password').value = settings.hiddenPassword || '';
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
            const password = document.getElementById('hidden-password').value;

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
                hiddenPassword: password,
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
                const settings = window.storageManager.getSettings();
                if (settings.hiddenPassword) {
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
        const settings = window.storageManager.getSettings();
        
        if (password === settings.hiddenPassword) {
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

    // 撤销最后操作
    async undoLastAction() {
        try {
            const result = await window.bookmarkManager.undo();
            this.renderBookmarks();
            this.updateUndoButton();
            this.showNotification('操作已撤销', 'success');
        } catch (error) {
            console.error('撤销失败:', error);
            this.showNotification('撤销失败: ' + error.message, 'error');
        }
    }

    // 更新撤销按钮状态
    updateUndoButton() {
        const btn = document.getElementById('undo-action');
        btn.disabled = window.bookmarkManager.undoStack.length === 0;
    }

    // 显示右键菜单
    showContextMenu(event) {
        const menu = document.getElementById('context-menu');
        const target = event.target.closest('.bookmark-item, .folder-header');
        
        if (!target) return;
        
        this.contextMenuTarget = target;
        
        // 根据目标类型调整菜单项
        const isFolder = target.classList.contains('folder-header');
        const hasUrl = !!target.dataset.url;
        
        // 显示/隐藏相关菜单项
        this.toggleMenuItem(menu, 'open', hasUrl);
        this.toggleMenuItem(menu, 'open-new-tab', hasUrl);
        this.toggleMenuItem(menu, 'copy-url', hasUrl);
        
        // 检查剪贴板状态
        const canPaste = this.clipboard && (isFolder || this.getParentPath(target.dataset.path));
        this.toggleMenuItem(menu, 'paste', canPaste);
        
        // 清除之前的事件监听器
        menu.querySelectorAll('.menu-item').forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
        });
        
        // 重新绑定菜单项事件
        menu.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleContextMenuAction(item.dataset.action);
            });
        });
        
        // 计算菜单位置，确保不超出屏幕
        const menuRect = menu.getBoundingClientRect();
        let x = event.pageX;
        let y = event.pageY;
        
        // 防止菜单超出右边界
        if (x + 200 > window.innerWidth) {
            x = window.innerWidth - 200;
        }
        
        // 防止菜单超出下边界
        if (y + 300 > window.innerHeight) {
            y = window.innerHeight - 300;
        }
        
        // 显示菜单
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.remove('hidden');
    }

    // 切换菜单项显示状态
    toggleMenuItem(menu, action, show) {
        const item = menu.querySelector(`[data-action="${action}"]`);
        if (item) {
            item.style.display = show ? 'flex' : 'none';
        }
    }

    // 隐藏右键菜单
    hideContextMenu() {
        document.getElementById('context-menu').classList.add('hidden');
        this.contextMenuTarget = null;
    }

    // 处理右键菜单操作
    async handleContextMenuAction(action) {
        if (!this.contextMenuTarget) return;
        
        const itemPath = this.contextMenuTarget.dataset.path;
        const url = this.contextMenuTarget.dataset.url;
        const isFolder = this.contextMenuTarget.classList.contains('folder-header');
        
        try {
            switch (action) {
                case 'open':
                    if (url) window.open(url, '_self');
                    break;
                    
                case 'open-new-tab':
                    if (url) window.open(url, '_blank');
                    break;
                    
                case 'add-bookmark':
                    this.showAddDialog('bookmark', isFolder ? itemPath : this.getParentPath(itemPath));
                    break;
                    
                case 'add-folder':
                    this.showAddDialog('folder', isFolder ? itemPath : this.getParentPath(itemPath));
                    break;
                    
                    
                case 'copy-url':
                    if (url) {
                        await navigator.clipboard.writeText(url);
                        this.showNotification('链接已复制', 'success');
                    }
                    break;
                    
                case 'cut':
                    this.clipboard = { path: itemPath, action: 'cut' };
                    this.clipboardAction = 'cut';
                    this.showNotification('已剪切', 'success');
                    break;
                    
                case 'copy':
                    this.clipboard = { path: itemPath, action: 'copy' };
                    this.clipboardAction = 'copy';
                    this.showNotification('已复制', 'success');
                    break;
                    
                case 'paste':
                    if (this.clipboard) {
                        await this.pasteItem(isFolder ? itemPath : this.getParentPath(itemPath));
                    }
                    break;
                    
                    
                case 'hide':
                    await window.bookmarkManager.toggleItemVisibility(itemPath);
                    this.renderBookmarks();
                    this.showNotification('项目已隐藏', 'success');
                    break;
                    
                case 'delete':
                    if (confirm('确定要删除这个项目吗？')) {
                        await window.bookmarkManager.deleteItem(itemPath);
                        this.renderBookmarks();
                        this.updateUndoButton();
                        this.showNotification('项目已删除', 'success');
                    }
                    break;
            }
        } catch (error) {
            console.error('操作失败:', error);
            this.showNotification('操作失败: ' + error.message, 'error');
        }
        
        this.hideContextMenu();
    }

    // 显示编辑对话框
    showEditDialog(itemPath) {
        const item = window.bookmarkManager.findItemByPath(itemPath);
        
        if (!item) {
            this.showNotification('找不到要编辑的项目', 'error');
            return;
        }
        
        this.currentEditingItem = itemPath;
        this.currentParentPath = null;
        this.currentItemType = null;
        
        const dialog = document.getElementById('edit-dialog');
        const title = document.getElementById('edit-dialog-title');
        const titleInput = document.getElementById('edit-title');
        const urlInput = document.getElementById('edit-url');
        const urlGroup = document.getElementById('edit-url-group');
        
        const isFolder = !!(item.children !== undefined);
        
        title.textContent = isFolder ? '编辑文件夹' : '编辑书签';
        titleInput.value = item.title || '';
        urlInput.value = item.url || '';
        
        // 文件夹不显示 URL 输入框
        urlGroup.style.display = isFolder ? 'none' : 'block';
        
        dialog.classList.remove('hidden');
        titleInput.focus();
    }

    // 隐藏编辑对话框
    hideEditDialog() {
        document.getElementById('edit-dialog').classList.add('hidden');
        this.currentEditingItem = null;
    }

    // 保存编辑
    async saveEdit() {
        try {
            const title = document.getElementById('edit-title').value.trim();
            const url = document.getElementById('edit-url').value.trim();
            
            if (!title) {
                this.showNotification('标题不能为空', 'error');
                return;
            }
            
            if (this.currentEditingItem) {
                // 编辑现有项目
                const updates = { title };
                if (url) updates.url = url;
                
                await window.bookmarkManager.editItem(this.currentEditingItem, updates);
                this.showNotification('编辑成功', 'success');
            } else {
                // 新建项目
                if (this.currentItemType === 'folder') {
                    await window.bookmarkManager.addFolder(this.currentParentPath || '', title);
                    this.showNotification('文件夹创建成功', 'success');
                } else {
                    if (!url) {
                        this.showNotification('书签链接不能为空', 'error');
                        return;
                    }
                    
                    const bookmark = { title, url };
                    await window.bookmarkManager.addBookmark(this.currentParentPath || '', bookmark);
                    this.showNotification('书签创建成功', 'success');
                }
            }
            
            this.renderBookmarks();
            this.updateUndoButton();
            this.hideEditDialog();
            
        } catch (error) {
            console.error('保存失败:', error);
            this.showNotification('保存失败: ' + error.message, 'error');
        }
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
        
        let html = `
            <div class="folder-tree-item ${activeClass} ${childrenClass}" 
                 data-folder-title="${folder.title}" 
                 data-path="${folder.path}"
                 style="padding-left: ${level * 0.5}rem">
                <i class="fas ${hasChildren ? (isExpanded ? 'fa-folder-open' : 'fa-folder') : 'fa-folder'}"></i>
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
    
    // 渲染右侧导航 - 根据选中状态决定显示内容
    renderNavigation(bookmarks, currentFolderContent) {
        if (this.selectedItems.size > 0) {
            this.renderSelectedBookmarksNav();
        } else {
            this.renderSubdirsNav(currentFolderContent);
        }
    }
    
    // 渲染选中的书签导航
    renderSelectedBookmarksNav() {
        const container = document.getElementById('subdirs-nav');
        const navSection = container.parentElement;
        const header = navSection.querySelector('h4');
        
        if (!container) return;
        
        // 更改标题
        header.innerHTML = '<i class="fas fa-check-square"></i> 已选中的书签';
        
        // 获取选中的书签
        const selectedBookmarks = [];
        this.selectedItems.forEach(path => {
            const item = window.bookmarkManager.findItemByPath(path);
            if (item && item.url) {
                selectedBookmarks.push({ ...item, path });
            }
        });
        
        container.innerHTML = selectedBookmarks.map(bookmark => `
            <div class="nav-item selected-bookmark-item" data-path="${bookmark.path}">
                <i class="fas fa-bookmark"></i>
                <span>${bookmark.title}</span>
                <button class="remove-selection" title="取消选中">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
        
        // 绑定取消选中事件
        container.querySelectorAll('.selected-bookmark-item').forEach(item => {
            const removeBtn = item.querySelector('.remove-selection');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const path = item.dataset.path;
                this.toggleBookmarkSelection(path, false);
            });
            
            // 点击整个项目也可以取消选中
            item.addEventListener('click', () => {
                const path = item.dataset.path;
                this.toggleBookmarkSelection(path, false);
            });
        });
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
        
        navItems += folders.map(folder => `
            <div class="nav-item" data-folder-title="${folder.title}" data-path="${this.currentFolderPath ? this.currentFolderPath + '/' + this.encodeFolderName(folder.title) : this.encodeFolderName(folder.title)}">
                <i class="fas fa-folder"></i>
                <span>${folder.title}</span>
                <span class="folder-count">${folder.children.length}</span>
            </div>
        `).join('');
        
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
        
        // 使用默认图标，避免网络请求错误
        const defaultFavicon = window.bookmarkManager.getDefaultFavicon();
        
        return `
            <div class="bookmark-item ${hiddenClass}" 
                 style="margin-left: ${level * 20}px"
                 data-path="${safePath}"
                 data-url="${bookmark.url}">
                <img class="bookmark-favicon" 
                     src="${defaultFavicon}" 
                     alt="favicon"
                     data-original-url="${bookmark.url}">
                <div class="bookmark-info">
                    <div class="bookmark-title">${safeTitle}</div>
                    <div class="bookmark-url">${bookmark.url}</div>
                </div>
                <div class="bookmark-actions">
                    <button class="bookmark-action" title="新标签页打开" data-action="open-new">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                </div>
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
        
        // 使用默认图标，避免网络请求错误
        const defaultFavicon = window.bookmarkManager.getDefaultFavicon();
        
        return `
            <div class="bookmark-item ${hiddenClass}" 
                 style="margin-left: ${level * 20}px"
                 data-path="${itemPath}"
                 data-url="${bookmark.url}">
                <img class="bookmark-favicon" 
                     src="${defaultFavicon}" 
                     alt="favicon"
                     data-original-url="${bookmark.url}">
                <div class="bookmark-info">
                    <div class="bookmark-title">${safeTitle}</div>
                    <div class="bookmark-url">${bookmark.url}</div>
                </div>
                <div class="bookmark-actions">
                    <button class="bookmark-action" title="新标签页打开" data-action="open-new">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                </div>
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

    // 显示添加对话框
    showAddDialog(type, parentPath) {
        const dialog = document.getElementById('edit-dialog');
        const title = document.getElementById('edit-dialog-title');
        const titleInput = document.getElementById('edit-title');
        const urlInput = document.getElementById('edit-url');
        const urlGroup = document.getElementById('edit-url-group');
        
        this.currentEditingItem = null; // 标记为新建
        this.currentParentPath = parentPath;
        this.currentItemType = type;
        
        title.textContent = type === 'folder' ? '添加文件夹' : '添加书签';
        titleInput.value = '';
        urlInput.value = '';
        
        urlGroup.style.display = type === 'folder' ? 'none' : 'block';
        
        dialog.classList.remove('hidden');
        titleInput.focus();
    }

    // 获取父路径
    getParentPath(itemPath) {
        const parts = itemPath.split('/');
        parts.pop();
        return parts.join('/');
    }

    // 粘贴项目
    async pasteItem(targetPath) {
        if (!this.clipboard) return;
        
        try {
            const sourceItem = window.bookmarkManager.findItemByPath(this.clipboard.path);
            if (!sourceItem) {
                this.showNotification('源项目不存在', 'error');
                return;
            }
            
            if (this.clipboardAction === 'cut') {
                await window.bookmarkManager.moveItem(this.clipboard.path, targetPath);
                this.showNotification('移动成功', 'success');
                this.clipboard = null;
            } else {
                // 复制逻辑
                const newItem = JSON.parse(JSON.stringify(sourceItem));
                newItem.title = newItem.title + ' - 副本';
                
                if (newItem.children) {
                    await window.bookmarkManager.addFolder(targetPath, newItem.title);
                } else {
                    await window.bookmarkManager.addBookmark(targetPath, newItem);
                }
                this.showNotification('复制成功', 'success');
            }
            
            this.renderBookmarks();
            this.updateUndoButton();
            
        } catch (error) {
            console.error('粘贴失败:', error);
            this.showNotification('粘贴失败: ' + error.message, 'error');
        }
    }

    // 切换项目选择状态
    toggleItemSelection(element) {
        const path = element.dataset.path;
        
        if (this.selectedItems.has(path)) {
            this.selectedItems.delete(path);
            element.classList.remove('selected');
        } else {
            this.selectedItems.add(path);
            element.classList.add('selected');
        }
        
        this.updateBatchToolbar();
        this.updateNavigationDisplay();
    }
    
    // 切换书签选择状态（通过路径）
    toggleBookmarkSelection(path, forceState = null) {
        if (forceState === false || (forceState === null && this.selectedItems.has(path))) {
            this.selectedItems.delete(path);
        } else if (forceState === true || forceState === null) {
            this.selectedItems.add(path);
        }
        
        // 更新书签项的视觉状态
        const bookmarkElement = document.querySelector(`[data-path="${path}"]`);
        if (bookmarkElement) {
            if (this.selectedItems.has(path)) {
                bookmarkElement.classList.add('selected');
            } else {
                bookmarkElement.classList.remove('selected');
            }
        }
        
        this.updateBatchToolbar();
        this.updateNavigationDisplay();
    }
    
    // 更新导航显示
    updateNavigationDisplay() {
        // 重新渲染导航区域
        const currentFolderContent = this.currentFolderContent || window.bookmarkManager.filteredBookmarks;
        this.renderNavigation(window.bookmarkManager.filteredBookmarks, currentFolderContent);
    }

    // 更新批量操作工具栏
    updateBatchToolbar() {
        const toolbar = document.getElementById('batch-toolbar');
        const countElement = document.getElementById('selected-count');
        
        countElement.textContent = this.selectedItems.size;
        
        if (this.selectedItems.size > 0) {
            toolbar.classList.remove('hidden');
        } else {
            toolbar.classList.add('hidden');
        }
    }

    // 清除选择
    clearSelection() {
        this.selectedItems.clear();
        document.querySelectorAll('.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.updateBatchToolbar();
    }

    // 批量删除
    async batchDelete() {
        if (this.selectedItems.size === 0) return;
        
        if (!confirm(`确定要删除选中的 ${this.selectedItems.size} 个项目吗？`)) {
            return;
        }
        
        try {
            const paths = Array.from(this.selectedItems);
            await window.bookmarkManager.deleteItems(paths);
            
            this.clearSelection();
            this.renderBookmarks();
            this.updateUndoButton();
            this.showNotification(`已删除 ${paths.length} 个项目`, 'success');
            
        } catch (error) {
            console.error('批量删除失败:', error);
            this.showNotification('批量删除失败: ' + error.message, 'error');
        }
    }

    // 批量隐藏
    async batchHide() {
        if (this.selectedItems.size === 0) return;
        
        try {
            const paths = Array.from(this.selectedItems);
            
            for (const path of paths) {
                await window.bookmarkManager.toggleItemVisibility(path);
            }
            
            this.clearSelection();
            this.renderBookmarks();
            this.showNotification(`已隐藏 ${paths.length} 个项目`, 'success');
            
        } catch (error) {
            console.error('批量隐藏失败:', error);
            this.showNotification('批量隐藏失败: ' + error.message, 'error');
        }
    }

    // 批量移动
    async batchMove() {
        if (this.selectedItems.size === 0) return;
        
        const targetPath = prompt('请输入目标文件夹路径:');
        if (!targetPath) return;
        
        try {
            const paths = Array.from(this.selectedItems);
            
            for (const path of paths) {
                await window.bookmarkManager.moveItem(path, targetPath);
            }
            
            this.clearSelection();
            this.renderBookmarks();
            this.updateUndoButton();
            this.showNotification(`已移动 ${paths.length} 个项目`, 'success');
            
        } catch (error) {
            console.error('批量移动失败:', error);
            this.showNotification('批量移动失败: ' + error.message, 'error');
        }
    }

    // 批量导出
    async batchExport() {
        if (this.selectedItems.size === 0) return;
        
        try {
            const paths = Array.from(this.selectedItems);
            const selectedBookmarks = [];
            
            for (const path of paths) {
                const item = window.bookmarkManager.findItemByPath(path);
                if (item) {
                    selectedBookmarks.push(item);
                }
            }
            
            const exportData = {
                bookmarks: selectedBookmarks,
                exportDate: new Date().toISOString(),
                count: selectedBookmarks.length
            };
            
            const content = JSON.stringify(exportData, null, 2);
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `selected_bookmarks_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.showNotification(`已导出 ${selectedBookmarks.length} 个项目`, 'success');
            
        } catch (error) {
            console.error('批量导出失败:', error);
            this.showNotification('批量导出失败: ' + error.message, 'error');
        }
    }

    // 处理键盘快捷键
    handleKeyboard(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'z':
                    event.preventDefault();
                    this.undoLastAction();
                    break;
                case 'f':
                    event.preventDefault();
                    document.getElementById('search-input').focus();
                    break;
                case 's':
                    event.preventDefault();
                    this.syncBookmarks();
                    break;
                case 'a':
                    event.preventDefault();
                    this.selectAll();
                    break;
            }
        }
        
        if (event.key === 'Escape') {
            this.hideContextMenu();
            this.hideEditDialog();
            this.hideSettingsPanel();
            this.hidePasswordPanel();
            this.clearSelection();
        }
        
        if (event.key === 'Delete' && this.selectedItems.size > 0) {
            this.batchDelete();
        }
    }

    // 全选
    selectAll() {
        document.querySelectorAll('.bookmark-item, .folder-header').forEach(el => {
            const path = el.dataset.path;
            if (path) {
                this.selectedItems.add(path);
                el.classList.add('selected');
            }
        });
        this.updateBatchToolbar();
    }
}

// 创建全局 UI 管理器实例
window.uiManager = new UIManager();