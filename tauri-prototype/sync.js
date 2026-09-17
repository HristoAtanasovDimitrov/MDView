"use strict";

// Copies the untouched Electron renderer (app/index.html) into src/ and
// injects the Tauri bridge shim before the app's own script runs.

const fs = require("fs");
const path = require("path");

const srcHtml = path.join(__dirname, "..", "app", "index.html");
const outDir = path.join(__dirname, "src");

let html = fs.readFileSync(srcHtml, "utf8");
const marker = "<script>";
const idx = html.indexOf(marker);
if (idx === -1) throw new Error("No <script> tag found in app/index.html");
// The renderer's CSP only allows inline scripts (script-src 'unsafe-inline'),
// so the shim must be inlined, not referenced by src.
const shim = fs.readFileSync(path.join(__dirname, "src", "shim.js"), "utf8");
html = html.slice(0, idx) + "<script>\n" + shim + "\n</script>\n" + html.slice(idx);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log("Synced app/index.html -> tauri-prototype/src/index.html");
