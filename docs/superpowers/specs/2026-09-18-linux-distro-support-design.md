# Linux distro support: Rocky Linux and Omarchy (Flathub + rpm)

**Date:** 2026-09-18
**Status:** Approved

## Goal

A Rocky Linux 8/9/10 or Omarchy (Arch-based) user installs MDView with one
standard command for their platform:

- Everywhere (Rocky 8/9/10, Omarchy/Arch, and any other distro):
  `flatpak install flathub com.hristodimitrov.mdview`
- Rocky 10 / Fedora, natively: download the `.rpm` from GitHub Releases.

## Background and constraints

- Tauri v2 requires WebKitGTK 4.1 (libsoup3). EL8 and EL9 do not ship it in
  any repo (AppStream or EPEL), so a native package for Rocky 8/9 is
  **technically impossible** — the webview library does not exist there.
- EL10 gets `webkit2gtk4.1` via EPEL, so a native `.rpm` works on Rocky 10.
- Flatpak's GNOME runtime bundles its own WebKitGTK and glibc, and Flatpak
  itself is in RHEL 8+ AppStream — one channel covers all Rocky versions and
  Arch-family distros uniformly.
- Decisions made during brainstorming:
  - Rocky delivery: **Flatpak + rpm** (rpm for Rocky 10/Fedora).
  - Omarchy delivery: **Flatpak only** (no AUR package).
  - Flatpak build strategy: **full source build** in Flathub's sandbox
    (guaranteed to pass Flathub review; no binary repacks).
- Build inputs are flatpak-friendly: `src-tauri/Cargo.lock` is committed, and
  the only npm dependency is `@tauri-apps/cli`, which the Flatpak build
  bypasses entirely (run `sync.js` with node, then plain `cargo build`; the
  frontend in `src/` is embedded into the binary at compile time by tauri's
  codegen). Only cargo offline sources need to be generated.

## 1. Native `.rpm` (Rocky 10 / Fedora)

- Add `"rpm"` to `bundle.targets` in `src-tauri/tauri.conf.json`.
- Add `-o -name '*.rpm'` to the release upload glob in
  `.github/workflows/release.yml`.
- The rpm's auto-generated dependency on `webkit2gtk4.1` resolves from EPEL on
  Rocky 10. README documents `sudo dnf install epel-release` first.

## 2. Flatpak, built from source (new `flatpak/` directory)

- **Manifest** `flatpak/com.hristodimitrov.mdview.yml`:
  - Runtime: `org.gnome.Platform` (ships WebKitGTK 4.1), matching
    `org.gnome.Sdk`, with SDK extensions for Rust (`rust-stable`) and Node.
  - Build steps: `node sync.js` → `cargo build --release --offline`
    (plain cargo, not tauri-cli — no Tauri bundlers inside Flatpak) →
    install the binary, icon, desktop file, and metainfo.
  - Sandbox permissions: `--filesystem=host` so opening/saving arbitrary
    `.md` files and the file association behave like a native app, plus the
    standard Wayland/X11/DRI sockets.
- **Offline sources** `flatpak/cargo-sources.json`, generated from
  `src-tauri/Cargo.lock` with flatpak-builder-tools' cargo generator. A repo
  script (`npm run flatpak:sources`) regenerates it whenever Rust
  dependencies change.
- **Desktop entry** `flatpak/com.hristodimitrov.mdview.desktop`: app name,
  Productivity category, `text/markdown` MimeType, `%F` exec field so file
  association and "Open with" work.
- **AppStream metainfo** `flatpak/com.hristodimitrov.mdview.metainfo.xml`:
  name, summary, MIT license, developer name, homepage, screenshots (reuse
  README screenshot URLs), release history, and the markdown file
  association. Required for the Flathub listing.

## 3. Flathub submission and release flow

- **One-time submission (manual, by the repo owner):** PR against
  `flathub/flathub` with the manifest; after acceptance, verify the app
  (GitHub-account verification, since the app ID is name-based). Claude
  prepares all files and exact steps; the PR must come from the owner's
  account.
- **Per release afterwards:** Flathub's `flatpak-external-data-checker`
  watches git tags and opens the version-bump PR on the flathub repo
  automatically; the owner merges it. Because `cargo-sources.json` lives in
  this repo and is regenerated when `Cargo.lock` changes, the checker PR
  picks it up via the tag. The metainfo `<releases>` entry is added as part
  of each release (same place the README version bump happens).

## 4. CI validation

- New job in `.github/workflows/smoke-test.yml`: build the Flatpak manifest
  with `flatpak-builder` on `ubuntu-latest` (against the local checkout, not
  the tag) so a broken manifest never reaches Flathub.
- Release smoke coverage: install-test the `.rpm` in a `rockylinux:10`
  container — enable EPEL, `dnf install` the built rpm, verify the binary
  and its library links resolve (`ldd` clean / binary `--help`-level check;
  no GUI run in the container).

## 5. Docs

- README Download table: split the Linux row into:
  - **Flathub** — all distros, incl. Rocky 8/9/10 and Omarchy/Arch
    (`flatpak install flathub com.hristodimitrov.mdview`).
  - **`.rpm`** — Rocky 10 / Fedora; note the EPEL prerequisite on Rocky.
  - **`.deb`** — Ubuntu / Debian (unchanged).
  - **AppImage** — fallback for other glibc-2.39+ distros (unchanged).

## Out of scope

- AUR package (decided against; Flatpak covers Omarchy).
- Rocky 8/9 native packages (impossible for Tauri v2, see constraints).
- aarch64 Flatpak beyond what Flathub's builders produce automatically.
- Code signing (all artifacts remain unsigned, matching existing releases).

## Error handling / risks

- **Flathub review feedback** may request manifest changes (permissions,
  metainfo quality). Treat as iteration on the submission PR, not scope
  change.
- **`cargo build --offline` divergence from tauri-cli:** the tauri build
  script runs `beforeBuildCommand` only under tauri-cli; the manifest runs
  `node sync.js` explicitly before cargo, keeping outputs identical.
- **EPEL dependency on Rocky 10:** if the `webkit2gtk4.1` EPEL package is
  ever retired, the rpm degrades to Fedora-only; Flatpak remains the covered
  path for all Rocky versions.

## Testing summary

- CI: flatpak-builder build of the manifest on every push (smoke-test).
- CI: rpm install test in a Rocky 10 container on release builds.
- Manual, once: install from Flathub beta channel (or local
  `flatpak-builder --install`) on an Arch and a Rocky VM before first
  publish.
