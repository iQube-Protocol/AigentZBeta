import { canAuthorityPublishThread, QUBETALK_THREADS } from "./policy";
import type { QubeTalkAuthority, QubeTalkClient, QubeTalkMessageDraft, QubeTalkThread } from "./types";

export type QubeTalkSeedMessage = QubeTalkMessageDraft & {
  seed_id: string;
};

export type SeedPublishResult = {
  published: Array<{ seed_id: string; thread: QubeTalkThread; title: string }>;
  skipped: Array<{ seed_id: string; thread: QubeTalkThread; reason: string }>;
  failed: Array<{ seed_id: string; thread: QubeTalkThread; error: string }>;
};

function seed(message: QubeTalkSeedMessage): QubeTalkSeedMessage {
  return message;
}

export const METAME_RUNTIME_THINCLIENT_SEEDS: QubeTalkSeedMessage[] = [
  seed({
    seed_id: "seed-spec-001",
    type: "decision",
    thread: "spec",
    severity: "info",
    title: "Project scope: metaMe Runtime Thin Client Shell",
    body: "Build a Next.js shell that renders runtime header and smart menu from AA API, and embeds existing runtime UI via iframe.",
    acceptance: [
      "Shell app exists in apps/metame-runtime-shell",
      "Header/menu are AA payload-driven",
      "iframe runtime is integrated with postMessage bridge",
    ],
    refs: {
      repo: "AigentZBeta",
      paths: ["apps/metame-runtime-shell"],
      endpoints: [],
      env: ["NEXT_PUBLIC_AA_API_BASE_URL", "NEXT_PUBLIC_RUNTIME_IFRAME_URL", "NEXT_PUBLIC_QUBETALK_WS_URL"],
    },
    control: {
      id: "seed-spec-001",
      supersedes_id: null,
      depends_on: [],
      assignee: "aigent_z",
      status: "open",
    },
    attestations: {
      authority: "aigent_z",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-spec-002",
    type: "decision",
    thread: "spec",
    severity: "info",
    title: "AA API hydration contract",
    body: "Adopt GET /runtime/shell-config as primary hydration endpoint, with selector/menu mutation endpoints returning config updates.",
    acceptance: [
      "GET /runtime/shell-config returns trust/selectors/menu/iframe bootstrap",
      "POST /runtime/selectors returns updated shell config fragment",
      "POST /runtime/menu-action returns updated shell config fragment",
    ],
    refs: {
      repo: "SmartTriad AA API",
      paths: [],
      endpoints: ["GET /runtime/shell-config", "POST /runtime/selectors", "POST /runtime/menu-action"],
      env: [],
    },
    control: {
      id: "seed-spec-002",
      supersedes_id: null,
      depends_on: ["seed-spec-001"],
      assignee: "aigent_z",
      status: "open",
    },
    attestations: {
      authority: "chatgpt",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-spec-003",
    type: "decision",
    thread: "spec",
    severity: "info",
    title: "Iframe handshake schema",
    body: "Handshake contract is SHELL_READY -> HANDOFF -> RUNTIME_READY. Enforce runtime origin validation on inbound/outbound messages.",
    acceptance: [
      "SHELL_READY and HANDOFF sent by shell",
      "RUNTIME_READY consumed by shell",
      "Runtime origin is validated before handling events",
    ],
    refs: {
      repo: "AigentZBeta",
      paths: ["packages/iframe-bridge", "apps/metame-runtime-shell/app/page.tsx"],
      endpoints: [],
      env: ["NEXT_PUBLIC_RUNTIME_IFRAME_ORIGIN"],
    },
    control: {
      id: "seed-spec-003",
      supersedes_id: null,
      depends_on: ["seed-spec-001"],
      assignee: "lovable_agent",
      status: "open",
    },
    attestations: {
      authority: "chatgpt",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-spec-004",
    type: "decision",
    thread: "spec",
    severity: "info",
    title: "Menu policy: triad + edge + collapse",
    body: "Default triad is Earn/Play/Make, edge items Be/Share appear by policy, and center collapse to metaMe button is allowed by config.",
    acceptance: [
      "Menu uses payload items and policy fields",
      "Collapsed and full modes both supported",
      "Mobile-safe touch targets retained",
    ],
    refs: {
      repo: "AigentZBeta",
      paths: ["apps/metame-runtime-shell/app/components/SmartMenu.tsx"],
      endpoints: ["GET /runtime/shell-config"],
      env: [],
    },
    control: {
      id: "seed-spec-004",
      supersedes_id: null,
      depends_on: ["seed-spec-002"],
      assignee: "lovable_agent",
      status: "open",
    },
    attestations: {
      authority: "aigent_z",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-spec-005",
    type: "decision",
    thread: "spec",
    severity: "warn",
    title: "Security policy: no secrets in QubeTalk",
    body: "Do not post long-lived secrets in channel messages. Use ephemeral scoped credentials and secure secret transport.",
    acceptance: [
      "No secret values posted in threads",
      "Executor credentials are time-bound and scoped",
      "Audit metadata is retained",
    ],
    refs: {
      repo: "QubeTalk policy",
      paths: [],
      endpoints: [],
      env: [],
    },
    control: {
      id: "seed-spec-005",
      supersedes_id: null,
      depends_on: [],
      assignee: "aigent_z",
      status: "open",
    },
    attestations: {
      authority: "aigent_z",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-spec-006",
    type: "log",
    thread: "spec",
    severity: "info",
    title: "Phase 2 note: external agent execution channels",
    body: "Future phase will extend this control plane to OpenClaw, Arc Anima, and additional agent frameworks with capability tokens and sandboxed execution.",
    acceptance: [
      "Phase 2 is acknowledged",
      "No Phase 2 implementation required in Sprint 1",
    ],
    refs: {
      repo: "metaMe runtime roadmap",
      paths: [],
      endpoints: [],
      env: [],
    },
    control: {
      id: "seed-spec-006",
      supersedes_id: null,
      depends_on: ["seed-spec-005"],
      assignee: null,
      status: "done",
    },
    attestations: {
      authority: "chatgpt",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-api-001",
    type: "task",
    thread: "api-wiring",
    severity: "blocker",
    title: "Implement GET /runtime/shell-config",
    body: "Return trust, selectors, menu policy, iframe URL/origin, and bootstrap handoff token in a single deterministic payload.",
    acceptance: [
      "Endpoint resolves by tenant/persona/session",
      "Includes iframe bootstrap handoff token",
      "Includes trust signal states",
    ],
    refs: {
      repo: "SmartTriad AA API",
      paths: [],
      endpoints: ["GET /runtime/shell-config"],
      env: [],
    },
    control: {
      id: "seed-api-001",
      supersedes_id: null,
      depends_on: ["seed-spec-002"],
      assignee: "aigent_z",
      status: "open",
    },
    attestations: {
      authority: "aigent_z",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-api-002",
    type: "task",
    thread: "api-wiring",
    severity: "info",
    title: "Implement selector and menu mutation endpoints",
    body: "Add POST /runtime/selectors and POST /runtime/menu-action with session-scoped updates and config fragments in responses.",
    acceptance: [
      "Selector endpoint accepts aigent_id and llm_id",
      "Menu endpoint accepts action_id and payload",
      "Responses include updated config data",
    ],
    refs: {
      repo: "SmartTriad AA API",
      paths: [],
      endpoints: ["POST /runtime/selectors", "POST /runtime/menu-action"],
      env: [],
    },
    control: {
      id: "seed-api-002",
      supersedes_id: null,
      depends_on: ["seed-api-001"],
      assignee: "aigent_z",
      status: "open",
    },
    attestations: {
      authority: "aigent_z",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-ui-001",
    type: "task",
    thread: "ui-shell",
    severity: "blocker",
    title: "Build shell UI: header, menu, iframe",
    body: "Implement mobile-first runtime header, smart menu, and iframe wrapper with ready-state loading behavior.",
    acceptance: [
      "Header uses trust + selectors from config",
      "Menu renders policy-driven modes",
      "Iframe fills main viewport between header and menu",
    ],
    refs: {
      repo: "AigentZBeta",
      paths: ["apps/metame-runtime-shell/app/components"],
      endpoints: ["GET /runtime/shell-config"],
      env: ["NEXT_PUBLIC_RUNTIME_IFRAME_URL", "NEXT_PUBLIC_RUNTIME_IFRAME_ORIGIN"],
    },
    control: {
      id: "seed-ui-001",
      supersedes_id: null,
      depends_on: ["seed-api-001"],
      assignee: "lovable_agent",
      status: "open",
    },
    attestations: {
      authority: "lovable",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-ui-002",
    type: "task",
    thread: "ui-shell",
    severity: "info",
    title: "Wire hydration and optimistic updates",
    body: "Hydrate from shell-config on load, and rehydrate from selector/menu mutation responses after user actions.",
    acceptance: [
      "AA hydration on initial mount",
      "Selector changes trigger mutation and refresh",
      "Menu actions trigger mutation and refresh",
    ],
    refs: {
      repo: "AigentZBeta",
      paths: ["apps/metame-runtime-shell/app/page.tsx", "packages/aa-client/src/index.ts"],
      endpoints: ["GET /runtime/shell-config", "POST /runtime/selectors", "POST /runtime/menu-action"],
      env: ["NEXT_PUBLIC_AA_API_BASE_URL"],
    },
    control: {
      id: "seed-ui-002",
      supersedes_id: null,
      depends_on: ["seed-ui-001", "seed-api-002"],
      assignee: "lovable_agent",
      status: "open",
    },
    attestations: {
      authority: "lovable",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-dev-001",
    type: "task",
    thread: "dev-exec",
    severity: "blocker",
    title: "Scaffold thin-shell app and shared packages",
    body: "Scaffold the app and typed shared packages, and add /dev diagnostics with payload and event traces.",
    acceptance: [
      "Workspace packages compile",
      "App boots and /dev renders",
      "Diagnostics show shell config and trace logs",
    ],
    refs: {
      repo: "AigentZBeta",
      paths: ["apps/metame-runtime-shell", "packages/aa-client", "packages/iframe-bridge", "packages/qubetalk-client"],
      endpoints: [],
      env: [],
    },
    control: {
      id: "seed-dev-001",
      supersedes_id: null,
      depends_on: ["seed-spec-001"],
      assignee: "windsurf_cascade",
      status: "open",
    },
    attestations: {
      authority: "chatgpt",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-dev-002",
    type: "task",
    thread: "dev-exec",
    severity: "info",
    title: "Implement typed AA client",
    body: "Implement typed AA client methods and runtime-safe parsing/error handling.",
    acceptance: [
      "getShellConfig implemented",
      "postSelectors implemented",
      "postMenuAction implemented",
    ],
    refs: {
      repo: "AigentZBeta",
      paths: ["packages/aa-client/src/index.ts"],
      endpoints: ["GET /runtime/shell-config", "POST /runtime/selectors", "POST /runtime/menu-action"],
      env: ["NEXT_PUBLIC_AA_API_BASE_URL"],
    },
    control: {
      id: "seed-dev-002",
      supersedes_id: null,
      depends_on: ["seed-api-001"],
      assignee: "windsurf_codex",
      status: "open",
    },
    attestations: {
      authority: "chatgpt",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-dev-003",
    type: "task",
    thread: "dev-exec",
    severity: "info",
    title: "Add diagnostics for AA and postMessage traces",
    body: "Expose last config snapshot plus recent AA request logs and bridge events in /dev for integration debugging.",
    acceptance: [
      "AA logs visible",
      "postMessage logs visible",
      "No secret values rendered",
    ],
    refs: {
      repo: "AigentZBeta",
      paths: ["apps/metame-runtime-shell/app/dev/page.tsx"],
      endpoints: [],
      env: [],
    },
    control: {
      id: "seed-dev-003",
      supersedes_id: null,
      depends_on: ["seed-dev-001"],
      assignee: "claude_code",
      status: "open",
    },
    attestations: {
      authority: "chatgpt",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-ops-001",
    type: "task",
    thread: "ops",
    severity: "info",
    title: "Confirm environment variable readiness",
    body: "Confirm required shell env vars are available in local and preview environments, including iframe origin and QubeTalk endpoint.",
    acceptance: [
      "Env var names documented",
      "Runtime iframe URL + origin verified",
      "AA base URL reachable from shell",
    ],
    refs: {
      repo: "AigentZBeta",
      paths: ["apps/metame-runtime-shell/.env.example"],
      endpoints: [],
      env: ["NEXT_PUBLIC_AA_API_BASE_URL", "NEXT_PUBLIC_RUNTIME_IFRAME_URL", "NEXT_PUBLIC_QUBETALK_WS_URL"],
    },
    control: {
      id: "seed-ops-001",
      supersedes_id: null,
      depends_on: ["seed-spec-005"],
      assignee: "aigent_z",
      status: "open",
    },
    attestations: {
      authority: "aigent_z",
      signature: "",
    },
  }),
  seed({
    seed_id: "seed-ops-002",
    type: "decision",
    thread: "ops",
    severity: "warn",
    title: "Executor access policy",
    body: "Executors publish task/status/patch in approved threads only. Secrets are never posted in QubeTalk.",
    acceptance: [
      "Least privilege thread permissions applied",
      "Credential rotation and revocation available",
      "Audit logging enabled",
    ],
    refs: {
      repo: "QubeTalk policy",
      paths: [],
      endpoints: [],
      env: [],
    },
    control: {
      id: "seed-ops-002",
      supersedes_id: null,
      depends_on: ["seed-spec-005"],
      assignee: "aigent_z",
      status: "open",
    },
    attestations: {
      authority: "aigent_z",
      signature: "",
    },
  }),
];

export function getMetameRuntimeThinClientSeeds(options?: { threads?: QubeTalkThread[] }): QubeTalkSeedMessage[] {
  if (!options?.threads || options.threads.length === 0) {
    return [...METAME_RUNTIME_THINCLIENT_SEEDS];
  }

  const include = new Set(options.threads);
  return METAME_RUNTIME_THINCLIENT_SEEDS.filter((message) => include.has(message.thread));
}

export function getMetameSeedsPublishableByAuthority(
  authority: QubeTalkAuthority,
  options?: { threads?: QubeTalkThread[] }
): { publishable: QubeTalkSeedMessage[]; blocked: QubeTalkSeedMessage[] } {
  const seeds = getMetameRuntimeThinClientSeeds(options);
  const publishable: QubeTalkSeedMessage[] = [];
  const blocked: QubeTalkSeedMessage[] = [];

  for (const message of seeds) {
    if (canAuthorityPublishThread(authority, message.thread)) {
      publishable.push(message);
    } else {
      blocked.push(message);
    }
  }

  return { publishable, blocked };
}

export async function publishMetameRuntimeThinClientSeeds(
  client: QubeTalkClient,
  authority: QubeTalkAuthority,
  options?: {
    threads?: QubeTalkThread[];
    continueOnError?: boolean;
  }
): Promise<SeedPublishResult> {
  const result: SeedPublishResult = {
    published: [],
    skipped: [],
    failed: [],
  };

  const { publishable, blocked } = getMetameSeedsPublishableByAuthority(authority, {
    threads: options?.threads ?? QUBETALK_THREADS,
  });

  for (const skippedSeed of blocked) {
    result.skipped.push({
      seed_id: skippedSeed.seed_id,
      thread: skippedSeed.thread,
      reason: `Authority ${authority} cannot publish to ${skippedSeed.thread}`,
    });
  }

  for (const seedMessage of publishable) {
    try {
      await client.publishDraft(seedMessage);
      result.published.push({
        seed_id: seedMessage.seed_id,
        thread: seedMessage.thread,
        title: seedMessage.title,
      });
    } catch (error) {
      result.failed.push({
        seed_id: seedMessage.seed_id,
        thread: seedMessage.thread,
        error: error instanceof Error ? error.message : "Unknown publish error",
      });

      if (!options?.continueOnError) {
        break;
      }
    }
  }

  return result;
}
