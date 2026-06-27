# MaoMaoChat 项目伪代码

## 核心架构
```
App = Tauri(Rust后端) + SvelteKit(前端) + Web渲染引擎
```

## 主要功能模块

### 1. 文件管理模块
```
class FileManager:
    openFile(path):
        content = Rust读取文件(path)
        html = 渲染Markdown(content)
        新建标签页(path, content, html)
    
    saveFile(path, content):
        Rust写入文件(path, content)
        标记为已保存()
    
    openFileDialog():
        path = 系统文件对话框()
        openFile(path)
```

### 2. 标签页管理模块
```
class TabManager:
    tabs = []  // 标签页列表
    activeTab = null
    
    addTab(path, content, html):
        if 已打开(path):
            切换到该标签()
        else:
            创建新标签(path, content, html)
    
    closeTab(id):
        如果有未保存更改:
            确认是否放弃()
        移除标签()
    
    switchTab(id):
        保存当前滚动位置()
        切换到新标签()
```

### 3. 渲染管线模块
```
class Renderer:
    init():
        markdownIt = 初始化MarkdownIt()
        注册插件(语法高亮, 数学公式, 任务列表)
    
    render(markdown):
        提取前置元数据(markdown)
        html = markdownIt.render(markdown)
        html = 安全过滤(html)
        return {html, frontmatter, wordCount}
```

### 4. 编辑器模块
```
class Editor:
    切换编辑模式():
        if 当前是查看模式:
            进入编辑模式()
            同步滚动位置()
        else:
            退出编辑模式()
            重新渲染预览()
    
    实时编辑(content):
        更新编辑内容()
        标记为未保存()
```

### 5. 主题系统
```
class ThemeManager:
    主题 = "system" | "light" | "dark"
    
    切换主题():
        循环切换(系统/亮色/暗色)
        应用CSS类()
    
    监听系统主题():
        跟随操作系统主题变化()
```

### 6. 文件监视器
```
class FileWatcher:
    监视文件(path):
        if 文件被外部修改:
            自动重新加载()
            保留编辑状态()
```

### 7. AI集成模块
```
class AIAssistant:
    生成内容(prompt):
        调用Rust AI接口()
        流式返回结果()
        实时更新编辑器()
    
    取消生成():
        发送取消信号()
```

### 8. 导航功能
```
class Navigation:
    目录导航():
        提取标题()
        生成侧边栏()
        高亮当前位置()
    
    搜索功能():
        全文搜索()
        高亮匹配项()
    
    Vim快捷键():
        j/k滚动()
        gg/G跳转()
        [/]切换标题()
```

## 数据流
```
用户操作 -> Svelte前端 -> Tauri命令 -> Rust后端 -> 文件系统
                ↓
            状态管理(Svelte stores)
                ↓
            UI渲染更新
```

## 存储机制
- **标签页状态**: 内存中Svelte stores
- **用户设置**: localStorage
- **最近文件**: localStorage
- **AI配置**: 系统密钥链
- **文件内容**: 文件系统

## 核心特性
1. 原生应用体验(Tauri)
2. 美观的Markdown渲染
3. 轻量级编辑功能
4. 多标签页管理
5. 实时文件监视
6. 主题切换
7. AI辅助生成
8. 跨平台支持(macOS/Windows)

## 技术栈
- **前端**: SvelteKit + Svelte 5 + Tailwind CSS
- **后端**: Rust + Tauri v2
- **渲染**: markdown-it + highlight.js + KaTeX + Mermaid
- **包管理**: pnpm
- **构建**: Vite + Tauri CLI

## 项目结构
```
src/                    # Svelte前端代码
  ├── routes/           # 页面路由
  ├── lib/              # 核心库
  │   ├── stores/       # 状态管理
  │   ├── components/   # UI组件
  │   ├── renderer/     # Markdown渲染
  │   ├── tauri/        # Tauri接口
  │   └── utils/        # 工具函数
  └── static/           # 静态资源

src-tauri/              # Rust后端代码
  ├── src/              # Rust源码
  │   ├── lib.rs        # 主入口
  │   ├── commands.rs   # Tauri命令
  │   ├── menu.rs       # 菜单系统
  │   ├── watcher.rs    # 文件监视
  │   └── ai.rs         # AI功能
  └── Cargo.toml        # Rust依赖
```
