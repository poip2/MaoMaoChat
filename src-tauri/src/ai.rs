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
// Legacy key names (for migration only)
const LEGACY_KEY_API: &str = "anthropic-api-key";
const LEGACY_KEY_URL: &str = "anthropic-base-url";
const LEGACY_KEY_MODEL: &str = "anthropic-model";

/// Migration result returned to the frontend.
#[derive(Serialize)]
pub struct MigrateResult {
    pub migrated: bool,
    pub id: String,
}

/// Shared cancellation flag across the app.
pub struct AiCancelFlag(pub Arc<AtomicBool>);

/// Resolve the keyring entry, mapping errors to user-friendly strings.
fn get_keyring(user: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, user).map_err(|e| format!("Keyring error: {}", e))
}

/// Derive the keychain key for a given config ID.
fn config_keyring_key(id: &str) -> String {
    format!("api-key-{}", id)
}

// ─── Commands ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn save_ai_key(id: String, api_key: String) -> Result<(), String> {
    if api_key.is_empty() {
        return Ok(()); // Don't overwrite existing key
    }
    let entry = get_keyring(&config_keyring_key(&id))?;
    entry
        .set_password(&api_key)
        .map_err(|e| format!("Failed to save API key: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn check_ai_keys(ids: Vec<String>) -> Result<Vec<bool>, String> {
    let mut results = Vec::with_capacity(ids.len());
    for id in &ids {
        let entry = get_keyring(&config_keyring_key(id))?;
        results.push(entry.get_password().is_ok());
    }
    Ok(results)
}

#[tauri::command]
pub fn delete_ai_key(id: String) -> Result<(), String> {
    let entry = get_keyring(&config_keyring_key(&id))?;
    // Ignore error if the entry doesn't exist (idempotent)
    let _ = entry.delete_credential();
    Ok(())
}

#[tauri::command]
pub fn migrate_legacy_ai_config() -> Result<MigrateResult, String> {
    let legacy_entry = get_keyring(LEGACY_KEY_API)?;
    let api_key = match legacy_entry.get_password() {
        Ok(k) => k,
        Err(_) => {
            return Ok(MigrateResult {
                migrated: false,
                id: String::new(),
            });
        }
    };

    // Generate a new UUID for the migrated config
    let uuid = uuid::Uuid::new_v4().to_string();

    // Copy the API key to the new key scheme
    let new_entry = get_keyring(&config_keyring_key(&uuid))?;
    new_entry
        .set_password(&api_key)
        .map_err(|e| format!("Failed to migrate API key: {}", e))?;

    // Delete the legacy entries
    let _ = legacy_entry.delete_credential();
    let _ = get_keyring(LEGACY_KEY_URL)?.delete_credential();
    let _ = get_keyring(LEGACY_KEY_MODEL)?.delete_credential();

    Ok(MigrateResult {
        migrated: true,
        id: uuid,
    })
}

#[tauri::command]
pub async fn ai_generate(
    window: Window,
    prompt: String,
    config_id: String,
    base_url: String,
    model: String,
    system: Option<String>,
    cancel_flag: tauri::State<'_, AiCancelFlag>,
) -> Result<(), String> {
    // Read API key from keyring using the config ID
    let api_key = get_keyring(&config_keyring_key(&config_id))?
        .get_password()
        .map_err(|_| "API key not configured. Please set it in Settings.".to_string())?;

    // Build client with custom base URL
    let client = AnthropicClient::builder(api_key, "2023-06-01")
        .with_api_base_url(&base_url)
        .build::<anthropic_ai_sdk::types::message::MessageError>()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    // Build request
    let params = RequiredMessageParams {
        model,
        messages: vec![Message::new_text(Role::User, prompt)],
        max_tokens: 4096,
    };

    // Add system prompt if provided
    let body = if let Some(sys) = system {
        CreateMessageParams::new(params)
            .with_system(sys)
            .with_stream(true)
    } else {
        CreateMessageParams::new(params).with_stream(true)
    };

    // Reset cancellation flag BEFORE creating the stream (fixes race condition)
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
