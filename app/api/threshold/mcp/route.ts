/**
 * POST /api/threshold/mcp — the metaMe Threshold Gateway (PRD-THR-001 §8).
 *
 * Minimal MCP server over Streamable HTTP. Threshold bearer authority is
 * resolved once at the transport boundary. Upload execution uses the same
 * shared executor as the native connector action so the two interfaces cannot
 * drift onto different authentication/storage paths again.
 */

import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/utils/publicOrigin';
import {
  SERVER_INFO,
  PROTOCOL_VERSION,
  HANDSHAKE_TOOLS,
  listTools,
  listResources,
  listPrompts,
  getPrompt,
  callTool,
  readResource,
  type GatewayContext,
} from '@/services/threshold/gateway';
import { resolveInvitation } from '@/services/threshold/resolveInvitation';
import { resolveBearer, createUpgradeHandshake, hasScope } from '@/services/threshold/gatewaySession';
import { makeIrlAdapter } from '@/services/threshold/irlAdapter';
import { buildCompanionInstallBrief } from '@/services/companion/extensionArtifact';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveConstitutionalNavigatorState } from '@/services/threshold/constitutionalNavigator';
import {
  getExchangeStateForMcp,
  depositExchangeArtifactViaMcp,
  declareArtifactFreezeViaMcp,
  signExchangeInstrumentViaMcp,
  establishDelegationViaMcp,
} from '@/services/threshold/mcpConstitutionalActs';
import {
  executeThresholdContentUpload,
  THRESHOLD_UPLOAD_ROLES,
  decodeBase64Strict,
  assertDecodableImage,
} from '@/services/threshold/uploadContentAsset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

export async function GET() {
  return cors(NextResponse.json({ error: 'Use POST for JSON-RPC; this gateway is stateless.' }, { status: 405 }));
}

interface RpcMsg { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

function ok(id: RpcMsg['id'], result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}
function err(id: RpcMsg['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function inferMime(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  return 'application/octet-stream';
}

async function callUploadContentAsset(args: Record<string, unknown>, ctx: GatewayContext) {
  const session = ctx.session;
  if (!session || !hasScope(session, 'content.asset.upload')) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'content.asset.upload capability required' }],
    };
  }

  const fileBase64 = typeof args.fileBase64 === 'string' ? args.fileBase64 : null;
  const file = typeof args.file === 'string' ? args.file : null;
  if ((fileBase64 && file) || (!fileBase64 && !file)) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Exactly one of fileBase64 or file is required.' }],
    };
  }

  const fileName = typeof args.fileName === 'string' ? args.fileName.trim() : '';
  const domain = typeof args.domain === 'string' ? args.domain.trim() : '';
  const role = typeof args.role === 'string' ? args.role.trim() : '';
  if (!fileName || !domain || !role) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Missing required parameters: fileName, domain, role' }],
    };
  }
  if (!THRESHOLD_UPLOAD_ROLES.has(role)) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Invalid role: ${role}` }],
    };
  }

  try {
    // Strict decode: rejects a data-URL prefix, whitespace, or any non-base64
    // character loudly instead of silently truncating to whatever Node's
    // lenient decoder could salvage. A corrupt decode here previously
    // persisted a garbage buffer all the way to Autonomys with no error
    // anywhere in the pipeline — the failure only surfaced later, as an
    // undecodable image on the display side.
    const bytes = decodeBase64Strict(fileBase64 || file || '');

    // Image-bearing roles must be genuine, fully-decodable rasters before
    // they are ever encrypted and persisted — this is the one point where
    // the original source is still in hand to validate against.
    await assertDecodableImage(bytes, role);

    const receipt = await executeThresholdContentUpload({
      bytes,
      mimeType: inferMime(fileName),
      fileName,
      domain,
      role,
      origin: ctx.origin,
      contentId: typeof args.contentId === 'string' ? args.contentId : null,
      bind: args.bind !== false,
      bundleId: typeof args.bundleId === 'string' ? args.bundleId : null,
      bundleLabel: typeof args.bundleLabel === 'string' ? args.bundleLabel : null,
      bundleType: typeof args.bundleType === 'string' ? args.bundleType : null,
      bundleOrder: typeof args.bundleOrder === 'number' ? args.bundleOrder : null,
      assetUse: typeof args.assetUse === 'string' ? args.assetUse : null,
      setPrimary: args.setPrimary === true,
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(receipt) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upload-failed';
    console.error('[threshold/mcp] upload_content_asset failed:', message);
    return {
      isError: true,
      content: [{ type: 'text', text: `Upload failed: ${message}` }],
    };
  }
}

async function handleOne(msg: RpcMsg, ctx: GatewayContext): Promise<object | null> {
  const { method, id, params = {} } = msg;
  if (id === undefined || id === null) return null;

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
        // Upload is intercepted at the transport boundary so both MCP and native
        // connector paths share one authorized execution function. This avoids an
        // authenticated MCP session making an unauthenticated internal HTTP hop.
        if (name === 'upload_content_asset') {
          return ok(id, await callUploadContentAsset(args, ctx));
        }
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
  const authz = request.headers.get('authorization');
  const bearer = authz?.toLowerCase().startsWith('bearer ') ? authz.slice(7).trim() : null;
  const session = await resolveBearer(bearer);
  const ctx: GatewayContext = {
    origin,
    gatewayUrl: `${origin}/api/threshold/mcp`,
    resolveInvitation,
    session,
    irl: makeIrlAdapter(origin),
    companionInstall: () => buildCompanionInstallBrief(origin),
    beginServiceUpgrade: session
      ? async (service, missing) => {
          const hs = await createUpgradeHandshake({ parentSessionId: session.id, service, requestedScope: missing });
          if (!hs) return null;
          return { authorizeUrl: `${origin}/threshold/enter-service#code=${encodeURIComponent(hs.handshakeCode)}` };
        }
      : undefined,
    resolveNavigatorState: session
      ? async (opts) => {
          const admin = getSupabaseServer();
          if (!admin) return null;
          return resolveConstitutionalNavigatorState(admin, session, opts);
        }
      : undefined,
    mcpActs: session
      ? {
          getExchangeState: () => {
            const admin = getSupabaseServer();
            if (!admin) return Promise.resolve({ ok: false as const, error: 'Platform database is unavailable.' });
            return getExchangeStateForMcp(admin, session);
          },
          depositArtifact: (args) => {
            const admin = getSupabaseServer();
            if (!admin) return Promise.resolve({ ok: false as const, error: 'Platform database is unavailable.' });
            return depositExchangeArtifactViaMcp(admin, session, args);
          },
          declareFreeze: (args) => {
            const admin = getSupabaseServer();
            if (!admin) return Promise.resolve({ ok: false as const, error: 'Platform database is unavailable.' });
            return declareArtifactFreezeViaMcp(admin, session, args);
          },
          signInstrument: (args) => {
            const admin = getSupabaseServer();
            if (!admin) return Promise.resolve({ ok: false as const, error: 'Platform database is unavailable.' });
            return signExchangeInstrumentViaMcp(admin, session, args);
          },
          establishDelegation: (args) => {
            const admin = getSupabaseServer();
            if (!admin) return Promise.resolve({ ok: false as const, error: 'Platform database is unavailable.' });
            return establishDelegationViaMcp(admin, session, args);
          },
        }
      : undefined,
  };

  if (!session) {
    const msgs = Array.isArray(body) ? body : [body];
    const wantsAuthTool = msgs.some(
      (m) =>
        (m as RpcMsg)?.method === 'tools/call' &&
        HANDSHAKE_TOOLS.has(String(((m as RpcMsg).params as Record<string, unknown> | undefined)?.name ?? '')),
    );
    if (wantsAuthTool) {
      const res = cors(NextResponse.json(err(null, -32001, 'Constitutional Handshake required'), { status: 401 }));
      res.headers.set(
        'WWW-Authenticate',
        `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      );
      return res;
    }
  }

  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map((m) => handleOne(m as RpcMsg, ctx)))).filter(Boolean);
    if (responses.length === 0) return cors(new NextResponse(null, { status: 202 }));
    return cors(NextResponse.json(responses));
  }

  const response = await handleOne(body as RpcMsg, ctx);
  if (response === null) return cors(new NextResponse(null, { status: 202 }));
  return cors(NextResponse.json(response));
}
