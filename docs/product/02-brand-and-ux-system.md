# Promisory · Brand and UX system
**Version 1.1 · 10 November 2026 · Proposed identity**

## 1. Brand direction

**Name:** Promisory  
**Positioning:** Connected commitments for teams that deliver together.  
**Tagline:** Keep every commitment connected.

The visual character is calm, precise, and collaborative. Promisory should help people understand a change and decide what to do next without turning delivery work into a wall of alarms.

Use azure blue (#0078D4) as the primary brand and action color, supported by deep navy and cool neutral surfaces. The product should feel at home beside Jira while remaining recognizable. Atlassian's host navigation and native UI Kit components keep their platform styling; Promisory styles apply inside its Custom UI surfaces.

### Voice

State the observed change, its consequence, and the next available action. Prefer “The launch depends on a bug that is still open” to an unexplained risk score. Use “Outcome not yet verified” when evidence is absent. Attribute decisions and acknowledge unknowns.

Avoid blame, individual performance rankings, false certainty, and theatrical alerts. Never translate missing data into a reassuring green state. Technical grant IDs and trace details belong behind “View evidence,” except when a user needs them to resolve a problem.

## 2. Logo system

### Connected Loop

The proposed mark is a geometric P built around a continuous delivery loop and a distinct endpoint. The loop represents a commitment moving through linked work; the endpoint represents an observable outcome. The construction uses clean, deliberate geometry that remains legible in a Jira issue panel and app directory.

This is an original editable vector identity. The SVG files are the source of truth; PNG files are deterministic exports. It is not an AI-generated bitmap or a placeholder for a later mark.

### Files and usage

| Asset | Use |
|---|---|
| brand/promisory-logo.svg | Primary horizontal mark and outlined wordmark on light backgrounds |
| brand/promisory-logo-reversed.svg | Light lockup on dark ink |
| brand/promisory-mark.svg | App icon, compact navigation, profile-sized contexts |
| brand/promisory-mark-mono.svg | Single-color printing, small utility placement |
| brand/promisory-icon-512.png | Square app icon export |
| brand/promisory-logo-preview.png | Review preview of the primary lockup |
| brand/brand-overview.png | Overview of the proposed visual system |

Maintain clear space equal to the width of the mark's stem on every side. Minimum mark size is 20 CSS pixels in dense navigation and 24 pixels for standalone use. Use the simplified monochrome mark below 24 pixels. The full horizontal lockup should be at least 132 pixels wide.

Keep proportions fixed. Do not add shadows, rotation, extra nodes, gradients, outlines, or status badges inside the mark. A risk state is a product signal, not a change to the identity. Avoid placing the warm endpoint accent on a similar warm background.

The final Marketplace upload sizes and file limits must be checked against the current listing form. The provided exports are reusable source assets, not a claim of compliance with every future marketplace placement.

## 3. Color palette

| Token | Hex | Purpose |
|---|---|---|
| color.ink | #102D46 | Headings, dark navigation, reversed brand backgrounds |
| color.primary | #0078D4 | Azure blue: primary buttons, app icon, selected actions, and brand mark |
| color.primaryHover | #0063B1 | Hover and pressed emphasis |
| color.link | #0067B8 | Accessible link and selected text on white or pale blue surfaces |
| color.canvas | #F5F8FC | Workspace canvas |
| color.surface | #FFFFFF | Cards, dialogs, input surfaces |
| color.subtle | #EBF4FC | Soft grouping and selected surface |
| color.textSecondary | #4B6177 | Supporting text and metadata |
| color.border | #CFDBE6 | Nonessential dividers and surface edges |
| color.borderStrong | #71869A | Required control boundaries |
| color.accentWarm | #EEA28B | Brand endpoint and small decorative accents |
| color.info | #3154B5 | Information and navigation context |
| color.focus | #0078D4 | Keyboard focus ring |
| color.success | #15724A | Verified / on-track text and icon |
| color.successSurface | #E9F5ED | Verified / on-track background |
| color.warning | #8A5600 | Watch / needs-attention text and icon |
| color.warningSurface | #FFF4D6 | Watch background |
| color.danger | #B42318 | At-risk / breach text and icon |
| color.dangerSurface | #FFF0EE | At-risk / breach background |
| color.unknown | #535E76 | Incomplete / unknown text and icon |
| color.unknownSurface | #EEF1F6 | Unknown background |

White text is used on azure primary buttons and deep navy surfaces. Use color.link for blue text on pale surfaces; the primary blue is reserved for fills, the mark, and foregrounds on white that meet the documented contrast threshold. Warm accent is decorative and must not carry small text. Light divider color is not sufficient for an essential input boundary; use borderStrong. Status chips always combine a label and icon with color.

Contrast calculations are included in brand/contrast-report.json. Check normal text against 4.5:1 and essential non-text control boundaries/focus indicators against 3:1. Verify actual rendered combinations, including hover, selection, and dark surfaces.

### Meaning of states

| State | Label and visual treatment |
|---|---|
| ON_TRACK | Green outline/check icon with “On track”; describes current known conditions |
| WATCH | Amber clock icon with “Watch”; future attention window |
| AT_RISK | Red outlined alert icon with “At risk”; specific current blocker |
| BREACHED | Red filled alert icon with “Deadline missed”; distinguish from predicted risk |
| UNKNOWN | Slate question/partial-circle icon with “Context incomplete” |
| FULFILLED | Green check and “Outcome verified”; show verified time and timeliness |
| HELD ACTION | Amber pause icon and the exact missing requirement |
| RECONCILING | Neutral progress icon and “Checking result”; do not offer a blind retry |

## 4. Typography

| Family | Application | Weights |
|---|---|---|
| Manrope | Wordmark and prominent page headings | 600, 700, 800 |
| Inter | Product UI, body, forms, tables, documentation | 400, 500, 600, 700 |
| IBM Plex Mono | Evidence identifiers, dates in dense diagnostics, technical excerpts | 400 |

The supplied fonts come from the Google Fonts open-source repository and include their SIL Open Font License files. Self-host the packaged assets; do not make customer browsers fetch fonts from a third-party CDN. Preserve license notices in distributed source/assets. [Font sources](https://github.com/google/fonts)

### Type scale

| Token | Size / line height | Typical use |
|---|---|---|
| display | 44 / 52 px | Brand cover and documentation overview |
| h1 | 30 / 38 px | Main workspace heading |
| h2 | 22 / 30 px | Section heading |
| h3 | 17 / 24 px | Card and dialog heading |
| body | 15 / 23 px | Explanations and document text |
| ui | 14 / 20 px | Controls, navigation, standard rows |
| label | 12 / 18 px | Metadata and field labels |
| micro | 11 / 16 px | Supplemental diagnostic labels only |

Use tabular numbers for dates, counts, and durations. Avoid all-caps paragraphs, thin weights, or condensed fonts for dense data. Limit long reading text to about 70–80 characters per line.

## 5. Layout and spacing

Base spacing unit: 4 px. The standard scale is 4, 8, 12, 16, 24, 32, 48, and 64 px.

- Main application navigation: approximately 224 px wide on desktop, collapsible where space is limited.
- Page padding: 32 px desktop, 20 px tablet, 16 px mobile.
- Cards: 16 or 24 px padding; 12 px corner radius; a subtle border, not a heavy shadow.
- Inputs and buttons: 8 px corner radius; default 44 px height.
- Tables: 52–56 px standard rows; 40 px compact rows only with a user-selected density mode.
- Detail panel: 360–440 px wide on desktop; full-screen dialog on narrow screens.
- Reading views: central column with stable navigation and clear source links.

Use a responsive two-column workspace for the commitment list and current evidence/review panel. At narrow widths, keep the main action and essential columns visible and move supplementary information into the detail view. Do not reduce type to squeeze in a desktop table.

### Lifecycle and hierarchy interaction

Add a **Product lifecycle** workspace before the work-level view. Its breadcrumb can show Product → Initiative → Epic, with relationship labels indicating whether each step is planning context or a native work parent. Display the current phase, accountable owner, linked Confluence artifact, source version, readiness, and next evidence needed.

Use a compact phase rail for strategy → discovery → initiative → definition → planning → delivery → validation → release → learning → evolution/retirement. On narrow screens, show an accessible list or selected-phase picker. Several phases may be active simultaneously; avoid a progress bar that falsely implies a single mandatory sequence.

The work map explicitly includes stories alongside tasks and bugs, with real subtasks underneath. Custom program/initiative parents appear only when configured; otherwise show a labelled planning connector. Milestones, sprints, releases, goals, and Confluence page nesting have distinct visual treatments.

A requirement card shows its stable ID, current source revision, reviewed revision, linked work, and acceptance evidence. When the PRD changes, show “Requirement changed; review applicability” and the affected paths. Keep readiness badges separate from delivery health and fulfillment badges. A ready release gate does not look like an executed deployment.

### Information order

1. Which commitment or project is being discussed.
2. What changed and when.
3. Which outcome and people are affected.
4. What evidence supports that conclusion and what is unknown.
5. The next available action.

## 6. Form and input controls

| Control | Behavior and states |
|---|---|
| Text input | Persistent visible label; hint; empty, filled, hover, focus, error, disabled, read-only |
| Search | Search icon, clear control, debounced filtering, visible result count, no search-as-submit surprise |
| Owner / work picker | Accessible combobox with keyboard results, source type, account/work ID disambiguation, and empty/error states |
| Select | Native or tested accessible select; no custom clickable div masquerading as a dropdown |
| Text area | Visible label, purpose-specific hint, character count when limited, preserved draft after errors |
| Date and time | Separate date/time and IANA zone; explicit date-only cutoff; localized display plus exact review value |
| Checkbox | Independent options with full-label click target; clear indeterminate state for tree selection |
| Radio group | Mutually exclusive options, group label, keyboard arrow navigation |
| Switch | Immediate reversible preference only; never an undisclosed policy publication or external action |
| Segmented control | View/filter choice with selected state and tab semantics where appropriate |
| Button | One clear primary action per region; loading label; disabled reason nearby |
| Destructive action | Explicit object and effect, narrow confirmation when warranted, safe focus return |
| File/source attachment | Source, permitted type/size, processing state, error, and removal; no false verification badge |

### Commitment form

Required fields: outcome/title, project scope, accountable owner, beneficiary, deadline with time zone, and acceptance conditions. Optional fields: delivery contributors, stakeholder watchers, linked work, policy template, and source reference.

Suggested microcopy:

| Situation | Copy |
|---|---|
| Outcome hint | “Describe what must be true when this commitment is fulfilled.” |
| Acceptance condition hint | “Add evidence someone can check, such as a production release and customer acceptance.” |
| Missing owner | “Choose one accountable owner.” |
| Ambiguous deadline | “Choose a date, cutoff time, and time zone.” |
| Source changed | “The source changed after this review. Refresh the proposal before applying it.” |
| Restricted source | “Some context is unavailable with your current access.” |
| Missing authority | “This action needs an authorized review.” |
| Uncertain write | “We are checking whether the change completed.” |

Validate on submit and, after the first error, as the user corrects that field. On failure, preserve values, announce an error summary, and focus the first invalid field. Do not require users to re-enter a large draft.

## 7. Component specifications

### Commitment row/card

Show title, stable short ID, accountable owner, agreed due date and time zone, health label, evidence freshness, and the number of relevant open findings. The row opens details; secondary actions have separate accessible buttons. Do not nest interactive controls inside an inaccessible whole-row click target.

### Impact explorer

Render hierarchy as an expandable list or tree and dependencies as clearly labelled edges. Selecting a bug reveals its path to commitments. Distinguish “contains,” “blocks,” “supports,” “owns,” and “verifies.” Provide a flat path table for keyboard and screen-reader use. Display incomplete traversal limits.

### Stakeholder strip

Show the accountable owner first, then scoped contributors and observers. Hover/focus reveals role provenance and scope. Avoid implying that avatar order is a reporting hierarchy.

### Evidence card

Include source name, source revision, observed/checked time, verification result, applicability, and a permitted source link. “Signed record available” and “Outcome verified” are separate labels.

### Review panel

Display before/after values, exact target, proposed effect, current evidence, required reviewers, source freshness, and the next action. “Approve review” records a review; “Apply authorized change” is a separate, clearly explained operation where the flow requires it. An inaccessible or stale proposal has no enabled execution button.

### Rovo entry point

Use “Ask about this commitment” or “Explain this impact.” Open the real Rovo surface in the implemented app. The prototype explicitly labels its deterministic response as a sample. Answers follow: finding → evidence → uncertainty → available next action.

## 8. Accessibility and responsive behavior

Target WCAG 2.2 AA. Provide visible focus, meaningful labels, accessible names for icon-only controls, 44 px preferred touch targets, a skip link, and logical heading order.

Dialogs trap focus, close with Escape when safe, and restore focus to their trigger. Toasts use a polite live region and do not steal focus. Errors are not communicated by color alone. Long operations report progress without rapid repeated announcements.

Test 200% zoom, a 390 px viewport, keyboard-only navigation, screen-reader names, and reduced-motion preference. Motion is limited to 120–180 ms transitions for state changes; remove nonessential transitions under reduced motion.

A future dark mode must have its own verified semantic tokens. The reversed logo is provided now; the first product release should ship one thoroughly tested light theme before claiming complete dark-theme support.

## 9. Interactive prototype

Open [the UX prototype](prototype.html). It demonstrates a product lifecycle with ten phases and Confluence artifacts, a project overview, a typed work/impact map including higher-level context and stories, role views, a commitment form, an evidence panel, a review interaction, and a sample Rovo explanation.

The “Simulate dependency delay” control changes fictional work evidence and recomputes visible example states. The “Add example commitment” action affects only in-memory prototype data. The prototype is a design reference; it is not a working Forge app, AI integration, or authorization engine.

## 10. Design handoff

Use brand/tokens.json as the source for semantic names and brand/tokens.css as the implementation reference. Maintain the same state vocabulary as the technical specification. Prefer tested platform components where they satisfy the design.

Acceptance requires readable 100% and 200% views, visible keyboard focus, error recovery without data loss, correct status labels, explicit unknown states, and a clear distinction between reviewing a proposal and completing an external action. Check the actual rendered UI rather than approving screenshots alone.

