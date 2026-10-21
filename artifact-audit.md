# Existing artifact byte audit — 2026-10-20

This inventory was produced from the existing acceptance artifact. The original `.tgz` was copied without repacking or altering its bytes. Archive members were read in memory; no package files were extracted to a runtime installation. No dependency install, `npm pack`, service launch, or installation/runtime test was rerun, and neither the candidate source nor the personal installation was changed.

| Identity | Value |
| --- | --- |
| Artifact | `artifact/codexless-0.1.2-preview.1.tgz` |
| Artifact SHA256 | `43c7e2c6fe24a6b87a91bdeccd3fa574f96da6dca887daec9c605ca91ce497d4` |
| Artifact size | 372,485 bytes |
| Manifest SHA256 | `c5702be0cc2f3631ad0d1c4f54098eda31a86693da55247ebcc6df3684730f23` |
| Recorded candidate tree | `3f44470de142222788f8f6e22e7926684062ad97` |
| Manifest sourceRevision | `394e8f4d356f064c27143a8580c3ba4028373e21` |
| Manifest buildId | `31dc0d0614200479c14822ea5536ffc4abefa0e52af486e9fad2728d7ded1b3d` |
| Version | `0.1.2-preview.1` |

The candidate tree is carried forward from the existing acceptance evidence. It is a Git tree identifier, not a new commit, and is not inferred from the archive alone.

The byte audit confirms:

- All **125** archive entries are regular files with unique safe `package/...` paths; no symlinks or hard links occur.
- All **124** payload hashes listed in the manifest match their archive bytes. The remaining entry is the manifest itself, which intentionally does not hash itself.
- The extracted `release-manifest.json` is byte-identical to the package member and the candidate source manifest.
- All **16** `package/bin/codexless-linux*` launchers retain executable mode and LF-only bytes with a final LF.
- Known API-key, Tunnel-ID and private-key patterns and the actual user-home/project path were checked without printing matched contents; no findings were present. No private `auth.json`, `session.json`, `config.toml`, acceptance directories, Git metadata, or node_modules are included.

`artifact/PAYLOAD-SHA256SUMS` records SHA256 for archive-member paths. `artifact/payload-inventory.json` and `artifact/payload-inventory.tsv` record all 125 member paths, hashes, octal permission modes, byte sizes, and manifest membership. Hashes and modes come from the original archive, not from a new filesystem extraction. JSON metadata explicitly records that no new runtime or installation tests were performed.

These files provide inspectable bytes for the already recorded acceptance results. They do not add native Windows/macOS or Linux arm64 validation, a model turn, or private household canonical-parity certification.
