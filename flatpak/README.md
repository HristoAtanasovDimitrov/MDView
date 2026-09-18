# Flatpak packaging

Files for MDView's Flatpak, distributed as a bundle attached to GitHub releases (built by the flatpak-bundle job in .github/workflows/release.yml).

## Regenerating cargo-sources.json

`cargo-sources.json` vendors every crate from `src-tauri/Cargo.lock` so the
Flatpak sandbox can run `cargo --offline`. Regenerate it whenever
`Cargo.lock` changes:

```bash
python -m pip install --user aiohttp tomlkit   # once
npm run flatpak:sources
```

The diff of the regenerated file is machine-generated noise; sanity-check
the entry count rather than reviewing it line by line.

## Provenance

`flatpak-cargo-generator.py` is vendored unmodified (MIT) from
[flatpak-builder-tools](https://github.com/flatpak/flatpak-builder-tools)
`cargo/flatpak-cargo-generator.py` @ `f03a673abe6ce189cea1c2857e2b44af2dd79d1f`, fetched 2026-09-18.

## Distribution

Distribution is GitHub-only by choice (2026-09-18): each release carries a
`MDView_<version>_x86_64.flatpak` bundle. The bundle embeds
`--runtime-repo` pointing at Flathub, so `flatpak install --user <file>` offers to
fetch the GNOME runtime automatically. The app itself is not published on
Flathub; if that ever changes, the manifest here is the starting point (a
Flathub copy would swap the `type: dir` source for a git source pinned to a
release tag + commit).
