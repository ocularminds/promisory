import api, { getAppContext, assumeTrustedRoute } from "@forge/api";
import { z } from "zod";
import { trustedContextSchema } from "@promisory/contracts";
import { ensure, PromisoryService, Repository } from "@promisory/domain";
import {
  AtlassianSources,
  type UserTransport,
} from "@promisory/integrations-atlassian";
import { ForgeSqlStore } from "./storage";
import { configuredExecutor } from "./remote";
import { reportFailure } from "./diagnostics";

export function trustedInvocation(context: unknown) {
  const invocation = z
    .object({
      accountId: z.string().optional(),
      principal: z.object({ accountId: z.string() }).optional(),
      cloudId: z.string().optional(),
    })
    .parse(context);
  const runtime = getAppContext();
  const clouds = [
    ...new Set(
      runtime.installation?.contexts.map((c) => c.cloudId).filter(Boolean) ??
        [],
    ),
  ];
  const cloudId =
    invocation.cloudId ?? (clouds.length === 1 ? clouds[0] : undefined);
  ensure(
    cloudId && (!clouds.length || clouds.includes(cloudId)),
    "INVALID_CONTEXT",
    "A trusted, installation-bound cloud context is required.",
  );
  return trustedContextSchema.parse({
    appId: runtime.appAri.toString(),
    environmentId: runtime.environmentAri.toString(),
    installationId: runtime.installationAri.toString(),
    cloudId,
    principalAccountId: invocation.accountId ?? invocation.principal?.accountId,
  });
}
const allowedJira =
  /^\/rest\/api\/3\/(?:myself|mypermissions|project(?:\/search|\/\d+)?|issuetype\/project|user(?:\/assignable\/search)?|issue\/\d+|version\/\d+|search\/jql)(?:\?[^#]*)?$/;
const allowedConfluence =
  /^\/wiki\/api\/v2\/(?:pages\/\d+|spaces)(?:\?[^#]*)?$/;
function currentUserTransport(): UserTransport {
  return {
    jira: async (path, options = {}) => {
      ensure(
        allowedJira.test(path),
        "UNSUPPORTED_PATH",
        "The Jira endpoint is outside the source adapter allowlist.",
      );
      ensure(
        !options.method ||
          options.method === "GET" ||
          path === "/rest/api/3/search/jql",
        "UNSUPPORTED_METHOD",
        "Source adapters only read.",
      );
      return api.asUser().requestJira(assumeTrustedRoute(path), {
        method: options.method ?? "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        ...(options.body ? { body: options.body } : {}),
      });
    },
    confluence: async (path) => {
      ensure(
        allowedConfluence.test(path),
        "UNSUPPORTED_PATH",
        "The Confluence endpoint is outside the source adapter allowlist.",
      );
      return api.asUser().requestConfluence(assumeTrustedRoute(path));
    },
    graph: async (query, variables) => {
      try {
        const response = await api
          .asUser()
          .requestTeamworkGraph(query, variables);
        if (!response.ok)
          console.warn(
            JSON.stringify({
              event: "PROMISORY_GRAPH_HTTP_FAILURE",
              status: response.status,
            }),
          );
        return response;
      } catch (error) {
        reportFailure("teamwork-graph.request", error);
        throw error;
      }
    },
  };
}
export async function serviceFor(
  context: unknown,
  channel: "UI" | "ROVO" = "UI",
) {
  const ctx = trustedInvocation(context);
  const runtime = getAppContext();
  // Licensing affects app writes only. Source Jira data is never modified or removed on expiry.
  const service = new PromisoryService(
    ctx,
    new Repository(new ForgeSqlStore(), ctx),
    new AtlassianSources(ctx, currentUserTransport()),
    await configuredExecutor(),
    { mode: "LIVE", channel },
  );
  const profile = process.env.PROMISORY_LICENSED_PROFILE;
  return {
    service,
    licenseActive:
      runtime.environmentType !== "PRODUCTION" ||
      (profile === "true" && runtime.license?.active === true) ||
      (profile === "false" && runtime.license === undefined),
  };
}
