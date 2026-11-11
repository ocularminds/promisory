# Development registration and test-site setup

10 November 2026 · Live setup evidence, distinct from local fixture tests

The user authorized a new Decionis test site and selection of either available Decionis developer space. They separately approved Forge's developer agreement and usage-based overage billing at the registration prompt.

## Observed results

- Forge CLI 15.1.0 registered **Promisory** in developer space `0f68d3d6-c7e7-428a-a05b-3caa95d44577` (Decionis).
- Fresh app ARI: `ari:cloud:ecosystem::app/6e0430ce-9c00-425a-80c2-97b5cec1e8ae`. The CLI created development, staging and production environments. No sibling app identity was reused.
- `forge site provision` reported `RUNNING`, then `FAILED` for task `aa95cdbc-329c-4c9c-84fd-8300c92445d5`. It returned no usable site URL. No successful demo-site provisioning is claimed.
- The official Cloud Developer Bundle signup verified `decionis-promisory-test.atlassian.net` as available. Its form offers Jira and Confluence Standard for five users each, Service Collection for one agent, and no credit card requirement. The form is prepared; its final customer agreement/AI terms acceptance is pending the user's separate answer.
- The first authenticated `forge lint` failed with `missing-remote-key` at the undeclared optional executor. [ADR 0005](../../decisions/0005-optional-forge-executor-build.md) records the configuration fix and its verification boundary.
- After the fix, [Forge lint passed](forge-lint.txt) with no issues. [The complete local check passed](check-output.txt): 65 tests in 12 files, type checking, UI and remote builds, manifest/build consistency, actual Forge backend packaging and release equivalence.
- [Forge deployment succeeded](forge-deploy.txt): **Promisory 2.0.0** is deployed to the **development** environment. The source package version remains `0.1.0`; Forge's deployment version is separate. No app installation was performed. The CLI's eligibility message applies to this current build without an external remote; it is not a claim about the future hybrid executor profile.

The [prepared signup screenshot](site-ready-for-agreement.jpg) redacts the account email. No token, credential, sign-in URL parameter or secret appears in this evidence.

At this point, app installation and all tenant integration checks remain **NOT RUN**. Registration and site-name availability do not prove installation, source access, SQL migration, Rovo, Teamwork Graph or execution.

## Platform references checked

- [Provision a demo development site](https://developer.atlassian.com/platform/forge/provision-a-demo-development-site/): one active demo site per developer, normally 90 days, CLI-managed provisioning.
- [Cloud Developer Bundle](https://go.atlassian.com/cloud-dev): traditional development/test-only signup used after the CLI provisioning failure.
- [Developer Terms](https://developer.atlassian.com/platform/marketplace/atlassian-developer-terms/) and [Forge pricing](https://developer.atlassian.com/platform/forge/forge-platform-pricing/): the registration CLI required explicit acceptance of overage billing.
