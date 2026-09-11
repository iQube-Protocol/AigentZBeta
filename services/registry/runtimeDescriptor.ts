/**
 * Agent Runtime Endpoint — the canonical, platform-agnostic runtime
 * descriptor (operator ruling, 2026-08-04).
 *
 * `registry_assets.metadata.runtime` IS AUTHORITATIVE. Agent Cards project
 * it (mirroring the existing `metadata.horizen` / `external_registry_bindings`
 * pattern — see services/horizen/agentRegistrationBinding.ts); no consumer
 * (Pulse, Invocation, Availability, Factory, Trust) may invent a parallel
 * runtime definition or read a platform-specific shape of its own.
 *
 * PHASE 1 SCOPE ONLY. This file defines the descriptor, validates it
 * structurally at write time, and deterministically resolves the URL Pulse
 * should monitor. It does NOT:
 *   - test reachability, fetch a health endpoint, or call `invoke` at all;
 *   - validate an MCP manifest;
 *   - gate Factory publication on runtime availability;
 *   - accrue uptime/reliability Standing;
 *   - authorize or perform any remote call.
 * Those are separate, later-scoped governed capabilities — deliberately not
 * smuggled in here as a side effect of adding this schema.
 */

export interface RuntimeDescriptor {
  /** Absolute HTTPS base URL of the running agent. Required for Pulse eligibility. */
  endpoint?: string;
  /** Absolute HTTPS URL, or a path relative to `endpoint` (e.g. "/health"). */
  health?: string;
  /** Absolute HTTPS URL, or a path relative to `endpoint` (e.g. "/invoke"). Unused in Phase 1 — reserved for the Invocation phase. */
  invoke?: string;
  /** Free-form label, not a closed enum — 'mcp' | 'http' | 'https' | 'a2a' | a future platform's own name. */
  protocol?: string;
  version?: string;
}

export type ValidateRuntimeDescriptorResult =
  | { ok: true; value: RuntimeDescriptor }
  | { ok: false; reason: string };

const PRIVATE_OR_LOOPBACK_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
];

function isPrivateOrLoopbackHost(hostname: string): boolean {
  return PRIVATE_OR_LOOPBACK_HOST_PATTERNS.some((p) => p.test(hostname));
}

/** Strips a trailing slash (except the bare root "/") — deterministic normalization, not a functional change to what the path addresses. */
function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function validateAbsoluteHttpsUrl(fieldName: string, raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: `runtime.${fieldName} "${raw}" is not a valid absolute URL` };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, reason: `runtime.${fieldName} must be absolute HTTPS, got "${url.protocol}"` };
  }
  if (url.username || url.password) {
    return { ok: false, reason: `runtime.${fieldName} must not embed credentials` };
  }
  if (isPrivateOrLoopbackHost(url.hostname)) {
    return { ok: false, reason: `runtime.${fieldName} host "${url.hostname}" is a loopback/private-network destination — not externally monitorable` };
  }
  // A bare root path ("/") carries no information beyond the origin itself
  // — normalized away entirely so "https://host" and "https://host/" always
  // produce the identical canonical value.
  const path = url.pathname === '/' ? '' : stripTrailingSlash(url.pathname);
  const normalized = `${url.origin}${path}${url.search}`;
  return { ok: true, value: normalized };
}

/** `health`/`invoke` may be absolute HTTPS OR a path relative to `endpoint` — never a bare non-rooted string. */
function validateAbsoluteOrRelativePath(fieldName: string, raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  if (/^https?:\/\//i.test(raw)) return validateAbsoluteHttpsUrl(fieldName, raw);
  if (!raw.startsWith('/')) {
    return { ok: false, reason: `runtime.${fieldName} must be an absolute HTTPS URL or a path starting with "/", got "${raw}"` };
  }
  return { ok: true, value: stripTrailingSlash(raw) };
}

/**
 * Structural validation only — no network call. Every field is optional
 * (many registered agents are discoverable or delegated before they expose
 * a live runtime), but a PRESENT field must be well-formed and safe.
 */
export function validateRuntimeDescriptor(input: unknown): ValidateRuntimeDescriptorResult {
  if (input === null || input === undefined) return { ok: true, value: {} };
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, reason: 'runtime descriptor must be an object' };
  }
  const raw = input as Record<string, unknown>;
  const value: RuntimeDescriptor = {};

  if (raw.endpoint !== undefined) {
    if (typeof raw.endpoint !== 'string' || !raw.endpoint) return { ok: false, reason: 'runtime.endpoint must be a non-empty string' };
    const endpoint = validateAbsoluteHttpsUrl('endpoint', raw.endpoint);
    if (!endpoint.ok) return endpoint;
    value.endpoint = endpoint.value;
  }
  if (raw.health !== undefined) {
    if (typeof raw.health !== 'string' || !raw.health) return { ok: false, reason: 'runtime.health must be a non-empty string' };
    const health = validateAbsoluteOrRelativePath('health', raw.health);
    if (!health.ok) return health;
    value.health = health.value;
  }
  if (raw.invoke !== undefined) {
    if (typeof raw.invoke !== 'string' || !raw.invoke) return { ok: false, reason: 'runtime.invoke must be a non-empty string' };
    const invoke = validateAbsoluteOrRelativePath('invoke', raw.invoke);
    if (!invoke.ok) return invoke;
    value.invoke = invoke.value;
  }
  if (raw.protocol !== undefined) {
    if (typeof raw.protocol !== 'string' || !raw.protocol) return { ok: false, reason: 'runtime.protocol must be a non-empty string' };
    value.protocol = raw.protocol;
  }
  if (raw.version !== undefined) {
    if (typeof raw.version !== 'string' || !raw.version) return { ok: false, reason: 'runtime.version must be a non-empty string' };
    value.version = raw.version;
  }
  return { ok: true, value };
}

/**
 * The URL Pulse should monitor, deterministically derived (operator ruling,
 * 2026-08-04):
 *   - no endpoint            → null (caller refuses NO_RUNTIME_ENDPOINT)
 *   - absolute health URL    → use it
 *   - relative health path   → resolve against endpoint
 *   - no health field        → use endpoint
 * `endpoint` is always the required base fact; `health` only ever refines
 * WHICH URL under/instead of it gets polled.
 */
export function resolveRuntimeHealthUrl(runtime: RuntimeDescriptor | null | undefined): string | null {
  if (!runtime?.endpoint) return null;
  const { endpoint, health } = runtime;
  if (!health) return endpoint;
  if (/^https:\/\//i.test(health)) return health;
  try {
    return new URL(health, endpoint).toString();
  } catch {
    return endpoint;
  }
}

/**
 * Persist the canonical runtime descriptor onto an asset's
 * `registry_assets.metadata.runtime` — a MERGE into the existing metadata
 * JSONB blob (which already carries `external_registry_bindings` and other
 * keys for this asset), never a blind overwrite that would clobber them.
 * Validates before writing; never persists a structurally invalid descriptor.
 */
export async function setAssetRuntimeDescriptor(
  assetId: string,
  rawDescriptor: unknown,
): Promise<ValidateRuntimeDescriptorResult> {
  const validated = validateRuntimeDescriptor(rawDescriptor);
  if (!validated.ok) return validated;

  const { getSupabaseServer } = await import('@/app/api/_lib/supabaseServer');
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'Supabase configuration missing' };

  const { data: existing, error: readError } = await supabase
    .from('registry_assets')
    .select('metadata')
    .eq('asset_id', assetId)
    .maybeSingle();
  if (readError) return { ok: false, reason: readError.message };
  if (!existing) return { ok: false, reason: `no registry_assets row for "${assetId}"` };

  const currentMetadata = (existing.metadata as Record<string, unknown> | null) ?? {};
  const { error: writeError } = await supabase
    .from('registry_assets')
    .update({ metadata: { ...currentMetadata, runtime: validated.value }, updated_at: new Date().toISOString() })
    .eq('asset_id', assetId);
  if (writeError) return { ok: false, reason: writeError.message };

  return validated;
}

/** Read-only projection helper — used by Agent Card routes, mirroring resolveHorizenRegistrationBinding's read pattern exactly. */
export async function getAssetRuntimeDescriptor(
  admin: { from: (table: string) => any },
  assetId: string,
): Promise<RuntimeDescriptor | null> {
  const { data } = await admin.from('registry_assets').select('metadata').eq('asset_id', assetId).maybeSingle();
  const runtime = (data?.metadata as { runtime?: unknown } | null)?.runtime;
  if (!runtime) return null;
  const validated = validateRuntimeDescriptor(runtime);
  // A canonical record that somehow fails re-validation is an audit gap, not
  // a value to project as-is — never serve a shape this same module would
  // have refused to accept.
  return validated.ok ? validated.value : null;
}
