# MDView — Tauri prototype

A proof-of-concept port of MDView from Electron to [Tauri 2](https://tauri.app), to shrink
the ~100 MB installer down to a few MB by using the OS webview (WebView2 on Windows)
instead of bundling Chromium.

## How it works

The Electron renderer (`../app/index.html`) is reused **unmodified**:

- `sync.js` copies `../app/index.html` into `src/` and injects `<script src="shim.js">`
  before the app's own script. It runs automatically before every dev run / build.
- `src/shim.js` reimplements the `window.mdview` preload bridge on Tauri IPC
  (file open/save dialogs, discard confirmation, drag & drop, external links,
  `open-path` events from second instances).
- `src-tauri/src/main.rs` (~80 lines) replaces `../main.js`: file reads/writes,
  CLI file argument, single-instance handling with focus + open-path forwarding.

## Build

Prerequisites: Node, Rust (MSVC toolchain), VS C++ build tools.

```
npm install
npm run build      # release exe + NSIS installer in src-tauri/target/release/
npm run dev        # dev mode with hot renderer reload (re-run `npm run sync` after editing app/index.html)
```

## Feature parity notes

- Tabs, session restore, recent files: unchanged (renderer-side, localStorage).
- File associations (.md/.markdown/.mdown): declared in `tauri.conf.json` NSIS bundle.
- Not ported yet: auto-update (electron-updater → would become tauri-plugin-updater),
  macOS `open-file` event handling, mac/linux bundle targets (Tauri supports both).
