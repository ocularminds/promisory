const input = (title: string, type = "string", required = true) => ({
  title,
  type,
  required,
  description: title,
});
const readInputs = {
  projectId: input("Stable numeric Jira project ID"),
  commitmentId: input("Promisory commitment ID", "string", false),
  workId: input("Stable work ID from a previous tool result", "string", false),
  requirementId: input("Mapped requirement ID", "string", false),
};
const tools = [
  [
    "get-context",
    "getCommitmentContext",
    "Get the current authorized agreement and diagnostic evidence.",
  ],
  [
    "trace-impact",
    "traceCommitmentImpact",
    "Trace confirmed work dependencies to commitments using the shared impact engine.",
  ],
  [
    "responsible-people",
    "findResponsiblePeople",
    "Read confirmed scoped owners and role bindings, never inferred reporting lines.",
  ],
  [
    "lifecycle-context",
    "getLifecycleContext",
    "Read permitted initiative, lifecycle artifacts, requirements, and readiness.",
  ],
  [
    "requirement-impact",
    "traceRequirementImpact",
    "Read exact requirement versions and their confirmed work links.",
  ],
  [
    "gate-readiness",
    "explainGateReadiness",
    "Explain readiness and source drift. This does not approve a gate.",
  ],
  [
    "fulfillment",
    "explainFulfillment",
    "Read versioned acceptance conditions and verified or unknown outcomes.",
  ],
  [
    "my-reviews",
    "listMyReviews",
    "Read the current user’s permitted review context.",
  ],
] as const;
export function makeManifest(
  appId: string,
  licensed = false,
  remoteUrl?: string,
) {
  const actions: Record<string, unknown>[] = tools.map(
    ([key, , description]) => ({
      key: `promisory-${key}`,
      name: key.replaceAll("-", " "),
      function: `rovo-${key}`,
      actionVerb: "GET",
      description,
      inputs: readInputs,
    }),
  );
  actions.push({
    key: "promisory-propose",
    function: "rovo-propose",
    actionVerb: "CREATE",
    name: "Propose a commitment",
    description:
      "Only on explicit user intent, save an unconfirmed candidate from accessible Jira work. No external effect.",
    inputs: {
      projectId: input("Stable Jira project ID"),
      issueId: input("Stable Jira issue ID"),
      title: input("Candidate commitment title"),
    },
  });
  actions.push({
    key: "promisory-recovery",
    function: "rovo-recovery",
    actionVerb: "CREATE",
    name: "Draft a recovery proposal",
    description:
      "Only on explicit user intent, prepare an exact internal due-date proposal. Does not approve or execute.",
    inputs: {
      commitmentId: input("Commitment ID"),
      expectedRevision: input("Current aggregate revision", "integer"),
      issueId: input("Stable Jira issue ID"),
      desiredDueDate: input("Desired Jira calendar date YYYY-MM-DD"),
    },
  });
  return {
    modules: {
      "jira:globalPage": [
        {
          key: "promisory-workspace",
          resource: "workspace",
          resolver: { function: "promisory-resolver" },
          title: "Promisory",
          icon: "resource:brand;promisory-icon.svg",
        },
      ],
      "jira:projectPage": [
        {
          key: "promisory-project",
          resource: "workspace",
          resolver: { function: "promisory-resolver" },
          title: "Promisory",
          icon: "resource:brand;promisory-icon.svg",
        },
      ],
      "jira:issuePanel": [
        {
          key: "promisory-impact-panel",
          resource: "workspace",
          resolver: { function: "promisory-resolver" },
          title: "Commitment impact",
          icon: "resource:brand;promisory-icon.svg",
        },
      ],
      "jira:adminPage": [
        {
          key: "promisory-settings",
          resource: "workspace",
          resolver: { function: "promisory-resolver" },
          title: "Promisory connections",
        },
      ],
      macro: [
        {
          key: "promisory-lifecycle",
          resource: "workspace",
          resolver: { function: "promisory-resolver" },
          title: "Promisory commitments",
          description:
            "Permission-aware commitment, requirement, and readiness context for this page.",
          layout: "block",
        },
      ],
      "rovo:agent": [
        {
          key: "promisory-agent",
          name: "Promisory",
          description:
            "Connect commitments to work, responsible people, and verifiable outcomes.",
          icon: "resource:brand;promisory-icon.svg",
          prompt: "resource:agent;prompt.txt",
          conversationStarters: [
            "What threatens our project commitments?",
            "Which requirements does this bug affect?",
            "What evidence is missing for release readiness?",
          ],
          actions: actions.map((a) => a.key),
        },
      ],
      action: actions,
      sql: [{ key: "promisory-db", engine: "mysql" }],
      trigger: [
        {
          key: "promisory-installed",
          function: "installation",
          events: ["avi:forge:installed:app", "avi:forge:upgraded:app"],
        },
        {
          key: "promisory-work-events",
          function: "source-changed",
          events: [
            "avi:jira:created:issue",
            "avi:jira:updated:issue",
            "avi:jira:deleted:issue",
            "avi:confluence:updated:page",
          ],
        },
      ],
      scheduledTrigger: [
        {
          key: "promisory-reconcile",
          function: "reconciliation",
          interval: "hour",
        },
      ],
      function: [
        { key: "promisory-resolver", handler: "index.handler" },
        { key: "installation", handler: "events.installed" },
        { key: "source-changed", handler: "events.sourceChanged" },
        { key: "reconciliation", handler: "events.reconcileSchedule" },
        ...tools.map(([key, handler]) => ({
          key: `rovo-${key}`,
          handler: `rovo.${handler}`,
        })),
        { key: "rovo-propose", handler: "rovo.proposeCommitment" },
        { key: "rovo-recovery", handler: "rovo.draftRecoveryProposal" },
      ],
    },
    resources: [
      { key: "workspace", path: "static/workspace/dist" },
      { key: "brand", path: "resources/brand" },
      { key: "agent", path: "resources/agent" },
    ],
    permissions: {
      scopes: [
        "read:jira-work",
        "read:jira-user",
        "write:jira-work",
        "read:page:confluence",
        "read:space:confluence",
        "read:confluence-content.summary",
        "storage:app",
        "read:graph:issue:jira",
        "read:graph:user:atlassian",
        ...(remoteUrl ? ["read:app-user-token"] : []),
      ],
      content: { styles: ["unsafe-inline"] },
    },
    ...(remoteUrl
      ? {
          remotes: [
            {
              key: "promisory-executor",
              baseUrl: remoteUrl,
              operations: ["compute", "storage"],
              storage: { inScopeEUD: true },
              auth: { appUserToken: { enabled: true } },
            },
          ],
        }
      : {}),
    app: {
      id: appId,
      runtime: { name: "nodejs22.x", architecture: "arm64", memoryMB: 256 },
      compatibility: {
        jira: { required: true },
        confluence: { required: false },
      },
      licensing: { enabled: licensed },
      description: "Keep every commitment connected.",
    },
  };
}
