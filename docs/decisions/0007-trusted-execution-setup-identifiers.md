# Trusted identifiers for execution setup

10 November 2026 · accepted for development implementation

The remote executor needs the full Forge app, environment and installation ARIs and the cloud UUID. Developer-console URLs expose UUID fragments, which are not sufficient evidence of the trusted invocation's serialized identity.

Expose those four values in a read-only Connections disclosure for the current Jira site administrator. Build the values from the already runtime-validated server context. Omit them from non-administrator workspaces and from the Rovo channel. No credential, principal override, organization selector, execution mode or mutable binding is exposed.

These identifiers help an operator prepare server-controlled configuration. Possession of them is not authorization: the remote still validates the FIT, configured installation, cloud, principal, module and request signature. The UI cannot use the disclosure to alter its effective context. Meaningful contract checks cover administrator visibility and omission for the reviewer and Rovo.
