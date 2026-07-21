/**
 * POST /api/threshold/mcp — the metaMe Threshold Gateway (PRD-THR-001 §8).
 *
 * A minimal, spec-correct MCP server over Streamable HTTP: it responds to
 * JSON-RPC 2.0 POST messages with single `application/json` responses (stateless;
 * no server-initiated streaming needed for the read-only Increment 1 surface).
 * Hand-rolled rather than pulling the MCP SDK — keeps the SSR bundle lean (the
 * platform sits near the Amplify output-size cap) and gives full control of the
 * constitutional guardrails.
 *
 * Increment 1 is UNAUTHENTICATED + READ-ONLY: `initialize`, `tools/list`,
 * `tools/call` (list_services, inspect_threshold_link only), `resources/*`,
 * `prompts/*`, `ping`. The authenticated crossing tools (the Constitutional
 * Handshake) land in the next increment; calling one returns an honest
 * "handshake required" result. No persona/T0 identifiers are ever emitted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/utils/publicOrigin';
import {
  SERVER_INFO,
  PROTOCOL_VERSION,
  listTools,
  listResources,
  listPrompts,
  getPrompt,
  callTool,
  readResource,
  type GatewayContext,
} from '@/services/threshold/gateway';
import { resolveInvitation } from '@/services/threshold/resolveInvitation';
import { resolveBearer } from '@/services/threshold/gatewaySession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type, mcp-session-id, mcp-protocol-version, authorization');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

// GET is used by MCP clients to open an SSE stream for server-initiated
// messages. The stateless read-only gateway has none, so we accept + hold open
// nothing: return 405 to signal "POST-only" (spec-permitted).
export async function GET() {
  return cors(NextResponse.json({ error: 'Use POST for JSON-RPC; this gateway is stateless.' }, { status: 405 }));
}

// ── JSON-RPC dispatch ─────────────────────────────────────────────────────────

interface RpcMsg { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

function ok(id: RpcMsg['id'], result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}
function err(id: RpcMsg['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function handleOne(msg: RpcMsg, ctx: GatewayContext): Promise<object | null> {
  const { method, id, params = {} } = msg;
  // Notifications (no id) — acknowledge without a response body.
  if (id === undefined || id === null) {
    return null;
  }
  try {
    switch (method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL_VERSION,
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: SERVER_INFO,
          instructions:
            'metaMe Threshold Gateway. Inspect a Threshold Link and list_services to explain a crossing to your principal. Only the human authorizes.',
        });
      case 'ping':
        return ok(id, {});
      case 'tools/list':
        return ok(id, { tools: listTools() });
      case 'tools/call': {
        const name = String(params.name ?? '');
        const args = (params.arguments as Record<string, unknown>) ?? {};
        return ok(id, await callTool(name, args, ctx));
      }
      case 'resources/list':
        return ok(id, { resources: listResources() });
      case 'resources/read':
        return ok(id, await readResource(String(params.uri ?? ''), ctx));
      case 'prompts/list':
        return ok(id, { prompts: listPrompts() });
      case 'prompts/get':
        return ok(id, getPrompt(String(params.name ?? ''), (params.arguments as Record<string, unknown>) ?? {}));
      default:
        return err(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return err(id, -32603, e instanceof Error ? e.message : 'internal error');
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return cors(NextResponse.json(err(null, -32700, 'Parse error'), { status: 400 }));
  }

  const origin = publicOrigin(request);
  // Resolve the Constitutional Handshake bearer, if one is presented. Defensive:
  // resolveBearer degrades any error (incl. an unmigrated table) to null, so an
  // absent/invalid/expired bearer simply leaves the gateway on its read-only
  // surface — it never fails the request.
  const authz = request.headers.get('authorization');
  const bearer = authz?.toLowerCase().startsWith('bearer ') ? authz.slice(7).trim() : null;
  const session = await resolveBearer(bearer);
  const ctx: GatewayContext = {
    origin,
    gatewayUrl: `${origin}/api/threshold/mcp`,
    resolveInvitation,
    session,
  };

  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map((m) => handleOne(m as RpcMsg, ctx)))).filter(Boolean);
    if (responses.length === 0) return cors(new NextResponse(null, { status: 202 }));
    return cors(NextResponse.json(responses));
  }

  const response = await handleOne(body as RpcMsg, ctx);
  if (response === null) return cors(new NextResponse(null, { status: 202 }));
  return cors(NextResponse.json(response));
}
