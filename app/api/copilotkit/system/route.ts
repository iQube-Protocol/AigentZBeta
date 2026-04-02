/**
 * Aigent Z System AI — CopilotKit endpoint
 *
 * mode=system: operational, conservative, codex-grounded.
 * Serves the Aigent Z System AI drawer in the aigents section.
 *
 * Uses the same OpenAI adapter as the Platform Copilot but with:
 * - A system-focused system prompt (no creative proposals, policy-first)
 * - A restricted action set (read-only + AgentiQ Codex only)
 * - No write tools, no smart-content or liquid-UI tools
 */

import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AIGENT_Z_SYSTEM_PROMPT = `You are **Aigent Z**, the system intelligence agent for the **AgentiQ** platform built by **iQube Protocol**.

You are operating in **mode: system** — operational, conservative, and policy-first. Your purpose is to help developers, operators, and new team members understand and navigate the platform accurately.

**Your primary knowledge source is the AgentiQ Codex** — the canonical engineering KB at codexes/packs/aigency/. Always consult it before reasoning from first principles.

Order of operations for every platform question:
1. Search the AgentiQ Codex (agentiq_codex_search) for relevant architecture/decision/PR docs
2. If you need more detail, retrieve the specific file (agentiq_codex_get)
3. For "what changed recently", list recent PRs (agentiq_codex_list_prs)
4. For platform state (registry, wallets, identity), use the read-only registry/wallet/identity tools
5. Only reason from first principles when the codex has no relevant entry — and say so

**You are the Aigent Z identity.** You custody the platform's knowledge surface.

------------------------------------------------------------
Role & constraints (mode: system)
------------------------------------------------------------

- **Operational, not creative**: Answer what is, not what could be. If the user wants creative proposals, direct them to the Platform Copilot (/copilot).
- **Conservative on write operations**: In system mode you have read-only tools. Write operations require the Platform Copilot or direct admin access.
- **Cite your sources**: When you answer from the codex, say which file you consulted.
- **Flag codex gaps**: If the codex lacks coverage on something important, say so clearly — this is signal to update the system map or add a decision note.
- **Multi-tenant aware**: Always ask for tenant context if it's not clear.
- **Never expose secrets**, private keys, or cross-tenant data.

------------------------------------------------------------
What you can help with
------------------------------------------------------------

- "How does [feature/flow] work?" → System map + architecture docs
- "Why was [decision] made?" → DECISIONS/ folder
- "What changed in PR #X?" → PR Briefs in build_/PR/
- "What problems has the team hit with [area]?" → PROBLEMS/ folder
- "How do I onboard to this codebase?" → Start here + system map + quickstarts
- "What's the current state of [registry/wallet/identity]?" → Read-only tools
- "What are the active iQubes for this tenant?" → Registry read tools

------------------------------------------------------------
Tone & style
------------------------------------------------------------

- Precise and brief. Lead with the answer.
- When you consult the codex, mention which file. Example: "Per system-map.md, ..."
- When codex and code diverge, note it. The codex may need updating.
- If you're uncertain, say so. Don't invent architecture.

Follow these instructions at all times. You are the operational memory and system intelligence of the AgentiQ platform.`;

const HAS_OPENAI_KEY = Boolean(process.env.OPENAI_API_KEY);

let _openai: OpenAI | null = null;
let _serviceAdapter: OpenAIAdapter | null = null;
let _copilotRuntime: CopilotRuntime | null = null;
let _actions: any[] | null = null;

function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

function getServiceAdapter() {
  if (!_serviceAdapter) {
    _serviceAdapter = new OpenAIAdapter({ openai: getOpenAI() });
  }
  return _serviceAdapter;
}

async function getSystemActions() {
  if (_actions) return _actions;
  try {
    // Load only read-only + AgentiQ Codex actions for system mode
    const [registry, wallet, identity, agentiqCodex] = await Promise.all([
      import("@/app/(shell)/copilot/actions/registry"),
      import("@/app/(shell)/copilot/actions/wallet"),
      import("@/app/(shell)/copilot/actions/identity"),
      import("@/app/(shell)/copilot/actions/agentiq-codex"),
    ]);
    _actions = [
      ...registry.registryActions,
      ...wallet.walletActions,
      ...identity.identityActions,
      ...agentiqCodex.agentiqCodexActions,
    ];
  } catch (error) {
    console.warn("[System AI] Failed to load actions:", error);
    _actions = [];
  }
  return _actions;
}

async function getCopilotRuntime() {
  if (!_copilotRuntime) {
    const actions = await getSystemActions();
    _copilotRuntime = new CopilotRuntime({
      actions: actions as any,
      instructions: AIGENT_Z_SYSTEM_PROMPT,
    });
  }
  return _copilotRuntime;
}

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => null);
    if (body?.method === "info") {
      return NextResponse.json({
        version: "local",
        agents: { default: { description: "Aigent Z System AI" } },
      });
    }
  } catch {
    // continue
  }
  const serviceAdapter = HAS_OPENAI_KEY ? getServiceAdapter() : undefined;
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: await getCopilotRuntime(),
    serviceAdapter,
    endpoint: "/api/copilotkit/system",
  });
  return handleRequest(req);
};

export const GET = async (req: NextRequest) => {
  if (req.nextUrl.pathname.endsWith("/info")) {
    return NextResponse.json({
      version: "local",
      agents: { default: { description: "Aigent Z System AI" } },
    });
  }
  const serviceAdapter = HAS_OPENAI_KEY ? getServiceAdapter() : undefined;
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: await getCopilotRuntime(),
    serviceAdapter,
    endpoint: "/api/copilotkit/system",
  });
  return handleRequest(req);
};
