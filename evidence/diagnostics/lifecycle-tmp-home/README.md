# Initial /tmp lifecycle attempt — not the final result

The initial attempt completed installation and lifecycle doctor, then official Codex 0.163.0 refused to create sandbox helper aliases beneath `/tmp`. Subsequent MCP and lifecycle steps were not completed in this attempt. The synthetic fixture was moved outside `/tmp`, with the same candidate source, permissions and dependency versions; the final run passed 11/11 checks. See `../../lifecycle/`.

These diagnostic files remain FAIL and are not counted in final PASS totals. They document an official Codex test-environment constraint, not a candidate source fix. No test was rerun for this publication.
