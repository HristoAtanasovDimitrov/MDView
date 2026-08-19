"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");

const MD_EXT = /\.(md|markdown|mdown|txt)$/i;

let win = null;
let pendingPath = filePathFromArgv(process.argv);

function filePathFromArgv(argv) {
  // Skip the executable (and the app dir when unpackaged), take the first
  // argument that looks like a markdown file path.
  return argv
    .slice(app.isPackaged ? 1 : 2)
    .find((a) => !a.startsWith("-") && MD_EXT.test(a)) || null;
}

async function readDoc(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return { path: filePath, name: path.basename(filePath), content };
}

async function sendOpen(filePath) {
  if (!win) return;
  try {
    win.webContents.send("open-path", await readDoc(filePath));
  } catch (err) {
    dialog.showErrorBox("MDView", `Could not open file:\n${filePath}\n\n${err.message}`);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      const p = filePathFromArgv(argv);
      if (p) sendOpen(p);
    }
  });

  app.whenReady().then(createWindow);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1150,
    height: 820,
    minWidth: 480,
    minHeight: 360,
    backgroundColor: "#14161c",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open every link in the system default browser, never in the app window.
  const openExternally = (url) => {
    if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url !== win.webContents.getURL()) {
      e.preventDefault();
      openExternally(url);
    }
  });

  win.loadFile(path.join(__dirname, "app", "index.html"));
  win.on("closed", () => { win = null; });
}

app.on("window-all-closed", () => app.quit());

/* ---------------- IPC ---------------- */

const FILTERS = [
  { name: "Markdown", extensions: ["md", "markdown", "mdown", "txt"] },
  { name: "All Files", extensions: ["*"] },
];

ipcMain.handle("get-initial-file", async () => {
  if (!pendingPath) return null;
  const p = pendingPath;
  pendingPath = null;
  try {
    return await readDoc(p);
  } catch {
    return null;
  }
});

ipcMain.handle("open-dialog", async () => {
  const res = await dialog.showOpenDialog(win, {
    filters: FILTERS,
    properties: ["openFile"],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return readDoc(res.filePaths[0]);
});

ipcMain.handle("read-file", (_e, filePath) => readDoc(filePath));

ipcMain.handle("save-file", async (_e, filePath, content) => {
  await fs.writeFile(filePath, content, "utf8");
  return true;
});

ipcMain.handle("save-as", async (_e, content, suggestedName) => {
  const res = await dialog.showSaveDialog(win, {
    defaultPath: suggestedName,
    filters: FILTERS,
  });
  if (res.canceled || !res.filePath) return null;
  await fs.writeFile(res.filePath, content, "utf8");
  return { path: res.filePath, name: path.basename(res.filePath) };
});

ipcMain.handle("confirm-discard", async () => {
  const res = await dialog.showMessageBox(win, {
    type: "warning",
    buttons: ["Discard changes", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    title: "Unsaved changes",
    message: "You have unsaved changes.",
    detail: "Discard them and continue?",
  });
  return res.response === 0;
});
