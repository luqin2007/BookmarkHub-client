# BookmarkHub Manager

一个功能强大的书签管理工具，支持从 GitHub Gist 同步 BookmarkHub 扩展的书签数据，并提供丰富的管理功能。

## 功能特性

### 🔄 数据同步
- **GitHub Gist 集成**: 从 GitHub Gist 获取 BookmarkHub 同步的书签数据
- **本地存储**: 使用 IndexedDB 进行本地数据持久化
- **离线访问**: 支持离线查看和管理书签

### 🔍 搜索与过滤
- **实时搜索**: 支持按标题和 URL 搜索书签
- **隐藏功能**: 支持隐藏特定书签和文件夹
- **密码保护**: 可设置密码来查看隐藏的书签

### 📁 书签管理
- **完整的 CRUD 操作**: 添加、删除、移动、修改书签
- **文件夹管理**: 创建、重命名、删除、移动文件夹
- **批量操作**: 支持批量删除和修改书签
- **拖拽排序**: 支持拖拽重新排列书签

### 🛠 实用工具
- **撤销功能**: 支持撤销最近的操作
- **链接检查**: 验证书签链接是否可用
- **自动图标**: 自动获取网站图标
- **导入导出**: 支持 JSON 和 HTML 格式的数据导入导出

## 快速开始

### 1. 准备工作

#### 获取 GitHub Token
1. 登录 GitHub，进入 Settings > Developer settings > Personal access tokens
2. 点击 "Generate new token"
3. 选择 `gist` 权限
4. 生成并复制 token

#### 获取 Gist ID
1. 在 GitHub 上创建一个新的 Gist 或找到包含 BookmarkHub 数据的 Gist
2. 从 Gist URL 中获取 ID（例如：`https://gist.github.com/username/abc123def456` 中的 `abc123def456`）

### 2. 配置应用

1. 打开应用，点击右上角的设置按钮
2. 输入 GitHub Token 和 Gist ID
3. 可选：设置查看隐藏书签的密码
4. 点击"保存设置"
5. 点击"同步书签"获取数据

### 3. 开始使用

- **搜索书签**: 在顶部搜索框中输入关键词
- **管理书签**: 右键点击书签或文件夹查看操作菜单
- **查看隐藏项**: 点击工具栏中的眼睛图标
- **检查链接**: 点击链接检查按钮验证所有书签
- **撤销操作**: 使用 Ctrl+Z 或点击撤销按钮

## BookmarkHub 数据格式

应用支持以下 BookmarkHub 数据格式：

```json
{
  "browser": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
  "version": "0.0.4",
  "createDate": 1757174541418,
  "bookmarks": [
    {
      "children": [
        {
          "dateLastUsed": 1741414031904,
          "syncing": false,
          "title": "示例网站",
          "url": "https://example.com/"
        }
      ],
      "syncing": false,
      "title": "示例文件夹",
      "folderType": "bookmarks-bar"
    }
  ]
}
```

## 键盘快捷键

- `Ctrl+F`: 聚焦搜索框
- `Ctrl+Z`: 撤销上一个操作
- `Ctrl+S`: 同步书签
- `Esc`: 关闭当前打开的对话框或面板

## 技术架构

### 前端技术
- **HTML5**: 语义化标记
- **CSS3**: 现代样式和动画
- **JavaScript ES6+**: 模块化开发
- **IndexedDB**: 本地数据存储
- **Font Awesome**: 图标库

### 核心模块
- **StorageManager**: 本地存储管理
- **GitHubManager**: GitHub API 集成
- **BookmarkManager**: 书签数据管理
- **UIManager**: 用户界面管理
- **App**: 主应用程序控制器

### 数据流
1. 用户配置 GitHub 凭据
2. 从 GitHub Gist 获取书签数据
3. 解析并存储到 IndexedDB
4. 渲染到用户界面
5. 用户操作触发数据更新
6. 可选择同步回 GitHub Gist

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

需要支持以下 Web API：
- IndexedDB
- Fetch API
- ES6 Modules
- CSS Grid/Flexbox

## 安全说明

- GitHub Token 存储在浏览器本地存储中
- 隐藏书签密码使用明文存储（仅用于前端显示控制）
- 所有网络请求通过 HTTPS 进行
- 不会向第三方服务发送用户数据

## 测试功能

项目包含一个专门的测试页面来验证各项功能：

### 运行测试
1. 在浏览器中打开 `test.html`
2. 点击"加载示例数据"按钮
3. 运行各项测试功能：
   - **数据识别测试**: 验证书签和文件夹是否正确识别
   - **搜索功能测试**: 测试搜索和过滤功能
   - **路径生成测试**: 验证项目路径计算是否正确
   - **存储恢复测试**: 测试数据持久化和恢复

### 测试数据结构
测试使用包含以下结构的数据：
- 包含子项的文件夹
- 直接书签项目
- 空文件夹
- 嵌套文件夹结构
- 隐藏书签

## 故障排除

### 常见问题

**Q: 书签被错误识别为文件夹**
A: 已修复。现在基于 `url` 属性和 `children` 属性正确识别项目类型

**Q: 同步失败，提示 Token 无效**
A: 检查 GitHub Token 是否正确，确保具有 `gist` 权限

**Q: 找不到 Gist 数据**
A: 确认 Gist ID 正确，且 Gist 包含有效的 JSON 数据

**Q: 书签图标无法加载**
A: 某些网站可能阻止跨域请求，这是正常现象

**Q: 搜索结果不准确**
A: 搜索功能基于标题和 URL 的文本匹配，支持部分匹配

**Q: 项目路径计算错误**
A: 已修复路径计算逻辑，现在支持正确的层级路径生成

### 清除数据
如果遇到严重问题，可以清除所有本地数据：
1. 打开浏览器开发者工具
2. 进入 Application/Storage 标签
3. 删除相关的 IndexedDB 和 localStorage 数据
4. 刷新页面重新开始

## 开发说明

### 项目结构
```
BookmarkHub-Manager/
├── index.html          # 主页面
├── styles.css          # 样式文件
├── js/
│   ├── storage.js      # 存储管理模块
│   ├── github.js       # GitHub API 模块
│   ├── bookmarks.js    # 书签管理模块
│   ├── ui.js           # UI 管理模块
│   └── app.js          # 主应用程序
└── README.md           # 说明文档
```

### 本地开发
1. 克隆或下载项目文件
2. 使用本地服务器运行（如 Live Server）
3. 在浏览器中打开 `index.html`

### 部署
项目为纯前端应用，可以部署到任何静态文件托管服务：
- GitHub Pages
- Netlify
- Vercel
- 或任何 Web 服务器

## 许可证

MIT License - 详见 LICENSE 文件

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0 (2024-01-XX)
- 初始版本发布
- 支持 GitHub Gist 同步
- 完整的书签管理功能
- 搜索和过滤功能
- 隐藏书签功能
- 撤销操作支持