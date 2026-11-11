import { activeVersion, type Workspace } from "@promisory/domain";
import { Badge, DateDisplay, Empty, ErrorSummary } from "./components";
import type { Client } from "./client";

export function EmbeddedView({
  client,
  workspace,
  onExpand,
  onRefresh,
  onProject,
  error,
  loading,
}: {
  client: Client;
  workspace: Workspace;
  onExpand: () => void;
  onRefresh: () => void;
  onProject: (id: string) => void;
  error: string;
  loading: boolean;
}) {
  const surface = client.surface!;
  const work = workspace.work.work.find(
    (w) => w.externalId === surface.issueId,
  );
  const artifacts =
    workspace.projectState?.value.artifacts.filter(
      (a) => a.pageId === surface.pageId,
    ) ?? [];
  const requirements =
    workspace.projectState?.value.requirements.filter((r) =>
      artifacts.some((a) => a.id === r.artifactId),
    ) ?? [];
  const gates =
    workspace.projectState?.value.gates.filter((g) =>
      g.requiredArtifactIds.some((id) => artifacts.some((a) => a.id === id)),
    ) ?? [];
  const assessments = workspace.assessments.filter((a) =>
    surface.kind === "ISSUE"
      ? a.paths.some((p) => p.nodeIds.includes(work?.id ?? ""))
      : workspace.commitments.some((record) => {
          const c = activeVersion(record.value);
          return (
            c?.id === a.commitmentId &&
            (c.requirementIds.some((id) =>
              requirements.some((r) => r.id === id),
            ) ||
              c.requiredGateIds.some((id) => gates.some((g) => g.id === id)))
          );
        }),
  );
  return (
    <main className="embedded-view" aria-busy={loading}>
      <div className="section-heading">
        <img src="./promisory-logo.svg" alt="Promisory" width="140" />
        <button onClick={onExpand}>Open workspace</button>
      </div>
      {client.mode === "EXAMPLE" && (
        <p className="callout">
          <b>Example data</b> · This is a local preview of the embedded view.
        </p>
      )}
      {error && <ErrorSummary message={error} />}
      <h1>
        {surface.kind === "ISSUE"
          ? "Commitment impact"
          : "Commitments & lifecycle"}
      </h1>
      <div className="button-row">
        <label>
          Project{" "}
          <select
            value={workspace.project?.id ?? ""}
            onChange={(e) => onProject(e.target.value)}
          >
            {workspace.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button onClick={onRefresh} disabled={loading}>
          Refresh evidence
        </button>
      </div>
      {surface.kind === "ISSUE" ? (
        <p>
          {work
            ? `${work.displayKey} · ${work.nativeTypeName} · ${work.title}`
            : "This issue is unavailable or outside the configured scope."}
        </p>
      ) : (
        <p>
          {artifacts.length
            ? artifacts
                .map((a) => `${a.title} · revision ${a.source.sourceRevision}`)
                .join(", ")
            : "This page has no permitted artifact mapping in the selected project."}
        </p>
      )}
      {assessments.length ? (
        assessments.map((a) => {
          const record = workspace.commitments.find(
              (c) => c.value.id === a.commitmentId,
            )!,
            c = activeVersion(record.value)!;
          return (
            <article className="card" key={c.id}>
              <div className="section-heading">
                <h2>{c.title}</h2>
                <Badge state={a.health} />
              </div>
              <p>
                {workspace.people.find(
                  (p) => p.accountId === c.accountableOwnerAccountId,
                )?.displayName ?? "Owner unavailable"}{" "}
                · <DateDisplay instant={c.agreedDueAt} zone={c.timeZone} />
              </p>
              {a.reasons.map((r) => (
                <p key={r.code}>{r.explanation}</p>
              ))}
              <p className="muted">
                {
                  a.paths.filter(
                    (p) =>
                      surface.kind !== "ISSUE" ||
                      p.nodeIds.includes(work?.id ?? ""),
                  ).length
                }{" "}
                confirmed paths · Coverage {a.coverage.toLowerCase()}
              </p>
            </article>
          );
        })
      ) : (
        <Empty title="No visible linked commitments">
          Only current permitted mappings appear here. Map sources or review the
          selected project in the workspace.
        </Empty>
      )}
      {requirements.map((r) => (
        <article className="card" key={r.id}>
          <div className="section-heading">
            <h2>{r.id}</h2>
            <Badge
              state={
                r.mappingState === "CONFIRMED" ? "CURRENT" : r.mappingState
              }
            />
          </div>
          <p>{r.description}</p>
          <p>
            Section {r.sectionReference} · mapping v{r.version} · source v
            {r.sourceRevision}
          </p>
        </article>
      ))}
      {gates.map((g) => {
        const assessment = workspace.gates.find((a) => a.gateId === g.id);
        return (
          <article className="card" key={g.id}>
            <h2>{g.title}</h2>
            <Badge state={assessment?.readiness ?? "UNKNOWN"} />
            <p>
              Readiness is separate from execution authority and outcome
              verification.
            </p>
          </article>
        );
      })}
    </main>
  );
}
