/**
 * Live synthetic SHADOW cases for the reusable due-date policy.
 * SHADOW only: this script cannot request a grant, claim, or Jira write.
 */
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
    version: { type: "string" },
    output: { type: "string" },
  },
});
const selector = z.uuid().parse(values.revision);
const policyVersion = z.string().min(1).parse(values.version);
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

const CLOUD = "e207942a-9edf-4952-b945-2ed6ed3707a7";
const PRIMARY = "712020:2921f941-93f4-4ccb-9c03-2555a8bfe3d9";
const SECONDARY = "557058:f1b32d40-94e4-4606-93b1-0d6eb3f5c340";
const ENVIRONMENT =
  "ari:cloud:ecosystem::environment/6e0430ce-9c00-425a-80c2-97b5cec1e8ae/24550cf8-ab9d-4e6a-b46e-96df09cf2866";
const INSTALLATION =
  "ari:cloud:ecosystem::installation/283d450f-c6c4-43aa-85fc-aa9d05a085f8";

function sample(): { proposal: AgentProposal; trusted: TrustedIntentContext } {
  return {
    proposal: {
      action: "jira.issue.set_due_date",
      target: `jira:${CLOUD}:10001`,
      parameters: {
        policy_id: selector,
        cloudId: CLOUD,
        issueId: "10001",
        expectedUpdatedAt: "2026-11-16T00:00:00.000Z",
        expectedDueDate: "2026-11-19",
        desiredDueDate: "2026-11-25",
        operationId: `synthetic-policy-check-${randomUUID()}`,
      },
    },
    trusted: {
      tenantId: settings.DECIONIS_ORG_ID,
      actor: {
        id: PRIMARY,
        type: "atlassian_user",
        runtime: "promisory-forge",
      },
      downstreamTarget: {
        system: "jira",
        operation: "set_due_date",
        environment: ENVIRONMENT,
      },
      context: {
        installation_id: INSTALLATION,
        proposal_hash: `sha256:${"0".repeat(64)}`,
        synthetic_policy_probe: true,
      },
      idempotencyKey: `synthetic-policy-check-${randomUUID()}`,
    },
  };
}
type Sample = ReturnType<typeof sample>;
type Verdict = "ALLOW" | "BLOCK" | "ESCALATE";
const cases: {
  name: string;
  expected: Verdict[];
  mutate: (input: Sample) => void;
}[] = [
  {
    name: "primary-account-reviewed-change",
    expected: ["ALLOW"],
    mutate: () => {},
  },
  {
    name: "other-issue-same-site",
    expected: ["ALLOW"],
    mutate: ({ proposal }) => {
      proposal.target = `jira:${CLOUD}:10002`;
      proposal.parameters.issueId = "10002";
    },
  },
  {
    name: "secondary-account",
    expected: ["ALLOW"],
    mutate: ({ trusted }) => {
      trusted.actor.id = SECONDARY;
    },
  },
  {
    name: "different-dates-into-2027",
    expected: ["ALLOW"],
    mutate: ({ proposal }) => {
      proposal.parameters.expectedDueDate = "2026-12-01";
      proposal.parameters.desiredDueDate = "2027-01-10";
    },
  },
  {
    name: "legacy-hex-account-id",
    expected: ["ALLOW"],
    mutate: ({ trusted }) => {
      trusted.actor.id = "5b10a2844c20165700ede21f";
    },
  },
  {
    name: "different-cloud-parameter",
    expected: ["BLOCK"],
    mutate: ({ proposal }) => {
      proposal.parameters.cloudId = "e207942a-9edf-4952-b945-2ed6ed3707a8";
    },
  },
  {
    name: "different-cloud-resource",
    expected: ["BLOCK"],
    mutate: ({ proposal }) => {
      proposal.target = "jira:e207942a-9edf-4952-b945-2ed6ed3707a8:10001";
    },
  },
  {
    name: "non-numeric-issue",
    expected: ["BLOCK"],
    mutate: ({ proposal }) => {
      proposal.parameters.issueId = "10001-other";
    },
  },
  {
    name: "malformed-desired-date",
    expected: ["BLOCK"],
    mutate: ({ proposal }) => {
      proposal.parameters.desiredDueDate = "2026-13-01";
    },
  },
  {
    name: "desired-date-outside-window",
    expected: ["BLOCK"],
    mutate: ({ proposal }) => {
      proposal.parameters.desiredDueDate = "2028-01-10";
    },
  },
  {
    name: "unset-existing-due-date",
    expected: ["BLOCK", "ESCALATE"],
    mutate: ({ proposal }) => {
      proposal.parameters.expectedDueDate = null;
    },
  },
  {
    name: "non-account-actor-id",
    expected: ["BLOCK"],
    mutate: ({ trusted }) => {
      trusted.actor.id = "system-event";
    },
  },
  {
    name: "different-action",
    expected: ["BLOCK"],
    mutate: ({ proposal }) => {
      proposal.action = "jira.comment.create";
    },
  },
  {
    name: "different-actor-type",
    expected: ["BLOCK"],
    mutate: ({ trusted }) => {
      trusted.actor.type = "service";
    },
  },
  {
    name: "different-runtime",
    expected: ["BLOCK"],
    mutate: ({ trusted }) => {
      trusted.actor.runtime = "other-runtime";
    },
  },
  {
    name: "different-system",
    expected: ["BLOCK"],
    mutate: ({ trusted }) => {
      trusted.downstreamTarget.system = "confluence";
    },
  },
  {
    name: "different-operation",
    expected: ["BLOCK"],
    mutate: ({ trusted }) => {
      trusted.downstreamTarget.operation = "delete_issue";
    },
  },
  {
    name: "different-environment",
    expected: ["BLOCK"],
    mutate: ({ trusted }) => {
      trusted.downstreamTarget.environment += "-other";
    },
  },
  {
    name: "different-installation",
    expected: ["BLOCK"],
    mutate: ({ trusted }) => {
      trusted.context.installation_id = `${INSTALLATION.slice(0, -1)}9`;
    },
  },
  {
    name: "missing-source-version",
    expected: ["ESCALATE"],
    mutate: ({ proposal }) => {
      delete proposal.parameters.expectedUpdatedAt;
    },
  },
  {
    name: "missing-operation-id",
    expected: ["ESCALATE"],
    mutate: ({ proposal }) => {
      delete proposal.parameters.operationId;
    },
  },
  {
    name: "missing-proposal-hash",
    expected: ["ESCALATE"],
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
for (const testCase of cases) {
  const input = sample();
  testCase.mutate(input);
  let wire: Record<string, unknown> = {};
  const authority = new DecionisGate({
    baseUrl: settings.DECIONIS_API_BASE,
    apiKey: settings.DECIONIS_ENFORCE_API_KEY,
    mode: "SHADOW",
    timeoutMs: 10000,
    fetch: async (url, init) => {
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
  const passed =
    testCase.expected.includes(decision.verdict as Verdict) &&
    wire.httpStatus === 200 &&
    wire.policyVersion === policyVersion &&
    !decision.authorization &&
    wire.tokenPresent === false &&
    wire.grantPresent === false;
  results.push({
    case: testCase.name,
    expected: testCase.expected,
    verdict: decision.verdict,
    passed,
    failClosed: decision.failClosed,
    authorizationPresent: Boolean(decision.authorization),
    decisionId: decision.decisionId,
    dossierId: decision.dossierId,
    reasonCodes: decision.reasonCodes,
    wire,
  });
  console.log(
    JSON.stringify({ case: testCase.name, verdict: decision.verdict, passed }),
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
      policyVersion,
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
