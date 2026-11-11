import Resolver from "@forge/resolver";
import { z } from "zod";
import { commands, type CommandName } from "@promisory/contracts";
import { DomainError, ensure } from "@promisory/domain";
import { serviceFor } from "./context";
import { reportFailure } from "./diagnostics";

const resolver = new Resolver();
const readCommands = new Set<CommandName>([
  "workspace.read",
  "connections.check",
  "people.find",
  "impact.trace",
  "evidence.refresh",
  "inbox.read",
  "lifecycle.assessReadiness",
]);
for (const name of Object.keys(commands) as CommandName[])
  resolver.define(name, async ({ payload, context }) => {
    try {
      const { service, licenseActive } = await serviceFor(context);
      ensure(
        licenseActive || readCommands.has(name),
        "LICENSE_REQUIRED",
        "The app entitlement is inactive. You can read existing records; renew before changing app records.",
      );
      return { ok: true, data: await service.run(name, payload) };
    } catch (error) {
      if (error instanceof z.ZodError)
        return {
          ok: false,
          error: {
            code: "INVALID_INPUT",
            message: "Check the highlighted fields.",
            fields: error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
        };
      if (error instanceof DomainError)
        return {
          ok: false,
          error: { code: error.code, message: error.message },
        };
      // Raw API responses, headers, source bodies, and credentials never enter logs or error payloads.
      reportFailure(name, error);
      return {
        ok: false,
        error: {
          code: "UNAVAILABLE",
          message:
            "This operation is unavailable. Your change has not been confirmed. Refresh connections and try again.",
        },
      };
    }
  });
export const handler = resolver.getDefinitions();
