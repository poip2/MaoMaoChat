# MaoMaoChat 后端伪代码

## 技术栈
```
Rust + Tauri v2
```

## 核心架构
```
后端 = Tauri应用框架 + Rust系统编程 + 原生API集成
```

---

## 一、应用入口 (lib.rs)

```rust
// 全局状态
struct OpenedFiles {
    paths: Mutex<Vec<String>>  // 存储OS"打开方式"事件的文件路径
}

fn run() {
    Tauri::Builder::default()
        // 注册插件
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_cli::init())
        
        // 注册状态管理
        .manage(WatcherState::default())      // 文件监视状态
        .manage(OpenedFiles::default())       // 已打开文件缓冲
        .manage(AiCancelFlag::new())          // AI取消标志
        
        // 注册命令处理器
        .invoke_handler(tauri::generate_handler![
            read_markdown_file,
            write_markdown_file,
            list_claude_plans,
            list_folder_md_files,
            quit_app,
            show_ai_context_menu,
            start_watching,
            stop_watching,
            get_opened_files,
            save_ai_config,
            load_ai_config,
            ai_generate,
            ai_cancel,
        ])
        
        // 设置菜单
        .setup(|app| {
            创建原生菜单()
            注册菜单事件处理器()
        })
        
        .build()
}
```

---

## 二、文件操作命令 (commands.rs)

### 1. 读取Markdown文件
```rust
#[tauri::command]
fn read_markdown_file(path: String) -> Result<String, String> {
    // 1. 验证文件存在
    if !Path::new(&path).exists() {
        return Err("文件不存在".to_string())
    }
    
    // 2. 读取文件内容
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取失败: {}", e))?;
    
    // 3. 处理编码
    // 自动检测UTF-8/GBK等编码
    
    Ok(content)
}
```

### 2. 写入Markdown文件
```rust
#[tauri::command]
fn write_markdown_file(path: String, content: String) -> Result<(), String> {
    // 1. 写入临时文件(原子写入)
    let temp_path = format!("{}.tmp", path);
    fs::write(&temp_path, &content)
        .map_err(|e| format!("写入失败: {}", e))?;
    
    // 2. 原子重命名
    fs::rename(&temp_path, &path)
        .map_err(|e| format!("重命名失败: {}", e))?;
    
    Ok(())
}
```

### 3. 列出Claude计划文件
```rust
#[tauri::command]
fn list_claude_plans() -> Result<Vec<PlanFile>, String> {
    let plans_dir = home_dir().join(".claude").join("plans");
    
    if !plans_dir.exists() {
        return Ok(vec![])
    }
    
    let mut plans = Vec::new();
    
    for entry in fs::read_dir(&plans_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.extension() == Some("md") {
            let name = path.file_name().unwrap().to_string_lossy();
            let content = fs::read_to_string(&path)?;
            let modified = entry.metadata()?.modified()?;
            
            plans.push(PlanFile {
                name: name.to_string(),
                path: path.to_string_lossy().to_string(),
                content,
                modified: modified.timestamp(),
            });
        }
    }
    
    // 按修改时间排序
    plans.sort_by(|a, b| b.modified.cmp(&a.modified));
    
    Ok(plans)
}
```

### 4. 列出文件夹中的Markdown文件
```rust
#[tauri::command]
fn list_folder_md_files(dir_path: String) -> Result<Vec<FileInfo>, String> {
    let dir = Path::new(&dir_path);
    
    if !dir.is_dir() {
        return Err("不是有效目录".to_string())
    }
    
    let mut files = Vec::new();
    
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_file() && is_markdown_file(&path) {
            let name = path.file_name().unwrap().to_string_lossy();
            let size = entry.metadata()?.len();
            
            files.push(FileInfo {
                name: name.to_string(),
                path: path.to_string_lossy().to_string(),
                size,
            });
        }
    }
    
    files.sort_by(|a, b| a.name.cmp(&b.name));
    
    Ok(files)
}

fn is_markdown_file(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some("md" | "markdown" | "mdown" | "mkd" | "txt") => true,
        _ => false,
    }
}
```

### 5. 退出应用
```rust
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}
```

### 6. 显示AI上下文菜单
```rust
#[tauri::command]
fn show_ai_context_menu(app: tauri::AppHandle, selection: String) {
    // 保存选中文本供菜单项使用
    // 菜单项通过前端路由处理
}
```

---

## 三、文件监视器 (watcher.rs)

### 1. 状态管理
```rust
#[derive(Default)]
pub struct WatcherState {
    watchers: Mutex<HashMap<String, RecommendedWatcher>>,
    last_save_times: Mutex<HashMap<String, Instant>>,
}
```

### 2. 开始监视
```rust
#[tauri::command]
pub fn start_watching(
    state: State<WatcherState>,
    app: AppHandle,
    path: String,
) -> Result<(), String> {
    let mut watchers = state.watchers.lock().unwrap();
    
    // 如果已经在监视，先停止
    if let Some(watcher) = watchers.remove(&path) {
        drop(watcher);
    }
    
    // 创建新的监视器
    let app_handle = app.clone();
    let watch_path = path.clone();
    
    let mut watcher = RecommendedWatcher::new(
        move |result: Result<Event, Error>| {
            if let Ok(event) = result {
                match event.kind {
                    EventKind::Modify(_) | EventKind::Create(_) => {
                        // 通知前端文件已更改
                        let _ = app_handle.emit("file-changed", &watch_path);
                    }
                    _ => {}
                }
            }
        },
        Config::default(),
    ).map_err(|e| format!("创建监视器失败: {}", e))?;
    
    watcher.watch(Path::new(&path), RecursiveMode::NonRecursive)
        .map_err(|e| format!("监视失败: {}", e))?;
    
    watchers.insert(path, watcher);
    
    Ok(())
}
```

### 3. 停止监视
```rust
#[tauri::command]
pub fn stop_watching(state: State<WatcherState>, path: String) {
    let mut watchers = state.watchers.lock().unwrap();
    watchers.remove(&path);
}
```

### 4. 记录保存时间
```rust
pub fn record_save_time(state: &WatcherState, path: &str) {
    let mut times = state.last_save_times.lock().unwrap();
    times.insert(path.to_string(), Instant::now());
}

pub fn get_last_save_time(state: &WatcherState, path: &str) -> Option<Instant> {
    let times = state.last_save_times.lock().unwrap();
    times.get(path).copied()
}
```

---

## 四、菜单系统 (menu.rs)

### 1. 创建菜单
```rust
pub fn create_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let menu = Menu::new(app)?;
    
    // macOS应用菜单
    #[cfg(target_os = "macos")]
    {
        let app_menu = Submenu::new(app, "MaoMaoChat", true)?;
        app_menu.append(&MenuItem::new(app, "关于 MaoMaoChat", true, Some("about")))?;
        app_menu.append(&PredefinedMenuItem::separator(app))?;
        app_menu.append(&PredefinedMenuItem::quit(app, Some("退出")))?;
        menu.append(&app_menu)?;
    }
    
    // 文件菜单
    let file_menu = Submenu::new(app, "文件", true)?;
    file_menu.append(&MenuItem::with_id(app, "open", "打开...", true, Some("CmdOrCtrl+O")))?;
    file_menu.append(&MenuItem::with_id(app, "paste_md", "粘贴 Markdown...", true, Some("CmdOrCtrl+Shift+V")))?;
    file_menu.append(&PredefinedMenuItem::separator(app))?;
    file_menu.append(&PredefinedMenuItem::close_window(app, Some("关闭窗口")))?;
    menu.append(&file_menu)?;
    
    // 编辑菜单
    let edit_menu = Submenu::new(app, "编辑", true)?;
    edit_menu.append(&PredefinedMenuItem::undo(app, None))?;
    edit_menu.append(&PredefinedMenuItem::redo(app, None))?;
    edit_menu.append(&PredefinedMenuItem::separator(app))?;
    edit_menu.append(&PredefinedMenuItem::cut(app, None))?;
    edit_menu.append(&PredefinedMenuItem::copy(app, None))?;
    edit_menu.append(&PredefinedMenuItem::paste(app, None))?;
    edit_menu.append(&PredefinedMenuItem::select_all(app, None))?;
    menu.append(&edit_menu)?;
    
    // 视图菜单
    let view_menu = Submenu::new(app, "视图", true)?;
    view_menu.append(&MenuItem::with_id(app, "find", "查找", true, Some("CmdOrCtrl+F")))?;
    view_menu.append(&MenuItem::with_id(app, "theme", "切换主题", true, None))?;
    view_menu.append(&PredefinedMenuItem::separator(app))?;
    view_menu.append(&PredefinedMenuItem::zoom_in(app, None))?;
    view_menu.append(&PredefinedMenuItem::zoom_out(app, None))?;
    view_menu.append(&PredefinedMenuItem::reset_zoom(app, None))?;
    menu.append(&view_menu)?;
    
    // AI菜单
    let ai_menu = Submenu::new(app, "AI", true)?;
    ai_menu.append(&MenuItem::with_id(app, "ai:google", "Google 搜索选中", true, None))?;
    ai_menu.append(&MenuItem::with_id(app, "ai:custom", "自定义提示...", true, None))?;
    ai_menu.append(&PredefinedMenuItem::separator(app))?;
    // 动态添加AI模板菜单项
    menu.append(&ai_menu)?;
    
    // 帮助菜单
    let help_menu = Submenu::new(app, "帮助", true)?;
    help_menu.append(&MenuItem::with_id(app, "check_updates", "检查更新...", true, None))?;
    menu.append(&help_menu)?;
    
    Ok(menu)
}
```

### 2. 菜单事件处理
```rust
app.on_menu_event(move |app_handle, event| {
    if let Some(window) = app_handle.get_webview_window("main") {
        let id = event.id().as_ref();
        
        match id {
            // 通用菜单项
            "open" => {
                let _ = window.eval("window.__maomaochat_open_file?.()");
            }
            "paste_md" => {
                let _ = window.eval("window.__maomaochat_paste?.()");
            }
            "theme" => {
                let _ = window.eval("window.__maomaochat_toggle_theme?.()");
            }
            "find" => {
                let _ = window.eval("window.__maomaochat_find?.()");
            }
            "about" => {
                let _ = window.eval("window.__maomaochat_about?.()");
            }
            "check_updates" => {
                let _ = window.eval("window.__maomaochat_check_updates?.()");
            }
            
            // AI菜单项路由
            s if s.starts_with("ai:") => {
                let js = format!(
                    "window.__maomaochat_ai_lookup?.({})", 
                    serde_json::json!(s)
                );
                let _ = window.eval(&js);
            }
            
            _ => {}
        }
    }
});
```

---

## 五、AI功能模块 (ai.rs)

### 1. AI配置
```rust
pub struct AiConfig {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
}

pub struct AiConfigPublic {
    pub configured: bool,
    pub base_url: String,
    pub model: String,
}

// 保存AI配置到系统密钥链
#[tauri::command]
pub fn save_ai_config(
    api_key: String,
    base_url: String,
    model: Option<String>,
) -> Result<(), String> {
    let keyring = Entry::new("maomaochat", "ai_config")
        .map_err(|e| format!("密钥链访问失败: {}", e))?;
    
    let config = serde_json::json!({
        "api_key": api_key,
        "base_url": base_url,
        "model": model.unwrap_or_default(),
    });
    
    keyring.set_password(&config.to_string())
        .map_err(|e| format!("保存配置失败: {}", e))?;
    
    Ok(())
}

// 加载AI配置
#[tauri::command]
pub fn load_ai_config() -> Result<AiConfigPublic, String> {
    let keyring = Entry::new("maomaochat", "ai_config")
        .map_err(|e| format!("密钥链访问失败: {}", e))?;
    
    match keyring.get_password() {
        Ok(json_str) => {
            let config: serde_json::Value = serde_json::from_str(&json_str)
                .map_err(|e| format!("解析配置失败: {}", e))?;
            
            Ok(AiConfigPublic {
                configured: true,
                base_url: config["base_url"].as_str().unwrap_or("").to_string(),
                model: config["model"].as_str().unwrap_or("").to_string(),
            })
        }
        Err(_) => Ok(AiConfigPublic {
            configured: false,
            base_url: String::new(),
            model: String::new(),
        })
    }
}
```

### 2. AI生成
```rust
#[derive(Clone)]
pub struct AiCancelFlag(pub Arc<AtomicBool>);

#[tauri::command]
pub async fn ai_generate(
    app: AppHandle,
    prompt: String,
    model: Option<String>,
    system: Option<String>,
    cancel_flag: State<'_, AiCancelFlag>,
) -> Result<(), String> {
    // 1. 加载配置
    let config = load_ai_config_internal()?;
    
    // 2. 重置取消标志
    cancel_flag.0.store(false, Ordering::SeqCst);
    
    // 3. 构建请求
    let client = reqwest::Client::new();
    let model_name = model.unwrap_or(config.model);
    
    let mut messages = Vec::new();
    if let Some(sys) = system {
        messages.push(serde_json::json!({
            "role": "system",
            "content": sys
        }));
    }
    messages.push(serde_json::json!({
        "role": "user",
        "content": prompt
    }));
    
    let request_body = serde_json::json!({
        "model": model_name,
        "messages": messages,
        "stream": true
    });
    
    // 4. 发送流式请求
    let response = client.post(&format!("{}/v1/chat/completions", config.base_url))
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    // 5. 处理流式响应
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    
    while let Some(chunk) = stream.next().await {
        // 检查取消标志
        if cancel_flag.0.load(Ordering::SeqCst) {
            let _ = app.emit("ai-cancelled", ());
            return Ok(());
        }
        
        let chunk = chunk.map_err(|e| format!("读取失败: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        
        // 解析SSE格式
        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim().to_string();
            buffer = buffer[line_end + 1..].to_string();
            
            if line.starts_with("data: ") {
                let data = &line[6..];
                
                if data == "[DONE]" {
                    let _ = app.emit("ai-done", ());
                    return Ok(());
                }
                
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                        let _ = app.emit("ai-chunk", content);
                    }
                }
            }
        }
    }
    
    let _ = app.emit("ai-done", ());
    Ok(())
}
```

### 3. 取消AI生成
```rust
#[tauri::command]
pub async fn ai_cancel(cancel_flag: State<'_, AiCancelFlag>) -> Result<(), String> {
    cancel_flag.0.store(true, Ordering::SeqCst);
    Ok(())
}
```

---

## 六、原生功能集成

### 1. 系统文件对话框
```rust
// 使用tauri-plugin-dialog
async fn open_file_dialog() -> Option<String> {
    let file = DialogBuilder::new()
        .set_title("打开Markdown文件")
        .add_filter("Markdown", &["md", "markdown", "mdown", "mkd", "txt"])
        .pick_file()
        .await;
    
    file.map(|f| f.path.to_string_lossy().to_string())
}
```

### 2. 系统密钥链
```rust
// 使用keyring crate存储敏感信息
fn store_secret(service: &str, key: &str, value: &str) -> Result<(), String> {
    let entry = Entry::new(service, key)
        .map_err(|e| format!("创建密钥条目失败: {}", e))?;
    
    entry.set_password(value)
        .map_err(|e| format!("存储密钥失败: {}", e))?;
    
    Ok(())
}

fn get_secret(service: &str, key: &str) -> Result<String, String> {
    let entry = Entry::new(service, key)
        .map_err(|e| format!("创建密钥条目失败: {}", e))?;
    
    entry.get_password()
        .map_err(|e| format!("读取密钥失败: {}", e))
}
```

### 3. 自动更新
```rust
// 使用tauri-plugin-process
async fn check_for_update() -> Result<Option<Update>, String> {
    let update = app.updater()
        .check()
        .await
        .map_err(|e| format!("检查更新失败: {}", e))?;
    
    Ok(update)
}

async fn install_update(update: Update) -> Result<(), String> {
    update.download_and_install()
        .await
        .map_err(|e| format!("安装更新失败: {}", e))?;
    
    Ok(())
}
```

### 4. CLI参数解析
```rust
// 使用tauri-plugin-cli
fn parse_cli_args(app: &AppHandle) -> Result<CliArgs, String> {
    let matches = app.get_cli_matches()
        .map_err(|e| format!("解析CLI参数失败: {}", e))?;
    
    let file = matches.args.get("file")
        .and_then(|arg| arg.value.as_str())
        .map(|s| s.to_string());
    
    Ok(CliArgs { file })
}
```

---

## 七、Cargo.toml 依赖配置

```toml
[package]
name = "maomaochat"
version = "0.2.6"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-process = "2"
tauri-plugin-opener = "2"
tauri-plugin-dialog = "2"
tauri-plugin-cli = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["stream"] }
futures = "0.3"
notify = "6"                    # 文件系统监视
keyring = "2"                   # 系统密钥链
chrono = "0.4"                  # 时间处理
dirs = "5"                      # 系统目录

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

---

## 八、Tauri配置文件

### tauri.conf.json
```json
{
  "productName": "MaoMaoChat",
  "version": "0.2.6",
  "identifier": "com.maomaochat.app",
  "build": {
    "frontendDist": "../build",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      {
        "title": "MaoMaoChat",
        "width": 1200,
        "height": 800,
        "minWidth": 600,
        "minHeight": 400,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "category": "DeveloperTool",
    "shortDescription": "Markdown Viewer & Editor",
    "longDescription": "A beautiful, native Markdown viewer and lightweight editor"
  }
}
```

---

## 九、命令注册表

```
文件操作:
  read_markdown_file      读取Markdown文件
  write_markdown_file     写入Markdown文件
  list_claude_plans       列出Claude计划
  list_folder_md_files    列出文件夹中的MD文件
  quit_app                退出应用

文件监视:
  start_watching          开始监视文件
  stop_watching           停止监视文件

AI功能:
  save_ai_config          保存AI配置
  load_ai_config          加载AI配置
  ai_generate             AI生成内容
  ai_cancel               取消AI生成

上下文菜单:
  show_ai_context_menu    显示AI上下文菜单
```

---

## 十、事件通信

### Rust -> 前端事件
```
file-changed        文件已被外部修改
ai-chunk            AI生成的内容块
ai-thinking         AI思考过程
ai-done             AI生成完成
ai-cancelled        AI生成已取消
ai-error            AI生成错误
```

### 前端 -> Rust命令调用
```
invoke("read_markdown_file", { path })
invoke("write_markdown_file", { path, content })
invoke("start_watching", { path })
invoke("ai_generate", { prompt, model, system })
invoke("ai_cancel")
invoke("save_ai_config", { apiKey, baseUrl, model })
invoke("load_ai_config")
```
