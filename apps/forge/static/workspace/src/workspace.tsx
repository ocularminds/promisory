import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  capabilitySchema,
  phases,
  phaseLabels,
  type CommandName,
  type CommitmentRecord,
  type CommitmentDraft,
  type RecoveryProposal,
  type WorkNode,
  type Capability,
} from "@promisory/contracts";
import { activeVersion, type Stored, type Workspace } from "@promisory/domain";
import {
  Badge,
  DateDisplay,
  Empty,
  ErrorSummary,
  FormField,
  GateHistory,
  textValue,
  personLabel,
} from "./components";
import { CommandForm, CommitmentForm } from "./forms";
import {
  exampleClient,
  forgeClient,
  readWorkspace,
  type Client,
} from "./client";
import { EmbeddedView } from "./embedded";

const navigation = [
  ["overview", "Overview", "▦"],
  ["lifecycle", "Product lifecycle", "◎"],
  ["work", "Work map", "⋈"],
  ["mine", "My work", "▤"],
  ["reviews", "Reviews", "◇"],
  ["evidence", "Evidence", "▧"],
  ["inbox", "Inbox", "▱"],
  ["connections", "Connections", "⚙"],
] as const;
type Page = (typeof navigation)[number][0];
type Form =
  | "commitment"
  | "recovery"
  | "transfer"
  | "verify"
  | "artifact"
  | "requirement"
  | "planning"
  | "role"
  | "gate"
  | null;
export function App() {
  const [client, setClient] = useState<Client>(),
    [workspace, setWorkspace] = useState<Workspace>(),
    [page, setPage] = useState<Page>("overview"),
    [projectId, setProjectId] = useState<string>(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [role, setRole] = useState("Manager"),
    [search, setSearch] = useState(""),
    [health, setHealth] = useState("ALL"),
    [phase, setPhase] = useState<(typeof phases)[number]>("DEFINITION");
  const [selected, setSelected] = useState<string>(),
    [selectedWork, setSelectedWork] = useState<string>(),
    [form, setForm] = useState<Form>(null),
    [revisionMode, setRevisionMode] = useState(false),
    [inbox, setInbox] = useState<
      Array<{
        id: string;
        commitmentId: string;
        reason: string;
        severity: string;
        seen: boolean;
      }>
    >([]);
  const initial = useRef(false),
    loadSequence = useRef(0),
    connectionCheckSequence = useRef(0);
  const [connectionChecks, setConnectionChecks] = useState<{
    checkedAt: string;
    capabilities: Capability[];
  }>();
  const [checkingConnections, setCheckingConnections] = useState(false);
  const [inboxMeta, setInboxMeta] = useState<{
    preferences: { quietStart: number; quietEnd: number; timeZone: string };
    digest: {
      state: string;
      unreadCount: number;
      nextAvailableAt: string;
      timeZone: string;
    };
  }>();
  const [inboxStatus, setInboxStatus] = useState<
    "LOADING" | "READY" | "UNAVAILABLE"
  >("LOADING");
  const [expanded, setExpanded] = useState(false);
  async function load(using = client, project = projectId) {
    if (!using) return;
    connectionCheckSequence.current++;
    setConnectionChecks(undefined);
    setCheckingConnections(false);
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    try {
      const w = await readWorkspace(using, project);
      if (sequence !== loadSequence.current) return;
      setWorkspace(w);
      setProjectId(w.project?.id);
    } catch (e) {
      if (sequence !== loadSequence.current) return;
      setWorkspace(undefined);
      setError(
        e instanceof Error ? e.message : "The workspace is unavailable.",
      );
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }
  async function checkConnections() {
    if (!client) return;
    const sequence = ++connectionCheckSequence.current;
    setCheckingConnections(true);
    setConnectionChecks(undefined);
    setError("");
    try {
      const capabilities = capabilitySchema
        .array()
        .parse(await client.run("connections.check", {}));
      if (sequence !== connectionCheckSequence.current) return;
      setConnectionChecks({
        checkedAt: new Date().toISOString(),
        capabilities,
      });
      setNotice("Connection checks finished. Review each result below.");
    } catch (e) {
      if (sequence !== connectionCheckSequence.current) return;
      setError(
        e instanceof Error ? e.message : "The connection check is unavailable.",
      );
    } finally {
      if (sequence === connectionCheckSequence.current)
        setCheckingConnections(false);
    }
  }
  async function begin(mode: "LIVE" | "EXAMPLE") {
    setLoading(true);
    setError("");
    try {
      const next =
        mode === "EXAMPLE" ? await exampleClient() : await forgeClient();
      if (mode === "EXAMPLE") {
        const surface = new URLSearchParams(location.search).get("surface");
        if (surface === "issue")
          next.surface = { kind: "ISSUE", issueId: "137" };
        if (surface === "page") next.surface = { kind: "PAGE", pageId: "203" };
      }
      setClient(next);
      if (next.startInSettings) setPage("connections");
      await load(next, next.projectId);
    } catch (e) {
      setLoading(false);
      setError(
        e instanceof Error ? e.message : "The connection is unavailable.",
      );
    }
  }
  useEffect(() => {
    if (initial.current) return;
    initial.current = true;
    if (window.parent !== window) void begin("LIVE");
    else if (new URLSearchParams(location.search).get("mode") === "example")
      void begin("EXAMPLE");
  }, []);
  useEffect(() => {
    if (client?.mode !== "LIVE" || !projectId) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !loading)
        void load(client, projectId);
    }, 60_000);
    return () => clearInterval(timer);
  }, [client, projectId, loading]);
  useEffect(() => {
    setInbox([]);
    setInboxMeta(undefined);
    setInboxStatus("LOADING");
    if (page !== "inbox" || !client || !projectId) return;
    let active = true;
    client
      .run<{
        notices: typeof inbox;
        preferences: NonNullable<typeof inboxMeta>["preferences"];
        digest: NonNullable<typeof inboxMeta>["digest"];
      }>("inbox.read", { projectId })
      .then((r) => {
        if (active) {
          setInbox(r.notices);
          setInboxMeta(r);
          setInboxStatus("READY");
        }
      })
      .catch((e) => {
        if (active) {
          setInboxStatus("UNAVAILABLE");
          setError(String(e));
        }
      });
    return () => {
      active = false;
    };
  }, [page, client, projectId, workspace]);
  async function command<T = unknown>(
    name: CommandName,
    input: unknown,
    message?: string,
  ): Promise<T> {
    if (!client) throw new Error("Select a workspace mode.");
    const result = await client.run<T>(name, input);
    await load(client);
    if (message) setNotice(message);
    return result;
  }
  async function action(name: CommandName, input: unknown, message?: string) {
    try {
      setError("");
      await command(name, input, message);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The action could not be completed.",
      );
    }
  }
  const current = workspace?.commitments.find((c) => c.value.id === selected);
  const agreement = current
    ? (activeVersion(current.value) ?? current.value.draft)
    : undefined;
  const active = current ? activeVersion(current.value) : undefined;
  const person = (accountId?: string) =>
    workspace?.people.find((p) => p.accountId === accountId)?.displayName ??
    "Owner unavailable";
  const assessment = (id: string) =>
    workspace?.assessments.find((a) => a.commitmentId === id);
  const resultState = (c: CommitmentRecord) =>
    c.outcomes
      .filter((o) => o.commitmentVersion === activeVersion(c)?.version)
      .at(-1)?.status;
  const shown =
    workspace?.commitments.filter((c) => {
      const a = activeVersion(c.value) ?? c.value.draft;
      if (!a) return false;
      const diagnostic = assessment(c.value.id);
      const matchSearch =
        `${a.title} ${a.outcome ?? ""} ${c.value.id} ${person(a.accountableOwnerAccountId)}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchRole =
        role === "Account"
          ? a.beneficiary?.kind === "CUSTOMER"
          : role === "Engineer"
            ? a.supportingWorkIds?.some((id) =>
                workspace.work.work.some(
                  (w) =>
                    w.id === id && w.assigneeAccountId === workspace.principal,
                ),
              ) ||
              diagnostic?.paths.some((p) =>
                p.nodeIds.some((id) =>
                  workspace.work.work.some(
                    (w) =>
                      w.id === id &&
                      w.assigneeAccountId === workspace.principal,
                  ),
                ),
              )
            : role === "Team"
              ? a.accountableOwnerAccountId === workspace.principal ||
                workspace.projectState?.value.bindings.some(
                  (b) =>
                    b.accountId === workspace.principal &&
                    [workspace.project!.id, c.value.id].includes(b.scopeId),
                )
              : true;
      return (
        matchSearch &&
        matchRole &&
        (health === "ALL" || diagnostic?.health === health)
      );
    }) ?? [];
  const proposalExpired = (proposal: RecoveryProposal) =>
    Date.parse(proposal.expiresAt) <= Date.parse(workspace?.now ?? "");
  const counts = {
    atRisk: shown.filter((c) =>
      ["AT_RISK", "BREACHED"].includes(assessment(c.value.id)?.health ?? ""),
    ).length,
    review: shown.reduce(
      (n, c) =>
        n +
        c.value.proposals.filter(
          (p) =>
            !proposalExpired(p) &&
            !c.value.operations.some((o) => o.proposalId === p.id),
        ).length,
      0,
    ),
    verified: shown.filter((c) => resultState(c.value) === "VERIFIED").length,
    unknown: shown.filter(
      (c) => assessment(c.value.id)?.coverage !== "COMPLETE",
    ).length,
  };
  function selectCommitment(id: string) {
    setSelected(id);
    setPage("overview");
  }
  function newCommitment() {
    setRevisionMode(false);
    setForm("commitment");
  }
  function heading(
    title: string,
    eyebrow: string,
    subtitle?: string,
    actions?: ReactNode,
  ) {
    return (
      <div className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {actions && <div className="heading-actions">{actions}</div>}
      </div>
    );
  }

  if (!client || !workspace)
    return (
      <main className="welcome">
        <img src="./promisory-logo.svg" alt="Promisory" width="220" />
        <p className="eyebrow">CONNECTED COMMITMENTS</p>
        <h1>Keep every commitment connected.</h1>
        <p>
          Follow a promise through the work, people, and evidence that determine
          whether it will be kept.
        </p>
        {error && <ErrorSummary message={error} />}
        <div className="welcome-actions">
          <button
            className="primary"
            disabled={loading}
            onClick={() => void begin("EXAMPLE")}
          >
            {loading ? "Opening workspace…" : "Explore example data"}
          </button>
          {window.parent !== window && (
            <button disabled={loading} onClick={() => void begin("LIVE")}>
              Connect installed Forge app
            </button>
          )}
        </div>
        <div className="welcome-note">
          <b>Example mode is explicit.</b> Fictional Northstar Retail data runs
          in memory. It makes no Atlassian requests and cannot execute an
          external action.
        </div>
        <p className="muted">
          Live mode runs inside an installed Jira or Confluence app.
        </p>
      </main>
    );

  if (client.surface && !expanded)
    return (
      <EmbeddedView
        client={client}
        workspace={workspace}
        onExpand={() => setExpanded(true)}
        onRefresh={() => void load()}
        onProject={(id) => void load(client, id)}
        error={error}
        loading={loading}
      />
    );
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <img className="brand" src="./promisory-logo.svg" alt="Promisory" />
        <div className="workspace-label">DELIVERY WORKSPACE</div>
        <nav aria-label="Workspace">
          {navigation.map(([id, label, icon]) => (
            <button
              key={id}
              className={page === id ? "nav-item active" : "nav-item"}
              aria-current={page === id ? "page" : undefined}
              onClick={() => {
                setPage(id);
              }}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
              {id === "reviews" && counts.review > 0 && (
                <span className="nav-count">{counts.review}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="small-mark" aria-hidden="true">
            ◎
          </span>
          <div>
            <b>Work. People. Outcomes.</b>
            <p>One connected agreement.</p>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="project-picker">
            <label htmlFor="project-select">Project</label>
            <select
              id="project-select"
              value={projectId ?? ""}
              onChange={(e) => {
                setProjectId(e.target.value);
                setSelected(undefined);
                void load(client, e.target.value);
              }}
            >
              {!workspace.project && (
                <option value="">Select a configured project</option>
              )}
              {workspace.projects.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="topbar-actions">
            <button disabled={loading} onClick={() => void load()}>
              {loading ? "Refreshing…" : "↻ Refresh evidence"}
            </button>
            <div className="current-user">
              <span className="avatar">
                {person(workspace.principal)
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span>{person(workspace.principal)}</span>
            </div>
          </div>
        </header>
        {client.mode === "EXAMPLE" && (
          <div className="example-banner">
            <span>
              <b>Example data</b> · Fictional records, held external actions ·
              Clock: 18 Nov 2026, 09:00 Stockholm
            </span>
            <label>
              Example actor
              <select
                aria-label="Example actor"
                value={workspace.principal}
                onChange={(e) => {
                  client.actor?.(e.target.value);
                  void load();
                }}
              >
                {workspace.people.map((p) => (
                  <option key={p.accountId} value={p.accountId}>
                    {personLabel(p, workspace.principal)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <main id="main" className="content" tabIndex={-1} aria-busy={loading}>
          {error && <ErrorSummary message={error} />}
          <div className="status-message" role="status" aria-live="polite">
            {notice}
          </div>
          {!workspace.project && page !== "connections" ? (
            <>
              <h1>Connect a project</h1>
              <Empty title="Your workspace is ready for a project">
                An administrator can choose the Jira project and optional
                Confluence connection.
              </Empty>
              <button
                className="primary"
                onClick={() => setPage("connections")}
              >
                Open connections
              </button>
            </>
          ) : (
            <>
              {page === "overview" && (
                <>
                  {heading(
                    "Every promise, connected.",
                    `${workspace.project?.key} / OVERVIEW`,
                    "See what needs attention, who can act, and which outcomes have evidence.",
                    <>
                      <button
                        onClick={async () => {
                          if (!client.askRovo) {
                            setNotice(
                              "Example mode has no Rovo connection. The work map shows deterministic domain evidence.",
                            );
                            return;
                          }
                          try {
                            await client.askRovo(
                              `What threatens the commitments in Jira project ${projectId}? Use Promisory tools and cite current evidence.`,
                            );
                          } catch (e) {
                            setError(String(e));
                          }
                        }}
                      >
                        ✧ Ask Promisory in Rovo
                      </button>
                      <button className="primary" onClick={newCommitment}>
                        + New commitment
                      </button>
                    </>,
                  )}
                  <div
                    className="role-tabs"
                    role="group"
                    aria-label="Workspace perspective"
                  >
                    {["Manager", "Team", "Engineer", "Account"].map((r) => (
                      <button
                        key={r}
                        aria-pressed={role === r}
                        className={role === r ? "selected" : ""}
                        onClick={() => setRole(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <div className="metrics">
                    <div className="metric">
                      <span>Visible commitments</span>
                      <strong>{shown.length}</strong>
                      <small>Within your selected scope</small>
                    </div>
                    <div className="metric">
                      <span>Need attention</span>
                      <strong className="text-danger">{counts.atRisk}</strong>
                      <small>Known risks or missed deadlines</small>
                    </div>
                    <div className="metric">
                      <span>Context incomplete</span>
                      <strong>{counts.unknown}</strong>
                      <small>Coverage stays explicit</small>
                    </div>
                    <div className="metric">
                      <span>Outcomes verified</span>
                      <strong className="text-success">
                        {counts.verified}
                      </strong>
                      <small>Evidence against agreed conditions</small>
                    </div>
                  </div>
                  <div
                    className={`overview-grid ${current ? "with-detail" : ""}`}
                  >
                    <section className="card commitments">
                      <div className="section-heading">
                        <div>
                          <h2>Commitments</h2>
                          <p>Accepted owners. Explicit deadlines.</p>
                        </div>
                        <span className="count-text">
                          {shown.length} visible
                        </span>
                      </div>
                      <div className="filters">
                        <label className="search">
                          <span aria-hidden="true">⌕</span>
                          <input
                            aria-label="Search commitments"
                            placeholder="Search commitments or owners"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          {search && (
                            <button
                              aria-label="Clear search"
                              onClick={() => setSearch("")}
                            >
                              ×
                            </button>
                          )}
                        </label>
                        <select
                          aria-label="Filter delivery health"
                          value={health}
                          onChange={(e) => setHealth(e.target.value)}
                        >
                          <option value="ALL">All health states</option>
                          <option value="AT_RISK">At risk</option>
                          <option value="BREACHED">Deadline missed</option>
                          <option value="WATCH">Watch</option>
                          <option value="UNKNOWN">Context incomplete</option>
                          <option value="ON_TRACK">On track</option>
                        </select>
                      </div>
                      {shown.length ? (
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Commitment</th>
                                <th>Owner</th>
                                <th>Agreed deadline</th>
                                <th>Delivery health</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shown.map((c) => {
                                const a =
                                  activeVersion(c.value) ?? c.value.draft!;
                                return (
                                  <tr
                                    key={c.value.id}
                                    className={
                                      selected === c.value.id
                                        ? "selected-row"
                                        : ""
                                    }
                                  >
                                    <td>
                                      <button
                                        className="text-button title-link"
                                        onClick={() => setSelected(c.value.id)}
                                      >
                                        {a.title}
                                      </button>
                                      <small>
                                        {c.value.id.startsWith("PM-") &&
                                        c.value.id.length < 15
                                          ? c.value.id
                                          : "Commitment"}{" "}
                                        ·{" "}
                                        {activeVersion(c.value)
                                          ? `Version ${activeVersion(c.value)!.version}`
                                          : "Draft · needs owner acceptance"}
                                      </small>
                                      <div className="mobile-commitment-meta">
                                        <span>
                                          {person(a.accountableOwnerAccountId)}
                                        </span>
                                        {a.agreedDueAt ? (
                                          <DateDisplay
                                            instant={a.agreedDueAt}
                                            zone={a.timeZone ?? "UTC"}
                                          />
                                        ) : (
                                          <span>Deadline unresolved</span>
                                        )}
                                        {c.value.pendingOwner && (
                                          <span>Transfer pending</span>
                                        )}
                                      </div>
                                      {resultState(c.value) === "VERIFIED" && (
                                        <Badge state="VERIFIED" />
                                      )}
                                    </td>
                                    <td>
                                      {person(a.accountableOwnerAccountId)}
                                      {c.value.pendingOwner && (
                                        <small>Transfer pending</small>
                                      )}
                                    </td>
                                    <td>
                                      {a.agreedDueAt ? (
                                        <DateDisplay
                                          instant={a.agreedDueAt}
                                          zone={a.timeZone ?? "UTC"}
                                        />
                                      ) : (
                                        <span>Deadline unresolved</span>
                                      )}
                                    </td>
                                    <td>
                                      <Badge
                                        state={
                                          assessment(c.value.id)?.health ??
                                          "UNKNOWN"
                                        }
                                      />
                                      {assessment(c.value.id)?.coverage !==
                                        "COMPLETE" && (
                                        <small>Coverage incomplete</small>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty
                          title={
                            search
                              ? "No matching commitments"
                              : "No commitments in this view"
                          }
                        >
                          {search
                            ? "Try a different title, owner, or health filter."
                            : "Create a draft, or choose another perspective."}
                        </Empty>
                      )}
                    </section>
                    {current && agreement && (
                      <aside className="card detail">
                        <div className="section-heading">
                          <p className="eyebrow">COMMITMENT DETAIL</p>
                          <button
                            className="icon-button"
                            aria-label="Close commitment detail"
                            onClick={() => setSelected(undefined)}
                          >
                            ×
                          </button>
                        </div>
                        <h2>{agreement.title}</h2>
                        <p>
                          {agreement.outcome ?? "Outcome needs confirmation."}
                        </p>
                        <div className="detail-badges">
                          <Badge
                            state={
                              assessment(current.value.id)?.health ?? "UNKNOWN"
                            }
                          />
                          <Badge
                            state={resultState(current.value) ?? "PENDING"}
                          />
                        </div>
                        <dl>
                          <dt>Accountable owner</dt>
                          <dd>{person(agreement.accountableOwnerAccountId)}</dd>
                          <dt>Beneficiary</dt>
                          <dd>
                            {agreement.beneficiary?.reference ??
                              "Needs confirmation"}
                          </dd>
                          <dt>Agreed deadline</dt>
                          <dd>
                            {agreement.agreedDueAt ? (
                              <DateDisplay
                                instant={agreement.agreedDueAt}
                                zone={agreement.timeZone ?? "UTC"}
                              />
                            ) : (
                              "Unresolved"
                            )}
                          </dd>
                          {active &&
                            active.originalDueAt !== active.agreedDueAt && (
                              <>
                                <dt>Original promise</dt>
                                <dd>
                                  <DateDisplay
                                    instant={active.originalDueAt}
                                    zone={active.timeZone}
                                  />
                                  <small>
                                    Original deadline remains part of
                                    timeliness.
                                  </small>
                                </dd>
                              </>
                            )}
                        </dl>
                        <h3>What the evidence says</h3>
                        {assessment(current.value.id)?.reasons.length ? (
                          <ul className="reason-list">
                            {assessment(current.value.id)!.reasons.map((r) => (
                              <li key={r.code}>{r.explanation}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted">
                            No active rule was found in current, permitted
                            evidence.
                          </p>
                        )}
                        <h3>Acceptance conditions</h3>
                        <ul className="reason-list">
                          {agreement.acceptance?.map((a) => (
                            <li key={a.id}>
                              {a.description}
                              <small>
                                Verifier:{" "}
                                {person(a.designatedVerifierAccountId)}
                              </small>
                            </li>
                          )) ?? <li>Acceptance is unresolved.</li>}
                        </ul>
                        {current.value.draft && (
                          <div className="callout">
                            <b>
                              {active ? "Proposed revision" : "Draft agreement"}
                            </b>
                            <p>
                              Owner acceptance creates a new immutable agreement
                              version.
                            </p>
                            <button
                              className="primary"
                              onClick={() =>
                                void action(
                                  "commitment.confirm",
                                  {
                                    commitmentId: current.value.id,
                                    expectedRevision: current.revision,
                                  },
                                  "The owner accepted this agreement.",
                                )
                              }
                            >
                              Accept as accountable owner
                            </button>
                            <button
                              onClick={() => {
                                setRevisionMode(true);
                                setForm("commitment");
                              }}
                            >
                              Complete candidate
                            </button>
                          </div>
                        )}
                        {active && (
                          <div className="button-stack">
                            <button
                              className="primary"
                              onClick={() => setForm("recovery")}
                            >
                              Compare recovery options
                            </button>
                            <button onClick={() => setForm("verify")}>
                              Verify acceptance evidence
                            </button>
                            <div className="button-row">
                              <button
                                onClick={() => {
                                  setRevisionMode(true);
                                  setForm("commitment");
                                }}
                              >
                                Propose revision
                              </button>
                              <button onClick={() => setForm("transfer")}>
                                Transfer owner
                              </button>
                            </div>
                          </div>
                        )}
                        {current.value.pendingOwner && (
                          <div className="callout">
                            <p>
                              Transfer to{" "}
                              {person(current.value.pendingOwner.accountId)} is
                              pending.
                            </p>
                            <button
                              onClick={() =>
                                void action(
                                  "commitment.acceptOwner",
                                  {
                                    commitmentId: current.value.id,
                                    expectedRevision: current.revision,
                                  },
                                  "Incoming owner accepted the transfer.",
                                )
                              }
                            >
                              Accept incoming ownership
                            </button>
                          </div>
                        )}
                        <details>
                          <summary>
                            Agreement history · {current.value.history.length}{" "}
                            events
                          </summary>
                          <ol className="timeline">
                            {current.value.history
                              .slice()
                              .reverse()
                              .map((h) => (
                                <li key={h.id}>
                                  <b>{h.summary}</b>
                                  <small>
                                    {person(h.actorAccountId)} ·{" "}
                                    {new Date(h.at).toLocaleDateString("en-GB")}
                                  </small>
                                </li>
                              ))}
                          </ol>
                        </details>
                      </aside>
                    )}
                  </div>
                  <section className="context-note">
                    <span aria-hidden="true">ⓘ</span>
                    <p>
                      Delivery health, review, execution authority, and verified
                      fulfillment describe different stages. Missing context
                      stays visible.
                    </p>
                  </section>
                </>
              )}
              {page === "lifecycle" && (
                <>
                  {heading(
                    "From intent to evidence.",
                    `${workspace.project?.key} / PRODUCT LIFECYCLE`,
                    "Ten connected phases. Planning context and native Jira ancestry remain distinct.",
                    <>
                      <button onClick={() => setForm("planning")}>
                        + Planning context
                      </button>
                      <button
                        className="primary"
                        onClick={() => setForm("artifact")}
                      >
                        Map an existing page
                      </button>
                    </>,
                  )}
                  <div className="planning-grid">
                    {workspace.projectState?.value.planning.map((p) => (
                      <article className="planning-card" key={p.id}>
                        <p className="eyebrow">{p.kind}</p>
                        <h3>{p.title}</h3>
                        <p>{person(p.ownerAccountId)}</p>
                        <span className="relationship">
                          {p.nativeWorkNodeId
                            ? "Bound to a configured native work level"
                            : "Explicit planning relationship"}
                        </span>
                      </article>
                    ))}
                  </div>
                  <nav className="phase-rail" aria-label="Lifecycle phases">
                    {phases.map((p, i) => (
                      <button
                        key={p}
                        aria-pressed={p === phase}
                        className={p === phase ? "selected" : ""}
                        onClick={() => setPhase(p)}
                      >
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        {phaseLabels[p]}
                      </button>
                    ))}
                  </nav>
                  <section className="card">
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">PHASE CONTEXT</p>
                        <h2>{phaseLabels[phase]}</h2>
                      </div>
                      <span className="muted">
                        Phases can overlap and repeat
                      </span>
                    </div>
                    <div className="artifact-grid">
                      {workspace.projectState?.value.artifacts
                        .filter((a) => a.phase === phase)
                        .map((a) => (
                          <article className="artifact" key={a.id}>
                            <div className="source-icon" aria-hidden="true">
                              C
                            </div>
                            <div>
                              <small>
                                {a.artifactRole.replaceAll("_", " ")} ·
                                Confluence
                              </small>
                              <h3>{a.title}</h3>
                              {client.openPage && (
                                <button
                                  onClick={() =>
                                    void client.openPage!(a.pageId).catch((e) =>
                                      setError(String(e)),
                                    )
                                  }
                                >
                                  Open source page
                                </button>
                              )}
                              <p>
                                {person(a.ownerAccountId)} · Source revision{" "}
                                {a.source.sourceRevision}
                              </p>
                              <p className="muted">
                                Page {a.pageId} · document organization
                              </p>
                            </div>
                          </article>
                        ))}
                    </div>
                    {!workspace.projectState?.value.artifacts.some(
                      (a) => a.phase === phase,
                    ) && (
                      <Empty title="No source mapped to this phase">
                        Map a permitted existing Confluence page. Onboarding
                        does not create or move pages.
                      </Empty>
                    )}
                  </section>
                  <div className="two-columns">
                    <section className="card">
                      <div className="section-heading">
                        <h2>Requirements & work</h2>
                        <button onClick={() => setForm("requirement")}>
                          Map requirement
                        </button>
                      </div>
                      {workspace.projectState?.value.requirements.map((r) => (
                        <article className="requirement" key={r.id}>
                          <div className="section-heading">
                            <strong>{r.id}</strong>
                            <Badge
                              state={
                                r.mappingState === "CONFIRMED"
                                  ? "CURRENT"
                                  : r.mappingState
                              }
                            />
                          </div>
                          <h3>{r.description}</h3>
                          <p>
                            PRD revision {r.sourceRevision} · Mapping version{" "}
                            {r.version}
                          </p>
                          <p className="muted">Section: {r.sectionReference}</p>
                          <div className="work-chips">
                            {r.confirmedWorkIds.map((id) => {
                              const work = workspace.work.work.find(
                                (w) => w.id === id,
                              );
                              return work ? (
                                <button
                                  key={id}
                                  onClick={() => {
                                    setSelectedWork(id);
                                    setPage("work");
                                  }}
                                >
                                  {work.displayKey}{" "}
                                  <span>{work.nativeTypeName}</span>
                                </button>
                              ) : null;
                            })}
                          </div>
                          <small>
                            A changed source requires a fresh confirmed mapping.
                          </small>
                          <details>
                            <summary>Previous requirement mappings</summary>
                            {r.version === 1 && (
                              <p>This is the first confirmed mapping.</p>
                            )}
                            {workspace
                              .projectState!.value.requirementHistory.filter(
                                (previous) => previous.id === r.id,
                              )
                              .map((previous) => (
                                <p key={`${previous.id}:${previous.version}`}>
                                  Mapping version {previous.version} · PRD
                                  revision {previous.sourceRevision}
                                  {" · "}Section {previous.sectionReference}
                                </p>
                              ))}
                          </details>
                        </article>
                      ))}
                    </section>
                    <section className="card">
                      <div className="section-heading">
                        <h2>Release readiness</h2>
                        <button onClick={() => setForm("gate")}>
                          Prepare gate
                        </button>
                      </div>
                      {workspace.gates.map((g) => (
                        <article className="gate" key={g.gateId}>
                          <h3>
                            {
                              workspace.projectState?.value.gates.find(
                                (x) => x.id === g.gateId,
                              )?.title
                            }
                          </h3>
                          <Badge state={g.readiness} />
                          <p>
                            Gate version{" "}
                            {
                              workspace.projectState!.value.gates.find(
                                (version) => version.id === g.gateId,
                              )?.version
                            }
                            {" · "}Applicability:{" "}
                            {g.applicability.toLowerCase()}
                          </p>
                          {g.conditions.map((c) => (
                            <p key={c.conditionId} className="condition-row">
                              <b>
                                {c.result === "PASS"
                                  ? "✓"
                                  : c.result === "FAIL"
                                    ? "!"
                                    : "○"}{" "}
                                {c.result}
                              </b>{" "}
                              {c.explanation}
                            </p>
                          ))}
                          {g.reasons.map((reason, i) => (
                            <p className="text-danger" key={i}>
                              {reason}
                            </p>
                          ))}
                          <div className="button-row">
                            <button
                              disabled={g.applicability !== "CURRENT"}
                              onClick={() =>
                                void action(
                                  "lifecycle.reviewGate",
                                  {
                                    projectId,
                                    expectedRevision:
                                      workspace.projectState!.revision,
                                    gateId: g.gateId,
                                    basisHash: g.basisHash,
                                    disposition: "ACCEPT",
                                    note: "Reviewed the exact current evidence and source versions.",
                                  },
                                  "Gate review recorded. It does not grant execution authority.",
                                )
                              }
                            >
                              Accept gate review
                            </button>
                            <button
                              disabled={g.applicability !== "CURRENT"}
                              onClick={() =>
                                void action(
                                  "lifecycle.reviewGate",
                                  {
                                    projectId,
                                    expectedRevision:
                                      workspace.projectState!.revision,
                                    gateId: g.gateId,
                                    basisHash: g.basisHash,
                                    disposition: "HOLD",
                                    note: "Required designated review remains on hold.",
                                  },
                                  "Gate held.",
                                )
                              }
                            >
                              Hold gate
                            </button>
                          </div>
                          <GateHistory
                            versions={[
                              ...workspace.projectState!.value.gateHistory,
                              ...workspace.projectState!.value.gates,
                            ].filter((version) => version.id === g.gateId)}
                            person={person}
                          />
                        </article>
                      ))}
                      <p className="footnote">
                        A ready or accepted gate is separate from Decionis
                        execution authority and business outcome verification.
                      </p>
                    </section>
                  </div>
                  {client.example && (
                    <div className="example-controls">
                      <b>Example scenario</b>
                      <button
                        onClick={() => {
                          client.example!.sources.changeRequirement();
                          void load();
                          setNotice(
                            "Example PRD revision changed. Requirement applicability and the gate now need reassessment.",
                          );
                        }}
                      >
                        Simulate PRD revision
                      </button>
                    </div>
                  )}
                </>
              )}
              {(page === "work" || page === "mine") && (
                <>
                  {heading(
                    page === "mine"
                      ? "Your work, in context."
                      : "Follow the real delivery path.",
                    `${workspace.project?.key} / ${page === "mine" ? "MY WORK" : "WORK MAP"}`,
                    "Stories, tasks, and bugs are peers. Blocking and implementation links carry their own meaning.",
                  )}
                  <section className="card">
                    <div className="section-heading">
                      <h2>
                        {page === "mine"
                          ? "Work assigned to you"
                          : "Native hierarchy & typed relationships"}
                      </h2>
                      <Badge state={workspace.work.coverage} />
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Work item</th>
                            <th>Native parent</th>
                            <th>Assignee</th>
                            <th>Current state</th>
                            <th>Upstream impact</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workspace.work.work
                            .filter(
                              (w) =>
                                page !== "mine" ||
                                w.assigneeAccountId === workspace.principal,
                            )
                            .map((w) => (
                              <tr
                                key={w.id}
                                className={
                                  selectedWork === w.id ? "selected-row" : ""
                                }
                              >
                                <td>
                                  <button
                                    className="text-button title-link"
                                    onClick={() => setSelectedWork(w.id)}
                                  >
                                    {w.displayKey} · {w.title}
                                  </button>
                                  <small>
                                    {w.nativeTypeName} · native level{" "}
                                    {w.hierarchyLevel}
                                  </small>
                                </td>
                                <td>
                                  {workspace.work.work.find(
                                    (x) => x.id === w.parentId,
                                  )?.displayKey ??
                                    (w.parentId
                                      ? "Outside visible scope"
                                      : "No native parent")}
                                </td>
                                <td>{person(w.assigneeAccountId)}</td>
                                <td>
                                  {w.statusName}
                                  <small>
                                    Target: {w.targetDate ?? "Not set"}
                                  </small>
                                </td>
                                <td>
                                  <button onClick={() => setSelectedWork(w.id)}>
                                    Trace impact
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <div className="two-columns">
                    <section className="card">
                      <h2>Confirmed relationships</h2>
                      <ul className="edge-list">
                        {[
                          ...workspace.work.edges,
                          ...(workspace.projectState?.value.edges ?? []),
                        ]
                          .filter((e) => e.kind !== "PARENT_OF")
                          .map((e) => (
                            <li key={e.id}>
                              <strong>
                                {workspace.work.work.find(
                                  (w) => w.id === e.fromId,
                                )?.displayKey ??
                                  workspace.projectState?.value.planning.find(
                                    (p) => p.id === e.fromId,
                                  )?.title ??
                                  e.fromId}
                              </strong>
                              <span className="relationship">
                                {e.kind.toLowerCase().replaceAll("_", " ")} →
                              </span>
                              <strong>
                                {workspace.work.work.find(
                                  (w) => w.id === e.toId,
                                )?.displayKey ?? e.toId}
                              </strong>
                              <small>
                                {e.state.toLowerCase()} ·{" "}
                                {e.provenance.source === "JIRA"
                                  ? "Jira link"
                                  : "Explicit planning link"}
                              </small>
                            </li>
                          ))}
                      </ul>
                      <p className="footnote">
                        Project is a container. Planning links, page nesting,
                        releases, and sprints are not native parents.
                      </p>
                    </section>
                    <section className="card">
                      <h2>
                        {selectedWork
                          ? workspace.work.work.find(
                              (w) => w.id === selectedWork,
                            )?.displayKey + " · Commitment impact"
                          : "Select work to trace its impact"}
                      </h2>
                      {selectedWork ? (
                        workspace.assessments
                          .filter((a) =>
                            a.paths.some((p) =>
                              p.nodeIds.includes(selectedWork),
                            ),
                          )
                          .map((a) => (
                            <article
                              className="impact-card"
                              key={a.commitmentId}
                            >
                              <button
                                className="text-button title-link"
                                onClick={() => selectCommitment(a.commitmentId)}
                              >
                                {
                                  activeVersion(
                                    workspace.commitments.find(
                                      (c) => c.value.id === a.commitmentId,
                                    )!.value,
                                  )?.title
                                }
                              </button>
                              <Badge state={a.health} />
                              {a.paths
                                .filter((p) => p.nodeIds[0] === selectedWork)
                                .map((p) => (
                                  <p key={p.id} className="path">
                                    {p.nodeIds
                                      .map(
                                        (id) =>
                                          workspace.work.work.find(
                                            (w) => w.id === id,
                                          )?.displayKey ??
                                          (id === a.commitmentId
                                            ? "Commitment"
                                            : id),
                                      )
                                      .join(" → ")}
                                  </p>
                                ))}
                              {a.reasons.map((r) => (
                                <p key={r.code}>{r.explanation}</p>
                              ))}
                              <small>
                                Rule {a.ruleVersion} ·{" "}
                                {a.coverage.toLowerCase()} coverage
                              </small>
                            </article>
                          ))
                      ) : (
                        <p className="muted">
                          Select a work item to inspect its typed paths and
                          current evidence.
                        </p>
                      )}
                      {selectedWork &&
                        !workspace.assessments.some((a) =>
                          a.paths.some((p) => p.nodeIds.includes(selectedWork)),
                        ) && (
                          <Empty title="No confirmed commitment path returned">
                            This is a bounded trace of visible records, not
                            proof that dependencies are absent.
                          </Empty>
                        )}
                    </section>
                  </div>
                </>
              )}
              {page === "reviews" && (
                <>
                  {heading(
                    "Review the exact change.",
                    `${workspace.project?.key} / REVIEWS`,
                    "A review records a person’s disposition. Apply separately checks current evidence and execution authority.",
                  )}
                  {workspace.commitments.flatMap((c) =>
                    c.value.proposals.map((p) => ({ c, p })),
                  ).length === 0 && (
                    <Empty title="No recovery proposals yet">
                      Open a commitment and compare recovery options to prepare
                      an exact change.
                    </Empty>
                  )}
                  {workspace.commitments
                    .flatMap((c) => c.value.proposals.map((p) => ({ c, p })))
                    .sort((a, b) => b.p.createdAt.localeCompare(a.p.createdAt))
                    .map(({ c, p }) => {
                      const operation = c.value.operations.find(
                          (o) => o.proposalId === p.id,
                        ),
                        reviews = c.value.reviews.filter(
                          (r) => r.proposalId === p.id,
                        ),
                        createdByMe =
                          p.createdByAccountId === workspace.principal,
                        expired = proposalExpired(p),
                        reviewUnavailableReason = operation
                          ? "This proposal already has an attempt recorded. Read its result under Apply through authority."
                          : expired
                            ? "This proposal expired. Prepare a new proposal before review."
                            : createdByMe
                              ? "You prepared this proposal. A different designated approver must review it."
                              : undefined;
                      const resultCheckUnavailableReason =
                        operation &&
                        operation.context.principalAccountId !==
                          workspace.principal
                          ? "The account that applied this change must check its result. Switch to that Jira account to continue."
                          : undefined;
                      return (
                        <section className="card review-card" key={p.id}>
                          <div className="section-heading">
                            <div>
                              <p className="eyebrow">
                                JIRA DUE-DATE PROPOSAL · AGREEMENT V
                                {p.commitmentVersion}
                              </p>
                              <h2>{activeVersion(c.value)?.title}</h2>
                            </div>
                            {operation ? (
                              <Badge state={operation.stage} />
                            ) : (
                              <Badge
                                state={
                                  expired
                                    ? "EXPIRED"
                                    : reviews.length > 0
                                      ? "REVIEW_RECORDED"
                                      : "AWAITING_REVIEW"
                                }
                              />
                            )}
                          </div>
                          <div className="change-diff">
                            <div>
                              <small>Reviewed Jira date</small>
                              <strong>
                                {p.effect.expectedDueDate ?? "No date"}
                              </strong>
                            </div>
                            <span aria-hidden="true">→</span>
                            <div>
                              <small>Proposed Jira date</small>
                              <strong>{p.effect.desiredDueDate}</strong>
                            </div>
                          </div>
                          <p>
                            Target:{" "}
                            {workspace.work.work.find(
                              (w) => w.externalId === p.effect.issueId,
                            )?.displayKey ?? p.effect.issueId}
                            . The commitment’s agreed deadline stays unchanged.
                          </p>
                          <p className="muted">
                            Prepared by{" "}
                            {createdByMe ? "you" : person(p.createdByAccountId)}{" "}
                            · {expired ? "Expired" : "Expires"}{" "}
                            {new Date(p.expiresAt).toLocaleString("en-GB", {
                              timeZone: "Europe/Stockholm",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            Stockholm
                          </p>
                          <div className="review-actions">
                            <div>
                              <h3>1. Independent review</h3>
                              {reviewUnavailableReason && (
                                <p id={`review-unavailable-${p.id}`}>
                                  {reviewUnavailableReason}
                                </p>
                              )}
                              <div className="button-row">
                                {(["APPROVE", "HOLD", "REJECT"] as const).map(
                                  (disposition) => (
                                    <button
                                      key={disposition}
                                      disabled={
                                        createdByMe || !!operation || expired
                                      }
                                      aria-describedby={
                                        reviewUnavailableReason
                                          ? `review-unavailable-${p.id}`
                                          : undefined
                                      }
                                      onClick={() =>
                                        void action(
                                          "review.record",
                                          {
                                            commitmentId: c.value.id,
                                            expectedRevision: c.revision,
                                            proposalId: p.id,
                                            intentHash: p.intentHash,
                                            disposition,
                                            note: `${disposition.toLowerCase()} for the displayed exact effect.`,
                                          },
                                          "Review recorded. Execution has not occurred.",
                                        )
                                      }
                                    >
                                      {disposition === "APPROVE"
                                        ? "Approve review"
                                        : disposition === "HOLD"
                                          ? "Hold"
                                          : "Reject"}
                                    </button>
                                  ),
                                )}
                              </div>
                              {reviews.map((r) => (
                                <p key={r.id}>
                                  {person(r.reviewerAccountId)} ·{" "}
                                  {r.disposition.toLowerCase()}
                                </p>
                              ))}
                            </div>
                            <div>
                              <h3>2. Apply through authority</h3>
                              {p.effectOrigin === "ATLASSIAN_ONLY" && (
                                <p>
                                  This Rovo proposal stays inside Atlassian.
                                  Prepare a separate date intent in the
                                  commitment’s recovery form before external
                                  execution.
                                </p>
                              )}
                              <p>
                                {operation?.message ??
                                  "Current source, user permissions, independent review, and a claimed grant are checked before dispatch."}
                              </p>
                              {operation &&
                              (operation.stage === "RECONCILING" ||
                                operation.stage === "EXECUTING" ||
                                operation.finalization === "PENDING") ? (
                                <>
                                  {resultCheckUnavailableReason && (
                                    <p id={`result-check-unavailable-${p.id}`}>
                                      {resultCheckUnavailableReason}
                                    </p>
                                  )}
                                  <button
                                    disabled={!!resultCheckUnavailableReason}
                                    aria-describedby={
                                      resultCheckUnavailableReason
                                        ? `result-check-unavailable-${p.id}`
                                        : undefined
                                    }
                                    onClick={() =>
                                      void action(
                                        "action.reconcile",
                                        {
                                          commitmentId: c.value.id,
                                          operationId: operation.id,
                                        },
                                        "Result check finished. Read the operation status below.",
                                      )
                                    }
                                  >
                                    Check operation result
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="primary"
                                  disabled={
                                    !!operation ||
                                    expired ||
                                    p.effectOrigin !== "USER_AUTHORED"
                                  }
                                  onClick={() =>
                                    void action(
                                      "action.apply",
                                      {
                                        commitmentId: c.value.id,
                                        expectedRevision: c.revision,
                                        proposalId: p.id,
                                        idempotencyKey: `apply-${p.id}`,
                                      },
                                      "The operation result is recorded below.",
                                    )
                                  }
                                >
                                  {operation
                                    ? "Attempt recorded"
                                    : "Apply reviewed change"}
                                </button>
                              )}
                              {operation?.finalization === "PENDING" && (
                                <small>
                                  The authority record still needs confirmation.
                                  Check the operation result to continue.
                                </small>
                              )}
                              {operation?.finalization === "RECORDED" && (
                                <small>
                                  {operation.stage === "RECONCILING"
                                    ? "An uncertain result was recorded. Completion is still awaiting verification."
                                    : operation.stage === "SUCCEEDED"
                                      ? "Jira change verified and authority record saved. Commitment health and outcome acceptance are assessed separately."
                                      : "The authority record for this attempt is saved. Read the operation status above."}
                                </small>
                              )}
                            </div>
                          </div>
                          <details>
                            <summary>View exact evidence and intent</summary>
                            <dl>
                              <dt>Intent hash</dt>
                              <dd className="mono">{p.intentHash}</dd>
                              <dt>Reviewed source revision</dt>
                              <dd>{p.effect.expectedUpdatedAt}</dd>
                              <dt>Versioned source basis</dt>
                              <dd>{p.basis.length} references</dd>
                              {operation && (
                                <>
                                  <dt>Authority finalization</dt>
                                  <dd>
                                    {operation.finalization.toLowerCase()}
                                  </dd>
                                </>
                              )}
                            </dl>
                          </details>
                        </section>
                      );
                    })}
                </>
              )}
              {page === "evidence" && (
                <>
                  {heading(
                    "Evidence before certainty.",
                    `${workspace.project?.key} / EVIDENCE`,
                    "Sources, observations, and acceptance remain independently inspectable.",
                  )}
                  <div className="two-columns">
                    <section className="card">
                      <h2>Jira source freshness</h2>
                      {workspace.work.work.map((w) => (
                        <article className="evidence-row" key={w.id}>
                          <div>
                            <b>
                              {w.displayKey} · {w.title}
                            </b>
                            <small>
                              Source revision {w.source.sourceRevision}
                            </small>
                            {client.openIssue && (
                              <button
                                onClick={() =>
                                  void client.openIssue!(w.displayKey).catch(
                                    (e) => setError(String(e)),
                                  )
                                }
                              >
                                Open Jira source
                              </button>
                            )}
                            <small>
                              Checked{" "}
                              {new Date(w.source.checkedAt).toLocaleTimeString(
                                "en-GB",
                                { timeZone: "Europe/Stockholm" },
                              )}{" "}
                              Stockholm
                            </small>
                          </div>
                          <Badge state={w.source.verification} />
                        </article>
                      ))}
                    </section>
                    <section className="card">
                      <h2>Teamwork Graph context</h2>
                      <Badge state={workspace.graph.coverage} />
                      <p className="muted">
                        Current-user assigned work from the curated traversal.
                        Context stays inside Atlassian.
                      </p>
                      {workspace.graph.items.map((item) => (
                        <article className="evidence-row" key={item.id}>
                          <div>
                            <b>{item.title}</b>
                            <small>{item.status}</small>
                            <span className="mono muted">{item.id}</span>
                          </div>
                        </article>
                      ))}
                      {workspace.graph.unknowns.map((u, i) => (
                        <p className="callout" key={i}>
                          {u}
                        </p>
                      ))}
                    </section>
                  </div>
                  <section className="card">
                    <h2>Outcome verification</h2>
                    {workspace.commitments.map((c) => (
                      <div className="evidence-row" key={c.value.id}>
                        <button
                          className="text-button title-link"
                          onClick={() => selectCommitment(c.value.id)}
                        >
                          {(activeVersion(c.value) ?? c.value.draft)?.title}
                        </button>
                        <Badge state={resultState(c.value) ?? "PENDING"} />
                        <small>
                          {c.value.outcomes.at(-1)?.timeliness === "LATE"
                            ? "Late against the original promise"
                            : c.value.outcomes.at(-1)
                              ? "Verified time is recorded"
                              : "No qualifying verification yet"}
                        </small>
                      </div>
                    ))}
                  </section>
                </>
              )}
              {page === "inbox" && (
                <>
                  {heading(
                    "Only the relevant changes.",
                    `${workspace.project?.key} / INBOX`,
                    "Findings are deduplicated by commitment and reason, then filtered through your current access.",
                  )}
                  {inboxMeta && (
                    <section className="card">
                      <h2>Quiet digest</h2>
                      <p>
                        {inboxMeta.digest.state === "QUIET_HOURS"
                          ? `Digest notifications are quiet until ${new Date(inboxMeta.digest.nextAvailableAt).toLocaleString("en-GB", { timeZone: inboxMeta.digest.timeZone })} (${inboxMeta.digest.timeZone}). The inbox remains available when you open it.`
                          : `${inboxMeta.digest.unreadCount} unread findings are ready in this in-app digest.`}
                      </p>
                      <form
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          await action(
                            "inbox.preferences",
                            {
                              quietStart: Number(data.get("quietStart")),
                              quietEnd: Number(data.get("quietEnd")),
                              timeZone: textValue(data, "quietZone"),
                            },
                            "Quiet hours saved.",
                          );
                        }}
                      >
                        <div className="form-grid three">
                          <FormField
                            name="quietStart"
                            label="Quiet hours start (0–23)"
                          >
                            <input
                              id="quietStart"
                              name="quietStart"
                              type="number"
                              min="0"
                              max="23"
                              defaultValue={inboxMeta.preferences.quietStart}
                            />
                          </FormField>
                          <FormField
                            name="quietEnd"
                            label="Quiet hours end (0–23)"
                          >
                            <input
                              id="quietEnd"
                              name="quietEnd"
                              type="number"
                              min="0"
                              max="23"
                              defaultValue={inboxMeta.preferences.quietEnd}
                            />
                          </FormField>
                          <FormField name="quietZone" label="Digest time zone">
                            <input
                              id="quietZone"
                              name="quietZone"
                              defaultValue={inboxMeta.preferences.timeZone}
                            />
                          </FormField>
                        </div>
                        <button>Save quiet hours</button>
                      </form>
                    </section>
                  )}
                  <section className="card">
                    {inboxStatus === "LOADING" ? (
                      <div role="status">
                        <Empty title="Checking current notices…">
                          Rechecking your source access and saved read markers.
                        </Empty>
                      </div>
                    ) : inboxStatus === "UNAVAILABLE" ? (
                      <Empty title="Inbox unavailable">
                        Refresh evidence to try the current access check again.
                      </Empty>
                    ) : inbox.length ? (
                      inbox.map((n) => (
                        <article className="inbox-item" key={n.id}>
                          <Badge state={n.severity} />
                          <div>
                            <button
                              className="text-button title-link"
                              onClick={() => selectCommitment(n.commitmentId)}
                            >
                              {workspace.commitments
                                .find((c) => c.value.id === n.commitmentId)
                                ?.value.versions.at(-1)?.title ??
                                "Commitment unavailable"}
                            </button>
                            <p>{n.reason}</p>
                          </div>
                          <button
                            disabled={n.seen}
                            onClick={async () => {
                              await action("inbox.markRead", {
                                notificationId: n.id,
                              });
                            }}
                          >
                            {n.seen ? "Read" : "Mark read"}
                          </button>
                        </article>
                      ))
                    ) : (
                      <Empty title="No current notices">
                        Refresh evidence to inspect the latest visible findings.
                      </Empty>
                    )}
                  </section>
                  <p className="footnote">
                    External sending is not enabled. These notices contain only
                    current authorized findings.
                  </p>
                </>
              )}
              {page === "connections" && (
                <>
                  {heading(
                    "Know what is connected.",
                    "WORKSPACE / CONNECTIONS",
                    "Source access is checked for the current user. Unavailable integrations never turn into example data.",
                  )}
                  <div className="two-columns">
                    <section className="card">
                      <h2>Project scope</h2>
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          void action(
                            "settings.configure",
                            {
                              expectedRevision: workspace.config?.revision ?? 0,
                              projectIds: [
                                textValue(data, "configuredProject"),
                              ],
                              confluenceConnected:
                                data.get("confluence") === "on",
                            },
                            "Project scope saved.",
                          );
                        }}
                      >
                        <FormField
                          name="configuredProject"
                          label="Selected Jira project"
                        >
                          <select
                            id="configuredProject"
                            name="configuredProject"
                            defaultValue={projectId}
                          >
                            {workspace.configurationProjects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.key} · {p.name}
                              </option>
                            ))}
                          </select>
                        </FormField>
                        <label className="check-line">
                          <input
                            name="confluence"
                            type="checkbox"
                            defaultChecked={
                              workspace.config?.value.confluenceConnected
                            }
                          />
                          Connect existing Confluence artifacts
                        </label>
                        <p className="muted">
                          Pages are mapped explicitly. This setting does not
                          publish or move documents.
                        </p>
                        <button
                          className="primary"
                          disabled={!workspace.canConfigure}
                        >
                          Save project scope
                        </button>
                        {!workspace.canAdmin && (
                          <p>
                            A current site administrator must choose the project
                            scope.
                          </p>
                        )}
                      </form>
                    </section>
                    <section className="card">
                      <div className="section-heading">
                        <h2>Connection diagnostics</h2>
                        <button
                          disabled={loading || checkingConnections}
                          onClick={() => void checkConnections()}
                        >
                          {checkingConnections
                            ? "Checking connections…"
                            : "Check connections"}
                        </button>
                      </div>
                      <p className="muted">
                        Checks access for your current account. This does not
                        authorize or apply a Jira change.
                      </p>
                      {connectionChecks && (
                        <p className="muted" role="status">
                          Last checked{" "}
                          {new Date(
                            connectionChecks.checkedAt,
                          ).toLocaleTimeString()}
                          . Results reset when the workspace refreshes.
                        </p>
                      )}
                      {(
                        connectionChecks?.capabilities ?? workspace.capabilities
                      ).map((c, i) => (
                        <div className="capability" key={`${c.key}-${i}`}>
                          <div>
                            <b>{c.key}</b>
                            <p>{c.detail}</p>
                          </div>
                          <Badge state={c.state} />
                        </div>
                      ))}
                    </section>
                  </div>
                  {workspace.project && (
                    <section className="card">
                      <div className="section-heading">
                        <h2>Explicit roles</h2>
                        <button onClick={() => setForm("role")}>
                          Add scoped binding
                        </button>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Person</th>
                              <th>Role</th>
                              <th>Scope</th>
                              <th>Provenance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {workspace.projectState?.value.bindings.map((b) => (
                              <tr key={b.id}>
                                <td>{person(b.accountId)}</td>
                                <td>
                                  {b.role.toLowerCase().replaceAll("_", " ")}
                                </td>
                                <td>
                                  {b.scopeType.toLowerCase()} · {b.scopeId}
                                </td>
                                <td>
                                  {b.provenance
                                    .toLowerCase()
                                    .replaceAll("_", " ")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="footnote">
                        Roles are not inferred from titles, authorship, or
                        activity. Each active agreement has one accepted
                        accountable owner.
                      </p>
                    </section>
                  )}
                  <section className="card">
                    <h2>Discovered work types</h2>
                    <div className="work-chips">
                      {workspace.work.workTypes.map((type, i) => (
                        <span key={`${type.id}-${i}`}>
                          {type.name} · native level {type.hierarchyLevel}
                        </span>
                      ))}
                    </div>
                    <p className="muted">
                      Higher work levels appear only when Jira reports them.
                      This app never edits your site-wide hierarchy.
                    </p>
                  </section>
                  {workspace.installationBinding && (
                    <details className="card">
                      <summary>Execution setup identifiers</summary>
                      <p>
                        These read-only identifiers come from this authenticated
                        installation. Use them to bind its execution service.
                        They do not grant authority or change source access.
                      </p>
                      <dl className="installation-binding">
                        {Object.entries(workspace.installationBinding).map(
                          ([key, value]) => (
                            <div key={key}>
                              <dt>{key}</dt>
                              <dd>
                                <code>{value}</code>
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </details>
                  )}
                  <details className="card">
                    <summary>Installation and data lifecycle</summary>
                    <p>
                      Source content is fetched under the current user.
                      Retention and remote cleanup need installed-tenant release
                      verification before production distribution.
                    </p>
                    {workspace.config?.value.enabled && (
                      <button
                        onClick={() =>
                          void action(
                            "settings.disconnect",
                            { expectedRevision: workspace.config!.revision },
                            "Disconnected. App reads and actions are disabled until a project is reconnected.",
                          )
                        }
                      >
                        Disconnect configured scope
                      </button>
                    )}
                  </details>
                </>
              )}
            </>
          )}
          {!!workspace.unknowns.filter((u) => !u.startsWith("Illustrative"))
            .length && (
            <details className="coverage-note">
              <summary>Context and coverage notes</summary>
              <ul>
                {workspace.unknowns
                  .filter((u) => !u.startsWith("Illustrative"))
                  .map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
              </ul>
            </details>
          )}
        </main>
        <footer className="workspace-footer">
          <span>Keep every commitment connected.</span>
          <span>
            {client.mode === "EXAMPLE"
              ? "Example mode · No external actions"
              : "Current-user Forge workspace"}
          </span>
        </footer>
      </div>
      {form === "commitment" && (
        <CommitmentForm
          workspace={workspace}
          record={revisionMode ? current : undefined}
          onClose={() => setForm(null)}
          onSave={async (draft) => {
            if (revisionMode && current)
              await command(
                "commitment.proposeRevision",
                {
                  commitmentId: current.value.id,
                  expectedRevision: current.revision,
                  draft,
                },
                "Revision saved for owner acceptance.",
              );
            else {
              const record = await command<Stored<CommitmentRecord>>(
                "commitment.createDraft",
                draft,
                "Draft saved. Owner acceptance is still required.",
              );
              setSelected(record.value.id);
            }
          }}
        />
      )}
      {form === "recovery" && current && active && (
        <CommandForm
          title="Compare recovery options"
          button="Prepare exact proposal"
          onClose={() => setForm(null)}
          onSubmit={async (data) => {
            await command(
              "proposal.prepare",
              {
                commitmentId: current.value.id,
                expectedRevision: current.revision,
                issueId: textValue(data, "issue"),
                desiredDueDate: textValue(data, "newdate"),
                alternative: textValue(data, "alternative"),
              },
              "Exact proposal prepared for independent review.",
            );
            setPage("reviews");
          }}
        >
          <div className="option-cards">
            <div>
              <b>Repair the blocker</b>
              <p>Coordinate linked work and review a delivery-date change.</p>
            </div>
            <div>
              <b>Reduce scope</b>
              <p>
                Identify a smaller outcome, then propose a separate agreement
                revision.
              </p>
            </div>
            <div>
              <b>Renegotiate</b>
              <p>
                Propose a new promise with the owner. Preserve the original
                deadline.
              </p>
            </div>
          </div>
          <FormField name="alternative" label="Recovery approach">
            <select id="alternative" name="alternative">
              <option value="REPAIR">Repair the blocker</option>
              <option value="REDUCE_SCOPE">
                Reduce scope — engineering date only
              </option>
              <option value="RENEGOTIATE">
                Renegotiate — engineering date only
              </option>
            </select>
          </FormField>
          <FormField name="issue" label="Exact Jira target">
            <select id="issue" name="issue">
              {workspace.work.work
                .filter((w) => active.supportingWorkIds.includes(w.id))
                .map((w) => (
                  <option key={w.id} value={w.externalId}>
                    {w.displayKey} · {w.title} · current{" "}
                    {w.targetDate ?? "no date"}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField name="newdate" label="Proposed Jira due date">
            <input id="newdate" name="newdate" type="date" required />
          </FormField>
          <p className="callout">
            This proposal changes only the Jira date after review and authority.
            The commitment deadline remains{" "}
            {new Date(active.agreedDueAt).toLocaleDateString("en-GB")}.
          </p>
        </CommandForm>
      )}
      {form === "transfer" && current && (
        <CommandForm
          title="Propose an owner transfer"
          onClose={() => setForm(null)}
          button="Request incoming acceptance"
          onSubmit={(data) =>
            command(
              "commitment.transferOwner",
              {
                commitmentId: current.value.id,
                expectedRevision: current.revision,
                incomingOwnerAccountId: textValue(data, "incoming"),
              },
              "Transfer proposed. The current owner remains accountable.",
            ).then(() => {})
          }
        >
          <FormField name="incoming" label="Incoming accountable owner">
            <select name="incoming" id="incoming">
              {workspace.people
                .filter(
                  (p) => p.accountId !== agreement?.accountableOwnerAccountId,
                )
                .map((p) => (
                  <option key={p.accountId} value={p.accountId}>
                    {personLabel(p, workspace.principal)}
                  </option>
                ))}
            </select>
          </FormField>
          <p>
            The transfer takes effect only when the incoming owner accepts it.
          </p>
        </CommandForm>
      )}
      {form === "verify" && current && active && (
        <CommandForm
          title="Verify the agreed outcome"
          button="Record verification"
          onClose={() => setForm(null)}
          onSubmit={(data) =>
            command(
              "outcome.verify",
              {
                commitmentId: current.value.id,
                expectedRevision: current.revision,
                attestedConditionIds: data.getAll("attested").map(String),
                revokedConditionIds: data.getAll("revoked").map(String),
                evidenceNote: textValue(data, "evidenceNote"),
              },
              "Acceptance evidence checked. Read the recorded outcome and timeliness.",
            ).then(() => {})
          }
        >
          <p>
            Accept only the conditions you can verify. Automated conditions are
            refetched from their exact agreed sources.
          </p>
          {active.acceptance.map((c) => (
            <label className="check-line" key={c.id}>
              <input
                type="checkbox"
                name="attested"
                value={c.id}
                disabled={c.designatedVerifierAccountId !== workspace.principal}
              />
              <span>
                {c.description}
                <small>
                  Designated verifier: {person(c.designatedVerifierAccountId)}
                </small>
              </span>
            </label>
          ))}
          {active.acceptance
            .filter(
              (c) => c.designatedVerifierAccountId === workspace.principal,
            )
            .map((c) => (
              <label className="check-line" key={`revoke-${c.id}`}>
                <input type="checkbox" name="revoked" value={c.id} />
                <span>Revoke earlier acceptance: {c.description}</span>
              </label>
            ))}
          <FormField name="evidenceNote" label="Evidence for your acceptance">
            <textarea
              id="evidenceNote"
              name="evidenceNote"
              maxLength={4000}
              placeholder="Describe the qualifying evidence you checked."
            />
          </FormField>
          <p className="footnote">
            A release does not by itself establish adoption. Late outcomes
            remain late against the original promise.
          </p>
        </CommandForm>
      )}
      {(form === "planning" ||
        form === "artifact" ||
        form === "requirement" ||
        form === "role" ||
        form === "gate") &&
        workspace.projectState && (
          <MappingForm
            type={form}
            workspace={workspace}
            onClose={() => setForm(null)}
            command={command}
          />
        )}
    </div>
  );
}

function MappingForm({
  type,
  workspace,
  onClose,
  command,
}: {
  type: "planning" | "artifact" | "requirement" | "role" | "gate";
  workspace: Workspace;
  onClose: () => void;
  command: (
    name: CommandName,
    input: unknown,
    message?: string,
  ) => Promise<unknown>;
}) {
  const state = workspace.projectState!,
    projectId = workspace.project!.id;
  const titles = {
    planning: "Add planning context",
    artifact: "Map an existing Confluence page",
    requirement: "Confirm a requirement mapping",
    role: "Confirm a scoped role",
    gate: "Prepare release readiness",
  };
  const owner = (
    <FormField name="mappingOwner" label="Accountable person">
      <select
        id="mappingOwner"
        name="mappingOwner"
        defaultValue={workspace.principal}
      >
        {workspace.people.map((p) => (
          <option key={p.accountId} value={p.accountId}>
            {personLabel(p, workspace.principal)}
          </option>
        ))}
      </select>
    </FormField>
  );
  return (
    <CommandForm
      title={titles[type]}
      onClose={onClose}
      button="Confirm mapping"
      onSubmit={async (data) => {
        const base = { projectId, expectedRevision: state.revision };
        if (type === "planning")
          await command(
            "planning.create",
            {
              ...base,
              kind: textValue(data, "kind"),
              title: textValue(data, "mappingTitle"),
              ownerAccountId: textValue(data, "mappingOwner"),
            },
            "Explicit planning context added. Native hierarchy is unchanged.",
          );
        if (type === "artifact")
          await command(
            "lifecycle.mapArtifact",
            {
              ...base,
              pageId: textValue(data, "pageId"),
              expectedSourceRevision: textValue(data, "sourceRevision"),
              artifactRole: textValue(data, "artifactRole"),
              phase: textValue(data, "mappedPhase"),
              ownerAccountId: textValue(data, "mappingOwner"),
            },
            "Existing page mapped against its current source revision.",
          );
        if (type === "requirement")
          await command(
            "requirement.linkWork",
            {
              ...base,
              ...(textValue(data, "requirementId")
                ? { requirementId: textValue(data, "requirementId") }
                : {}),
              artifactId: textValue(data, "artifactId"),
              expectedSourceRevision: textValue(data, "sourceRevision"),
              sectionReference: textValue(data, "anchor"),
              description: textValue(data, "mappingTitle"),
              workIds: data.getAll("mappedWork").map(String),
              acceptanceConditionIds: [],
            },
            "Requirement mapping confirmed for the exact source revision.",
          );
        if (type === "role")
          await command(
            "roles.bind",
            {
              ...base,
              accountId: textValue(data, "mappingOwner"),
              role: textValue(data, "role"),
              scopeType: "PROJECT",
              scopeId: projectId,
            },
            "Explicit project role recorded.",
          );
        if (type === "gate")
          await command(
            "lifecycle.createGate",
            {
              ...base,
              ...(textValue(data, "existingGate")
                ? { gateId: textValue(data, "existingGate") }
                : {}),
              title: textValue(data, "mappingTitle"),
              artifactIds: data.getAll("artifact").map(String),
              requirementIds: data.getAll("requirement").map(String),
              reviewerBindingIds: data.getAll("binding").map(String),
              conditions: [
                {
                  id: "release-version",
                  version: 1,
                  description: "The agreed Jira release version is released.",
                  predicate: "QUALIFYING_RELEASE",
                  required: true,
                  sourceIds: [textValue(data, "releaseId")],
                },
              ],
            },
            "Versioned release-readiness gate prepared.",
          );
      }}
    >
      {(type === "planning" || type === "requirement" || type === "gate") && (
        <FormField
          name="mappingTitle"
          label={type === "requirement" ? "Requirement description" : "Title"}
        >
          <input
            id="mappingTitle"
            name="mappingTitle"
            maxLength={240}
            required
          />
        </FormField>
      )}
      {type === "planning" && (
        <>
          <FormField name="kind" label="Planning kind">
            <select id="kind" name="kind">
              <option value="OBJECTIVE">Product objective</option>
              <option value="INITIATIVE">Initiative</option>
              <option value="PRODUCT">Product</option>
              <option value="PROGRAM">Program planning context</option>
            </select>
          </FormField>
          {owner}
          <p className="callout">
            This creates a Promisory planning record. It does not add a native
            Jira hierarchy level.
          </p>
        </>
      )}
      {type === "artifact" && (
        <>
          <FormField name="pageId" label="Confluence page ID">
            <input
              id="pageId"
              name="pageId"
              inputMode="numeric"
              pattern="[0-9]+"
              required
            />
          </FormField>
          <FormField name="sourceRevision" label="Current page revision">
            <input
              id="sourceRevision"
              name="sourceRevision"
              inputMode="numeric"
              required
            />
          </FormField>
          <FormField name="artifactRole" label="Artifact role">
            <select id="artifactRole" name="artifactRole">
              {[
                "STRATEGY",
                "RESEARCH",
                "INITIATIVE_CHARTER",
                "PRD",
                "DESIGN_DECISION",
                "DELIVERY_PLAN",
                "READINESS",
                "LAUNCH",
                "RUNBOOK",
                "OUTCOME_REVIEW",
                "RETROSPECTIVE",
                "RETIREMENT_PLAN",
              ].map((r) => (
                <option value={r} key={r}>
                  {r.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </FormField>
          <FormField name="mappedPhase" label="Lifecycle phase">
            <select id="mappedPhase" name="mappedPhase">
              {phases.map((p) => (
                <option key={p} value={p}>
                  {phaseLabels[p]}
                </option>
              ))}
            </select>
          </FormField>
          {owner}
        </>
      )}
      {type === "requirement" && (
        <>
          <FormField
            name="requirementId"
            label="Requirement to remap (optional)"
          >
            <select id="requirementId" name="requirementId">
              <option value="">Create a new stable reference</option>
              {state.value.requirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id}
                </option>
              ))}
            </select>
          </FormField>
          <FormField name="artifactId" label="Source artifact">
            <select id="artifactId" name="artifactId">
              {state.value.artifacts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </FormField>
          <FormField name="sourceRevision" label="Current source revision">
            <input id="sourceRevision" name="sourceRevision" required />
          </FormField>
          <FormField
            name="anchor"
            label="Unique section reference"
            hint="The exact anchor must occur once in the source storage representation."
          >
            <input id="anchor" name="anchor" required />
          </FormField>
          <fieldset>
            <legend>Confirmed work links</legend>
            {workspace.work.work.map((w) => (
              <label className="check-line" key={w.id}>
                <input type="checkbox" name="mappedWork" value={w.id} />
                {w.displayKey} · {w.title}
              </label>
            ))}
          </fieldset>
        </>
      )}
      {type === "role" && (
        <>
          {owner}
          <FormField name="role" label="Scoped role">
            <select id="role" name="role">
              <option value="APPROVER">Designated approver</option>
              <option value="VERIFIER">Outcome verifier</option>
              <option value="RELEASE_OWNER">Release owner</option>
              <option value="CONTRIBUTOR">Contributor</option>
              <option value="OBSERVER">Observer</option>
            </select>
          </FormField>
          <p>
            A current project administrator confirms this binding. A title does
            not confer authority.
          </p>
        </>
      )}
      {type === "gate" && (
        <>
          <FormField name="existingGate" label="Gate version">
            <select id="existingGate" name="existingGate">
              <option value="">Create a new gate</option>
              {state.value.gates.map((g) => (
                <option key={g.id} value={g.id}>
                  Revise {g.title} (currently v{g.version})
                </option>
              ))}
            </select>
          </FormField>
          <fieldset>
            <legend>Required artifacts</legend>
            {state.value.artifacts.map((a) => (
              <label className="check-line" key={a.id}>
                <input type="checkbox" name="artifact" value={a.id} />
                {a.title}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Required mappings</legend>
            {state.value.requirements.map((r) => (
              <label className="check-line" key={r.id}>
                <input type="checkbox" name="requirement" value={r.id} />
                {r.id} · {r.description}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Designated reviewer bindings</legend>
            {state.value.bindings
              .filter((b) => ["APPROVER", "RELEASE_OWNER"].includes(b.role))
              .map((b) => (
                <label className="check-line" key={b.id}>
                  <input type="checkbox" name="binding" value={b.id} />
                  {
                    workspace.people.find((p) => p.accountId === b.accountId)
                      ?.displayName
                  }{" "}
                  · {b.role}
                </label>
              ))}
          </fieldset>
          <FormField name="releaseId" label="Jira release version ID">
            <input
              name="releaseId"
              id="releaseId"
              inputMode="numeric"
              pattern="[0-9]+"
              required
            />
          </FormField>
          <p>
            Gate acceptance evaluates this release condition and exact source
            versions. It cannot grant execution authority.
          </p>
        </>
      )}
    </CommandForm>
  );
}
