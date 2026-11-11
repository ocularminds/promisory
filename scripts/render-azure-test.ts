import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { z } from "zod";

const targetSchema = z.strictObject({
  schemaVersion: z.literal("promisory.azure-test.v1"),
  subscriptionId: z.literal("e7b998b6-a628-4548-a9d6-f54cf98a0464"),
  resourceGroup: z.literal("decionis-rg"),
  cluster: z.literal("decionis-aks"),
  namespace: z.literal("decionis"),
  registry: z.literal("decionisacr.azurecr.io"),
  publicHost: z.literal("promisory-test.decionis.com"),
  ingressAddress: z.literal("52.143.254.111"),
  ingressClass: z.literal("decionis-nginx"),
  ingressNamespace: z.literal("app-routing-system"),
  ingressPodApp: z.literal("nginx-decionis-0"),
  clusterIssuer: z.literal("letsencrypt-prod"),
  storageClass: z.literal("decionis-zrs"),
  storageSize: z.literal("4Gi"),
  policyRevision: z.literal("457e04a4-0a1d-4f18-8bca-7a9a5df2adc8"),
  effectObserverApiKeyId: z.literal("c97a5168-1325-487c-94e8-e3d4b06adffd"),
});
const { values } = parseArgs({
  options: {
    image: { type: "string" },
    "review-only": { type: "boolean", default: false },
  },
});
const reviewOnly = values["review-only"];
if (!reviewOnly && !values.image)
  throw new Error("A verified image digest is required.");
if (reviewOnly && values.image)
  throw new Error("Review-only rendering must not claim a verified image.");
const image = reviewOnly
  ? "decionisacr.azurecr.io/promisory/executor:unbuilt-review-only"
  : z
      .string()
      .regex(
        /^decionisacr\.azurecr\.io\/promisory\/executor@sha256:[a-f0-9]{64}$/,
      )
      .parse(values.image);
const target = targetSchema.parse(
  JSON.parse(await readFile("infra/azure/test-target.json", "utf8")),
);
const name = "promisory-test-executor";
const labels = {
  "app.kubernetes.io/name": name,
  "app.kubernetes.io/part-of": "promisory",
};
const annotations = {
  "promisory.decionis.com/review-only": String(reviewOnly),
};
const metadata = (resourceName: string) => ({
  name: resourceName,
  namespace: target.namespace,
  labels,
  annotations,
});
const runtime = {
  PROMISORY_APP_ID:
    "ari:cloud:ecosystem::app/6e0430ce-9c00-425a-80c2-97b5cec1e8ae",
  PROMISORY_ENVIRONMENT_ID:
    "ari:cloud:ecosystem::environment/6e0430ce-9c00-425a-80c2-97b5cec1e8ae/24550cf8-ab9d-4e6a-b46e-96df09cf2866",
  PROMISORY_INSTALLATION_ID:
    "ari:cloud:ecosystem::installation/283d450f-c6c4-43aa-85fc-aa9d05a085f8",
  PROMISORY_CLOUD_ID: "e207942a-9edf-4952-b945-2ed6ed3707a7",
  PROMISORY_ORGANIZATION_ID: "124e5022-6eee-4717-ab65-a03899db6237",
  PROMISORY_AUTHORITY_POLICY_ID: target.policyRevision,
  PROMISORY_AUTHORITY_URL: "https://api.decionis.com",
  PROMISORY_EFFECT_OBSERVER_ID: target.effectObserverApiKeyId,
  PROMISORY_STATE_DIRECTORY: "/var/lib/promisory",
  PROMISORY_MODE: "SHADOW",
  PROMISORY_ENFORCEMENT_VERIFIED: "false",
  PROMISORY_SHARE_DUE_DATE_INTENT: "false",
  PROMISORY_SHARE_JIRA_DATE_SNAPSHOT: "false",
  PROMISORY_LISTEN_HOST: "0.0.0.0",
  PROMISORY_PORT: "8787",
};
const networkPolicy = {
  apiVersion: "networking.k8s.io/v1",
  kind: "NetworkPolicy",
  metadata: metadata(name),
  spec: {
    podSelector: { matchLabels: labels },
    policyTypes: ["Ingress", "Egress"],
    ingress: [
      {
        from: [
          {
            namespaceSelector: {
              matchLabels: {
                "kubernetes.io/metadata.name": target.ingressNamespace,
              },
            },
            podSelector: { matchLabels: { app: target.ingressPodApp } },
          },
        ],
        ports: [{ protocol: "TCP", port: 8787 }],
      },
    ],
    egress: [
      {
        to: [
          {
            namespaceSelector: {
              matchLabels: { "kubernetes.io/metadata.name": "kube-system" },
            },
            podSelector: { matchLabels: { "k8s-app": "kube-dns" } },
          },
        ],
        ports: [
          { protocol: "UDP", port: 53 },
          { protocol: "TCP", port: 53 },
        ],
      },
      {
        // The API's public load-balancer address is translated to these
        // ingress pods inside AKS; a public ipBlock alone cannot admit it.
        to: [
          {
            namespaceSelector: {
              matchLabels: {
                "kubernetes.io/metadata.name": target.ingressNamespace,
              },
            },
            podSelector: { matchLabels: { app: target.ingressPodApp } },
          },
        ],
        ports: [{ protocol: "TCP", port: 443 }],
      },
      {
        to: [
          {
            ipBlock: {
              cidr: "0.0.0.0/0",
              except: [
                "0.0.0.0/8",
                "10.0.0.0/8",
                "100.64.0.0/10",
                "127.0.0.0/8",
                "168.63.129.16/32",
                "169.254.0.0/16",
                "172.16.0.0/12",
                "192.0.0.0/24",
                "192.168.0.0/16",
                "198.18.0.0/15",
                "224.0.0.0/4",
                "240.0.0.0/4",
              ],
            },
          },
        ],
        ports: [{ protocol: "TCP", port: 443 }],
      },
    ],
  },
};
const items = [
  {
    apiVersion: "v1",
    kind: "ServiceAccount",
    metadata: metadata(name),
    automountServiceAccountToken: false,
  },
  {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: metadata(name),
    data: runtime,
  },
  {
    apiVersion: "v1",
    kind: "PersistentVolumeClaim",
    metadata: metadata("promisory-test-state"),
    spec: {
      storageClassName: target.storageClass,
      accessModes: ["ReadWriteOnce"],
      resources: { requests: { storage: target.storageSize } },
    },
  },
  {
    apiVersion: "v1",
    kind: "Service",
    metadata: metadata(name),
    spec: {
      selector: labels,
      ports: [{ name: "http", port: 80, targetPort: 8787 }],
      type: "ClusterIP",
    },
  },
  {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: metadata(name),
    spec: {
      replicas: reviewOnly ? 0 : 1,
      strategy: { type: "Recreate" },
      revisionHistoryLimit: 2,
      selector: { matchLabels: labels },
      template: {
        metadata: {
          labels,
          annotations: {
            "promisory.decionis.com/config-sha256": createHash("sha256")
              .update(JSON.stringify(runtime))
              .digest("hex"),
          },
        },
        spec: {
          serviceAccountName: name,
          automountServiceAccountToken: false,
          terminationGracePeriodSeconds: 30,
          nodeSelector: {
            "kubernetes.io/os": "linux",
            "kubernetes.io/arch": "amd64",
          },
          securityContext: {
            runAsNonRoot: true,
            runAsUser: 1000,
            runAsGroup: 1000,
            fsGroup: 1000,
            fsGroupChangePolicy: "OnRootMismatch",
            seccompProfile: { type: "RuntimeDefault" },
          },
          containers: [
            {
              name: "executor",
              image,
              imagePullPolicy: "IfNotPresent",
              ports: [{ name: "http", containerPort: 8787 }],
              envFrom: [
                { configMapRef: { name } },
                { secretRef: { name: "promisory-test-secrets" } },
              ],
              securityContext: {
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: true,
                capabilities: { drop: ["ALL"] },
              },
              resources: {
                requests: { cpu: "100m", memory: "128Mi" },
                limits: { cpu: "500m", memory: "512Mi" },
              },
              volumeMounts: [
                { name: "state", mountPath: "/var/lib/promisory" },
                { name: "tmp", mountPath: "/tmp" },
              ],
              startupProbe: {
                httpGet: { path: "/healthz", port: "http" },
                periodSeconds: 2,
                failureThreshold: 30,
              },
              readinessProbe: {
                httpGet: { path: "/healthz", port: "http" },
                periodSeconds: 10,
                timeoutSeconds: 2,
              },
              livenessProbe: {
                httpGet: { path: "/healthz", port: "http" },
                periodSeconds: 30,
                timeoutSeconds: 2,
              },
            },
          ],
          volumes: [
            {
              name: "state",
              persistentVolumeClaim: { claimName: "promisory-test-state" },
            },
            { name: "tmp", emptyDir: { medium: "Memory", sizeLimit: "16Mi" } },
          ],
        },
      },
    },
  },
];
const ingress = {
  apiVersion: "networking.k8s.io/v1",
  kind: "Ingress",
  metadata: {
    ...metadata(name),
    annotations: {
      ...annotations,
      "cert-manager.io/cluster-issuer": target.clusterIssuer,
      "nginx.ingress.kubernetes.io/force-ssl-redirect": "true",
      "nginx.ingress.kubernetes.io/proxy-body-size": "16k",
      "nginx.ingress.kubernetes.io/proxy-read-timeout": "25",
      "nginx.ingress.kubernetes.io/limit-rps": "5",
    },
  },
  spec: {
    ingressClassName: target.ingressClass,
    tls: [{ hosts: [target.publicHost], secretName: "promisory-test-tls" }],
    rules: [
      {
        host: target.publicHost,
        http: {
          paths: [
            {
              path: "/",
              pathType: "Prefix",
              backend: { service: { name, port: { number: 80 } } },
            },
          ],
        },
      },
    ],
  },
};
const review = {
  schemaVersion: "promisory.azure-test-plan.v1",
  generatedAt: new Date().toISOString(),
  reviewOnly,
  imagePinned: !reviewOnly,
  registryVerificationRequired: true,
  image,
  target,
  resources: [...items, networkPolicy, ingress].map(({ kind, metadata }) => ({
    kind,
    name: metadata.name,
    namespace: metadata.namespace,
  })),
  secretNames: [
    "PROMISORY_AUTHORITY_API_KEY",
    "PROMISORY_REMOTE_SIGNING_KEY",
    "PROMISORY_CLAIM_ENCRYPTION_KEY",
  ],
  initialExecutionMode: "SHADOW",
  initialSharingEnabled: false,
  newPaidResource:
    "One 4 GiB disk on the existing decionis-zrs storage class (Premium_ZRS, Retain).",
  separateSharedRuntimeChange: {
    deployment: "decionis-api",
    environmentVariable: "DECIONIS_TRUSTED_EFFECT_OBSERVER_API_KEY_IDS",
    appendApiKeyId: target.effectObserverApiKeyId,
    purpose:
      "Allow this executor's authenticated reconciliation of its own claimed operations.",
    requiresRollout: true,
  },
};
const directory = reviewOnly
  ? "release/azure-test-review"
  : "release/azure-test";
await mkdir(directory, { recursive: true });
for (const [filename, value] of Object.entries({
  "network-policy.json": networkPolicy,
  "resources.json": { apiVersion: "v1", kind: "List", items },
  "ingress.json": ingress,
  "review.json": review,
}))
  await writeFile(
    `${directory}/${filename}`,
    `${JSON.stringify(value, null, 2)}\n`,
  );
console.log(
  JSON.stringify({
    directory,
    reviewOnly: review.reviewOnly,
    resources: review.resources.length,
    initialExecutionMode: review.initialExecutionMode,
  }),
);
