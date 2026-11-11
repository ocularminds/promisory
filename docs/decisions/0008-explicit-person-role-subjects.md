# Explicit role subjects in Rovo results

10 November 2026 · Accepted for the development candidate

An installed Rovo answer correctly identified an incomplete commitment but linked its project approver to the other test account with the same display name. A raw binding contains both the role holder's `accountId` and the administrator's `confirmedByAccountId`; the answer confused their meaning.

The responsible-people tool now pairs each binding with a subject resolved by exact account ID. People whose visible names collide are marked explicitly. The agent instructions distinguish the role holder from the confirming administrator and prohibit name-based person links or mentions in that case. An unavailable person remains unresolved; a matching name cannot fill the identity gap.

This is additive explanation context inside Atlassian. It does not create a role, change a permission check, or make the model an authority. Runtime commands still use the trusted current principal and exact stored bindings. A contract test with identical names verifies that the approver and confirming administrator remain distinct. Installed wording validation is tracked in the live evidence record.
