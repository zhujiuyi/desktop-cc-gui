//! Temporary diagnostics channel (2026-09-22) for the "reply never shows in
//! the UI" report. Everything here is inert unless the app is started with
//! `CCGUI_TRACE=1` (then lines land in `%TEMP%\ccgui-trace-<pid>.jsonl`):
//!
//! - `rust-emit`: the exact event batches the webview receives (hooked into
//!   `EventSink::flush` for the engine event channel),
//! - `rust-send`: one line per `send_message` call with the run/session ids,
//! - `ui`: decision lines the webview batches back (see `store/trace.ts` —
//!   which run the dispatcher keyed an event to, and which gate dropped it).
//!
//! Remove this module (and its hook call sites) once the report is closed.

use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

fn enabled() -> bool {
    static ON: OnceLock<bool> = OnceLock::new();
    *ON.get_or_init(|| std::env::var_os("CCGUI_TRACE").is_some())
}

fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn trace_file() -> PathBuf {
    static FILE: OnceLock<PathBuf> = OnceLock::new();
    FILE.get_or_init(|| {
        std::env::temp_dir().join(format!("ccgui-trace-{}.jsonl", std::process::id()))
    })
    .clone()
}

fn writer() -> Option<&'static Mutex<std::fs::File>> {
    static W: OnceLock<Option<Mutex<std::fs::File>>> = OnceLock::new();
    W.get_or_init(|| {
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(trace_file())
            .ok()
            .map(Mutex::new)
    })
    .as_ref()
}

/// Append one already-serialized JSON line; no-op unless tracing is on.
pub fn append_raw(line: &str) {
    if !enabled() {
        return;
    }
    if let Some(w) = writer() {
        let mut f = w.lock().unwrap_or_else(|e| e.into_inner());
        let _ = writeln!(f, "{line}");
    }
}

/// The exact batch the webview (and any web-access target) receives.
pub fn trace_engine_payload(payload: &str) {
    if !enabled() {
        return;
    }
    append_raw(&format!(
        "{{\"dir\":\"rust-emit\",\"t\":{},\"p\":{payload}}}",
        now_ms()
    ));
}

/// One line per outbound send: which run id the frontend requested, for which
/// session, on which engine.
pub fn note_send(run_id: &str, session_id: Option<&str>, engine: &str) {
    if !enabled() {
        return;
    }
    let v = serde_json::json!({
        "dir": "rust-send",
        "t": now_ms(),
        "runId": run_id,
        "sessionId": session_id,
        "engine": engine,
    });
    append_raw(&v.to_string());
}

#[tauri::command]
pub fn trace_frontend_enabled() -> bool {
    enabled()
}

#[tauri::command]
pub fn trace_frontend(lines: Vec<String>) {
    if !enabled() {
        return;
    }
    for l in lines {
        let v = serde_json::json!({"dir": "ui", "t": now_ms(), "l": l});
        append_raw(&v.to_string());
    }
}
