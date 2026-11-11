import { z } from "zod";
import { id, externalId, SCHEMA_VERSION } from "@promisory/contracts";
import {
  activeVersion,
  bindingApplies,
  DomainError,
  ensure,
} from "@promisory/domain";
import { serviceFor } from "./context";
import { reportFailure } from "./diagnostics";

const selection = z
  .object({
    projectId: externalId,
    commitmentId: id.optional(),
    workId: id.optional(),
    requirementId: id.optional(),
  })
  .strict();
/** Forge's extensible envelope is not a command. Project only declared tool fields. */
function inputs(payload: unknown, fields: readonly string[]) {
  ensure(
    new TextEncoder().encode(JSON.stringify(payload)).length <= 16_000,
    "INPUT_LIMIT",
    "The tool input is too large.",
  );
  const value = z.record(z.string(), z.unknown()).parse(payload);
  ensure(
    ![
      "accountId",
      "principal",
      "principalAccountId",
      "organizationId",
      "cloudId",
      "installationId",
      "appId",
      "environmentId",
      "mode",
      "executionMode",
      "policyMode",
      "policyId",
      "approverRole",
      "roles",
      "url",
      "apiUrl",
      "destination",
      "headers",
      "recipients",
      "grant",
    ].some((field) => Object.hasOwn(value, field)),
    "INVALID_INPUT",
    "Identity, policy and execution controls cannot be supplied as tool inputs.",
  );
  // Context, context tokens and future platform metadata are neither inspected
  // nor forwarded. The resulting command is still parsed by its strict schema.
  return Object.fromEntries(
    fields
      .filter((field) => Object.hasOwn(value, field))
      .map((field) => [field, value[field]]),
  );
}
async function tool(
  payload: unknown,
  context: unknown,
  kind:
    | "context"
    | "impact"
    | "people"
    | "lifecycle"
    | "requirement"
    | "fulfillment"
    | "reviews",
) {
  let phase = "input";
  try {
    const input = selection.parse(
      inputs(payload, Object.keys(selection.shape)),
    );
    phase = "context";
    const { service } = await serviceFor(context, "ROVO");
    phase = "workspace";
    const workspace = await service.workspace(input.projectId);
    phase = "response";
    const permitted = workspace.commitments.filter(
      (c) => !input.commitmentId || c.value.id === input.commitmentId,
    );
    const commitments = permitted.slice(0, 25);
    if (permitted.length > commitments.length)
      workspace.unknowns.push(
        "The response is limited to 25 commitments. Select an exact commitment to continue.",
      );
    if (input.commitmentId)
      ensure(
        commitments.length === 1,
        "NOT_FOUND",
        "This commitment is unavailable with your access.",
      );
    const assessments = workspace.assessments
      .filter(
        (a) =>
          commitments.some((c) => c.value.id === a.commitmentId) &&
          (!input.workId ||
            a.paths.some((p) => p.nodeIds.includes(input.workId!))),
      )
      .map((a) => ({
        ...a,
        paths: a.paths.slice(0, 30),
        traversalTruncated: a.traversalTruncated || a.paths.length > 30,
      }));
    const requirements =
      workspace.projectState?.value.requirements.filter(
        (r) => !input.requirementId || r.id === input.requirementId,
      ) ?? [];
    if (input.requirementId)
      ensure(
        requirements.length === 1,
        "NOT_FOUND",
        "This requirement is unavailable with your access.",
      );
    const people = workspace.people.map((person) => ({
      ...person,
      displayNameAmbiguous:
        workspace.people.filter(
          (other) =>
            other.displayName.trim().toLowerCase() ===
            person.displayName.trim().toLowerCase(),
        ).length > 1,
    }));
    const result =
      kind === "impact"
        ? { assessments, graph: workspace.graph }
        : kind === "people"
          ? {
              people,
              bindings: workspace.projectState?.value.bindings.map(
                (binding) => ({
                  ...binding,
                  subject: people.find(
                    (person) => person.accountId === binding.accountId,
                  ) ?? {
                    accountId: binding.accountId,
                    displayName: null,
                    displayNameAmbiguous: true,
                  },
                }),
              ),
            }
          : kind === "requirement"
            ? requirements.map((r) => ({
                requirement: r,
                work: workspace.work.work.filter((w) =>
                  r.confirmedWorkIds.includes(w.id),
                ),
                affectedCommitments: commitments
                  .filter(
                    (c) =>
                      activeVersion(c.value)?.requirementIds.includes(r.id) ||
                      assessments.some(
                        (a) =>
                          a.commitmentId === c.value.id &&
                          a.paths.some((p) =>
                            p.nodeIds.some((id) =>
                              r.confirmedWorkIds.includes(id),
                            ),
                          ),
                      ),
                  )
                  .map((c) => ({
                    commitmentId: c.value.id,
                    revision: c.revision,
                    assessment: assessments.find(
                      (a) => a.commitmentId === c.value.id,
                    ),
                  })),
              }))
            : kind === "lifecycle"
              ? {
                  planning: workspace.projectState?.value.planning,
                  artifacts: workspace.projectState?.value.artifacts,
                  requirements,
                  gates: workspace.gates,
                }
              : kind === "fulfillment"
                ? commitments.map((c) => ({
                    commitmentId: c.value.id,
                    revision: c.revision,
                    acceptance: activeVersion(c.value)?.acceptance,
                    outcomes: c.value.outcomes.slice(-10),
                  }))
                : kind === "reviews"
                  ? commitments
                      .filter((c) =>
                        workspace.projectState?.value.bindings.some((b) =>
                          bindingApplies(
                            b,
                            service.ctx,
                            workspace.now,
                            [input.projectId, c.value.id],
                            ["APPROVER"],
                          ),
                        ),
                      )
                      .map((c) => ({
                        commitmentId: c.value.id,
                        revision: c.revision,
                        proposals: c.value.proposals
                          .filter(
                            (p) =>
                              p.createdByAccountId !== workspace.principal &&
                              !c.value.operations.some(
                                (o) => o.proposalId === p.id,
                              ),
                          )
                          .slice(-10),
                        reviews: c.value.reviews
                          .filter(
                            (r) => r.reviewerAccountId === workspace.principal,
                          )
                          .slice(-10),
                      }))
                  : commitments.map((c) => ({
                      commitmentId: c.value.id,
                      revision: c.revision,
                      agreementState: activeVersion(c.value)
                        ? "ACCEPTED"
                        : "DRAFT",
                      commitment: activeVersion(c.value) ?? c.value.draft,
                      assessment: assessments.find(
                        (a) => a.commitmentId === c.value.id,
                      ),
                    }));
    const references = [
      ...workspace.work.work.map((w) => w.source),
      ...workspace.graph.sources,
      ...(workspace.projectState?.value.artifacts.map((a) => a.source) ?? []),
    ];
    if (references.length > 100)
      workspace.unknowns.push(
        "Source references are limited to 100 entries; narrow the selection for more detail.",
      );
    return {
      schemaVersion: SCHEMA_VERSION,
      result,
      coverage:
        workspace.unknowns.length ||
        assessments.some(
          (a) => a.coverage !== "COMPLETE" || a.traversalTruncated,
        )
          ? "INCOMPLETE"
          : "COMPLETE",
      sourceReferences: references.slice(0, 100),
      unknowns: workspace.unknowns,
      nextActions: [
        {
          label: "Open the exact agreement and review its evidence",
          command: "workspace.read",
          targetId: input.projectId,
        },
      ],
    };
  } catch (error) {
    if (!(error instanceof DomainError))
      reportFailure(`rovo.${kind}.${phase}`, error);
    return {
      schemaVersion: SCHEMA_VERSION,
      result: null,
      coverage: "UNKNOWN",
      sourceReferences: [],
      unknowns: [
        error instanceof DomainError
          ? error.message
          : "The tool could not validate this input or retrieve authorized context.",
      ],
      nextActions: [],
    };
  }
}
export const getCommitmentContext = (payload: unknown, context: unknown) =>
  tool(payload, context, "context");
export const traceCommitmentImpact = (payload: unknown, context: unknown) =>
  tool(payload, context, "impact");
export const findResponsiblePeople = (payload: unknown, context: unknown) =>
  tool(payload, context, "people");
export const getLifecycleContext = (payload: unknown, context: unknown) =>
  tool(payload, context, "lifecycle");
export const traceRequirementImpact = (payload: unknown, context: unknown) =>
  tool(payload, context, "requirement");
export const explainGateReadiness = (payload: unknown, context: unknown) =>
  tool(payload, context, "lifecycle");
export const explainFulfillment = (payload: unknown, context: unknown) =>
  tool(payload, context, "fulfillment");
export const listMyReviews = (payload: unknown, context: unknown) =>
  tool(payload, context, "reviews");
export async function proposeCommitment(payload: unknown, context: unknown) {
  const input = z
    .strictObject({
      projectId: externalId,
      title: z.string().min(1).max(240),
      issueId: externalId,
    })
    .parse(inputs(payload, ["projectId", "title", "issueId"]));
  const { service, licenseActive } = await serviceFor(context, "ROVO");
  ensure(
    licenseActive,
    "LICENSE_REQUIRED",
    "A current entitlement is required.",
  );
  await service.sources.project(input.projectId);
  const work = await service.sources.work(input.issueId);
  ensure(
    work.projectId === input.projectId,
    "INVALID_SCOPE",
    "Select work within the project.",
  );
  const result = await service.run("commitment.createDraft", {
    title: input.title,
    projectIds: [input.projectId],
    supportingWorkIds: [work.id],
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    result,
    coverage: "INCOMPLETE",
    sourceReferences: [work.source],
    unknowns: [
      "The candidate has no accepted owner, exact deadline, beneficiary, or agreed acceptance conditions. Confirm these in the app.",
    ],
    nextActions: [],
  };
}
export async function draftRecoveryProposal(
  payload: unknown,
  context: unknown,
) {
  const input = z
    .strictObject({
      commitmentId: id,
      expectedRevision: z.number().int().positive(),
      issueId: externalId,
      desiredDueDate: z.string(),
    })
    .parse(
      inputs(payload, [
        "commitmentId",
        "expectedRevision",
        "issueId",
        "desiredDueDate",
      ]),
    );
  const { service, licenseActive } = await serviceFor(context, "ROVO");
  ensure(
    licenseActive,
    "LICENSE_REQUIRED",
    "A current entitlement is required.",
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    result: await service.run("proposal.prepare", {
      ...input,
      alternative: "REPAIR",
    }),
    coverage: "INCOMPLETE",
    sourceReferences: [],
    unknowns: [
      "This proposal stays inside Atlassian. Its fields may derive from graph context. External execution requires a separate user-authored intent, independent review, and Decionis authority.",
    ],
    nextActions: [],
  };
}
