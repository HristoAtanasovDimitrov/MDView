# Linux Distro Support (Flathub + rpm) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship MDView to Rocky Linux 8/9/10 and Omarchy/Arch via Flathub (source-built Flatpak), plus a native `.rpm` for Rocky 10/Fedora.

**Architecture:** Two independent delivery channels. (1) The existing Tauri release pipeline gains an `rpm` bundle target with a Rocky 10 container install-test. (2) A new `flatpak/` directory holds a source-build Flatpak manifest (GNOME runtime supplies WebKitGTK 4.1; plain `cargo build --offline` with vendored crates replaces tauri-cli inside the sandbox), validated by CI, then submitted to Flathub once.

**Tech Stack:** Tauri v2 (Rust), flatpak-builder, flatpak-cargo-generator (Python), GitHub Actions, Docker (rockylinux/rockylinux:10).

**Spec:** `docs/superpowers/specs/2026-09-18-linux-distro-support-design.md`

**Deviation from spec (approved rationale):** The spec assumed GitHub-account verification for the app ID `com.hristodimitrov.mdview`. Flathub only auto-verifies `io.github.<username>.*` IDs; a `com.*` ID requires proving ownership of the matching domain. The Flatpak app ID is therefore **`io.github.hristoatanasovdimitrov.MDView`**. The Tauri `identifier` in `tauri.conf.json` is untouched (it does not need to match). If the user owns `hristodimitrov.com`, the ID can be swapped back with a rename of the three `flatpak/` files and the strings inside them.

**Second spec correction:** Flathub's external-data-checker bumps the git tag in the flathub manifest, but it cannot regenerate `cargo-sources.json`. When `src-tauri/Cargo.lock` changes between releases, the flathub-repo copy of `cargo-sources.json` must be refreshed in the bump PR (one command, documented in `flatpak/FLATHUB.md`, Task 8).

**Working notes for the executor:**
- The dev machine is Windows; `flatpak-builder` cannot run locally. Real validation happens in CI (Task 9). Local verification is limited to syntax checks.
- Run all `git` and file commands from the repo root `C:\Users\hr.dimitrov\Documents\GitHub\MDView`.
- The binary built by cargo is `src-tauri/target/release/mdview` (crate name `mdview` in `src-tauri/Cargo.toml`).
- `src-tauri/icons/icon.png` is 512x512.
- v2.0.0 was tagged 2026-09-17.

---

### Task 1: Add the rpm bundle target to the release pipeline

**Files:**
- Modify: `src-tauri/tauri.conf.json:29`
- Modify: `.github/workflows/release.yml:80`

- [ ] **Step 1: Add `rpm` to the bundle targets**

In `src-tauri/tauri.conf.json`, change:

```json
    "targets": ["nsis", "dmg", "appimage", "deb"],
```

to:

```json
    "targets": ["nsis", "dmg", "appimage", "deb", "rpm"],
```

- [ ] **Step 2: Add `*.rpm` to the release upload glob**

In `.github/workflows/release.yml`, change:

```yaml
              \( -name '*.exe' -o -name '*.dmg' -o -name '*.deb' -o -name '*.AppImage' \)
```

to:

```yaml
              \( -name '*.exe' -o -name '*.dmg' -o -name '*.deb' -o -name '*.AppImage' -o -name '*.rpm' \)
```

- [ ] **Step 3: Verify both files parse**

```bash
node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8')); console.log('json ok')"
python -c "import yaml,io; yaml.safe_load(io.open('.github/workflows/release.yml',encoding='utf8')); print('yaml ok')"
```

Expected: `json ok`, `yaml ok`. (If `python` is missing, try `py -3`; if that is missing too, visually diff the one-line YAML change — it only extends an existing `\( ... \)` group.)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/tauri.conf.json .github/workflows/release.yml
git commit -m "Release: build and upload an rpm bundle"
```

---

### Task 2: Install-test the rpm in a Rocky Linux 10 container

**Files:**
- Modify: `.github/workflows/release.yml` (insert a step after the "Build (unsigned, no signing certificates)" step, before "Upload bundles to the draft release")

- [ ] **Step 1: Add the container install-test step**

Insert into the `build` job of `.github/workflows/release.yml`, directly after the `tauri-apps/tauri-action@v0` step:

```yaml
      - name: Verify the rpm installs on Rocky Linux 10
        if: matrix.os == 'ubuntu-latest'
        run: |
          set -e
          ls src-tauri/target/release/bundle/rpm/*.rpm
          docker run --rm -v "$PWD/src-tauri/target/release/bundle/rpm:/rpms:ro" \
            rockylinux/rockylinux:10 bash -ec '
              dnf install -y epel-release
              dnf install -y /rpms/*.rpm
              bin=$(rpm -qlp /rpms/*.rpm | grep "^/usr/bin/" | head -n1)
              echo "installed binary: $bin"
              test -x "$bin"
              ldd "$bin" | tee /tmp/ldd.out
              if grep -q "not found" /tmp/ldd.out; then
                echo "FAIL: unresolved shared libraries"; exit 1
              fi
              echo "RPM INSTALL OK on Rocky 10"
            '
```

Notes for the executor: the rpm's `webkit2gtk4.1` dependency only resolves after `epel-release` is installed — that is the point of the test. `rpm -qlp` queries the rpm *file*, so the test does not hardcode the package name Tauri generates.

- [ ] **Step 2: Verify workflow YAML parses**

Run:

```bash
python -c "import yaml,io; yaml.safe_load(io.open('.github/workflows/release.yml',encoding='utf8')); print('yaml ok')"
```

Expected: `yaml ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "Release: install-test the rpm on Rocky Linux 10"
```

---

### Task 3: Desktop entry and AppStream metainfo

**Files:**
- Create: `flatpak/io.github.hristoatanasovdimitrov.MDView.desktop`
- Create: `flatpak/io.github.hristoatanasovdimitrov.MDView.metainfo.xml`

- [ ] **Step 1: Write the desktop entry**

`flatpak/io.github.hristoatanasovdimitrov.MDView.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=MDView
Comment=Dark markdown viewer and editor
Exec=mdview %F
Icon=io.github.hristoatanasovdimitrov.MDView
Terminal=false
Categories=Utility;TextEditor;
MimeType=text/markdown;
StartupWMClass=MDView
```

- [ ] **Step 2: Write the AppStream metainfo**

`flatpak/io.github.hristoatanasovdimitrov.MDView.metainfo.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>io.github.hristoatanasovdimitrov.MDView</id>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>
  <name>MDView</name>
  <summary>Dark markdown viewer and editor</summary>
  <description>
    <p>
      A fast, simple Markdown viewer and editor. Reading view with book-style
      serif typography, tabs restored across launches, an edit mode with split
      live preview, find and search-and-replace with regular expressions, and
      clickable task-list checkboxes that edit the source document.
    </p>
    <p>
      The markdown renderer is dependency-free and covers headings, emphasis,
      code, lists, task lists, tables, blockquotes, links, images, and
      horizontal rules.
    </p>
  </description>
  <launchable type="desktop-id">io.github.hristoatanasovdimitrov.MDView.desktop</launchable>
  <url type="homepage">https://github.com/HristoAtanasovDimitrov/MDView</url>
  <url type="bugtracker">https://github.com/HristoAtanasovDimitrov/MDView/issues</url>
  <url type="vcs-browser">https://github.com/HristoAtanasovDimitrov/MDView</url>
  <developer id="io.github.hristoatanasovdimitrov">
    <name>Hristo Dimitrov</name>
  </developer>
  <content_rating type="oars-1.1"/>
  <screenshots>
    <screenshot type="default">
      <image>https://raw.githubusercontent.com/HristoAtanasovDimitrov/MDView/main/docs/screenshot-view.png</image>
      <caption>Reading view</caption>
    </screenshot>
    <screenshot>
      <image>https://raw.githubusercontent.com/HristoAtanasovDimitrov/MDView/main/docs/screenshot-edit.png</image>
      <caption>Edit mode with split live preview</caption>
    </screenshot>
  </screenshots>
  <releases>
    <release version="2.0.0" date="2026-09-17"/>
  </releases>
</component>
```

- [ ] **Step 3: Verify the XML parses**

Run (PowerShell):

```powershell
[xml](Get-Content "flatpak/io.github.hristoatanasovdimitrov.MDView.metainfo.xml" -Raw) | Out-Null; "xml ok"
```

Expected: `xml ok`. (Full `appstreamcli validate` runs in CI, Task 6.)

- [ ] **Step 4: Commit**

```bash
git add flatpak/io.github.hristoatanasovdimitrov.MDView.desktop flatpak/io.github.hristoatanasovdimitrov.MDView.metainfo.xml
git commit -m "Flatpak: desktop entry and AppStream metainfo"
```

---

### Task 4: Vendored cargo sources for offline builds

**Files:**
- Create: `flatpak/flatpak-cargo-generator.py` (vendored from flatpak-builder-tools)
- Create: `flatpak/cargo-sources.json` (generated)
- Modify: `package.json` (add script)

- [ ] **Step 1: Vendor the generator script**

```bash
curl -fsSL -o flatpak/flatpak-cargo-generator.py \
  https://raw.githubusercontent.com/flatpak/flatpak-builder-tools/master/cargo/flatpak-cargo-generator.py
```

Expected: file exists, starts with `#!/usr/bin/env python3`. It is MIT-licensed (same as this repo); vendoring keeps regeneration reproducible.

- [ ] **Step 2: Add the npm script**

In `package.json`, change the `scripts` block to:

```json
  "scripts": {
    "sync": "node sync.js",
    "start": "tauri dev",
    "dist": "tauri build",
    "tauri": "tauri",
    "flatpak:sources": "python flatpak/flatpak-cargo-generator.py src-tauri/Cargo.lock -o flatpak/cargo-sources.json"
  },
```

- [ ] **Step 3: Generate cargo-sources.json**

```bash
python -m pip install --user aiohttp toml
npm run flatpak:sources
```

Expected: `flatpak/cargo-sources.json` is created (a large JSON array; every crate in `src-tauri/Cargo.lock` appears). If `python` is not on PATH on this machine, try `py -3` in both commands.

- [ ] **Step 4: Verify the generated JSON**

```bash
node -e "const s=require('./flatpak/cargo-sources.json'); console.log('entries:', s.length); if (!s.length) process.exit(1)"
```

Expected: `entries: <several hundred>`.

- [ ] **Step 5: Commit**

```bash
git add flatpak/flatpak-cargo-generator.py flatpak/cargo-sources.json package.json
git commit -m "Flatpak: vendored cargo sources and generator script"
```

---

### Task 5: Flatpak manifest

**Files:**
- Create: `flatpak/io.github.hristoatanasovdimitrov.MDView.yml`
- Modify: `.gitignore` (flatpak-builder artifacts)

- [ ] **Step 1: Write the manifest**

`flatpak/io.github.hristoatanasovdimitrov.MDView.yml`:

```yaml
# Flatpak manifest for MDView, built from source.
# This copy builds the local checkout (type: dir) and is what CI validates.
# The Flathub copy of this manifest uses a git source pinned to a release
# tag instead - see flatpak/FLATHUB.md.
app-id: io.github.hristoatanasovdimitrov.MDView
runtime: org.gnome.Platform
runtime-version: '48'
sdk: org.gnome.Sdk
sdk-extensions:
  - org.freedesktop.Sdk.Extension.rust-stable
  - org.freedesktop.Sdk.Extension.node22
command: mdview
finish-args:
  # Standard GUI access
  - --share=ipc
  - --socket=wayland
  - --socket=fallback-x11
  - --device=dri
  # Markdown documents may embed remote images
  - --share=network
  # Open/save arbitrary .md files like a native editor (CLI opens included)
  - --filesystem=host
build-options:
  append-path: /usr/lib/sdk/rust-stable/bin:/usr/lib/sdk/node22/bin
modules:
  - name: mdview
    buildsystem: simple
    build-options:
      env:
        CARGO_HOME: /run/build/mdview/cargo
    build-commands:
      # sync.js inlines src/shim.js into src/index.html; tauri's codegen then
      # embeds src/ into the binary at compile time, so no bundler is needed.
      - node sync.js
      - cargo --offline build --release --manifest-path src-tauri/Cargo.toml
      - install -Dm755 src-tauri/target/release/mdview /app/bin/mdview
      - install -Dm644 src-tauri/icons/icon.png /app/share/icons/hicolor/512x512/apps/io.github.hristoatanasovdimitrov.MDView.png
      - install -Dm644 flatpak/io.github.hristoatanasovdimitrov.MDView.desktop /app/share/applications/io.github.hristoatanasovdimitrov.MDView.desktop
      - install -Dm644 flatpak/io.github.hristoatanasovdimitrov.MDView.metainfo.xml /app/share/metainfo/io.github.hristoatanasovdimitrov.MDView.metainfo.xml
    sources:
      - type: dir
        path: ..
        skip:
          - src-tauri/target
          - node_modules
          - dist
          - .git
      - cargo-sources.json
```

Executor note: `CARGO_HOME=/run/build/mdview/cargo` is required — the generated `cargo-sources.json` vendors crates into `cargo/vendor/` and writes `cargo/config` with the offline source replacement; `/run/build/<module-name>` is the module build directory.

- [ ] **Step 2: Ignore flatpak-builder artifacts**

Append to `.gitignore` (create it if missing; check first — the repo may already have one):

```gitignore
.flatpak-builder/
flatpak/build-dir/
flatpak/repo/
```

- [ ] **Step 3: Verify the manifest YAML parses**

```bash
python -c "import yaml,io; yaml.safe_load(io.open('flatpak/io.github.hristoatanasovdimitrov.MDView.yml',encoding='utf8')); print('yaml ok')"
```

Expected: `yaml ok`.

- [ ] **Step 4: Commit**

```bash
git add flatpak/io.github.hristoatanasovdimitrov.MDView.yml .gitignore
git commit -m "Flatpak: source-build manifest"
```

---

### Task 6: CI job that builds the Flatpak

**Files:**
- Modify: `.github/workflows/smoke-test.yml`

- [ ] **Step 1: Add a push trigger scoped to flatpak inputs and gate the existing job**

Change the top of `.github/workflows/smoke-test.yml` from:

```yaml
name: Smoke test

on:
  workflow_dispatch:

jobs:
  smoke:
```

to:

```yaml
name: Smoke test

on:
  workflow_dispatch:
  push:
    paths:
      - "flatpak/**"
      - "src-tauri/Cargo.lock"

jobs:
  smoke:
    # The app-launch smoke test is manual-only; pushes to flatpak files
    # trigger just the flatpak job below.
    if: github.event_name == 'workflow_dispatch'
```

(The existing `strategy:` block and everything below it in the `smoke` job stays as is, indented under `smoke:` after the new `if:` line.)

- [ ] **Step 2: Append the flatpak job**

Add at the end of `.github/workflows/smoke-test.yml`, as a sibling of `smoke:`:

```yaml
  flatpak:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install flatpak-builder and validators
        run: |
          sudo apt-get update
          sudo apt-get install -y flatpak flatpak-builder appstream desktop-file-utils

      - name: Validate desktop entry and metainfo
        run: |
          desktop-file-validate flatpak/io.github.hristoatanasovdimitrov.MDView.desktop
          appstreamcli validate --no-net flatpak/io.github.hristoatanasovdimitrov.MDView.metainfo.xml

      - name: Install the GNOME runtime and SDK extensions
        run: |
          flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
          flatpak install --user -y flathub \
            org.gnome.Platform//48 org.gnome.Sdk//48 \
            org.freedesktop.Sdk.Extension.rust-stable//24.08 \
            org.freedesktop.Sdk.Extension.node22//24.08

      - name: Build the flatpak from the local checkout
        run: |
          flatpak-builder --user --force-clean --disable-rofiles-fuse \
            flatpak/build-dir flatpak/io.github.hristoatanasovdimitrov.MDView.yml

      - name: Check the built app ships the binary and metadata
        run: |
          test -x flatpak/build-dir/files/bin/mdview
          test -f flatpak/build-dir/files/share/applications/io.github.hristoatanasovdimitrov.MDView.desktop
          test -f flatpak/build-dir/files/share/metainfo/io.github.hristoatanasovdimitrov.MDView.metainfo.xml
          echo "FLATPAK BUILD OK"
```

Executor note: if the runtime install fails because `org.freedesktop.Sdk.Extension.node22//24.08` does not exist on flathub, substitute `node20` for `node22` here AND in `flatpak/io.github.hristoatanasovdimitrov.MDView.yml` (both the `sdk-extensions` entry and `append-path`); `sync.js` only needs Node ≥ 14. Likewise, if `org.gnome.Platform//48` has been EOL'd by the time this runs, bump to the current stable (`flatpak remote-info flathub org.gnome.Platform` lists branches) and match the freedesktop extension branch it is based on.

- [ ] **Step 3: Verify workflow YAML parses**

```bash
python -c "import yaml,io; yaml.safe_load(io.open('.github/workflows/smoke-test.yml',encoding='utf8')); print('yaml ok')"
```

Expected: `yaml ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/smoke-test.yml
git commit -m "CI: build and validate the flatpak on flatpak-related pushes"
```

---

### Task 7: README download table

**Files:**
- Modify: `README.md:22` (the Linux row)

- [ ] **Step 1: Replace the single Linux row with per-channel rows**

Replace this row in the Download table:

```markdown
| Linux | [`MDView_2.0.0_amd64.deb`](https://github.com/HristoAtanasovDimitrov/MDView/releases/download/v2.0.0/MDView_2.0.0_amd64.deb) or [`.AppImage`](https://github.com/HristoAtanasovDimitrov/MDView/releases/download/v2.0.0/MDView_2.0.0_amd64.AppImage) | Prefer the .deb (~2 MB, uses the system WebKitGTK); the AppImage bundles its own and is large. AppImage: `chmod +x` and run |
```

with:

```markdown
| Linux (any distro) | `flatpak install flathub io.github.hristoatanasovdimitrov.MDView` | Via [Flathub](https://flathub.org/apps/io.github.hristoatanasovdimitrov.MDView). Works on Rocky/RHEL 8+, Arch/Omarchy, Ubuntu, and anything else with Flatpak |
| Linux (Ubuntu/Debian) | [`MDView_2.0.0_amd64.deb`](https://github.com/HristoAtanasovDimitrov/MDView/releases/download/v2.0.0/MDView_2.0.0_amd64.deb) | ~2 MB, uses the system WebKitGTK |
| Linux (Rocky 10/Fedora) | [`MDView-2.0.0-1.x86_64.rpm`](https://github.com/HristoAtanasovDimitrov/MDView/releases/download/v2.0.0/MDView-2.0.0-1.x86_64.rpm) | On Rocky, enable EPEL first: `sudo dnf install epel-release`. Not installable on Rocky 8/9 (no WebKitGTK 4.1 there - use the Flatpak) |
| Linux (other) | [`MDView_2.0.0_amd64.AppImage`](https://github.com/HristoAtanasovDimitrov/MDView/releases/download/v2.0.0/MDView_2.0.0_amd64.AppImage) | Bundles its own WebKitGTK (large). `chmod +x` and run. Needs glibc ≥ the build runner's (Ubuntu 24.04) |
```

Executor note: the rpm link and the Flathub page will 404 until (a) the next tagged release runs the new pipeline and (b) the Flathub submission is accepted. That is expected — same pattern as every pre-release README bump. Flag it in the final report so the user knows to cut a release.

- [ ] **Step 2: Verify the table renders**

Run: `git diff README.md` and check every `|` row has 3 columns and the pipes inside backtick spans are absent (none used above).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "README: Flathub, rpm, and per-distro Linux download rows"
```

---

### Task 8: Release-time version bumps for rpm links and metainfo

**Files:**
- Modify: `.github/workflows/readme-bump.yml:27-42`
- Create: `flatpak/FLATHUB.md`

- [ ] **Step 1: Extend the bump workflow**

Replace the "Rewrite README download links" step in `.github/workflows/readme-bump.yml` with:

```yaml
      - name: Rewrite README download links and flatpak metainfo
        run: |
          VER="${{ inputs.version }}"
          VER="${VER#v}"
          sed -E -i "s/(MDView_)[0-9]+\.[0-9]+\.[0-9]+/\1${VER}/g" README.md
          sed -E -i "s/(MDView-)[0-9]+\.[0-9]+\.[0-9]+(-1)/\1${VER}\2/g" README.md
          sed -E -i "s#(releases/(tag|download)/v)[0-9]+\.[0-9]+\.[0-9]+#\1${VER}#g" README.md
          sed -E -i "s/\[[0-9]+\.[0-9]+\.[0-9]+\]\(https/[${VER}](https/g" README.md
          # Prepend a <release> entry to the flatpak metainfo if this version
          # is not recorded yet (Flathub requires an entry per release).
          META="flatpak/io.github.hristoatanasovdimitrov.MDView.metainfo.xml"
          if ! grep -q "version=\"${VER}\"" "$META"; then
            sed -i "s#<releases>#<releases>\n    <release version=\"${VER}\" date=\"$(date +%F)\"/>#" "$META"
          fi
          if git diff --quiet; then
            echo "Already at ${VER}, nothing to bump"
          else
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add README.md "$META"
            git commit -m "Bump README links and flatpak metainfo to ${VER}"
            git push origin main
          fi
```

(Only the step changes; the workflow triggers, permissions, and checkout step stay as they are.)

- [ ] **Step 2: Write the Flathub submission and maintenance guide**

`flatpak/FLATHUB.md`:

````markdown
# Publishing MDView on Flathub

## One-time submission (repo owner, ~30 min + review wait)

1. Fork https://github.com/flathub/flathub and clone the fork's `new-pr` branch:

   ```bash
   git clone --branch=new-pr git@github.com:<your-fork>/flathub.git flathub
   cd flathub
   git checkout -b add-mdview new-pr
   ```

2. Copy the two files Flathub needs from this repo:

   ```bash
   cp ../MDView/flatpak/io.github.hristoatanasovdimitrov.MDView.yml .
   cp ../MDView/flatpak/cargo-sources.json .
   ```

3. In the copied manifest, replace the `type: dir` source with the git
   source (Flathub builds from the release tag):

   ```yaml
    sources:
      - type: git
        url: https://github.com/HristoAtanasovDimitrov/MDView.git
        tag: v2.1.0
        x-checker-data:
          type: git
          tag-pattern: ^v([\d.]+)$
      - cargo-sources.json
   ```

   Use the latest tag that contains the `flatpak/` directory. Delete the
   `skip:` list and the comment header referring to the local build.

4. Commit, push, and open a PR against the `new-pr` branch of
   `flathub/flathub`. Follow the PR template checklist. A test build runs on
   the PR; reviewers may request manifest tweaks (normal iteration).

5. After the app repo `flathub/io.github.hristoatanasovdimitrov.MDView` is
   created, verify the app at https://flathub.org/apps/manage using the
   "Log in with GitHub" flow (the io.github.* ID makes this automatic).

## Every release afterwards

- Flathub's external-data-checker sees the new git tag (via
  `x-checker-data`) and opens a bump PR on the flathub repo. Merge it and
  the build publishes automatically.
- **If `src-tauri/Cargo.lock` changed since the previous release**, the
  bump PR's `cargo-sources.json` is stale. Regenerate it in this repo
  (`npm run flatpak:sources`, committed by the release prep), then copy it
  onto the flathub bump PR branch before merging:

  ```bash
  cp ../MDView/flatpak/cargo-sources.json .
  git commit -am "Update cargo sources for vX.Y.Z"
  ```

- The `<releases>` entry in the metainfo is added automatically by the
  readme-bump workflow when a release is tagged.
````

- [ ] **Step 3: Verify workflow YAML parses**

```bash
python -c "import yaml,io; yaml.safe_load(io.open('.github/workflows/readme-bump.yml',encoding='utf8')); print('yaml ok')"
```

Expected: `yaml ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/readme-bump.yml flatpak/FLATHUB.md
git commit -m "Release: bump rpm links and metainfo releases; document Flathub flow"
```

---

### Task 9: Push and verify in CI

**Files:** none (verification only)

- [ ] **Step 1: Push the branch**

Work happened on `main` per this repo's convention (spec was committed to `main` directly). Push:

```bash
git push origin main
```

- [ ] **Step 2: Confirm the flatpak CI job runs and passes**

The push touches `flatpak/**`, so the `Smoke test` workflow's `flatpak` job triggers automatically:

```bash
gh run list --workflow=smoke-test.yml --limit 3
gh run watch $(gh run list --workflow=smoke-test.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: the `flatpak` job succeeds with `FLATPAK BUILD OK`; the `smoke` job shows as skipped (it is dispatch-only). If the job fails on the runtime/extension install, apply the node20 / runtime-branch fallback documented in Task 6 and push again.

- [ ] **Step 3: Dispatch the full smoke test (regression check)**

```bash
gh workflow run smoke-test.yml
gh run watch $(gh run list --workflow=smoke-test.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: existing `smoke` matrix passes unchanged on ubuntu and macos.

- [ ] **Step 4: Update the knowledge graph**

```bash
graphify update .
```

---

### Task 10: Hand off the manual steps

**Files:** none

- [ ] **Step 1: Report to the user**

The final report must tell the user:

1. **Cut a release** (e.g. `v2.1.0`) to produce the first rpm and exercise the Rocky 10 install test; the README's rpm link 404s until then.
2. **Submit to Flathub** following `flatpak/FLATHUB.md` — the PR must come from their GitHub account (one-time, then verify the app via "Log in with GitHub").
3. The rpm is Rocky 10/Fedora only; Rocky 8/9 users use the Flatpak (technical constraint documented in the spec).
4. Per the spec's testing summary, do one manual install check before first publish: build locally on any Linux box or VM with `flatpak-builder --user --install --force-clean flatpak/build-dir flatpak/io.github.hristoatanasovdimitrov.MDView.yml`, then open a `.md` file — ideally once on an Arch/Omarchy VM and once on a Rocky VM.
