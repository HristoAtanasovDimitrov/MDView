"use strict";

const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("mdview", {
  getInitialFile: () => ipcRenderer.invoke("get-initial-file"),
  openDialog: () => ipcRenderer.invoke("open-dialog"),
  readFile: (p) => ipcRenderer.invoke("read-file", p),
  saveFile: (p, content) => ipcRenderer.invoke("save-file", p, content),
  saveAs: (content, suggestedName) => ipcRenderer.invoke("save-as", content, suggestedName),
  confirmDiscard: () => ipcRenderer.invoke("confirm-discard"),
  pathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch { return null; }
  },
  onOpenPath: (cb) => ipcRenderer.on("open-path", (_e, doc) => cb(doc)),
});
