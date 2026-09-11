/** POST /api/threshold/mcp — metaMe Threshold Gateway. */
import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/utils/publicOrigin';
import { SERVER_INFO, PROTOCOL_VERSION, HANDSHAKE_TOOLS, listTools, listResources, listPrompts, getPrompt, callTool, readResource, type GatewayContext } from '@/services/threshold/gateway';
import { resolveInvitation } from '@/services/threshold/resolveInvitation';
import { resolveBearer, createUpgradeHandshake, hasScope } from '@/services/threshold/gatewaySession';
import { makeIrlAdapter } from '@/services/threshold/irlAdapter';
import { makePublicKnowledgeAdapter } from '@/services/threshold/publicKnowledge';
import { buildCompanionInstallBrief } from '@/services/companion/extensionArtifact';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveConstitutionalNavigatorState } from '@/services/threshold/constitutionalNavigator';
import { getAccessibleIQube, listAccessibleIQubes, readAccessibleIQubeText } from '@/services/threshold/personaIQubeProjection';
import { depositExchangeArtifactViaMcp, confirmOperatorAssistedArtifactViaMcp, declareArtifactFreezeViaMcp, signExchangeInstrumentViaMcp, establishDelegationViaMcp, resolveExchangeWriteAuthority } from '@/services/threshold/mcpConstitutionalActs';
import { getExchangeStateWithRegistryReferences } from '@/services/threshold/mcpExchangeProjection';
import { executeThresholdContentUpload, THRESHOLD_UPLOAD_ROLES, decodeBase64Strict, assertDecodableImage } from '@/services/threshold/uploadContentAsset';
import { getPersonaState, listAvailablePersonas, requestPersonaSwitch } from '@/services/threshold/personaRecross';
import { PUBLIC_DISCOVERY_TOOLS, callPublicDiscoveryTool, isPublicDiscoveryTool } from '@/services/threshold/publicIQubeMcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function cors(res: NextResponse): NextResponse { res.headers.set('Access-Control-Allow-Origin', '*'); res.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); res.headers.set('Access-Control-Allow-Headers', 'content-type, mcp-session-id, mcp-protocol-version, authorization'); res.headers.set('Cache-Control', 'no-store'); return res; }
export async function OPTIONS() { return cors(new NextResponse(null, { status: 204 })); }
export async function GET() { return cors(NextResponse.json({ error: 'Use POST for JSON-RPC; this gateway is stateless.' }, { status: 405 })); }
interface RpcMsg { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }
function ok(id: RpcMsg['id'], result: unknown) { return { jsonrpc: '2.0', id: id ?? null, result }; }
function err(id: RpcMsg['id'], code: number, message: string) { return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }; }
function inferMime(fileName: string): string { const lower = fileName.toLowerCase(); if (/\.jpe?g$/.test(lower)) return 'image/jpeg'; if (lower.endsWith('.png')) return 'image/png'; if (lower.endsWith('.webp')) return 'image/webp'; if (lower.endsWith('.gif')) return 'image/gif'; if (lower.endsWith('.pdf')) return 'application/pdf'; if (lower.endsWith('.md')) return 'text/markdown'; if (lower.endsWith('.txt')) return 'text/plain'; if (lower.endsWith('.json')) return 'application/json'; if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; if (lower.endsWith('.mp4')) return 'video/mp4'; if (lower.endsWith('.webm')) return 'video/webm'; if (lower.endsWith('.mp3')) return 'audio/mpeg'; if (lower.endsWith('.wav')) return 'audio/wav'; return 'application/octet-stream'; }

async function callUploadContentAsset(args: Record<string, unknown>, ctx: GatewayContext) {
  const session = ctx.session;
  if (!session || !hasScope(session, 'content.asset.upload')) return { isError: true, content: [{ type: 'text', text: 'content.asset.upload capability required' }] };
  const fileBase64 = typeof args.fileBase64 === 'string' ? args.fileBase64 : null; const file = typeof args.file === 'string' ? args.file : null;
  if ((fileBase64 && file) || (!fileBase64 && !file)) return { isError: true, content: [{ type: 'text', text: 'Exactly one of fileBase64 or file is required.' }] };
  const fileName = typeof args.fileName === 'string' ? args.fileName.trim() : ''; const domain = typeof args.domain === 'string' ? args.domain.trim() : ''; const role = typeof args.role === 'string' ? args.role.trim() : '';
  if (!fileName || !domain || !role) return { isError: true, content: [{ type: 'text', text: 'Missing required parameters: fileName, domain, role' }] };
  if (!THRESHOLD_UPLOAD_ROLES.has(role)) return { isError: true, content: [{ type: 'text', text: `Invalid role: ${role}` }] };
  try {
    const bytes = decodeBase64Strict(fileBase64 || file || ''); await assertDecodableImage(bytes, role);
    const receipt = await executeThresholdContentUpload({ bytes, mimeType: inferMime(fileName), fileName, domain, role, origin: ctx.origin, contentId: typeof args.contentId === 'string' ? args.contentId : null, bind: args.bind !== false, bundleId: typeof args.bundleId === 'string' ? args.bundleId : null, bundleLabel: typeof args.bundleLabel === 'string' ? args.bundleLabel : null, bundleType: typeof args.bundleType === 'string' ? args.bundleType : null, bundleOrder: typeof args.bundleOrder === 'number' ? args.bundleOrder : null, assetUse: typeof args.assetUse === 'string' ? args.assetUse : null, setPrimary: args.setPrimary === true });
    return { content: [{ type: 'text', text: JSON.stringify(receipt) }] };
  } catch (error) { const message = error instanceof Error ? error.message : 'upload-failed'; console.error('[threshold/mcp] upload_content_asset failed:', message); return { isError: true, content: [{ type: 'text', text: `Upload failed: ${message}` }] }; }
}

async function handleOne(msg: RpcMsg, ctx: GatewayContext): Promise<object | null> {
  const { method, id, params = {} } = msg; if (id === undefined || id === null) return null;
  try {
    switch (method) {
      case 'initialize': return ok(id, { protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL_VERSION, capabilities: { tools: {}, resources: {}, prompts: {} }, serverInfo: SERVER_INFO, instructions: 'metaMe Threshold Gateway. Call get_agent_manifest first (or read metame://agent-manifest). Only the human authorizes changes of authority.' });
      case 'ping': return ok(id, {});
      case 'tools/list': return ok(id, { tools: [...listTools(), ...PUBLIC_DISCOVERY_TOOLS] });
      case 'tools/call': {
        const name = String(params.name ?? ''); const args = (params.arguments as Record<string, unknown>) ?? {};
        if (name === 'upload_content_asset') return ok(id, await callUploadContentAsset(args, ctx));
        if (isPublicDiscoveryTool(name)) { const result = await callPublicDiscoveryTool(name, args); return ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result && typeof result === 'object' && 'ok' in result && result.ok === false ? { isError: true } : {}) }); }
        if (name === 'request_persona_switch' && ctx.session) {
          const personaPublicRef = typeof args.personaPublicRef === 'string' ? args.personaPublicRef : '';
          const prepared = await requestPersonaSwitch(ctx.session, { personaPublicRef }, ctx.origin);
          if (!prepared.ok) return ok(id, { isError: true, content: [{ type: 'text', text: prepared.error }] });
          return ok(id, { isError: true, content: [{ type: 'text', text: 'Persona switch prepared. Reauthorize this MCP connection to complete a fresh target-persona crossing.' }], _meta: { 'mcp/www_authenticate': [`Bearer resource_metadata="${ctx.origin}/.well-known/oauth-protected-resource"`] } });
        }
        return ok(id, await callTool(name, args, ctx));
      }
      case 'resources/list': return ok(id, { resources: listResources() });
      case 'resources/read': return ok(id, await readResource(String(params.uri ?? ''), ctx));
      case 'prompts/list': return ok(id, { prompts: listPrompts() });
      case 'prompts/get': return ok(id, getPrompt(String(params.name ?? ''), (params.arguments as Record<string, unknown>) ?? {}));
      default: return err(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) { return err(id, -32603, e instanceof Error ? e.message : 'internal error'); }
}

export async function POST(request: NextRequest) {
  let body: unknown; try { body = await request.json(); } catch { return cors(NextResponse.json(err(null, -32700, 'Parse error'), { status: 400 })); }
  const origin = publicOrigin(request); const authz = request.headers.get('authorization'); const bearer = authz?.toLowerCase().startsWith('bearer ') ? authz.slice(7).trim() : null; const session = await resolveBearer(bearer); const irl = makeIrlAdapter(origin);
  const ctx: GatewayContext = {
    origin, gatewayUrl: `${origin}/api/threshold/mcp`, resolveInvitation, session, irl,
    publicKnowledge: makePublicKnowledgeAdapter({ origin, irl }), companionInstall: () => buildCompanionInstallBrief(origin),
    beginServiceUpgrade: session ? async (service, missing) => { const hs = await createUpgradeHandshake({ parentSessionId: session.id, service, requestedScope: missing }); return hs ? { authorizeUrl: `${origin}/threshold/enter-service#code=${encodeURIComponent(hs.handshakeCode)}` } : null; } : undefined,
    personaRecross: session ? { getState: () => getPersonaState(session), listAvailable: () => listAvailablePersonas(session), requestSwitch: (input) => requestPersonaSwitch(session, input, origin) } : undefined,
    resolveNavigatorState: session ? async (opts) => { const admin = getSupabaseServer(); return admin ? resolveConstitutionalNavigatorState(admin, session, opts) : null; } : undefined,
    iqubeProjection: session ? { list: (query) => listAccessibleIQubes(session, query), get: (iqubeId) => getAccessibleIQube(session, iqubeId), readText: (iqubeId, opts) => readAccessibleIQubeText(session, iqubeId, opts) } : undefined,
    mcpActs: session ? {
      getExchangeState: () => { const admin = getSupabaseServer(); return admin ? getExchangeStateWithRegistryReferences(admin, session) : Promise.resolve({ ok: false as const, error: 'Platform database is unavailable.' }); },
      depositArtifact: (args) => { const admin = getSupabaseServer(); return admin ? depositExchangeArtifactViaMcp(admin, session, args) : Promise.resolve({ ok: false as const, error: 'Platform database is unavailable.' }); },
      confirmOperatorAssistedArtifact: (args) => { const admin = getSupabaseServer(); return admin ? confirmOperatorAssistedArtifactViaMcp(admin, session, args) : Promise.resolve({ ok: false as const, error: 'Platform database is unavailable.' }); },
      declareFreeze: (args) => { const admin = getSupabaseServer(); return admin ? declareArtifactFreezeViaMcp(admin, session, args) : Promise.resolve({ ok: false as const, error: 'Platform database is unavailable.' }); },
      signInstrument: (args) => { const admin = getSupabaseServer(); return admin ? signExchangeInstrumentViaMcp(admin, session, args) : Promise.resolve({ ok: false as const, error: 'Platform database is unavailable.' }); },
      establishDelegation: (args) => { const admin = getSupabaseServer(); return admin ? establishDelegationViaMcp(admin, session, args) : Promise.resolve({ ok: false as const, error: 'Platform database is unavailable.' }); },
      resolveExchangeAuthority: () => { const admin = getSupabaseServer(); return admin ? resolveExchangeWriteAuthority(admin, session) : Promise.resolve({ ok: false as const, error: 'Platform database is unavailable.' }); },
    } : undefined,
  };

  if (session && !Array.isArray(body)) {
    const msg = body as RpcMsg; const params = (msg.params ?? {}) as Record<string, unknown>;
    if (msg.method === 'tools/call' && String(params.name ?? '') === 'request_persona_switch') {
      const args = (params.arguments as Record<string, unknown>) ?? {}; const personaPublicRef = typeof args.personaPublicRef === 'string' ? args.personaPublicRef : '';
      const prepared = await requestPersonaSwitch(session, { personaPublicRef }, origin);
      if (!prepared.ok) return cors(NextResponse.json(ok(msg.id, { isError: true, content: [{ type: 'text', text: prepared.error }] })));
      const res = cors(NextResponse.json(err(msg.id, -32001, 'Fresh persona OAuth authorization required'), { status: 401 })); res.headers.set('WWW-Authenticate', `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`); return res;
    }
  }

  if (!session) {
    const msgs = Array.isArray(body) ? body : [body];
    const wantsAuthTool = msgs.some((m) => (m as RpcMsg)?.method === 'tools/call' && HANDSHAKE_TOOLS.has(String(((m as RpcMsg).params as Record<string, unknown> | undefined)?.name ?? '')));
    if (wantsAuthTool) { const res = cors(NextResponse.json(err(null, -32001, 'Constitutional Handshake required'), { status: 401 })); res.headers.set('WWW-Authenticate', `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`); return res; }
  }
  if (Array.isArray(body)) { const responses = (await Promise.all(body.map((m) => handleOne(m as RpcMsg, ctx)))).filter(Boolean); return responses.length ? cors(NextResponse.json(responses)) : cors(new NextResponse(null, { status: 202 })); }
  const response = await handleOne(body as RpcMsg, ctx); return response === null ? cors(new NextResponse(null, { status: 202 })) : cors(NextResponse.json(response));
}
