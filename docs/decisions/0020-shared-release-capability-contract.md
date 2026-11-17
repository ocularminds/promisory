# 0020 · Keep installed and packaged capabilities in one manifest generator

The local development manifest contained the PRD drafting actions, read-only MCP tools, additional Graph scopes, Jira link events and daily privacy trigger. The shared release generator still described the earlier capability set. Source equivalence alone therefore allowed all three generated profiles to omit the same features. Forge rejected a development deployment because it would change the approved scopes; the installed development app was not downgraded.

The shared generator now includes the full installed capability set. Offline manifest validation and profile generation compare the development manifest with that generator, and release equivalence also rejects profiles packaged from stale source. Only identity, licensing and executor origin may differ between profiles. Regression tests require the PRD actions, GET-only MCP tools, privacy schedule, source-link triggers and Graph permissions in every profile.

The existing executor installation binding and authority checks are unchanged. A judge's independent installation still fails closed at Apply until its own executor is configured. The public profiles must be redeployed and their installed capabilities verified before claiming release acceptance.
