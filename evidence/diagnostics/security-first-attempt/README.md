# Initial security harness attempt — not the final result

This original attempt passed the first 7 checks, then stopped because the test harness assumed every MCP error payload was JSON. MCP schema validation returned plain text. The harness parser was corrected, with no candidate source change, and the fresh final run passed 17/17 checks; see `../../security/`.

These diagnostic files remain FAIL and are not counted as successful final acceptance. They are retained for provenance. The failure stack's personal task path was replaced by `<HARNESS>`. No test was rerun for this publication.
