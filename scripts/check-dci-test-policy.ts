/** Live synthetic policy checks. SHADOW only; this script cannot claim or write. */
import { loadEnvFile } from "node:process";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  DecionisGate,
  IntentCapture,
  type AgentProposal,
  type TrustedIntentContext,
} from "@decionis/agent-safe-pipeline";

const { values } = parseArgs({
  options: {
    revision: { type: "string" },
    unavailable: { type: "boolean", default: false },
    recovery: { type: "boolean", default: false },
    output: { type: "string" },
  },
});
const selector = values.recovery
  ? z
      .literal("436f37a4-311f-4dd5-aa07-5a197ed277ed")
      .parse(values.revision ?? "436f37a4-311f-4dd5-aa07-5a197ed277ed")
  : values.revision
    ? z.uuid().parse(values.revision)
    : "promisory-test-jira-due-date";
const profile = values.recovery
  ? {
      expectedDueDate: "2026-11-18",
      desiredDueDate: "2026-11-19",
      otherDueDate: "2026-11-20",
      otherExistingDate: "2026-11-17",
      policyVersion: "promisory-recovery-test-v1",
    }
  : {
      expectedDueDate: "2026-11-12",
      desiredDueDate: "2026-11-18",
      otherDueDate: "2026-11-19",
      otherExistingDate: "2026-11-13",
      policyVersion: "promisory-test-v3",
    };
const output = z
  .string()
  .regex(/^docs\/evidence\/[a-z0-9-]+\/[a-z0-9-]+\.json$/)
  .parse(values.output);
loadEnvFile(".env");
const settings = z
  .object({
    DECIONIS_API_BASE: z.literal("https://api.decionis.com"),
    DECIONIS_ORG_ID: z.literal("124e5022-6eee-4717-ab65-a03899db6237"),
    DECIONIS_ENFORCE_API_KEY: z.string().min(1),
  })
  .parse(process.env);

// Independently fixed from the user's approved business effect, not generated
// from the policy's conditions (which are the subject of these tests).
function sample(): { proposal: AgentProposal; trusted: TrustedIntentContext } {
  return {
    proposal: {
      action: "jira.issue.set_due_date",
      target: "jira:e207942a-9edf-4952-b945-2ed6ed3707a7:10001",
      parameters: {
        policy_id: selector,
        cloudId: "e207942a-9edf-4952-b945-2ed6ed3707a7",
        issueId: "10001",
        expectedUpdatedAt: "2026-11-10T00:00:00.000Z",
        expectedDueDate: profile.expectedDueDate,
        desiredDueDate: profile.desiredDueDate,
        operationId: `synthetic-policy-check-${randomUUID()}`,
      },
    },
    trusted: {
      tenantId: settings.DECIONIS_ORG_ID,
      actor: {
        id: "712020:2921f941-93f4-4ccb-9c03-2555a8bfe3d9",
        type: "atlassian_user",
        runtime: "promisory-forge",
      },
      downstreamTarget: {
        system: "jira",
        operation: "set_due_date",
        environment:
          "ari:cloud:ecosystem::environment/6e0430ce-9c00-425a-80c2-97b5cec1e8ae/24550cf8-ab9d-4e6a-b46e-96df09cf2866",
      },
      context: {
        installation_id:
          "ari:cloud:ecosystem::installation/283d450f-c6c4-43aa-85fc-aa9d05a085f8",
        proposal_hash: `sha256:${"0".repeat(64)}`,
        synthetic_policy_probe: true,
      },
      idempotencyKey: `synthetic-policy-check-${randomUUID()}`,
    },
  };
}
type Sample = ReturnType<typeof sample>;
const cases: { name: string; mutate: (input: Sample) => void }[] = [
  { name: "approved-effect", mutate: () => {} },
  {
    name: "different-date-same-year",
    mutate: ({ proposal }) => {
      proposal.parameters.desiredDueDate = profile.otherDueDate;
    },
  },
  {
    name: "different-existing-date",
    mutate: ({ proposal }) => {
      proposal.parameters.expectedDueDate = profile.otherExistingDate;
    },
  },
  {
    name: "different-issue-same-numeric-prefix",
    mutate: ({ proposal }) => {
      proposal.parameters.issueId = "10001-other";
    },
  },
  {
    name: "different-principal-same-numeric-prefix",
    mutate: ({ trusted }) => {
      trusted.actor.id = "712020:2921f941-93f4-4ccb-9c03-2555a8bfe3d8";
    },
  },
  {
    name: "secondary-test-account",
    mutate: ({ trusted }) => {
      trusted.actor.id = "557058:f1b32d40-94e4-4606-93b1-0d6eb3f5c340";
    },
  },
  {
    name: "different-action",
    mutate: ({ proposal }) => {
      proposal.action = "jira.comment.create";
    },
  },
  {
    name: "different-resource",
    mutate: ({ proposal }) => {
      proposal.target = "jira:e207942a-9edf-4952-b945-2ed6ed3707a7:10002";
    },
  },
  {
    name: "different-cloud",
    mutate: ({ proposal }) => {
      proposal.parameters.cloudId = "e207942a-9edf-4952-b945-2ed6ed3707a8";
    },
  },
  {
    name: "different-actor-type",
    mutate: ({ trusted }) => {
      trusted.actor.type = "service";
    },
  },
  {
    name: "different-runtime",
    mutate: ({ trusted }) => {
      trusted.actor.runtime = "other-runtime";
    },
  },
  {
    name: "different-system",
    mutate: ({ trusted }) => {
      trusted.downstreamTarget.system = "confluence";
    },
  },
  {
    name: "different-operation",
    mutate: ({ trusted }) => {
      trusted.downstreamTarget.operation = "delete_issue";
    },
  },
  {
    name: "different-environment",
    mutate: ({ trusted }) => {
      trusted.downstreamTarget.environment += "-other";
    },
  },
  {
    name: "different-installation",
    mutate: ({ trusted }) => {
      trusted.context.installation_id =
        "ari:cloud:ecosystem::installation/283d450f-c6c4-43aa-85fc-aa9d05a085f9";
    },
  },
  {
    name: "missing-source-version",
    mutate: ({ proposal }) => {
      delete proposal.parameters.expectedUpdatedAt;
    },
  },
  {
    name: "missing-operation-id",
    mutate: ({ proposal }) => {
      delete proposal.parameters.operationId;
    },
  },
  {
    name: "missing-proposal-hash",
    mutate: ({ trusted }) => {
      delete trusted.context.proposal_hash;
    },
  },
];
const wireSchema = z.object({
  status: z.string().optional(),
  policy_version: z.string().nullish(),
  execution_token: z.unknown().optional(),
  execution_grant: z.unknown().optional(),
});
const results = [];
for (const [index, testCase] of cases.entries()) {
  if (values.unavailable && index > 0) break;
  const input = sample();
  testCase.mutate(input);
  let wire: Record<string, unknown> = {};
  const authority = new DecionisGate({
    baseUrl: settings.DECIONIS_API_BASE,
    apiKey: settings.DECIONIS_ENFORCE_API_KEY,
    mode: "SHADOW",
    timeoutMs: 10000,
    fetch: async (url, init) => {
      // Prevent an accidental future edit from making this a grant request.
      const body = JSON.parse(String(init?.body));
      if (body.mode !== "SHADOW") throw new Error("SHADOW_ONLY_CHECK");
      const response = await fetch(url, { ...init, redirect: "error" });
      const parsed = wireSchema.safeParse(await response.clone().json());
      wire = {
        httpStatus: response.status,
        status: parsed.success ? parsed.data.status : null,
        policyVersion: parsed.success ? parsed.data.policy_version : null,
        tokenPresent: parsed.success && Boolean(parsed.data.execution_token),
        grantPresent: parsed.success && Boolean(parsed.data.execution_grant),
      };
      return response;
    },
  });
  const captured = new IntentCapture({ ttlSeconds: 60 }).capture(
    input.proposal,
    input.trusted,
  );
  const decision = await authority.evaluate(captured);
  const expected = values.unavailable
    ? "BLOCK"
    : index === 0
      ? "ALLOW"
      : testCase.name.startsWith("missing-")
        ? "ESCALATE"
        : "BLOCK";
  const policyAnswered = values.unavailable
    ? wire.httpStatus === 503 &&
      decision.reasonCodes.includes("AUTHORITY_POLICY_ID_MISMATCH")
    : wire.httpStatus === 200 && wire.policyVersion === profile.policyVersion;
  const passed =
    decision.verdict === expected &&
    policyAnswered &&
    !decision.authorization &&
    wire.tokenPresent === false &&
    wire.grantPresent === false;
  const result = {
    case: testCase.name,
    expected,
    verdict: decision.verdict,
    passed,
    failClosed: decision.failClosed,
    authorizationPresent: Boolean(decision.authorization),
    decisionId: decision.decisionId,
    dossierId: decision.dossierId,
    reasonCodes: decision.reasonCodes,
    wire,
  };
  results.push(result);
  console.log(
    JSON.stringify({ case: result.case, verdict: result.verdict, passed }),
  );
}
const passed = results.every((result) => result.passed);
await writeFile(
  output,
  `${JSON.stringify(
    {
      schemaVersion: "promisory.policy-check.v1",
      mode: "LIVE_AUTHORITY_SYNTHETIC_SHADOW_POLICY_CASES",
      observedAt: new Date().toISOString(),
      organizationId: settings.DECIONIS_ORG_ID,
      policySelector: selector,
      policyVersion: profile.policyVersion,
      testEffect: {
        expectedDueDate: profile.expectedDueDate,
        desiredDueDate: profile.desiredDueDate,
      },
      requestedMode: "SHADOW",
      sourceSnapshot: "EXPLICITLY_SYNTHETIC_NOT_READ_FROM_JIRA",
      noJiraReadOrWrite: true,
      noGrantClaimAttempted: true,
      passed,
      results,
    },
    null,
    2,
  )}\n`,
  { flag: "wx" },
);
if (!passed) process.exitCode = 1;
