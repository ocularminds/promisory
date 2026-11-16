import {
  CHANGE_RETENTION_MS,
  SCHEMA_VERSION,
  type ChangeFeed,
  type ChangeSignal,
  type CommitmentVersion,
  type ImpactAssessment,
} from "@promisory/contracts";

/** Repeated deliveries for the same source inside this window update one signal. */
export const CHANGE_COALESCE_MS = 120_000;
const MAX_SIGNALS = 200;

/**
 * Append one observed change. Repeated events for the same source and kind
 * update the newest matching signal instead of adding notices for everyone.
 */
export function appendChange(
  feed: ChangeFeed | undefined,
  signal: ChangeSignal,
  now: string,
): ChangeFeed {
  const cutoff = Date.parse(now) - CHANGE_RETENTION_MS;
  const signals = (feed?.signals ?? []).filter(
    (s) => Date.parse(s.observedAt) >= cutoff,
  );
  const latest = signals.findLast(
    (s) =>
      s.source === signal.source &&
      s.sourceId === signal.sourceId &&
      s.kind === signal.kind,
  );
  if (
    latest &&
    Date.parse(signal.observedAt) - Date.parse(latest.observedAt) <
      CHANGE_COALESCE_MS
  ) {
    latest.fields = [...new Set([...latest.fields, ...signal.fields])].slice(
      0,
      20,
    );
    latest.relatedSourceIds = [
      ...new Set([...latest.relatedSourceIds, ...signal.relatedSourceIds]),
    ].slice(0, 2);
    latest.observedAt = signal.observedAt;
  } else signals.push(signal);
  signals.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  return {
    schemaVersion: SCHEMA_VERSION,
    signals: signals.slice(-MAX_SIGNALS),
  };
}

/**
 * Keep only changes whose every referenced source is visible to the reader.
 * A link between a visible and a restricted item is omitted entirely, so the
 * restricted item's identifier is not disclosed.
 */
export function visibleChanges(
  feed: ChangeFeed | undefined,
  visibleIssueIds: ReadonlySet<string>,
  visiblePageIds: ReadonlySet<string>,
): ChangeSignal[] {
  return (feed?.signals ?? []).filter((s) => {
    if (s.source === "CONFLUENCE_PAGE") return visiblePageIds.has(s.sourceId);
    if (s.source === "JIRA_ISSUE") return visibleIssueIds.has(s.sourceId);
    return (
      s.relatedSourceIds.length > 0 &&
      s.relatedSourceIds.every((id) => visibleIssueIds.has(id))
    );
  });
}

export interface ChangeImpact {
  signal: ChangeSignal;
  commitmentId: string;
  commitmentVersion: number;
  /** Why this change concerns the commitment. */
  relation: "SUPPORTING_WORK" | "DEPENDENCY_PATH" | "SOURCE_ARTIFACT";
}

/**
 * Join visible changes to the commitments they can affect. The newest change
 * per (commitment, source) is returned, so repeated edits update one item.
 */
export function changeImpacts(input: {
  changes: ChangeSignal[];
  commitments: CommitmentVersion[];
  assessments: ImpactAssessment[];
  cloudId: string;
  artifactPageIds: ReadonlyMap<string, string>;
}): ChangeImpact[] {
  const work = (issueId: string) => `jira:${input.cloudId}:${issueId}`;
  const newest = new Map<string, ChangeImpact>();
  for (const c of input.commitments) {
    const assessment = input.assessments.find(
      (a) => a.commitmentId === c.id && a.commitmentVersion === c.version,
    );
    const pathNodes = new Set(
      assessment?.paths.flatMap((p) => p.nodeIds) ?? [],
    );
    const pages = new Set(
      c.sourceBasis
        .filter((b) => b.entityKind === "ARTIFACT")
        .flatMap((b) => {
          const page = input.artifactPageIds.get(b.entityId);
          return page ? [page] : [];
        }),
    );
    for (const signal of input.changes) {
      const ids =
        signal.source === "JIRA_LINK"
          ? signal.relatedSourceIds
          : [signal.sourceId];
      let relation: ChangeImpact["relation"] | undefined;
      if (signal.source === "CONFLUENCE_PAGE") {
        if (pages.has(signal.sourceId)) relation = "SOURCE_ARTIFACT";
      } else if (ids.some((id) => c.supportingWorkIds.includes(work(id))))
        relation = "SUPPORTING_WORK";
      else if (ids.some((id) => pathNodes.has(work(id))))
        relation = "DEPENDENCY_PATH";
      if (!relation) continue;
      const key = `${c.id}\u0000${signal.source}\u0000${signal.sourceId}`;
      const prior = newest.get(key);
      if (!prior || prior.signal.observedAt < signal.observedAt)
        newest.set(key, {
          signal,
          commitmentId: c.id,
          commitmentVersion: c.version,
          relation,
        });
    }
  }
  return [...newest.values()].sort((a, b) =>
    b.signal.observedAt.localeCompare(a.signal.observedAt),
  );
}
