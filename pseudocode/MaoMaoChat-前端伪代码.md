# MaoMaoChat 前端伪代码

## 技术栈
```
SvelteKit + Svelte 5 + Tailwind CSS + Vite
```

## 核心架构
```
前端 = Svelte组件 + Svelte Stores状态管理 + Tauri API调用
```

---

## 一、状态管理模块 (Stores)

### 1. 标签页状态 (tabs.ts)
```typescript
interface Tab {
    id: string
    filePath: string
    fileName: string
    content: string          // 原始markdown内容
    renderedHtml: string     // 渲染后的HTML
    frontmatter: object      // 前置元数据
    wordCount: number
    scrollTop: number        // 滚动位置
    isEditing: boolean       // 是否编辑模式
    editContent: string      // 编辑中的内容
    dirty: boolean           // 是否有未保存更改
}

class TabStore {
    tabs = writable<Tab[]>([])
    activeTabId = writable<string>("__home__")
    
    addTab(filePath, fileName, content, html):
        if 文件已打开:
            切换到该标签()
            更新内容()
        else:
            创建新Tab对象()
            添加到tabs列表()
            设置为活动标签()
    
    closeTab(id):
        保存滚动位置()
        移除标签()
        切换到相邻标签或首页()
    
    switchTab(id):
        保存当前滚动位置()
        更新activeTabId()
    
    setEditing(id, editing):
        更新isEditing状态()
        同步editContent()
    
    updateEditContent(id, content):
        更新editContent()
        计算dirty状态()
    
    markSaved(id):
        content = editContent
        dirty = false
        记录保存时间()
```

### 2. 文档状态 (document.ts)
```typescript
interface DocumentState {
    filePath: string | null
    fileName: string | null
    content: string
    renderedHtml: string
    frontmatter: object | null
    wordCount: number
    loading: boolean
    error: string | null
}

// 当前活动文档的响应式状态
document = writable<DocumentState>()
```

### 3. 设置状态 (settings.ts)
```typescript
interface ReaderSettings {
    fontSize: number         // 字体大小
    lineHeight: number       // 行高
    fontFamily: "sans" | "serif" | "mono"
    maxWidth: number         // 最大宽度
    closeOnEscape: boolean   // ESC关闭标签
}

class SettingsStore {
    settings = loadFromLocalStorage()
    
    update(newSettings):
        保存到localStorage()
        更新store()
}
```

### 4. 主题状态 (theme.ts)
```typescript
type ThemeMode = "system" | "light" | "dark"

class ThemeStore {
    themeMode = writable<ThemeMode>("system")
    
    getEffectiveTheme():
        if system: 检测系统主题()
        return 当前主题
    
    applyTheme():
        添加/移除CSS类 "dark"
    
    cycleTheme():
        循环: system -> light -> dark -> system
}
```

### 5. 最近文件 (recents.ts)
```typescript
interface RecentFile {
    path: string
    name: string
    openedAt: number
    scrollPercent: number
}

class RecentsStore {
    recentFiles = writable<RecentFile[]>([])
    
    addRecentFile(path, name):
        移除重复项()
        添加到列表头部()
        限制最多15个()
        保存到localStorage()
    
    updateScrollPercent(path, percent):
        更新滚动百分比()
}
```

### 6. 目录状态 (toc.ts)
```typescript
class TocStore {
    tocVisible = writable<boolean>(false)
    tocEntries = writable<TocEntry[]>([])
    
    extractHeadings(html):
        解析HTML提取h1-h6()
        生成目录树()
}
```

### 7. 阅读进度 (readingProgress.ts)
```typescript
class ReadingProgressStore {
    保存进度(filePath, lineNumber):
        存储到localStorage()
    
    获取进度(filePath):
        从localStorage读取()
        返回上次阅读行号()
}
```

---

## 二、渲染管线 (renderer/pipeline.ts)

```typescript
class MarkdownRenderer {
    md: MarkdownIt
    
    init():
        md = new MarkdownIt()
        注册插件:
            - markdown-it-texmath (数学公式)
            - markdown-it-task-lists (任务列表)
            - markdown-it-anchor (标题锚点)
            - 自定义source-line插件 (行号映射)
        注册highlight.js语言:
            javascript, typescript, python, rust, go, 
            bash, json, yaml, html, css, sql, 等25+种
    
    renderFull(markdown: string): RenderResult {
        // 1. 提取前置元数据
        frontmatter = 解析YAML前置元数据(markdown)
        content = 移除前置元数据部分(markdown)
        
        // 2. 计算字数
        wordCount = 统计字数(content)
        
        // 3. 渲染Markdown为HTML
        rawHtml = md.render(content)
        
        // 4. 安全过滤
        html = DOMPurify.sanitize(rawHtml)
        
        // 5. 解析相对路径图片
        html = 转换相对路径图片(html, baseDir)
        
        return { html, frontmatter, wordCount }
    }
}
```

---

## 三、Tauri接口层 (tauri/)

### 1. 文件操作 (files.ts)
```typescript
class FileOperations {
    async readMarkdownFile(path):
        return await invoke("read_markdown_file", { path })
    
    async saveFile(path, content):
        await invoke("write_markdown_file", { path, content })
    
    async openFile(path):
        // 1. 设置加载状态
        document.set({ loading: true })
        
        // 2. 读取文件内容
        content = await readMarkdownFile(path)
        
        // 3. 渲染Markdown
        result = renderFull(content)
        
        // 4. 创建新标签页
        tabStore.addTab(path, fileName, content, result.html)
        
        // 5. 更新文档状态
        document.set({ ...result, loading: false })
        
        // 6. 添加到最近文件
        addRecentFile(path, fileName)
        
        // 7. 开始监视文件
        invoke("start_watching", { path })
    
    async openFileDialog():
        path = await 系统文件对话框({
            filters: ["md", "markdown", "txt"]
        })
        if path: openFile(path)
    
    async reloadCurrentFile(path):
        content = await readMarkdownFile(path)
        result = renderFull(content)
        tabStore.updateTabContent(path, content, result.html)
}
```

### 2. 文件监视 (watcher.ts)
```typescript
class FileWatcher {
    async startWatching(path):
        await invoke("start_watching", { path })
    
    // 监听文件变化事件
    listen("file-changed", (event):
        if 时间戳 > 上次保存时间:
            reloadCurrentFile(path)
            // 保留编辑状态
    )
}
```

### 3. AI接口 (ai.ts)
```typescript
class AIInterface {
    async streamAI(prompt, handlers):
        // 注册事件监听器
        listen("ai-chunk", handlers.onChunk)
        listen("ai-done", handlers.onDone)
        listen("ai-error", handlers.onError)
        listen("ai-cancelled", handlers.onCancelled)
        
        // 调用Rust AI生成
        await invoke("ai_generate", { prompt, model, system })
    
    async cancelAI():
        await invoke("ai_cancel")
    
    async saveAIConfig(apiKey, baseUrl, model):
        await invoke("save_ai_config", { apiKey, baseUrl, model })
    
    async loadAIConfig():
        return await invoke("load_ai_config")
}
```

---

## 四、UI组件 (components/)

### 1. 主页面 (+page.svelte)
```svelte
<script>
    // 状态管理
    tabs, activeTabId, document, settings, theme
    
    // 模态框状态
    searchVisible, pasteVisible, openVisible, 
    settingsVisible, aboutVisible, lightboxVisible
    
    // 功能状态
    zenMode, rawMode, aiGenerating
    
    // 生命周期
    onMount:
        初始化渲染器()
        注册全局函数(供Tauri菜单调用)
        注册键盘快捷键监听
        注册滚动监听(阅读进度)
        检查CLI参数
        检查更新()
        加载AI配置()
    
    // 快捷键处理
    handleKeydown(e):
        Ctrl+O: 打开文件
        Ctrl+S: 保存
        Ctrl+E: 切换编辑模式
        Ctrl+T: 新标签
        Ctrl+W: 关闭标签
        Ctrl+1-9: 切换标签
        Ctrl+F: 搜索
        Ctrl+U: 原始模式
        Ctrl+Shift+F: 禅模式
        Ctrl+/-: 缩放
        Vim键: j/k/gg/G/[/]/搜索
    
    // 标签切换同步
    $effect:
        当activeTabId变化:
            保存离开标签的阅读进度()
            更新document store()
            恢复滚动位置()
            恢复阅读进度()
</script>

<div class="app">
    {#if !zenMode}
        <ProgressBar />
        <Toolbar />
        <TabBar />
    {/if}
    
    <DropZone />
    <TableOfContents />
    <SearchOverlay />
    <PasteModal />
    <OpenDialog />
    <SettingsDialog />
    <AboutDialog />
    <ImageLightbox />
    
    {#if loading}
        <LoadingState />
    {:else if error}
        <ErrorState />
    {:else if renderedHtml}
        {#if isEditing}
            <Editor />
        {:else if rawMode}
            <RawSource />
        {:else}
            <FrontmatterBar />
            <MarkdownRenderer />
            <StatusBar />
        {/if}
    {:else}
        <EmptyState />
    {/if}
</div>
```

### 2. 工具栏 (Toolbar.svelte)
```svelte
<script>
    导出事件: onOpen, onPaste, onUrl, onEditToggle, onSave, 
              onRawToggle, onAIGenerate, onAICancel
</script>

<div class="toolbar">
    <button on:click={onOpen}>打开</button>
    <button on:click={onPaste}>粘贴</button>
    <button on:click={onUrl}>URL</button>
    
    <div class="separator" />
    
    <button on:click={onEditToggle}>
        {isEditing ? "预览" : "编辑"}
    </button>
    <button on:click={onSave} disabled={!dirty}>保存</button>
    <button on:click={onRawToggle}>
        {rawMode ? "渲染" : "源码"}
    </button>
    
    <div class="separator" />
    
    <button on:click={onAIGenerate}>AI生成</button>
    {#if aiGenerating}
        <button on:click={onAICancel}>取消</button>
    {/if}
</div>
```

### 3. 标签栏 (TabBar.svelte)
```svelte
<script>
    tabs, activeTabId
    
    拖拽排序: onDragStart, onDragOver, onDrop
</script>

<div class="tab-bar">
    <button on:click={goHome}>首页</button>
    
    {#each $tabs as tab, index}
        <div 
            class="tab" 
            class:active={tab.id === $activeTabId}
            draggable="true"
            on:click={switchTab(tab.id)}
            on:dragstart={handleDragStart(index)}
            on:dragover={handleDragOver}
            on:drop={handleDrop(index)}
        >
            <span>{tab.fileName}</span>
            {#if tab.dirty}
                <span class="dirty-dot">•</span>
            {/if}
            <button on:click|stopPropagation={closeTab(tab.id)}>×</button>
        </div>
    {/each}
</div>
```

### 4. Markdown渲染器 (MarkdownRenderer.svelte)
```svelte
<script>
    export html: string
    export onImageClick: function
    
    // 图片点击处理
    handleImageClick(e):
        获取所有图片src()
        计算当前索引()
        onImageClick(src, allImages, index)
</script>

<article class="prose">
    {@html html}
</article>
```

### 5. 编辑器 (Editor.svelte)
```svelte
<script>
    export value: string
    export onChange: function
    export fontSize, lineHeight, maxWidth
    
    textarea绑定value
    实时调用onChange()
</script>

<textarea 
    {value}
    on:input={e => onChange(e.target.value)}
    style="font-size: {fontSize}px; line-height: {lineHeight}"
/>
```

### 6. 搜索覆盖层 (SearchOverlay.svelte)
```svelte
<script>
    export visible: boolean
    
    搜索关键词
    匹配结果列表
    当前匹配索引
    
    search():
        使用mark.js高亮匹配()
        统计匹配数量()
        跳转到第一个匹配()
    
    next() / prev():
        跳转到下一个/上一个匹配()
</script>

{#if visible}
    <div class="search-overlay">
        <input bind:value={query} placeholder="搜索..." />
        <span>{currentIndex}/{totalMatches}</span>
        <button on:click={prev}>↑</button>
        <button on:click={next}>↓</button>
        <button on:click={close}>×</button>
    </div>
{/if}
```

### 7. 目录侧边栏 (TableOfContents.svelte)
```svelte
<script>
    tocEntries, tocVisible
    activeHeadingId
    
    监听滚动:
        计算当前可见标题()
        高亮对应目录项()
</script>

{#if $tocVisible}
    <nav class="toc">
        {#each $tocEntries as entry}
            <a 
                href="#{entry.id}"
                class:active={entry.id === activeHeadingId}
                style="padding-left: {entry.level * 16}px"
            >
                {entry.text}
            </a>
        {/each}
    </nav>
{/if}
```

### 8. 图片灯箱 (ImageLightbox.svelte)
```svelte
<script>
    export visible: boolean
    export images: string[]
    export index: number
    
    键盘导航:
        左箭头: 上一张
        右箭头: 下一张
        ESC: 关闭
</script>

{#if visible}
    <div class="lightbox" on:click={close}>
        <button class="prev" on:click|stopPropagation={prev}>‹</button>
        <img src={images[index]} />
        <button class="next" on:click|stopPropagation={next}>›</button>
        <span class="counter">{index+1}/{images.length}</span>
    </div>
{/if}
```

### 9. 设置对话框 (SettingsDialog.svelte)
```svelte
<script>
    settings
    
    字体大小滑块
    行高滑块
    字体选择(无衬线/衬线/等宽)
    最大宽度滑块
    ESC关闭开关
</script>

{#if visible}
    <dialog>
        <label>字体大小: {fontSize}px</label>
        <input type="range" bind:value={fontSize} min=10 max=32 />
        
        <label>行高: {lineHeight}</label>
        <input type="range" bind:value={lineHeight} min=1 max=3 step=0.1 />
        
        <label>字体:</label>
        <select bind:value={fontFamily}>
            <option value="sans">无衬线</option>
            <option value="serif">衬线</option>
            <option value="mono">等宽</option>
        </select>
        
        <label>ESC关闭标签:</label>
        <input type="checkbox" bind:checked={closeOnEscape} />
    </dialog>
{/if}
```

---

## 五、工具函数 (utils/)

### 1. 滚动同步 (scroll-sync.ts)
```typescript
class ScrollSync {
    getCurrentSourceLine(mode: "viewer" | "editor" | "raw"):
        获取当前可见的data-source-line属性()
        返回行号
    
    scrollToSourceLine(mode, lineNumber):
        查找对应行号的元素()
        平滑滚动到该位置()
}
```

### 2. 剪贴板 (clipboard.ts)
```typescript
class Clipboard {
    async readText():
        return await navigator.clipboard.readText()
    
    async writeText(text):
        await navigator.clipboard.writeText(text)
}
```

### 3. URL工具 (url.ts)
```typescript
class UrlUtils {
    isUrl(text): boolean
    normalizeUrl(url): string
    extractDomain(url): string
}
```

---

## 六、全局键盘快捷键映射

```
文件操作:
  Ctrl+O          打开文件
  Ctrl+S          保存
  Ctrl+Shift+V    粘贴Markdown
  Ctrl+T          新标签(首页)
  Ctrl+W          关闭标签

编辑:
  Ctrl+E          切换编辑模式
  Ctrl+U          切换源码视图

导航:
  Ctrl+1-9        切换到第N个标签
  Ctrl+F          搜索
  Ctrl+Shift+F    禅模式

视图:
  Ctrl++          放大
  Ctrl+-          缩小
  Ctrl+0          重置缩放

Vim风格:
  j               向下滚动
  k               向上滚动
  d               向下半页
  u               向上半页
  gg              跳转到顶部
  G               跳转到底部
  [               上一个标题
  ]               下一个标题
  /               打开搜索
```
