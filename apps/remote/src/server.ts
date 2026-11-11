import { createServer } from "node:http";
import { isAbsolute, join } from "node:path";
import { z } from "zod";
import {
  authorityPolicyIdSchema,
  executorModuleKeys,
  effectObserverIdSchema,
} from "@promisory/integrations-decionis";
import { createRemoteHandler, FileExecutionJournal } from "./index";
import { EncryptedFileClaimVault } from "./vault";

// One explicitly bound installation per process. This entry never discovers
// organizations or credentials from an invocation, browser input, or model.
const settings = z
  .object({
    PROMISORY_APP_ID: z.string().startsWith("ari:cloud:ecosystem::app/"),
    PROMISORY_ENVIRONMENT_ID: z.string().min(1),
    PROMISORY_INSTALLATION_ID: z.string().min(1),
    PROMISORY_CLOUD_ID: z.uuid(),
    PROMISORY_ORGANIZATION_ID: z.uuid(),
    PROMISORY_AUTHORITY_POLICY_ID: authorityPolicyIdSchema,
    PROMISORY_AUTHORITY_URL: z
      .url()
      .refine((value) => new URL(value).protocol === "https:"),
    PROMISORY_AUTHORITY_API_KEY: z.string().min(1),
    PROMISORY_EFFECT_OBSERVER_ID: effectObserverIdSchema,
    PROMISORY_REMOTE_SIGNING_KEY: z.string().min(32),
    PROMISORY_CLAIM_ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/i),
    PROMISORY_STATE_DIRECTORY: z.string().refine(isAbsolute),
    PROMISORY_ENFORCEMENT_VERIFIED: z.enum(["true", "false"]).default("false"),
    PROMISORY_SHARE_DUE_DATE_INTENT: z.enum(["true", "false"]).default("false"),
    PROMISORY_SHARE_JIRA_DATE_SNAPSHOT: z
      .enum(["true", "false"])
      .default("false"),
    PROMISORY_MODE: z.enum(["SHADOW", "ENFORCEMENT"]).default("SHADOW"),
    PROMISORY_PORT: z.coerce.number().int().min(1024).max(65535).default(8787),
    PROMISORY_LISTEN_HOST: z
      .enum(["127.0.0.1", "0.0.0.0"])
      .default("127.0.0.1"),
  })
  .safeParse(process.env);
if (!settings.success) {
  process.stderr.write(
    `Remote configuration incomplete: ${settings.error.issues.map((i) => i.path.join(".")).join(", ")}\n`,
  );
  process.exit(1);
}
const env = settings.data;
const handler = createRemoteHandler(
  {
    appId: env.PROMISORY_APP_ID,
    environmentId: env.PROMISORY_ENVIRONMENT_ID,
    installationId: env.PROMISORY_INSTALLATION_ID,
    cloudId: env.PROMISORY_CLOUD_ID,
    moduleKeys: [...executorModuleKeys],
    signingKey: () => env.PROMISORY_REMOTE_SIGNING_KEY,
    enabled: true,
  },
  {
    organizationId: env.PROMISORY_ORGANIZATION_ID,
    policyId: env.PROMISORY_AUTHORITY_POLICY_ID,
    authorityUrl: env.PROMISORY_AUTHORITY_URL,
    apiKey: () => env.PROMISORY_AUTHORITY_API_KEY,
    effectObserverId: env.PROMISORY_EFFECT_OBSERVER_ID,
    mode: env.PROMISORY_MODE,
    independentlyVerifiedEnforcement:
      env.PROMISORY_ENFORCEMENT_VERIFIED === "true",
    dataPolicy: {
      independentDueDateIntent: env.PROMISORY_SHARE_DUE_DATE_INTENT === "true",
      jiraDueDateSnapshot: env.PROMISORY_SHARE_JIRA_DATE_SNAPSHOT === "true",
    },
  },
  new FileExecutionJournal(join(env.PROMISORY_STATE_DIRECTORY, "operations")),
  new EncryptedFileClaimVault(
    join(env.PROMISORY_STATE_DIRECTORY, "claims"),
    env.PROMISORY_CLAIM_ENCRYPTION_KEY,
  ),
);
const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/healthz") {
      res
        .writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        })
        .end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (
      req.method !== "POST" ||
      ![
        "/v1/actions/apply",
        "/v1/actions/reconcile",
        "/v1/connection/check",
      ].includes(req.url ?? "")
    ) {
      res.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 16000) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (typeof value === "string") headers.set(key, value);
    const result = await handler(
      new Request(`http://127.0.0.1:${env.PROMISORY_PORT}${req.url}`, {
        method: "POST",
        headers,
        body: Buffer.concat(chunks),
      }),
    );
    res.writeHead(result.status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(await result.text());
  } catch {
    res
      .writeHead(503, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "REMOTE_UNAVAILABLE" }));
  }
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.listen(env.PROMISORY_PORT, env.PROMISORY_LISTEN_HOST, () =>
  process.stdout.write(
    `Promisory remote listening on ${env.PROMISORY_LISTEN_HOST}:${env.PROMISORY_PORT}; mode ${env.PROMISORY_MODE}.\n`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => server.close());
