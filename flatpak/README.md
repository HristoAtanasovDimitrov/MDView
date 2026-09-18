# Flatpak packaging

Files for MDView's Flatpak (submitted to Flathub separately; see FLATHUB.md).

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

(FLATHUB.md does not exist yet - a later task creates it; the reference is intentional.)
