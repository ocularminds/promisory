import { Temporal } from "@js-temporal/polyfill";
import type {
  CommitmentVersion,
  Coverage,
  ImpactAssessment,
  ImpactPath,
  ImpactReason,
  WorkEdge,
  WorkNode,
} from "@promisory/contracts";

export const IMPACT_RULE_VERSION = "promisory.impact.v1";
export interface Traversal {
  paths: ImpactPath[];
  truncated: boolean;
  cycles: string[][];
}
/** Traverse only typed effect paths. Containment, roles, and suggested links cannot imply blocking. */
export function tracePaths(
  start: string,
  targets: Set<string>,
  edges: WorkEdge[],
  limits = { depth: 10, nodes: 500, paths: 100 },
): Traversal {
  const adjacency = new Map<string, WorkEdge[]>();
  const seenEdges = new Set<string>();
  for (const e of edges) {
    if (
      e.state !== "CONFIRMED" ||
      ![
        "BLOCKS",
        "IMPLEMENTS",
        "SUPPORTS",
        "DEFINES",
        "ALIGNS_TO",
        "PARENT_OF",
      ].includes(e.kind)
    )
      continue;
    // An affected descendant contributes to its actual ancestors. Keep the
    // stored Jira parent edge intact; reverse only its traversal direction.
    const traversed =
      e.kind === "PARENT_OF" ? { ...e, fromId: e.toId, toId: e.fromId } : e;
    const signature = `${traversed.fromId}|${e.kind}|${traversed.toId}`;
    if (seenEdges.has(signature)) continue;
    seenEdges.add(signature);
    adjacency.set(traversed.fromId, [
      ...(adjacency.get(traversed.fromId) ?? []),
      traversed,
    ]);
  }
  for (const list of adjacency.values())
    list.sort((a, b) => a.id.localeCompare(b.id));
  const paths: ImpactPath[] = [],
    cycles: string[][] = [];
  const visited = new Set<string>();
  const queue = [{ node: start, nodes: [start], edges: [] as string[] }];
  let truncated = false;
  while (queue.length) {
    const current = queue.shift()!;
    if (!visited.has(current.node) && visited.size >= limits.nodes) {
      truncated = true;
      break;
    }
    visited.add(current.node);
    if (targets.has(current.node)) {
      paths.push({
        id: `path-${paths.length + 1}`,
        nodeIds: current.nodes,
        edgeIds: current.edges,
      });
      if (paths.length >= limits.paths) {
        truncated = queue.length > 0;
        break;
      }
      continue;
    }
    const outgoing = adjacency.get(current.node) ?? [];
    if (current.edges.length >= limits.depth) {
      truncated ||= outgoing.length > 0;
      continue;
    }
    for (const edge of outgoing) {
      if (current.nodes.includes(edge.toId)) {
        cycles.push([...current.nodes, edge.toId]);
        continue;
      }
      if (queue.length >= limits.nodes * 2) {
        truncated = true;
        continue;
      }
      queue.push({
        node: edge.toId,
        nodes: [...current.nodes, edge.toId],
        edges: [...current.edges, edge.id],
      });
    }
  }
  return { paths, truncated, cycles };
}
export function validateNativeHierarchy(
  work: WorkNode[],
  edges: WorkEdge[],
): string[] {
  const byId = new Map(work.map((w) => [w.id, w]));
  const issues: string[] = [];
  for (const edge of edges.filter((e) => e.kind === "PARENT_OF")) {
    const parent = byId.get(edge.fromId),
      child = byId.get(edge.toId);
    if (
      !parent ||
      !child ||
      child.parentId !== parent.id ||
      parent.cloudId !== child.cloudId ||
      parent.hierarchyLevel <= child.hierarchyLevel
    )
      issues.push(edge.id);
  }
  return issues;
}
export function assessImpact(input: {
  commitment: CommitmentVersion;
  work: WorkNode[];
  edges: WorkEdge[];
  coverage: Coverage;
  now: string;
  staleAfterMs?: number;
  requirementDrift?: boolean;
  gateNotReady?: boolean;
  outcomeVerified?: boolean;
  ownerAvailable?: boolean;
  gateUnknown?: boolean;
}): ImpactAssessment {
  const { commitment: c, now } = input;
  const reasons: ImpactReason[] = [];
  const paths: ImpactPath[] = [];
  const cycles: string[][] = [];
  const currentTime = Date.parse(now);
  let coverage = input.coverage,
    traversalTruncated = false;
  const target = new Set([c.id]);
  const relevant = new Map<string, WorkNode>();
  const completeEdges = [...input.edges];
  for (const workId of c.supportingWorkIds)
    if (
      !completeEdges.some(
        (e) => e.fromId === workId && e.toId === c.id && e.kind === "SUPPORTS",
      )
    ) {
      const node = input.work.find((w) => w.id === workId);
      if (node)
        completeEdges.push({
          id: `supports-${node.externalId}-${c.id}`,
          fromId: node.id,
          toId: c.id,
          fromKind: "WORK",
          toKind: "COMMITMENT",
          kind: "SUPPORTS",
          state: "CONFIRMED",
          provenance: node.source,
        });
    }
  for (const work of input.work) {
    if (paths.length >= 500) {
      traversalTruncated = true;
      break;
    }
    const trace = tracePaths(work.id, target, completeEdges);
    traversalTruncated ||= trace.truncated;
    cycles.push(...trace.cycles);
    if (trace.paths.length) {
      relevant.set(work.id, work);
      const available = 500 - paths.length;
      traversalTruncated ||= trace.paths.length > available;
      paths.push(
        ...trace.paths.slice(0, available).map((path) => ({
          ...path,
          id: `path-${paths.length}-${work.externalId}-${path.id}`,
        })),
      );
    }
  }
  const add = (code: string, explanation: string, sources: string[] = []) =>
    reasons.push({
      code,
      explanation,
      evidenceSourceIds: sources,
      pathIds: paths
        .filter((p) => p.nodeIds.some((n) => sources.includes(n)))
        .map((p) => p.id),
    });
  const knownRisk = [...relevant.values()].filter(
    (w) =>
      !w.resolved &&
      completeEdges.some(
        (e) =>
          e.fromId === w.id &&
          e.kind === "BLOCKS" &&
          e.state === "CONFIRMED" &&
          paths.some((p) => p.edgeIds.includes(e.id)),
      ),
  );
  if (currentTime > Date.parse(c.agreedDueAt) && !input.outcomeVerified)
    add(
      "DEADLINE_PASSED",
      "The agreed deadline has passed and the required outcome is not verified.",
    );
  if (knownRisk.length)
    add(
      "BLOCKING_DEFECT",
      "An unresolved, confirmed blocker lies on the required delivery path.",
      knownRisk.map((w) => w.id),
    );
  const localDeadline = Temporal.Instant.from(c.agreedDueAt)
    .toZonedDateTimeISO(c.timeZone)
    .toPlainDate()
    .toString();
  const late = [...relevant.values()].filter(
    (w) => !w.resolved && w.targetDate && w.targetDate > localDeadline,
  );
  if (late.length)
    add(
      "DELIVERY_AFTER_PROMISE",
      "A linked target calendar date is after the promise in its agreed time zone.",
      late.map((w) => w.id),
    );
  if (!c.ownerAcceptedAt || input.ownerAvailable === false)
    add(
      "UNACCEPTED_OWNER",
      "The accountable owner needs to accept or regain access.",
    );
  const stale = [...relevant.values()].filter(
    (w) =>
      currentTime - Date.parse(w.source.checkedAt) >
        (input.staleAfterMs ?? 900_000) ||
      ["STALE", "UNAVAILABLE"].includes(w.source.verification),
  );
  if (stale.length) {
    coverage = "INCOMPLETE";
    add(
      "STALE_EVIDENCE",
      "Required evidence needs a current authorized refresh.",
      stale.map((w) => w.id),
    );
  }
  if (
    input.coverage !== "COMPLETE" ||
    c.supportingWorkIds.some((w) => !relevant.has(w)) ||
    traversalTruncated ||
    cycles.length
  ) {
    coverage = "INCOMPLETE";
    add(
      "INCOMPLETE_SCOPE",
      "Context is incomplete: a source, relationship, or traversal could not be fully checked.",
    );
  }
  if (input.requirementDrift)
    add(
      "REQUIREMENT_CHANGED",
      "A required source version or section mapping changed; review applicability again.",
    );
  if (input.gateNotReady)
    add("GATE_NOT_READY", "A required readiness condition explicitly fails.");
  if (input.gateUnknown) {
    coverage = "INCOMPLETE";
    add(
      "GATE_UNVERIFIED",
      "A required readiness gate does not yet have current qualifying evidence.",
    );
  }
  if (!input.outcomeVerified && !c.supportingWorkIds.length) {
    coverage = "INCOMPLETE";
    add(
      "OUTCOME_UNMEASURED",
      "No qualifying observation establishes the agreed outcome.",
    );
  }
  if (
    !input.outcomeVerified &&
    currentTime <= Date.parse(c.agreedDueAt) &&
    Date.parse(c.agreedDueAt) - currentTime <= 3 * 86_400_000 &&
    [...relevant.values()].some((w) => !w.resolved)
  )
    add(
      "DUE_SOON",
      "The deadline is within three days and required work remains incomplete.",
    );
  const codes = new Set(reasons.map((r) => r.code));
  const health = codes.has("DEADLINE_PASSED")
    ? "BREACHED"
    : [
          "BLOCKING_DEFECT",
          "DELIVERY_AFTER_PROMISE",
          "UNACCEPTED_OWNER",
          "GATE_NOT_READY",
        ].some((c) => codes.has(c))
      ? "AT_RISK"
      : ["DUE_SOON", "REQUIREMENT_CHANGED"].some((c) => codes.has(c))
        ? "WATCH"
        : coverage !== "COMPLETE"
          ? "UNKNOWN"
          : "ON_TRACK";
  return {
    commitmentId: c.id,
    commitmentVersion: c.version,
    ruleVersion: IMPACT_RULE_VERSION,
    assessedAt: now,
    health,
    coverage,
    reasons,
    paths,
    traversalTruncated,
    cycles,
  };
}
