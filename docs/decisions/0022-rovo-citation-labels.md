# Bind Rovo citations to current Jira labels

Date: 2026-11-17

During the installed-app video retake, two Rovo answers treated Jira numeric ID
10002 as display key KAN-2. The current source is KAN-3. The domain assessment and
workspace decision card correctly identified the blocker; the Rovo response had
stable evidence IDs but lacked the corresponding Jira labels in that reason.

Each assessment reason now includes up to 30 `workEvidence` entries from the
already authorized, freshly loaded Jira workspace. Each entry binds the scoped
work ID to its current issue ID, issue key, title, type, status, resolved flag, and
source revision. `workEvidenceTruncated` makes the bound explicit. The agent
instructions require that mapping and prohibit deriving issue keys from numeric
IDs. No new source access, permissions, execution action, or authority path is
introduced. Teamwork Graph records are not used to populate this projection.

A regression test gives the blocker a display key unrelated to its numeric ID and
checks that the response identifies only that blocker with its current key.
The full suite passes: 187 tests in 30 files. The failed Rovo capture is retained
privately and excluded from the submission edit; the corrected deployment must
be checked through the installed agent before its replacement footage is used.
