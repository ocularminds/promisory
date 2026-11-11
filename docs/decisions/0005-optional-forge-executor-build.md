# 0005 — Bind the Forge executor build to the manifest

10 November 2026 · Accepted

After registering the development app, Forge CLI 15.1.0's authenticated lint rejected the call to `invokeRemote("promisory-executor", ...)` because the initial installation manifest intentionally has no executor host. Runtime environment checks do not remove that static declaration requirement.

The shared build generator now selects the executor entry and TypeScript inputs alongside the manifest. A manifest without a remote compiles only the held executor. The optional remote implementation has no import path from those deployed entry points. Environment flags cannot add it to that build. A declared remote includes the implementation in both the Forge bundle and Forge's TypeScript lint inputs, preserving the literal allowlisted remote key.

Offline manifest validation checks the generated entry and TypeScript configuration against the declared capability. Release packaging requires the same executor capability as the frozen development build; the three profiles retain identical source bytes. Release verification checks each profile's build binding. Changes that add a remote declaration alone, alter the entry alone, or exclude an enabled executor from linting are rejected.

The existing HMAC, current-user token, explicit data-sharing checks, provenance rules, supported grant flow and reconciliation behavior continue to apply to the enabled implementation. A real HTTPS executor and installation binding are still needed before a live governed action can pass acceptance.
