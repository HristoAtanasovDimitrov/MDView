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

3. In the copied manifest, replace the `type: dir` source (including its
   `skip:` list) with a git source pinned to the latest release tag that
   contains the `flatpak/` directory, and delete the four comment lines at
   the top of the file:

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

4. Lint the copied manifest before opening the PR (the linter that Flathub
   runs on submissions). This runs on a Linux box:

   ```bash
   # Linux only; install the linter once
   flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
   flatpak install --user -y flathub org.flatpak.Builder
   flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest io.github.hristoatanasovdimitrov.MDView.yml
   ```

   Expected: one error, `finish-args-host-filesystem-access` for
   `--filesystem=host`. That access is required because MDView is a file
   editor whose windows are opened from the command line and from file
   associations (`Exec=mdview %F`): paths arrive as plain argv, which
   cannot go through the documents portal. The exception is granted via a
   pull request against the exceptions file in the
   `flathub-infra/flatpak-builder-lint` repository (linked from the linter's
   docs), typically raised during submission review - reference the
   argv/CLI-opens justification above when filing it.

5. Commit, push, and open a PR against the `new-pr` branch of
   `flathub/flathub`. Follow the PR template checklist. A test build runs on
   the PR; reviewers may request manifest tweaks (normal iteration).

6. After the app repo `flathub/io.github.hristoatanasovdimitrov.MDView` is
   created, verify the app at https://flathub.org/apps/manage using the
   "Log in with GitHub" flow (the io.github.* ID makes this automatic).

## Every release afterwards

- Flathub's external-data-checker sees the new git tag (via
  `x-checker-data`) and opens a bump PR on the flathub repo. Merge it and
  the build publishes automatically.
- **If `src-tauri/Cargo.lock` changed since the previous release**, the
  bump PR's `cargo-sources.json` is stale. Regenerate it in this repo
  (`npm run flatpak:sources`, see README.md in this directory), then copy
  it onto the flathub bump PR branch before merging:

  ```bash
  cp ../MDView/flatpak/cargo-sources.json .
  git commit -am "Update cargo sources for vX.Y.Z"
  ```

- The `<releases>` entry in the metainfo is added automatically by the
  readme-bump workflow when a release is tagged.
- If the release changed the README screenshots, also update the pinned
  screenshot URLs in the metainfo (they reference an immutable tag).
