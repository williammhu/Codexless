# Focused actual MCP security acceptance

Result: **PASS, 17 checks**, harness process exit **0**.

Candidate Git tree: `3f44470de142222788f8f6e22e7926684062ad97`.
Runtime: Linux x64, Node `v22.23.3`, official `codex-cli 0.163.0`.

The SDK initialized the actual candidate stdio MCP service and discovered all 45 public tools. Configuration was a newly generated, credential-free `CODEX_HOME` using legacy `sandbox_mode = "workspace-write"`, `approval_policy = "on-request"`, and trust for exactly one synthetic Git project. The fixture was deliberately outside `/tmp`, since official workspace sandbox policy can permit writes in `/tmp`.

Verified against real Codex App Server:

- `inherit` used `:workspace`; explicit `readOnly` used `:read-only`.
- An `inherit` write inside the trusted project succeeded.
- An `inherit` write to a sibling outside the trusted project exited **1** with `EROFS`; no file was created.
- A `readOnly` write inside the project exited **1** with `EROFS`; no file was created.
- An untrusted sibling working directory was rejected with `PERMISSION_APPROVAL_REQUIRED` without changing trust.
- Remote `permissionProfile`, `permissions`, `sandbox_mode`, `approval_policy`, and `trust_level` overrides were rejected as unrecognized schema keys.
- An absolute outside-root read, symlink escape read, and symlink escape edit were rejected; the outside target remained unchanged.
- A model task remained `consent_required`, repeating its request preserved the same task ID, and declining returned `rejected`; `turnId` remained null throughout. No approval or model turn was requested.
- The isolated TOML was unchanged and no credential files were created. All owned fixtures were removed.

No personal installation, original Codex configuration, credentials, user project, or GitHub state was touched. The source index retained the expected tree, and `git diff --exit-code --quiet` confirmed that tracked working files matched that index after acceptance.

Evidence: `security-report.json` contains actual error/exit/profile results with personal paths replaced by placeholders; `security.log` contains the concise check output. `actual-mcp-security.mjs` is the standalone reproduction harness and is intentionally outside the contribution source.

The first attempt passed 7 checks and stopped because the harness assumed all MCP error content was JSON. MCP schema validation returned plain text. The parser was corrected, and the full run then passed in a fresh fixture. That first-attempt evidence is retained separately in `../diagnostics/security-first-attempt/report.json` and `../diagnostics/security-first-attempt/run.log`; no candidate source change was needed.

Reproduction (paths are placeholders):

```sh
PATH="<NODE22_BIN>:$PATH" \
CODEXLESS_ACCEPTANCE_SOURCE="<EXACT_CANDIDATE_CHECKOUT>" \
CODEXLESS_ACCEPTANCE_CODEX_BIN="<OFFICIAL_CODEX_EXECUTABLE>" \
<NODE22> actual-mcp-security.mjs
```

The candidate checkout must have its dependencies installed and its Git index/worktree at the exact tree above. The source tree is read only to this harness.

Actual command vectors (each used `timeoutMs: 5000`; paths redacted):

```json
{"command":["pwd"],"cwd":"<FIXTURE>/trusted project","access":"inherit","exitCode":0,"permissionProfile":":workspace"}
{"command":["pwd"],"cwd":"<FIXTURE>/trusted project","access":"readOnly","exitCode":0,"permissionProfile":":read-only"}
{"command":["<NODE22>","-e","require('node:fs').writeFileSync('allowed.txt','inside marker\\n')"],"cwd":"<FIXTURE>/trusted project","access":"inherit","exitCode":0}
{"command":["<NODE22>","-e","require('node:fs').writeFileSync(process.argv[1],'must not appear')","<FIXTURE>/outside-write-rejected.txt"],"cwd":"<FIXTURE>/trusted project","access":"inherit","exitCode":1,"error":"EROFS"}
{"command":["<NODE22>","-e","require('node:fs').writeFileSync('readonly-denied.txt','must not appear')"],"cwd":"<FIXTURE>/trusted project","access":"readOnly","exitCode":1,"error":"EROFS"}
{"command":["pwd"],"cwd":"<FIXTURE>/untrusted-sibling","access":"inherit","toolError":"PERMISSION_APPROVAL_REQUIRED","processNotStarted":true}
```

## Public evidence copy

This is evidence from the original completed run, not a new test execution. The public harness differs only in output-directory handling: it writes any future reproduction to `reproduction-output/` (or `CODEXLESS_ACCEPTANCE_OUTPUT`) instead of overwriting this evidence. That public-copy change has not been rerun. Use the exact candidate checkout, with its own test dependencies installed; the source's original user configuration and credentials must not be copied.

The two first-attempt records are preserved separately in `../diagnostics/security-first-attempt/`; they are not part of the final 17/17 PASS result.
