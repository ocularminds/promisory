import { z } from "zod";
import {
  commands,
  externalId,
  id,
  type CommandName,
} from "@promisory/contracts";
import type { Workspace } from "@promisory/domain";
import type { createExample } from "@promisory/test-fixtures";

export class ClientError extends Error {
  constructor(
    message: string,
    readonly fields: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
  }
}
export type ExampleSession = Awaited<ReturnType<typeof createExample>>;
export interface Client {
  mode: "LIVE" | "EXAMPLE";
  example?: ExampleSession;
  surface?: { kind: "ISSUE" | "PAGE"; issueId?: string; pageId?: string };
  projectId?: string;
  startInSettings?: boolean;
  openIssue?(key: string): Promise<void>;
  openPage?(pageId: string): Promise<void>;
  run<T = unknown>(command: CommandName, input: unknown): Promise<T>;
  actor?(accountId: string): void;
  askRovo?(prompt: string): Promise<void>;
}
export async function exampleClient(): Promise<Client> {
  const session = await (
    await import("@promisory/test-fixtures")
  ).createExample();
  let service = session.service;
  return {
    mode: "EXAMPLE",
    example: session,
    actor: (id) => {
      service = session.as(id);
    },
    run: async <T>(name: CommandName, input: unknown) =>
      (await service.run(name, input)) as T,
  };
}
export async function forgeClient(): Promise<Client> {
  const bridge = await import("@forge/bridge");
  const context = await bridge.view.getContext();
  const extension = z
    .object({
      project: z.object({ id: externalId }).optional(),
      issue: z.object({ id: externalId }).optional(),
      content: z.object({ id: externalId }).optional(),
    })
    .parse(context.extension);
  // These values select a presentation. The resolver independently verifies
  // every source and uses only its own trusted invocation identity.
  const surface =
    context.moduleKey === "promisory-impact-panel"
      ? { kind: "ISSUE" as const, issueId: extension.issue?.id }
      : context.moduleKey === "promisory-lifecycle"
        ? { kind: "PAGE" as const, pageId: extension.content?.id }
        : undefined;
  return {
    mode: "LIVE",
    surface,
    projectId: extension.project?.id,
    startInSettings: context.moduleKey === "promisory-settings",
    openIssue: async (key) => {
      await bridge.router.open({ target: "issue", issueKey: id.parse(key) });
    },
    openPage: async (pageId) => {
      await bridge.router.open({
        target: "contentView",
        contentId: externalId.parse(pageId),
      });
    },
    run: async <T>(name: CommandName, input: unknown) => {
      const response = await bridge.invoke<
        Record<string, unknown>,
        {
          ok: boolean;
          data?: T;
          error?: {
            message: string;
            fields?: Array<{ path: string; message: string }>;
          };
        }
      >(name, commands[name].parse(input));
      const result = "body" in response ? response.body : response;
      if (!result.ok)
        throw new ClientError(
          result.error?.message ?? "The action could not be completed.",
          result.error?.fields,
        );
      return result.data as T;
    },
    askRovo: async (prompt: string) => {
      if (!(await bridge.rovo.isEnabled()))
        throw new ClientError("Rovo is not enabled for this tenant.");
      await bridge.rovo.open({
        type: "forge",
        agentKey: "promisory-agent",
        agentName: "Promisory",
        prompt,
      });
    },
  };
}
export async function readWorkspace(
  client: Client,
  projectId?: string,
): Promise<Workspace> {
  return client.run<Workspace>(
    "workspace.read",
    projectId ? { projectId } : {},
  );
}
