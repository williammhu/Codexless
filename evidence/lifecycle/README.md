# Actual installed Linux lifecycle acceptance

Final result: **11/11 checks passed** on Ubuntu x64, Node.js 22.23.3, npm 10.9.9 and Codex CLI 0.163.0.

The exact candidate index tree was `3f44470de142222788f8f6e22e7926684062ad97` before and after testing. Its release-manifest SHA-256 was `c5702be0cc2f3631ad0d1c4f54098eda31a86693da55247ebcc6df3684730f23`.

`installed-lifecycle.mjs` installs the complete reviewed candidate into a synthetic HOME and XDG directories beneath this artifact directory. It does not copy source node_modules: initial install, reinstall and update each execute the actual installer's `npm ci --omit=dev`. The MCP client dependency is separate test tooling; the actual launched server is the installed candidate and uses its dedicated installed Node runtime.

The test covers:

- Actual install with private configuration, explicit trust of one synthetic project, production dependencies and a copied Node/npm runtime.
- Installed lifecycle doctor.
- Installed stdio initialize, exact 45-tool discovery and actual `uname -s` returning `Linux`.
- Installed foreground loopback HTTP health/readiness, initialize, tool discovery and actual Linux command, followed by shutdown.
- Idempotent reinstall preserving runtime configuration and isolated Codex configuration.
- Update from the same exact candidate, creating complete application/runtime/dependency integrity snapshots.
- Integrity-checked rollback to that same candidate version, followed by another actual MCP command.
- No user service or autostart started or enabled.
- Uninstall removing owned app/runtime/commands/unit while preserving configuration, state, backups and the synthetic original `~/.codex/config.toml` sentinel.
- Repeated uninstall.

This is a **same-version rollback** test. It does not claim migration or downgrade compatibility with a different historical product release. The synthetic lifecycle test does not test ChatGPT, account Tunnel connectivity, credentials or a metered model turn.

To reproduce separately, set explicit executable and candidate paths:

```sh
CODEXLESS_ACCEPTANCE_SOURCE="<EXACT_CANDIDATE_CHECKOUT>" \
CODEXLESS_ACCEPTANCE_CODEX_BIN="<OFFICIAL_CODEX_EXECUTABLE>" \
CODEXLESS_ACCEPTANCE_NODE_BIN="<NODE22_EXECUTABLE>" \
CODEXLESS_ACCEPTANCE_NPM_BIN="<NPM10_EXECUTABLE>" \
<NODE22_EXECUTABLE> installed-lifecycle.mjs
```

The final machine-readable report is `installed-lifecycle-result.json`; the corresponding log is `installed-lifecycle.log`. Both replace local paths with `$SOURCE`, `$PROJECT`, `$TEST_HOME`, `$FIXTURE`, `$WORKSPACE` and `$CODEX`. The temporary installed fixtures were removed after success. The npm cache used only for this acceptance was also removed to avoid retaining large dependency archives.

An initial attempt put synthetic HOME/CODEX_HOME beneath `/tmp`. Official Codex 0.163.0 refused to create its sandbox helper aliases there; the MCP startup compatibility probe consequently exited 1. That attempt is preserved in `../diagnostics/lifecycle-tmp-home/result.json` and `../diagnostics/lifecycle-tmp-home/run.log`. The final run changed only the synthetic test fixture location, outside `/tmp`; candidate source, permissions and dependency versions were unchanged. This is a test-environment constraint, not evidence of a fixed candidate defect. No real user's original Codex configuration or credentials were read.

## Public evidence copy

These are the original recorded results, not a new run. Only this public reproduction harness's path handling was parameterized: candidate/executable paths use the `CODEXLESS_ACCEPTANCE_*` variables above, the MCP test client is resolved from that candidate's installed test dependencies (or `CODEXLESS_ACCEPTANCE_CLIENT_SOURCE`), and reproduction output goes to `reproduction-output/` (or `CODEXLESS_ACCEPTANCE_OUTPUT`). Those public-copy changes have not been rerun. Use the exact Git tree listed above and install its dependencies separately before reproducing. Do not copy personal configuration or credentials. The original `/tmp` diagnostic is separate from the successful final run.
