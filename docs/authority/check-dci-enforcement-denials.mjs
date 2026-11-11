// Run inside the approved executor image. All inputs are synthetic; there is
// no Jira client and no allowed-effect case. No grant is claimed or persisted.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ActionRegistry,
  DecionisGate,
  DecionisGrantVerifier,
  IntentCapture,
  SafeExecutor,
} from "@decionis/agent-safe-pipeline";

const policyId = "457e04a4-0a1d-4f18-8bca-7a9a5df2adc8";
if (
  process.env.PROMISORY_AUTHORITY_POLICY_ID !== policyId ||
  process.env.PROMISORY_AUTHORITY_URL !== "https://api.decionis.com" ||
  process.env.PROMISORY_ORGANIZATION_ID !==
    "124e5022-6eee-4717-ab65-a03899db6237"
)
  throw new Error("Expected approved test binding is absent.");

const results = [];
for (const name of [
  "different-date",
  "different-principal",
  "missing-evidence",
]) {
  const proposal = {
    action: "jira.issue.set_due_date",
    target: "jira:e207942a-9edf-4952-b945-2ed6ed3707a7:10001",
    parameters: {
      policy_id: policyId,
      cloudId: "e207942a-9edf-4952-b945-2ed6ed3707a7",
      issueId: "10001",
      expectedUpdatedAt: "2026-11-10T00:00:00.000Z",
      expectedDueDate: "2026-11-12",
      desiredDueDate: name === "different-date" ? "2026-11-19" : "2026-11-18",
      operationId: `synthetic-enforcement-denial-${randomUUID()}`,
    },
  };
  const context = {
    tenantId: process.env.PROMISORY_ORGANIZATION_ID,
    actor: {
      id:
        name === "different-principal"
          ? "557058:f1b32d40-94e4-4606-93b1-0d6eb3f5c340"
          : "712020:2921f941-93f4-4ccb-9c03-2555a8bfe3d9",
      type: "atlassian_user",
      runtime: "promisory-forge",
    },
    downstreamTarget: {
      system: "jira",
      operation: "set_due_date",
      environment: process.env.PROMISORY_ENVIRONMENT_ID,
    },
    context: {
      installation_id: process.env.PROMISORY_INSTALLATION_ID,
      ...(name === "missing-evidence"
        ? {}
        : { proposal_hash: `sha256:${"0".repeat(64)}` }),
      synthetic_policy_probe: true,
    },
    idempotencyKey: `synthetic-enforcement-denial-${randomUUID()}`,
  };
  let wire = {};
  const authority = new DecionisGate({
    baseUrl: "https://api.decionis.com",
    apiKey: () => process.env.PROMISORY_AUTHORITY_API_KEY,
    mode: "ENFORCEMENT",
    timeoutMs: 10000,
    fetch: async (url, init) => {
      if (
        new URL(url).origin !== "https://api.decionis.com" ||
        JSON.parse(String(init?.body)).mode !== "ENFORCEMENT"
      )
        throw new Error("Unexpected authority destination or mode.");
      const response = await fetch(url, { ...init, redirect: "error" });
      const body = await response.clone().json();
      wire = {
        httpStatus: response.status,
        policyVersion: body.policy_version,
        tokenPresent: Boolean(body.execution_token),
        grantPresent: Boolean(body.execution_grant),
      };
      return response;
    },
  });
  const captured = new IntentCapture({ ttlSeconds: 60 }).capture(
    proposal,
    context,
  );
  const decision = await authority.evaluate(captured);
  const expected = name === "missing-evidence" ? "ESCALATE" : "BLOCK";
  let canaryDispatches = 0;
  let verifierRequests = 0;
  let executionOutcome = "NOT_RUN";
  if (decision.verdict === expected && !decision.authorization) {
    const registry = new ActionRegistry()
      .register("jira.issue.set_due_date", {
        parametersSchema: z.record(z.string(), z.unknown()),
        execute: async () => {
          canaryDispatches++;
          return { synthetic: true };
        },
      })
      .seal();
    const verifier = new DecionisGrantVerifier({
      baseUrl: "https://api.decionis.com",
      apiKey: () => process.env.PROMISORY_AUTHORITY_API_KEY,
      timeoutMs: 4000,
      fetch: async () => {
        verifierRequests++;
        throw new Error("A denied decision must not request a grant or claim.");
      },
    });
    const execution = await new SafeExecutor(registry, verifier).run(
      captured,
      decision,
    );
    executionOutcome = execution.outcome;
  }
  const passed =
    decision.verdict === expected &&
    wire.httpStatus === 200 &&
    wire.policyVersion === "promisory-test-v3" &&
    !wire.tokenPresent &&
    !wire.grantPresent &&
    !decision.authorization &&
    canaryDispatches === 0 &&
    verifierRequests === 0 &&
    executionOutcome === "BLOCKED";
  results.push({
    name,
    expected,
    verdict: decision.verdict,
    wire,
    executionOutcome,
    canaryDispatches,
    verifierRequests,
    authorizationPresent: Boolean(decision.authorization),
    decisionId: decision.decisionId,
    dossierId: decision.dossierId,
    reasonCodes: decision.reasonCodes,
    passed,
  });
  if (!passed) break;
}
const report = {
  schemaVersion: "promisory.enforcement-denials.v1",
  recordedAt: new Date().toISOString(),
  mode: "LIVE_AUTHORITY_ENFORCEMENT_WITH_SYNTHETIC_INPUTS",
  policyId,
  sourceSnapshot: "EXPLICITLY_SYNTHETIC_NOT_READ_FROM_JIRA",
  downstream: "INERT_CANARY_NO_JIRA_CLIENT",
  noGrantClaimAttempted: results.every(
    (result) => result.verifierRequests === 0,
  ),
  noJiraReadOrWrite: true,
  authenticatedForgeInvocationVerified: false,
  results,
  passed: results.length === 3 && results.every((result) => result.passed),
};
console.log(JSON.stringify(report));
if (!report.passed) process.exitCode = 1;
