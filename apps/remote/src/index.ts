import { z } from "zod";
import type { JWTVerifyGetKey } from "jose";
import { externalId, type JiraDueDateEffect } from "@promisory/contracts";
import { DomainError, ensure } from "@promisory/domain";
import {
  AgentSafeExecutor,
  connectionCheckRequestSchema,
  connectionCheckResultSchema,
  connectionFailureSchema,
  connectionFailureDetails,
  remoteEnvelopeSchema,
  type AuthorityBinding,
  type RemoteJira,
  type ClaimVault,
  type ExecutionJournal,
  type ConnectionFailure,
  type ConnectionCheckResult,
} from "@promisory/integrations-decionis";
import {
  authenticateEnvelope,
  verifyForgeInvocation,
  type InstallationBinding,
} from "./auth";
import { FileExecutionJournal } from "./journal";

const changelogPageSchema = z.object({
  isLast: z.boolean().optional(),
  values: z.array(z.unknown()).max(100),
});
const taggedHistorySchema = z.object({
  historyMetadata: z.object({
    extraData: z.object({ promisoryOperationId: z.string().max(200) }),
  }),
  items: z.array(z.unknown()).max(100),
});
const dueDateHistorySchema = z.object({
  fieldId: z.literal("duedate"),
  from: z.iso.date().nullable(),
  to: z.iso.date(),
});

export class InvocationJira implements RemoteJira {
  constructor(
    private apiBase: string,
    private userToken: string,
    private request: typeof fetch = fetch,
  ) {
    ensure(
      userToken.length > 0,
      "FRESH_USER_REQUIRED",
      "A fresh native user token is required.",
    );
  }
  private async send(path: string, options: RequestInit = {}) {
    return this.request(`${this.apiBase.replace(/\/$/, "")}${path}`, {
      ...options,
      redirect: "error",
      headers: {
        Authorization: `Bearer ${this.userToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: options.signal ?? AbortSignal.timeout(6000),
    });
  }
  async verifyCurrentUser(
    accountId: string,
    observeStatus?: (status: number) => void,
  ) {
    const response = await this.send("/rest/api/3/myself");
    observeStatus?.(response.status);
    ensure(
      response.ok,
      "FRESH_USER_REQUIRED",
      "Jira could not verify the current user connection.",
    );
    const user = z
      .object({ accountId: z.string(), active: z.boolean() })
      .parse(await response.json());
    ensure(
      user.active && user.accountId === accountId,
      "OAUTH_IDENTITY_MISMATCH",
      "The Jira token must belong to the active invocation user.",
    );
  }
  async read(issueId: string) {
    const r = await this.send(
      `/rest/api/3/issue/${externalId.parse(issueId)}?fields=updated,duedate`,
    );
    ensure(
      r.ok,
      "SOURCE_UNAVAILABLE",
      "Jira could not provide the current authorized state.",
    );
    const value = z
      .object({
        fields: z.object({
          updated: z.string(),
          duedate: z.string().nullable(),
        }),
      })
      .parse(await r.json());
    return {
      updatedAt: new Date(value.fields.updated).toISOString(),
      dueDate: value.fields.duedate,
    };
  }
  async canEdit(issueId: string) {
    const r = await this.send(
      `/rest/api/3/mypermissions?issueId=${externalId.parse(issueId)}&permissions=EDIT_ISSUES`,
    );
    if (!r.ok) return false;
    return z
      .object({
        permissions: z.object({
          EDIT_ISSUES: z.object({ havePermission: z.boolean() }),
        }),
      })
      .parse(await r.json()).permissions.EDIT_ISSUES.havePermission;
  }
  async setDueDate(
    effect: JiraDueDateEffect,
    operationId: string,
    timeoutMs: number,
  ) {
    const r = await this.send(
      `/rest/api/3/issue/${externalId.parse(effect.issueId)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          fields: { duedate: effect.desiredDueDate },
          historyMetadata: {
            type: "promisory",
            extraData: { promisoryOperationId: operationId },
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    return { status: r.status };
  }
  async receipt(effect: JiraDueDateEffect, operationId: string) {
    for (let startAt = 0; startAt < 500; startAt += 100) {
      const r = await this.send(
        `/rest/api/3/issue/${externalId.parse(effect.issueId)}/changelog?startAt=${startAt}&maxResults=100`,
      );
      if (!r.ok) return false;
      let payload: unknown;
      try {
        payload = await r.json();
      } catch {
        return false;
      }
      const parsed = changelogPageSchema.safeParse(payload);
      if (!parsed.success) return false;
      const page = parsed.data;
      if (
        page.values.some((value) => {
          const history = taggedHistorySchema.safeParse(value);
          if (
            !history.success ||
            history.data.historyMetadata.extraData.promisoryOperationId !==
              operationId
          )
            return false;
          // Jira's fromString/toString are presentation values. Only its
          // stable field ID and exact stored calendar dates prove this effect.
          return history.data.items.some((value) => {
            const item = dueDateHistorySchema.safeParse(value);
            return (
              item.success &&
              item.data.from === effect.expectedDueDate &&
              item.data.to === effect.desiredDueDate
            );
          });
        })
      )
        return true;
      if (page.isLast || page.values.length < 100) break;
    }
    return false;
  }
}
export function createRemoteHandler(
  binding: InstallationBinding,
  authority: AuthorityBinding,
  journal: ExecutionJournal,
  vault: ClaimVault,
  dependencies: {
    jwks?: JWTVerifyGetKey;
    request?: typeof fetch;
    connectionLog?: (
      event:
        | ConnectionFailure
        | (ConnectionCheckResult & {
            event: "PROMISORY_REMOTE_CONNECTION_CHECK";
          }),
    ) => void;
  } = {},
) {
  const executor = new AgentSafeExecutor(
    journal,
    authority,
    undefined,
    vault,
    (event) => console.info(JSON.stringify(event)),
  );
  const connectionLog =
    dependencies.connectionLog ??
    ((event) => console.info(JSON.stringify(event)));
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname;
    const checkingConnection = path === "/v1/connection/check";
    let stage: ConnectionFailure["stage"] = "REQUEST";
    let observedBinding: ConnectionFailure["binding"];
    let httpStatus: number | undefined;
    try {
      ensure(
        request.method === "POST",
        "METHOD_NOT_ALLOWED",
        "Use an authorized POST invocation.",
      );
      const auth = request.headers.get("authorization");
      ensure(
        auth && auth.startsWith("Bearer "),
        "INVALID_INVOCATION",
        "A Forge invocation token is required.",
      );
      const trusted = await verifyForgeInvocation(
        auth.slice(7),
        binding,
        dependencies.jwks,
        checkingConnection
          ? (value) => {
              stage = value.stage;
              if (value.binding) observedBinding = value.binding;
            }
          : undefined,
      );
      stage = "USER_TOKEN";
      const userToken = request.headers.get("x-forge-oauth-user");
      ensure(
        userToken,
        "FRESH_USER_REQUIRED",
        "Obtain a fresh active-user invocation.",
      );
      stage = "ENVELOPE";
      const bodyText = await request.text();
      ensure(
        new TextEncoder().encode(bodyText).length <= 16000,
        "BODY_TOO_LARGE",
        "The action envelope exceeds its limit.",
      );
      const body: unknown = JSON.parse(bodyText);
      const origin = authenticateEnvelope(
        body,
        request.headers.get("x-promisory-signature") ?? "",
        trusted.context,
        binding,
        {
          originHeader: request.headers.get("x-promisory-origin") ?? "",
          method: request.method,
          path,
          fitModuleKey: trusted.moduleKey,
          appVersion: trusted.appVersion,
        },
      );
      const jira = new InvocationJira(
        trusted.apiBaseUrl,
        userToken,
        dependencies.request,
      );
      if (checkingConnection) {
        stage = "CONNECTION_CONTRACT";
        const query = connectionCheckRequestSchema.parse(body);
        const remaining = Date.parse(query.expiresAt) - Date.now();
        ensure(
          remaining > 0 && remaining <= 65_000,
          "STALE_CONNECTION_CHECK",
          "Start a fresh connection check.",
        );
        stage = "JIRA_CURRENT_USER";
        await jira.verifyCurrentUser(
          trusted.context.principalAccountId,
          (status) => {
            httpStatus = status;
          },
        );
        const result = connectionCheckResultSchema.parse({
          schemaVersion: "promisory.remote-connection.v2",
          context: trusted.context,
          requestId: query.requestId,
          checkedAt: new Date().toISOString(),
          moduleKey: origin.moduleKey,
          fitModuleKey: trusted.moduleKey || null,
          moduleVerification: trusted.moduleKey
            ? "FIT_AND_HOSTED_CONTEXT"
            : "HOSTED_CONTEXT",
          appVersion: trusted.appVersion,
          currentUserVerified: true,
          readOnly: true,
          mode: authority.mode,
          enforcementVerificationHeld:
            !authority.independentlyVerifiedEnforcement,
          dataSharingEnabled:
            authority.dataPolicy.independentDueDateIntent &&
            authority.dataPolicy.jiraDueDateSnapshot,
        });
        connectionLog({
          event: "PROMISORY_REMOTE_CONNECTION_CHECK",
          ...result,
        });
        return Response.json(result);
      }
      if (path === "/v1/actions/apply") {
        const envelope = remoteEnvelopeSchema.parse(body);
        ensure(
          authority.dataPolicy.independentDueDateIntent &&
            authority.dataPolicy.jiraDueDateSnapshot,
          "DATA_SHARING_DISABLED",
          "The action data contract is not enabled.",
        );
        return Response.json(await executor.execute(envelope, jira));
      }
      ensure(
        path === "/v1/actions/reconcile",
        "NOT_FOUND",
        "This remote route is unavailable.",
      );
      const query = z
        .object({ context: z.unknown(), operationId: z.string() })
        .strict()
        .parse(body);
      return Response.json(
        await executor.reconcile(trusted.context, query.operationId, jira),
      );
    } catch (error) {
      if (checkingConnection)
        connectionLog(
          connectionFailureSchema.parse({
            event: "PROMISORY_REMOTE_CONNECTION_CHECK_FAILED",
            schemaVersion: "promisory.remote-connection-diagnostic.v1",
            recordedAt: new Date().toISOString(),
            origin: "EXECUTOR",
            stage,
            ...connectionFailureDetails(error),
            ...(observedBinding ? { binding: observedBinding } : {}),
            ...(httpStatus ? { httpStatus } : {}),
          }),
        );
      const code =
        error instanceof DomainError ? error.code : "INVALID_REQUEST";
      return Response.json(
        {
          error: code,
          message:
            "The invocation was not completed. Recheck its authenticated context, source, and configuration.",
        },
        { status: 400 },
      );
    }
  };
}
// Hosting is explicit: importing the adapter never opens a port or enables execution.
export { FileExecutionJournal } from "./journal";
export { verifyForgeInvocation } from "./auth";
