# MDView 1.5.0 — Tabs, Recent Files, Interactive Checkboxes

Design spec for three features requested for the next version.

## 1. Tabs

Multiple markdown files open at once, one tab per document.

- **Model (renderer)**: `tabs: [{ id, path, name, text, dirty, scrollView, scrollEdit }]`, `activeId`.
  Switching a tab saves the current editor text + scroll offsets into the outgoing
  tab and loads the incoming one, then re-renders.
- **UI**: a tab strip between the toolbar and the save-rule. Each tab shows the file
  name, a dirty dot, and a close button. A `+` button creates a new Untitled tab.
  The strip scrolls horizontally on overflow. Middle-click closes a tab.
- **Shortcuts**: `Ctrl+T` new tab, `Ctrl+W` close tab, `Ctrl+Tab`/`Ctrl+PageDown`
  next, `Ctrl+Shift+Tab`/`Ctrl+PageUp` previous.
  `main.js` removes the default application menu on Windows/Linux (minimal
  roles-only menu on macOS) so `Ctrl+W` reaches the renderer instead of closing
  the window.
- **Session persistence**: `localStorage["mdview.session"] = { files: [paths], active: n }`,
  saved on every tab change (Electron only). On startup, each stored path is
  re-read via IPC; unreadable files are dropped silently. Only path-backed tabs
  persist — Welcome/Untitled tabs do not survive a restart.
- **Rules**: opening a path that is already open focuses the existing tab.
  Closing a dirty tab asks the existing confirm-discard dialog. Closing the last
  tab leaves a fresh Welcome tab. Window close confirms if *any* tab is dirty.
  The open dialog allows multi-select; drag & drop opens every dropped file.
  Files arriving from a second instance / macOS `open-file` open as new tabs.

## 2. Recent files

- `localStorage["mdview.recent"]`: MRU array of `{ path, name }`, capped at 12,
  updated on every successful open, save-as, and session restore.
- **UI**: a `Recent ▾` toolbar button opens a dropdown listing entries
  (name + dimmed path) plus "Clear recent". Clicking an entry opens it in a tab;
  if the file no longer reads, the entry is removed and an alert shown.
- Electron-only (browser flavor has no stable paths); the button is hidden when
  `window.mdview` is absent.

## 3. Interactive task checkboxes

- `renderMarkdown` gains a `baseLine` offset parameter and records the absolute
  source line of each list item (blockquote recursion passes its start line —
  the stripped buffer maps 1:1 to source lines, so offsets stay linear).
- Task checkboxes render **enabled** with `data-line="<n>"`.
- A delegated click handler on `#content` toggles `[ ]` ↔ `[x]` on that exact
  source line (after re-verifying the line still matches the task pattern),
  updates the active tab text/editor, and marks the tab dirty. The view is not
  re-rendered — the clicked checkbox already reflects the new state.
- Saving stays explicit (`Ctrl+S`), consistent with the app's dirty-indicator
  model. Works in both the Electron and browser contexts of `app/index.html`.

## Out of scope

- `MDView.html` (the standalone original) stays untouched.
- No per-tab edit-mode memory beyond the session; edit mode is global as today.

## Verification

- Load `app/index.html` in a browser to exercise tab UI + checkbox toggling.
- Launch the Electron app twice to confirm session restore and recent list.
- CI smoke test still passes: the window title keeps the `<name> — MDView` shape.
