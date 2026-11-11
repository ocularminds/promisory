# Promisory · Product and implementation package

**Keep every commitment connected.**

Brand revision 1.1 uses azure blue **#0078D4** as the primary color, with deep navy and pale azure supporting surfaces.

Prepared 10 November 2026. Name selected by the product owner. This package specifies a proposed product; it does not claim that Promisory is implemented, installed, Marketplace-approved, or connected to live Atlassian data.

## Start here

1. [Technical specification](01-technical-specification.md) — features, roles, hierarchy, workflows, architecture, data contracts, integration boundaries, and expected outcomes.
2. [Brand and UX system](02-brand-and-ux-system.md) — identity, palette, typography, layouts, controls, accessibility, and interaction rules.
3. [Implementation plan](03-implementation-plan.md) — a six-week delivery sequence, acceptance gates, release strategy, pilot measures, and Codegeist evidence.
4. [Codex implementation instructions](04-codex-implementation-instructions.md) — a reusable implementation prompt, engineering rules, and completion criteria.
5. [Product lifecycle and traceability](06-product-lifecycle-and-traceability.md) — ten phases, levels above epics, Confluence artifacts, stories/tasks/bugs, and versioned readiness.
6. [Sources and decisions](05-sources-and-decisions.md) — current platform references, observations from the existing repositories, and assumptions to validate.

Open [the package viewer](index.html) to read the documents with navigation, inspect the design system, and try the [interactive UX prototype](prototype.html).

The [visual brand board](brand.html) presents the identity and controls. The [validation record](validation-report.md) describes the checks performed on this package. To use the files offline, open index.html in a modern browser with its supporting folders alongside it.

## Supporting assets

- The brand directory contains editable SVG logos, PNG exports, local fonts and their licenses, CSS tokens, and JSON tokens.
- The contracts directory contains proposed, versioned Promisory data contracts and illustrative fixtures. They are not claimed to be existing Decionis APIs.
- The templates directory contains an AGENTS.md template and implementation bootstrap prompt for the future Promisory repository.
- The diagrams directory contains editable architecture and hierarchy diagrams.
- The previews directory contains reviewed desktop, lifecycle, work-map, and mobile screenshots of the design prototype.

## Decisions made in this package

Promisory covers the full product lifecycle and follows Jira's real configured hierarchy above and below epics. It connects Confluence strategy, discovery, requirements, release, and learning artifacts through typed dependency and accountability relationships. It uses Rovo to explain and propose, Teamwork Graph to discover permission-filtered context, and Decionis/AgentSafe for an explicitly configured execution path. A completed work item, a human review, and verified fulfillment are distinct events.

The recommended Codegeist category is **Apps for Software Teams**, reflecting the expanded project-to-engineer scope. Customer commitments remain a central use case. The plan targets Rovo, Teamwork Graph, Marketplace submission, and the optional Atlassian MCP bonus without treating bonus eligibility as guaranteed judging points.

## Validation boundaries

The source references and existing integration code were reviewed on 10 November 2026. Platform features marked Preview, tenant permissions, current release binaries, signing contracts, and live installation behavior must be verified during Phase 0. The visual prototype uses fictional data and local interactions only. It performs no policy evaluation, sends no messages, and changes no Atlassian records.
