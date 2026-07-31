/**
 * sanitizeReceiptMetadata — T0/T1/T2 enforcement before DVN receipt emission.
 *
 * Used by the intent-chain orchestrator (and any future receipt emitter) to
 * scrub metadata before it lands in `orchestration_events.metadata` and
 * flows out to the DVN canister.
 *
 * Per CLAUDE.md + AGENTIQ_INTENT_CHAINS_SPEC.md §6:
 *   T0 fields NEVER appear in receipts (or browser-bound JSON):
 *     - personaId / persona_id / initiated_by_persona_id / *_persona_id
 *     - authProfileId / auth_profile_id
 *     - rootDid / root_did
 *     - kybeAttestation / kybe_attestation
 *     - fioHandle / fio_handle (cross-persona)
 *     - recipient / recipient_email (PII destination)
 *     - payee_persona_id
 *   T1 fields are allowed in JSON but content-sensitive — strip or
 *   summarise for receipts:
 *     - comment (chain feedback) → replace with `comment_present` bool
 *     - error_message → truncate to 200 chars
 *   T2 fields safe in receipts:
 *     - alias_commitment / actor_alias_commitment / payee_alias_commitment
 *     - chain_id / template_id / step_id / artifact_id
 *     - outcome_hash, anchor txids, batch ids
 *
 * The sanitizer is conservative: anything not on the T2 explicit allowlist
 * passes through (preserving the existing receipt content) unless it
 * matches a T0 strip pattern or a T1 transform.
 */

const T0_STRIP_KEYS = new Set<string>([
  'personaId',
  'persona_id',
  'initiated_by_persona_id',
  'rated_by_persona_id',
  'payee_persona_id',
  'creator_persona_id',
  'steward_persona_id',
  'authProfileId',
  'auth_profile_id',
  'rootDid',
  'root_did',
  'kybeAttestation',
  'kybe_attestation',
  'fioHandle',
  'fio_handle',
  'recipient',
  'recipient_email',
  'recipientEmail',
  'recipient_name',
  'recipientName',
]);

/**
 * T1 transforms — fields kept but value replaced/truncated for receipt safety.
 *   - comment → comment_present bool (training corpus stays in DB, not in receipts)
 *   - error_message → truncate to 200 chars (avoid PII leaking through stack traces)
 *   - description → truncate to 500 chars (avoid pasted-content leaks)
 */
const T1_TRANSFORM: Record<string, (v: unknown, out: Record<string, unknown>) => void> = {
  comment: (v, out) => {
    out.comment_present = v != null && String(v).trim().length > 0;
  },
  comment_text: (v, out) => {
    out.comment_present = v != null && String(v).trim().length > 0;
  },
  error_message: (v, out) => {
    if (v == null) return;
    const s = String(v);
    out.error_message = s.length > 200 ? s.slice(0, 200) + '…' : s;
  },
  description: (v, out) => {
    if (v == null) return;
    const s = String(v);
    out.description = s.length > 500 ? s.slice(0, 500) + '…' : s;
  },
};

const DEFAULT_STRING_TRUNCATE = 500;

export interface SanitizeOptions {
  /**
   * Max length for any string value at any depth. Default 500.
   * Hard cap of 2000 regardless of caller input.
   */
  stringTruncate?: number;
  /**
   * Extra keys to strip beyond the built-in T0 set (caller-specified
   * domain-specific T0 leakage). Case-sensitive.
   */
  extraStripKeys?: string[];
}

/**
 * Sanitize a metadata object for DVN receipt emission. Recursive: nested
 * objects + arrays are walked. Original object is not mutated.
 */
export function sanitizeReceiptMetadata(
  metadata: Record<string, unknown> | null | undefined,
  opts: SanitizeOptions = {},
): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {};
  const stripKeys = new Set([...T0_STRIP_KEYS, ...(opts.extraStripKeys ?? [])]);
  const truncate = Math.min(opts.stringTruncate ?? DEFAULT_STRING_TRUNCATE, 2000);
  return walk(metadata, stripKeys, truncate);
}

function walk(
  obj: Record<string, unknown>,
  stripKeys: Set<string>,
  truncate: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (stripKeys.has(k)) continue;
    const transform = T1_TRANSFORM[k];
    if (transform) {
      transform(v, out);
      continue;
    }
    if (v === null || v === undefined) {
      out[k] = v;
      continue;
    }
    if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? walk(item as Record<string, unknown>, stripKeys, truncate)
          : truncateIfString(item, truncate),
      );
      continue;
    }
    if (typeof v === 'object') {
      out[k] = walk(v as Record<string, unknown>, stripKeys, truncate);
      continue;
    }
    out[k] = truncateIfString(v, truncate);
  }
  return out;
}

function truncateIfString(v: unknown, max: number): unknown {
  if (typeof v !== 'string') return v;
  return v.length > max ? v.slice(0, max) + '…' : v;
}

/**
 * Helper for chain-specific emissions — wraps sanitizeReceiptMetadata with
 * the canonical chain receipt skeleton + the receipt_metadata_keys allowlist
 * from a step definition.
 */
export function buildChainReceiptMetadata(args: {
  chain_id: string;
  template_id: string;
  template_version?: string;
  step_id?: string;
  step_index?: number;
  step_kind?: string;
  actor?: string;
  actor_alias_commitment?: string;
  /** Caller-provided keys (intersected with the step's receipt_metadata_keys). */
  extra?: Record<string, unknown>;
  /** Step's receipt_metadata_keys allowlist (undefined = no filter on extras). */
  receipt_metadata_keys?: string[];
}): Record<string, unknown> {
  const skeleton: Record<string, unknown> = {
    chain_id: args.chain_id,
    template_id: args.template_id,
  };
  if (args.template_version) skeleton.template_version = args.template_version;
  if (args.step_id) skeleton.step_id = args.step_id;
  if (typeof args.step_index === 'number') skeleton.step_index = args.step_index;
  if (args.step_kind) skeleton.step_kind = args.step_kind;
  if (args.actor) skeleton.actor = args.actor;
  if (args.actor_alias_commitment) skeleton.actor_alias_commitment = args.actor_alias_commitment;

  let extras = args.extra ?? {};
  if (args.receipt_metadata_keys && args.receipt_metadata_keys.length > 0) {
    const allowed = new Set(args.receipt_metadata_keys);
    extras = Object.fromEntries(
      Object.entries(extras).filter(([k]) => allowed.has(k)),
    );
  }
  return sanitizeReceiptMetadata({ ...skeleton, ...extras });
}
