use anthropic_ai_sdk::client::AnthropicClient;
use anthropic_ai_sdk::types::message::{
    ContentBlockDelta, CreateMessageParams, Message, MessageClient, RequiredMessageParams, Role,
    StreamEvent,
};
use futures_util::StreamExt;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{Emitter, Manager, Window};

const KEYRING_SERVICE: &str = "maomaochat-ai";
const KEYRING_USER_KEY: &str = "anthropic-api-key";
const KEYRING_USER_URL: &str = "anthropic-base-url";
const KEYRING_USER_MODEL: &str = "anthropic-model";

/// Public AI config returned to the frontend — no secrets.
#[derive(Serialize)]
pub struct AiConfigPublic {
    pub configured: bool,
    pub base_url: String,
    pub model: String,
}

/// Shared cancellation flag across the app.
pub struct AiCancelFlag(pub Arc<AtomicBool>);

/// Normalize a user-supplied base URL
fn normalize_base_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

/// Resolve the keyring entry, mapping errors to user-friendly strings.
fn get_keyring(user: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, user).map_err(|e| format!("Keyring error: {}", e))
}

// ─── Commands ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn save_ai_config(
    api_key: String,
    base_url: String,
    model: Option<String>,
) -> Result<(), String> {
    // Validate base_url can be parsed after normalization
    let normalized = normalize_base_url(&base_url);
    let _ = url::Url::parse(&format!("{}/messages", normalized))
        .map_err(|_| "Invalid base URL".to_string())?;

    // Store API key (skip if empty — don't overwrite an existing key)
    if !api_key.is_empty() {
        let entry = get_keyring(KEYRING_USER_KEY)?;
        entry
            .set_password(&api_key)
            .map_err(|e| format!("Failed to save API key: {}", e))?;
    }

    // Store base URL
    let entry = get_keyring(KEYRING_USER_URL)?;
    entry
        .set_password(&normalized)
        .map_err(|e| format!("Failed to save base URL: {}", e))?;

    // Store model (optional)
    if let Some(m) = model {
        if !m.is_empty() {
            let entry = get_keyring(KEYRING_USER_MODEL)?;
            entry
                .set_password(&m)
                .map_err(|e| format!("Failed to save model: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn load_ai_config() -> Result<AiConfigPublic, String> {
    let key_entry = get_keyring(KEYRING_USER_KEY)?;
    let configured = key_entry.get_password().is_ok();

    let base_url = get_keyring(KEYRING_USER_URL)?
        .get_password()
        .unwrap_or_else(|_| "https://api.anthropic.com/v1".to_string());

    let model = get_keyring(KEYRING_USER_MODEL)?
        .get_password()
        .unwrap_or_else(|_| "claude-sonnet-4-20250514".to_string());

    Ok(AiConfigPublic {
        configured,
        base_url,
        model,
    })
}

#[tauri::command]
pub async fn ai_generate(
    window: Window,
    prompt: String,
    model: Option<String>,
    system: Option<String>,
    cancel_flag: tauri::State<'_, AiCancelFlag>,
) -> Result<(), String> {
    // Read credentials from keyring
    let api_key = get_keyring(KEYRING_USER_KEY)?
        .get_password()
        .map_err(|_| "API key not configured. Please set it in Settings.".to_string())?;

    let base_url = get_keyring(KEYRING_USER_URL)?
        .get_password()
        .unwrap_or_else(|_| "https://api.anthropic.com/v1".to_string());

    let model_name = model
        .or_else(|| get_keyring(KEYRING_USER_MODEL).ok()?.get_password().ok())
        .unwrap_or_else(|| "claude-sonnet-4-20250514".to_string());

    // Build client with custom base URL
    let client = AnthropicClient::builder(api_key, "2023-06-01")
        .with_api_base_url(&base_url)
        .build::<anthropic_ai_sdk::types::message::MessageError>()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    // Build request
    let mut params = RequiredMessageParams {
        model: model_name,
        messages: vec![Message::new_text(Role::User, prompt)],
        max_tokens: 4096,
    };

    // Add system prompt if provided
    let body = if let Some(sys) = system {
        CreateMessageParams::new(params).with_system(sys).with_stream(true)
    } else {
        CreateMessageParams::new(params).with_stream(true)
    };

    // Reset cancellation flag
    cancel_flag.0.store(false, Ordering::SeqCst);
    let cancelled = cancel_flag.0.clone();

    // Create stream
    let mut stream = client
        .create_message_streaming(&body)
        .await
        .map_err(|e| format!("Stream error: {}", e))?;

    // Process stream
    while let Some(result) = stream.next().await {
        // Check cancellation
        if cancelled.load(Ordering::SeqCst) {
            let _ = window.emit("ai-cancelled", ());
            return Ok(());
        }

        match result {
            Ok(StreamEvent::ContentBlockDelta { delta, .. }) => match delta {
                ContentBlockDelta::TextDelta { text } => {
                    if let Err(e) = window.emit("ai-chunk", &text) {
                        eprintln!("Failed to emit ai-chunk: {}", e);
                    }
                }
                ContentBlockDelta::ThinkingDelta { thinking } => {
                    if let Err(e) = window.emit("ai-thinking", &thinking) {
                        eprintln!("Failed to emit ai-thinking: {}", e);
                    }
                }
                _ => {} // InputJsonDelta / SignatureDelta — ignore
            },
            Ok(StreamEvent::MessageStop) => {
                let _ = window.emit("ai-done", ());
                break;
            }
            Ok(StreamEvent::Error { error }) => {
                // Sanitize error: redact anything that looks like an API key
                let msg = sanitize_error(&error.message);
                let _ = window.emit("ai-error", &msg);
                break;
            }
            Ok(_) => {} // Ping / MessageStart / ContentBlockStart etc.
            Err(e) => {
                let msg = sanitize_error(&e.to_string());
                let _ = window.emit("ai-error", &msg);
                break;
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn ai_cancel(cancel_flag: tauri::State<'_, AiCancelFlag>) -> Result<(), String> {
    cancel_flag.0.store(true, Ordering::SeqCst);
    Ok(())
}

/// Strip potential API key patterns from error messages before sending to frontend.
fn sanitize_error(msg: &str) -> String {
    // Redact anything that looks like a bearer token or API key
    let mut sanitized = msg.to_string();
    // Match patterns like "sk-ant-..." or long hex/base64 strings
    if let Ok(re) = regex::Regex::new(r"(sk-ant-[a-zA-Z0-9_-]{20,}|[a-f0-9]{32,})") {
        sanitized = re.replace_all(&sanitized, "[REDACTED]").to_string();
    }
    sanitized
}
