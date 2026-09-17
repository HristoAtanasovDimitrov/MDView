"use strict";

// Tauri replacement for Electron's preload.js: exposes the same window.mdview
// bridge the renderer already uses, implemented on Tauri IPC. Must load
// before the app's own script so `isElectron` detection picks it up.

(() => {
  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;

  // Plugin globals are not always injected under __TAURI__, so talk to the
  // dialog/opener plugins through their raw invoke commands.
  const dlgOpen = (options) => invoke("plugin:dialog|open", { options });
  const dlgSave = (options) => invoke("plugin:dialog|save", { options });
  const dlgAsk = (message, options) =>
    invoke("plugin:dialog|ask", { message, ...options });
  const openUrl = (url) => invoke("plugin:opener|open_url", { url });

  const MD_EXT = /\.(md|markdown|mdown|txt)$/i;
  const FILTERS = [
    { name: "Markdown", extensions: ["md", "markdown", "mdown", "txt"] },
    { name: "All Files", extensions: ["*"] },
  ];
  const openCallbacks = [];
  const basename = (p) => p.split(/[\\/]/).pop();

  window.mdview = {
    getInitialFile: () => invoke("get_initial_file"),

    openDialog: async () => {
      const sel = await dlgOpen({ multiple: true, filters: FILTERS });
      if (!sel) return null;
      const paths = Array.isArray(sel) ? sel : [sel];
      const docs = [];
      for (const p of paths) {
        try { docs.push(await invoke("read_doc", { path: p })); } catch {}
      }
      return docs.length ? docs : null;
    },

    readFile: (p) => invoke("read_doc", { path: p }),

    saveFile: (p, content) => invoke("save_file", { path: p, content }),

    saveAs: async (content, suggestedName) => {
      const p = await dlgSave({ defaultPath: suggestedName, filters: FILTERS });
      if (!p) return null;
      await invoke("save_file", { path: p, content });
      return { path: p, name: basename(p) };
    },

    confirmDiscard: () =>
      dlgAsk("You have unsaved changes.\n\nDiscard them and continue?", {
        title: "Unsaved changes",
        kind: "warning",
        okButtonLabel: "Discard changes",
        cancelButtonLabel: "Cancel",
      }),

    // Tauri delivers drops as native paths via its own event (below), so the
    // renderer's HTML5 drop path is never taken.
    pathForFile: () => null,

    onOpenPath: (cb) => openCallbacks.push(cb),
  };

  // Second app instance / file-association opens, forwarded from Rust.
  listen("open-path", (e) => openCallbacks.forEach((cb) => cb(e.payload)));

  // Tauri intercepts native file drops before HTML5 drop events fire.
  listen("tauri://drag-drop", async (e) => {
    for (const p of e.payload.paths || []) {
      if (!MD_EXT.test(p)) continue;
      try {
        const doc = await invoke("read_doc", { path: p });
        openCallbacks.forEach((cb) => cb(doc));
      } catch {}
    }
  });

  // Tauri does not mirror document.title onto the native window (Electron does).
  const appWindow = window.__TAURI__.window.getCurrentWindow();
  const syncTitle = () => appWindow.setTitle(document.title || "MDView");
  window.addEventListener("DOMContentLoaded", () => {
    syncTitle();
    new MutationObserver(syncTitle).observe(
      document.querySelector("title") || document.head,
      { subtree: true, childList: true, characterData: true }
    );
  });

  // Open every external link in the system browser, never in the app window.
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (/^(https?|mailto):/i.test(href)) {
        e.preventDefault();
        openUrl(href);
      }
    },
    true
  );
})();
