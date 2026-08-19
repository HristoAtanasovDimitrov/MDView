# MDView

A fast, dark markdown viewer and editor for Windows.

## Two ways to use it

| Flavor | Where | Notes |
|--------|-------|-------|
| Standalone page | [MDView.html](MDView.html) | Zero-install; open in Edge/Chrome |
| Desktop app | `dist/MDView-Setup-<version>.exe` (built via `npm run dist`) | Installs per-user, associates `.md` files |

## Features

- Reading view with book-style serif typography
- Edit mode (`Ctrl+E`) with split live preview
- Open (`Ctrl+O`), Save (`Ctrl+S`), drag & drop
- Find (`Ctrl+F`) with match highlighting and Enter / Shift+Enter / F3 stepping
- Search & replace (`Ctrl+H`) with a regular-expression toggle and `$1` capture groups
- Adjustable reading width with a persistent "set default"
- Links open in the system default browser
- Word count, character count, reading time
- Unsaved-changes indicator (pulsing amber rule under the toolbar)
- Dependency-free markdown renderer: headings, emphasis, code, lists,
  task lists, tables, blockquotes, links, images, horizontal rules

## Development

```bash
npm install     # once
npm start       # run the app in dev mode
npm run dist    # build the Windows installer into dist/
```

The installer is unsigned, so SmartScreen may prompt on first run
(More info → Run anyway).

## Project layout

- `app/index.html` — the entire UI and markdown renderer (Electron flavor)
- `main.js` — Electron main process: windows, dialogs, file I/O, single instance, external links
- `preload.js` — the secure IPC bridge exposed as `window.mdview`
- `build/gen-icon.ps1` — regenerates `build/icon.ico`
- `build/installer.nsh` — NSIS additions (friendly app name registration)
- `MDView.html` — the original standalone browser version

## License

[MIT](LICENSE)
