import fs from "node:fs";
import path from "node:path";
import WS from "ws";

(globalThis as any).WebSocket = WS as any;

import { QubeTalkClientImpl } from "../packages/qubetalk-client/src/client";
import type { QubeTalkAuthority } from "../packages/qubetalk-client/src/types";

const wsUrl = process.env.NEXT_PUBLIC_QUBETALK_WS_URL;
const authToken = process.env.QUBETALK_AUTH_TOKEN ?? process.env.NEXT_PUBLIC_QUBETALK_AUTH_TOKEN;
const authority = (process.env.QUBETALK_AUTHORITY ?? "codex") as QubeTalkAuthority;

if (!wsUrl) throw new Error("Missing NEXT_PUBLIC_QUBETALK_WS_URL");
if (!authToken) throw new Error("Missing QUBETALK_AUTH_TOKEN");

const briefPath = path.resolve(process.cwd(), "LOVABLE_RUNTIME_HEADER_MENU_BRIEF.md");
const briefText = fs.existsSync(briefPath) ? fs.readFileSync(briefPath, "utf8") : "Brief file not found.";
const excerpt = briefText.slice(0, 1800);

const client = new QubeTalkClientImpl({
  wsUrl,
  authToken,
  authority,
  channel: "metame-runtime-thinclient",
});

async function run() {
  await client.connect();

  const uiMsg = await client.publishDraft({
    type: "task",
    thread: "ui-shell",
    severity: "info",
    title: "Handoff: metaMe header/menu parity + iframe trigger contract",
    body: [
      "Primary handoff doc: LOVABLE_RUNTIME_HEADER_MENU_BRIEF.md",
      "Implement parity for trust/reliability indicators, Aigent/LLM selectors (icons + tooltips), triad/edge menu grouping, welcome/post-welcome behavior, collapse policy, and iframe intent forwarding.",
      "Trigger contract: POST /aa/v1/runtime/menu-action and POST /aa/v1/runtime/selectors, then forward MENU_ACTION / SELECTOR_CHANGE to iframe using AA response payload.",
      "Brief excerpt:",
      excerpt
    ].join("\n\n"),
    acceptance: [
      "Lovable acknowledges brief in ui-shell thread",
      "Header/menu behavior mirrors current AigentiQ runtime",
      "Menu actions map to surface planner/copilot instructions via iframe bridge"
    ],
    refs: {
      repo: "AigentZBeta",
      paths: [
        "LOVABLE_RUNTIME_HEADER_MENU_BRIEF.md",
        "apps/metame-runtime-shell",
        "packages/iframe-bridge"
      ],
      endpoints: [
        "GET /aa/v1/runtime/shell-config",
        "POST /aa/v1/runtime/selectors",
        "POST /aa/v1/runtime/menu-action"
      ],
      env: [
        "NEXT_PUBLIC_QUBETALK_WS_URL",
        "QUBETALK_AUTH_TOKEN",
        "NEXT_PUBLIC_AA_API_BASE_URL",
        "NEXT_PUBLIC_RUNTIME_IFRAME_URL",
        "NEXT_PUBLIC_RUNTIME_IFRAME_ORIGIN"
      ]
    },
    control: {
      status: "open",
      assignee: "lovable_agent"
    }
  });

  const devMsg = await client.publishDraft({
    type: "status",
    thread: "dev-exec",
    severity: "info",
    title: "Lovable handoff posted in #ui-shell",
    body: `Posted handoff task for Lovable in #ui-shell. Message ID: ${uiMsg.control.id}`,
    acceptance: [
      "Handoff visible in ui-shell",
      "Execution tracking continues in dev-exec"
    ],
    refs: {
      repo: "AigentZBeta",
      paths: ["LOVABLE_RUNTIME_HEADER_MENU_BRIEF.md"],
      endpoints: [],
      env: ["NEXT_PUBLIC_QUBETALK_WS_URL"]
    }
  });

  const uiHistory = await client.getHistory("ui-shell", 5);
  const devHistory = await client.getHistory("dev-exec", 5);

  console.log(JSON.stringify({
    published: [
      { thread: "ui-shell", id: uiMsg.control.id, title: uiMsg.title },
      { thread: "dev-exec", id: devMsg.control.id, title: devMsg.title }
    ],
    ui_shell_last: uiHistory.slice(-2).map((m) => ({ id: m.control.id, title: m.title })),
    dev_exec_last: devHistory.slice(-2).map((m) => ({ id: m.control.id, title: m.title }))
  }, null, 2));

  client.disconnect();
}

run().catch((err) => {
  console.error("QubeTalk publish failed:", err);
  process.exitCode = 1;
});
