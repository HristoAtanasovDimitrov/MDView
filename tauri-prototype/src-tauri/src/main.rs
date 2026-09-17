// Prevent an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{env, fs, path::Path};
use tauri::{Emitter, Manager};

#[derive(Serialize, Clone)]
struct Doc {
    path: String,
    name: String,
    content: String,
}

fn is_md_path(p: &str) -> bool {
    let l = p.to_lowercase();
    !p.starts_with('-')
        && (l.ends_with(".md") || l.ends_with(".markdown") || l.ends_with(".mdown") || l.ends_with(".txt"))
}

fn md_path_from_args<I: Iterator<Item = String>>(mut args: I) -> Option<String> {
    args.find(|a| is_md_path(a))
}

fn read_doc_inner(path: &str) -> Result<Doc, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let name = Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(Doc { path: path.to_string(), name, content })
}

#[tauri::command]
fn get_initial_file() -> Option<Doc> {
    let p = md_path_from_args(env::args().skip(1))?;
    read_doc_inner(&p).ok()
}

#[tauri::command]
fn read_doc(path: String) -> Result<Doc, String> {
    read_doc_inner(&path)
}

#[tauri::command]
fn save_file(path: String, content: String) -> Result<bool, String> {
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(true)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
            if let Some(p) = md_path_from_args(argv.into_iter().skip(1)) {
                if let Ok(doc) = read_doc_inner(&p) {
                    let _ = app.emit("open-path", doc);
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_initial_file, read_doc, save_file])
        .run(tauri::generate_context!())
        .expect("error while running MDView");
}
