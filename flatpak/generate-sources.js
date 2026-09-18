"use strict";

// Regenerates flatpak/cargo-sources.json from src-tauri/Cargo.lock.
// Requires Python 3 with: pip install aiohttp tomlkit
const { spawnSync } = require("child_process");
const path = require("path");

const args = [
  path.join(__dirname, "flatpak-cargo-generator.py"),
  path.join(__dirname, "..", "src-tauri", "Cargo.lock"),
  "-o",
  path.join(__dirname, "cargo-sources.json"),
];

const interpreters =
  process.platform === "win32" ? ["py", "python", "python3"] : ["python3", "python"];
for (const py of interpreters) {
  const cmd = py === "py" ? [py, ["-3", ...args]] : [py, args];
  const res = spawnSync(cmd[0], cmd[1], { stdio: "inherit" });
  if (res.error && res.error.code === "ENOENT") continue;
  process.exit(res.status ?? 1);
}
console.error("No Python 3 interpreter found (tried python3, python, py -3)");
process.exit(1);
