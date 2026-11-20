import { z } from "zod";

// Jira requires scheduling permission to edit duedate in addition to access
// to the issue and permission to edit it. Both adapters use the same contract.
export const jiraDueDatePermissionKeys = [
  "BROWSE_PROJECTS",
  "EDIT_ISSUES",
  "SCHEDULE_ISSUES",
] as const;

const permission = z.object({ havePermission: z.boolean() });
const dueDatePermissions = z.object({
  permissions: z.object({
    BROWSE_PROJECTS: permission,
    EDIT_ISSUES: permission,
    SCHEDULE_ISSUES: permission,
  }),
});

export function hasJiraDueDatePermissions(value: unknown): boolean {
  const parsed = dueDatePermissions.safeParse(value);
  return (
    parsed.success &&
    jiraDueDatePermissionKeys.every(
      (key) => parsed.data.permissions[key].havePermission === true,
    )
  );
}
