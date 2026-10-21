# PR #17: existing Ubuntu candidate evidence

This evidence snapshot responds to [the maintainer's request](https://github.com/liyana31811/Codexless/pull/17#issuecomment-6293037517). It publishes public-safe copies of the **already reported** 2026-10-20 results and the original npm artifact. Preparing this snapshot did not rerun acceptance tests, repack the npm artifact, change the test/runtime environment, or change the PR source branch.

## Exact candidate

| Identity | Value |
| --- | --- |
| Final PR commit | `b2f727cfed500922b996f74ae94e0c78813fc668` |
| Final Git tree | `3f44470de142222788f8f6e22e7926684062ad97` |
| Candidate build ID | `31dc0d0614200479c14822ea5536ffc4abefa0e52af486e9fad2728d7ded1b3d` |
| Preserved manifest sourceRevision | `394e8f4d356f064c27143a8580c3ba4028373e21` |
| Original package SHA256 | `43c7e2c6fe24a6b87a91bdeccd3fa574f96da6dca887daec9c605ca91ce497d4` |
| Original package size | 372485 bytes |

The tests ran on the maintainer's two patches applied, in order, to `394e8f4d356f064c27143a8580c3ba4028373e21`. That staged candidate tree was then published as commits `61c529c3f722348639500f7cdfed64b75a6793af` and `b2f727cfed500922b996f74ae94e0c78813fc668`, with the identical final tree. The manifest's sourceRevision remains the supplied base, rather than being rewritten to the later commit. The packaging report's 12 changed files are relative to that base, not the upstream PR base.

Environment recorded for the existing runs: Ubuntu 22.04.5 LTS x86_64; Node.js 22.23.3; npm 10.9.9; official Codex CLI 0.163.0; Git 2.34.1. Runtime acceptance used isolated synthetic HOME/CODEX_HOME/XDG/project fixtures, no credentials, and no model turn.

## Evidence map

| Existing result | Public records |
| --- | --- |
| 25 actual MCP checks | `evidence/linux-test.log`, `evidence/linux-mcp.redacted.json`, `evidence/ubuntu-acceptance.public.json` |
| Extra 17 actual-MCP security checks | `evidence/security/security-report.json`, `evidence/security/security.log`, accompanying README and harness |
| 11 actual installed-lifecycle checks | `evidence/lifecycle/installed-lifecycle-result.json`, `evidence/lifecycle/installed-lifecycle.log`, accompanying README and harness |
| npm dependency installation and full suite | `evidence/npm-ci.log`, `evidence/npm-test.log` |
| 12 Ubuntu platform regression checks | `evidence/platform-test.log` |
| Syntax summary | `evidence/syntax.json` (116 MJS, 16 launchers; summary record, not a per-file transcript) |
| Original package and exact manifest | `artifact/codexless-0.1.2-preview.1.tgz`, `artifact/release-manifest.json` |
| Actual package member hashes/modes/sizes | `artifact/payload-inventory.json`, `artifact/payload-inventory.tsv`, `artifact/PAYLOAD-SHA256SUMS` |
| Original packaging audit | `evidence/packaging/`, `artifact-audit.md` |
| Initial unsuccessful attempts | `evidence/diagnostics/`, kept separate from final pass counts |
| Source-to-public-copy mapping | `evidence/REDACTION.json` |

The payload inventory records the tar archive's file modes, rather than the modes of copied/extracted files. The package contains 125 regular files: 124 manifested payloads plus the manifest itself. The original package is not repacked or redacted; it contains the public candidate payload only. Its SHA256 can legitimately differ from another pack of the same source; the inventory identifies the actual published bytes.

## Outcomes and limits

The recorded final runs passed 25/25 baseline actual MCP checks, 17/17 additional actual-MCP security checks and 11/11 installed lifecycle checks. The 7 Node lifecycle/process-cleanup checks in `linux-test.log` are a separate suite from the 11 installed-lifecycle checks. `npm test` explicitly skips the native Windows installer on this Linux host.

Two initial failures are retained as provenance, not counted as final successful checks:

1. The first security harness assumed a JSON response for the SDK's plain-text schema error and stopped. Only the external harness parser was corrected; the fresh-fixture final run passed 17/17 without candidate-source changes.
2. The first installed-lifecycle fixture used a synthetic HOME beneath `/tmp`; official Codex refused creation of its sandbox helper aliases there. Moving only the synthetic HOME/XDG fixture outside `/tmp` allowed the same candidate and permissions to pass 11/11.

The installed rollback restored an integrity-checked **same-version** backup. It does not establish historical-release migration or downgrade support. The existing packaging audit constructed the exact Windows fixture on Linux, without executing the PowerShell installer. The three public canonical files matched the public baseline; this does not certify private household canonical parity.

Hosted Ubuntu/Windows CI on the final commit is linked in [run 39437027257](https://github.com/williammhu/Codexless/actions/runs/39437027257); its synthetic peers are distinct from local live-Codex acceptance. Any CI status in the copied summary is a historical observation made during the earlier report, not a new status check.

**Not run/not certified here:** complete native Windows/macOS installer and live-Codex acceptance; private canonical parity; Linux arm64 real-machine acceptance; Browser/Excel; a metered model turn; account Tunnel/ChatGPT E2E for this core candidate; historical-release downgrade; persistent systemd start/enable. Personal integration deployment results are not evidence for this core candidate. No merge, release or formal platform-support approval is asserted.

## Integrity verification

From this directory, `sha256sum -c SHA256SUMS` verifies the public snapshot. `python3 verify-evidence.py` additionally reads the existing package in memory and verifies every member's bytes/mode/size, the separate manifest, all 124 manifest payloads and the 16 LF/executable Linux launchers. It does not install or start Codexless and does not run acceptance tests.

The downloadable ZIP is an evidence container, not a newly built application package. `DOWNLOADS.sha256` (published beside it) checks that container; `SHA256SUMS` inside checks its contents. Original-to-public digests and redaction notes are in `evidence/REDACTION.json`. Private snapshots/configuration, credentials and unrelated machine data are omitted. Published harness path adaptations are explicitly disclosed and were not rerun as part of publication.

The unchanged historical packaging report refers to its original local `audit-packaging.mjs`; that harness is not distributed in this snapshot. The supplied `verify-evidence.py` independently verifies the published package and inventory, but does not rerun the historical fixture-construction or public-canonical-baseline checks. Their recorded outcomes remain in the packaging report/results.
