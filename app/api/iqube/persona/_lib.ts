/**
 * Shared logic for persona iQube API routes.
 * Handles DB access, field whitelists, shaping, and admin gate.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createCipheriv, createHash, hkdfSync, randomBytes } from "crypto";
import { getEvmKnytBalance } from "@/services/wallet/knyt/evmKnytService";
import { getTxExplorerUrl } from "@/services/chain/mintChains";
import {
  createBlakQube,
  createMetaQube,
  createTokenQube,
  getBlakQube,
  getMetaQube,
  getTokenQube,
  updateBlakQubePayload,
  updateMetaQube,
} from "@/server/services/iqRegistryService";

export type PersonaType = "knyt" | "qripto";

// ─── Supabase client ─────────────────────────────────────────────────────────

export function createServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase configuration missing");
  return createClient(url, key);
}

// ─── Table names ─────────────────────────────────────────────────────────────

export function personaTable(type: PersonaType) {
  return type === "knyt"
    ? "nakamoto_knyt_personas"
    : "nakamoto_qripto_personas";
}

// ─── Admin check ─────────────────────────────────────────────────────────────

export async function isAdminEmail(
  supabase: SupabaseClient,
  email: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("crm_auth_profiles")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) return false;

  const { data: role } = await supabase
    .from("crm_admin_roles")
    .select("id")
    .eq("auth_profile_id", profile.id)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();

  return Boolean(role);
}

// ─── User-editable field whitelists ──────────────────────────────────────────

const KNYT_USER_EDITABLE = new Set([
  "First-Name", "Last-Name", "Email", "Phone-Number", "Age", "Address",
  "Profession", "Local-City", "profile_image_url",
  "EVM-Public-Key", "BTC-Public-Key", "Solana-Public-Key",
  "Wallets-of-Interest", "Tokens-of-Interest", "Web3-Interests",
  "Twitter-Handle", "Telegram-Handle", "Discord-Handle", "Instagram-Handle",
  "YouTube-ID", "Facebook-ID", "TikTok-Handle",
  "Motion-Comics-Owned", "Print-Comics-Owned", "Digital-Comics-Owned",
  "KNYT-Posters-Owned", "Print-Cards-Owned", "Digital-Cards-Owned",
  "Characters-Owned", "print_episodes_owned",
  "preferred_channel_primary", "preferred_channel_secondary",
]);

const QRIPTO_USER_EDITABLE = new Set([
  "First-Name", "Last-Name", "Email", "Profession", "Local-City", "profile_image_url",
  "EVM-Public-Key", "BTC-Public-Key", "Solana-Public-Key",
  "Wallets-of-Interest", "Tokens-of-Interest", "Web3-Interests",
  "Twitter-Handle", "Telegram-Handle", "Discord-Handle", "Instagram-Handle",
  "GitHub-Handle", "YouTube-ID", "Facebook-ID", "TikTok-Handle",
  "preferred_channel_primary", "preferred_channel_secondary",
]);

const KNYT_ADMIN_EDITABLE = new Set([
  ...KNYT_USER_EDITABLE,
  "KNYT-ID", "OM-Member-Since", "OM-Tier-Status", "Metaiye-Shares-Owned",
  "Total-Invested", "investment_amount_band",
  "platform_auth_profile_id",
  "campaign_cohort", "campaign_state", "offer_fit", "message_angle",
  "reactivation_potential", "investor_priority_band",
  "campaign_notes", "campaign_tags",
]);

const QRIPTO_ADMIN_EDITABLE = new Set([
  ...QRIPTO_USER_EDITABLE,
  "Qripto-ID", "investment_amount_band",
  "platform_auth_profile_id",
]);

export function getUserEditableFields(type: PersonaType): Set<string> {
  return type === "knyt" ? KNYT_USER_EDITABLE : QRIPTO_USER_EDITABLE;
}

export function getAdminEditableFields(type: PersonaType): Set<string> {
  return type === "knyt" ? KNYT_ADMIN_EDITABLE : QRIPTO_ADMIN_EDITABLE;
}

// ─── Admin-only fields (never returned to users) ──────────────────────────────

const ADMIN_ONLY_FIELDS = new Set([
  "platform_auth_profile_id",
  "campaign_cohort", "campaign_state", "offer_fit", "message_angle",
  "reactivation_potential", "investor_priority_band",
  "kickstarter_clicked_at", "kickstarter_backed_at",
  "last_campaign_sent_at", "last_campaign_sequence",
  "campaign_notes", "campaign_tags",
]);

// ─── MetaQube scoring config ──────────────────────────────────────────────────

const META_SCORES: Record<PersonaType, {
  sensitivity: number; verifiability: number; accuracy: number; risk: number;
  designer: string; use: string; relatedIQubes: string[];
}> = {
  knyt: {
    sensitivity: 7, verifiability: 8, accuracy: 8, risk: 6.5,
    designer: "KNYT Ecosystem",
    use: "KNYT ecosystem profile management, reward tracking, and cartridge access gating",
    relatedIQubes: ["QriptoPersona", "MetisQube", "EcosystemQube"],
  },
  qripto: {
    sensitivity: 6, verifiability: 7, accuracy: 8, risk: 5,
    designer: "Aigent",
    use: "Personalized cryptocurrency recommendations, portfolio analysis, and cartridge access gating",
    relatedIQubes: ["MetisQube", "VeniceQube", "WalletQube"],
  },
};

// ─── Shape row into iQube subdivisions ───────────────────────────────────────

export function shapeAsIQube(
  row: Record<string, unknown>,
  type: PersonaType,
  forAdmin: boolean
) {
  const scores = META_SCORES[type];

  // Resolve the canonical FIO/persona handle.
  // FIO handles ARE the persona ID on the FIO protocol (e.g. qryptiq@knyt, qryptiq@qripto).
  // fio_handle and knyt_handle are the same concept — a FIO handle whose domain is the
  // persona brand. Fall back to KNYT-ID / Qripto-ID as the DB source of truth.
  const personaHandle =
    (typeof row.fio_handle === "string" && row.fio_handle ? row.fio_handle : null) ||
    (typeof row.knyt_handle === "string" && row.knyt_handle ? row.knyt_handle : null) ||
    (typeof row["KNYT-ID"] === "string" && row["KNYT-ID"] ? row["KNYT-ID"] : null) ||
    (typeof row["Qripto-ID"] === "string" && row["Qripto-ID"] ? row["Qripto-ID"] : null) ||
    null;

  // metaQube — public provenance, non-PII, single canonical field set (no duplicates)
  const metaQube = {
    "iQube-Identifier": type === "knyt" ? "KNYT Persona iQube" : "Qripto Persona iQube",
    "iQube-Type": "DataQube",
    ownerType: "Individual",
    ownerIdentifiability: "Semi-Identifiable",
    contentType: "Data",
    creator: scores.designer,
    transactionDate: row.created_at ?? null,
    description: scores.use,
    relatedIQubes: scores.relatedIQubes,
    // Scores (0–10) — single occurrence only
    sensitivity: scores.sensitivity,
    verifiable: scores.verifiability,
    accuracy: scores.accuracy,
    risk: scores.risk,
    persona_type: type,
  };

  // blakQube — private payload; strip admin-only fields for non-admins
  const blakQube: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!forAdmin && ADMIN_ONLY_FIELDS.has(k)) continue;
    // Strip internal DB fields
    if (k === "id" || k === "user_id") continue;
    blakQube[k] = v;
  }

  // tokenQube — wallet binding + mint status
  const evmAddress =
    typeof row["EVM-Public-Key"] === "string" ? row["EVM-Public-Key"] : null;
  const tokenQube = {
    ownerType: "Person",
    settlementNetwork: "Base Sepolia (chainId 84532)",
    walletRequired: !evmAddress,
    evmAddress,
    personaHandle,            // canonical FIO handle (single authoritative field)
    fioHandle: personaHandle, // backward-compat alias
    knytHandle: personaHandle, // backward-compat alias
    mintStatus: row._mintStatus ?? "unminted",
  };

  return { metaQube, blakQube, tokenQube, _id: row.id };
}

// ─── KNYT balance refresh (side-effect, non-blocking) ────────────────────────

export async function refreshKnytBalance(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<void> {
  const evmAddress =
    typeof row["EVM-Public-Key"] === "string" && row["EVM-Public-Key"].trim()
      ? row["EVM-Public-Key"].trim()
      : null;
  if (!evmAddress || !row.id) return;

  try {
    const balance = await getEvmKnytBalance(evmAddress);
    if (!balance) return;
    await supabase
      .from("nakamoto_knyt_personas")
      .update({
        "KNYT-COYN-Owned": balance.balanceFormatted,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id as string);
  } catch {
    // Non-fatal — balance will refresh on next load
  }
}

// ─── Filter a patch body to allowed keys ─────────────────────────────────────

export function filterPatch(
  body: Record<string, unknown>,
  allowed: Set<string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

// ─── Persona iQube staging (trinity + encryption + Auto Drive) ────────────────
//
// Staging turns a persona row into the canonical iQube trinity:
//
//   iq_meta_qubes   public provenance (no PII)      → the on-chain metaIdentifier
//   iq_blak_qubes   encrypted payload pointer       → Autonomys CID (or Supabase)
//   iq_token_qubes  wrapped content key             → receives the chain anchor
//
// The trinity ids are what POST /api/core/mint-tokenqube needs: `metaIdentifier`
// is the MetaQube id, `tokenQubeId` is the TokenQube row that
// updateTokenQubeChainAnchor() writes chain_token_id/chain_tx_hash back into.
//
// Staging is idempotent per (user, persona type) — a persona has ONE iQube
// identity, re-staged in place when its blakQube changes.

const PERSONA_HKDF_INFO = "aigentz-persona-iqube-v1";

/**
 * Encode bytes for a Postgres `bytea` column over PostgREST, which expects the
 * `\x<hex>` literal form. supabase-js JSON-serialises a Buffer to
 * `{"type":"Buffer","data":[…]}`, which Postgres stores as the literal text of
 * that object — silently unrecoverable ciphertext.
 */
function toByteaLiteral(buf: Buffer): string {
  return `\\x${buf.toString("hex")}`;
}

/** Commitment over a T0 identifier — the only form that reaches a public row. */
function commitment(namespace: string, value: string): string {
  return createHash("sha256").update(`${namespace}:${value}`).digest("hex").slice(0, 16);
}

/**
 * Master wrapping key. The zero-key dev fallback is flagged all the way out to
 * the response so an operator never mistakes dev ciphertext for real custody.
 */
function getMasterKey(): { key: Buffer; usingDevKey: boolean } {
  const keyHex = process.env.PERSONA_IQUBE_ENCRYPTION_KEY;
  if (keyHex && keyHex.length === 64) {
    return { key: Buffer.from(keyHex, "hex"), usingDevKey: false };
  }
  return { key: Buffer.alloc(32, 0), usingDevKey: true };
}

/**
 * Per-persona content key. Derived, never stored in plaintext — invariant 3
 * ("key never leaves the process"): it exists only inside this call's frame and
 * is persisted solely as ciphertext wrapped under the master.
 */
function deriveContentKey(master: Buffer, scope: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", master, Buffer.from(scope, "utf8"), PERSONA_HKDF_INFO, 32)
  );
}

/** Wrap the content key under the master → `iv.authTag.ciphertext`, all base64. */
function wrapContentKey(master: Buffer, contentKey: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", master, iv);
  const wrapped = Buffer.concat([cipher.update(contentKey), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    wrapped.toString("base64"),
  ].join(".");
}

/**
 * Upload ciphertext to Autonomys Auto Drive. Returns null when
 * AUTONOMYS_API_KEY is unset or the upload fails — the caller falls back to the
 * Supabase-held copy so staging still yields a usable BlakQube pointer.
 */
async function uploadCiphertextToAutoDrive(
  ciphertext: Buffer,
  filename: string
): Promise<string | null> {
  const apiKey = process.env.AUTONOMYS_API_KEY;
  if (!apiKey) return null;
  try {
    const { createAutoDriveApi } = await import("@autonomys/auto-drive");
    const { NetworkId } = await import("@autonomys/auto-utils");
    const api = createAutoDriveApi({ apiKey, network: NetworkId.MAINNET });
    const cid = await api.uploadFileFromBuffer(ciphertext, filename);
    return String(cid);
  } catch (err) {
    // Non-fatal: the encrypted payload is still held in Supabase, so the
    // persona can be minted and re-anchored to Auto Drive later.
    console.error("[persona iqube stage] Auto Drive upload failed", err);
    return null;
  }
}

// ─── Caller resolution ────────────────────────────────────────────────────────

function createAuthClient(authHeader: string | null): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase configuration missing");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? anon;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export interface PersonaCaller {
  userId: string;
  row: Record<string, unknown>;
}

/**
 * Resolve the calling user and their persona row. Mirrors the GET route's
 * lookup: user_id first, then the CRM email fallback for personas imported
 * before the platform account existed.
 */
export async function resolvePersonaCaller(
  request: Request,
  type: PersonaType
): Promise<{ caller: PersonaCaller } | { error: string; status: number }> {
  const supabase = createAuthClient(request.headers.get("Authorization"));
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: "Unauthorized", status: 401 };

  const { data: row, error: fetchErr } = await supabase
    .from(personaTable(type))
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr.message, status: 500 };

  let resolvedRow = row;
  if (!resolvedRow && user.email) {
    const service = createServerClient();
    const { data: crmRow } = await service
      .from(personaTable(type))
      .select("*")
      .ilike("Email", user.email)
      .maybeSingle();
    if (crmRow) resolvedRow = crmRow;
  }

  if (!resolvedRow) {
    const label = type === "knyt" ? "KNYT" : "Qripto";
    return { error: `No ${label} persona found`, status: 404 };
  }

  return { caller: { userId: user.id, row: resolvedRow as Record<string, unknown> } };
}

/** The persona's own connected wallet — the mint recipient, never the deployer. */
export function personaWalletAddress(row: Record<string, unknown>): string | null {
  const raw = row["EVM-Public-Key"];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed) ? trimmed : null;
}

// ─── Trinity shape returned to the drawer ─────────────────────────────────────

export interface PersonaTrinityView {
  stubId: string;
  status: string;
  metaQubeId: string;
  blakQubeId: string;
  tokenQubeId: string;
  /** Registry MetaQube row (iq_meta_qubes) — what the metaQube tab renders. */
  metaQube: Record<string, unknown> | null;
  /** BlakQube pointer + cipher parameters. Never the plaintext, never the key. */
  blakQube: {
    payloadPointer: string;
    payloadProvider: string;
    payloadType: string;
    payloadSize: number | null;
    encryptionAlg: string;
    checksum: string | null;
    autonomysCid: string | null;
  } | null;
  /** On-chain anchor, present once the TokenQube has been minted. */
  chainAnchor: {
    chainTokenId: number | null;
    chainId: number | null;
    chainTxHash: string | null;
    chainMinter: string | null;
    /** Built server-side from the anchor's own chainId — never in the client. */
    explorerUrl: string | null;
  } | null;
  /** The persona's connected wallet — the default mint recipient. */
  recipientAddress: string | null;
  usingDevKey: boolean;
}

function projectTrinity(
  stub: Record<string, unknown>,
  meta: Awaited<ReturnType<typeof getMetaQube>>,
  blak: Awaited<ReturnType<typeof getBlakQube>>,
  token: Awaited<ReturnType<typeof getTokenQube>>,
  recipientAddress: string | null,
  usingDevKey: boolean
): PersonaTrinityView {
  return {
    stubId: String(stub.id),
    status: String(stub.status ?? "staged"),
    metaQubeId: String(stub.meta_qube_id ?? ""),
    blakQubeId: String(stub.blak_qube_id ?? ""),
    tokenQubeId: String(stub.token_qube_id ?? ""),
    metaQube: meta
      ? {
          id: meta.id,
          name: meta.name,
          slug: meta.slug,
          qube_type: meta.qube_type,
          series: meta.series ?? null,
          tags: meta.tags ?? [],
          description: meta.description ?? null,
          created_at: meta.created_at,
          updated_at: meta.updated_at,
          ...(meta.metadata ?? {}),
        }
      : null,
    blakQube: blak
      ? {
          payloadPointer: blak.payload_pointer,
          payloadProvider: blak.payload_provider,
          payloadType: blak.payload_type,
          payloadSize: blak.payload_size ?? null,
          encryptionAlg: blak.encryption_alg,
          checksum: blak.checksum ?? null,
          autonomysCid: (stub.autonomys_cid as string | null) ?? null,
        }
      : null,
    chainAnchor: token
      ? {
          chainTokenId: token.chain_token_id ?? null,
          chainId: token.chain_id ?? null,
          chainTxHash: token.chain_tx_hash ?? null,
          chainMinter: token.chain_minter ?? null,
          explorerUrl:
            token.chain_id && token.chain_tx_hash
              ? getTxExplorerUrl(token.chain_id, token.chain_tx_hash)
              : null,
        }
      : null,
    recipientAddress,
    usingDevKey,
  };
}

/**
 * Read the persona's current trinity without staging. Returns null when the
 * persona has never been staged, so the drawer can render "not staged yet"
 * instead of silently minting on a read.
 */
export async function readPersonaTrinity(
  caller: PersonaCaller,
  type: PersonaType
): Promise<PersonaTrinityView | null> {
  const service = createServerClient();
  const { data: stub } = await service
    .from("iqube_mint_stubs")
    .select("*")
    .eq("user_id", caller.userId)
    .eq("iqube_type", `${type}_persona`)
    .maybeSingle();

  if (!stub?.meta_qube_id) return null;

  const [meta, blak, token] = await Promise.all([
    getMetaQube(String(stub.meta_qube_id)),
    stub.blak_qube_id ? getBlakQube(String(stub.blak_qube_id)) : Promise.resolve(null),
    stub.token_qube_id ? getTokenQube(String(stub.token_qube_id)) : Promise.resolve(null),
  ]);

  return projectTrinity(
    stub as Record<string, unknown>,
    meta,
    blak,
    token,
    personaWalletAddress(caller.row),
    !process.env.PERSONA_IQUBE_ENCRYPTION_KEY
  );
}

/**
 * Stage the persona iQube: encrypt the blakQube, push the ciphertext to Auto
 * Drive, and create (or refresh) the trinity registry rows.
 *
 * Idempotent — the same persona keeps the same MetaQube/TokenQube ids across
 * re-stages, so a re-mint anchors to the identity that already exists rather
 * than minting a second iQube for the same subject.
 */
export async function stagePersonaIQube(
  caller: PersonaCaller,
  type: PersonaType
): Promise<PersonaTrinityView> {
  const service = createServerClient();
  const iqubeType = `${type}_persona`;
  const shaped = shapeAsIQube(caller.row, type, false);

  // Encrypt the blakQube under a key derived for this persona alone.
  const { key: master, usingDevKey } = getMasterKey();
  const scope = `${iqubeType}:${caller.userId}`;
  const contentKey = deriveContentKey(master, scope);
  const iv = randomBytes(12); // GCM 96-bit IV
  const cipher = createCipheriv("aes-256-gcm", contentKey, iv);
  const plaintext = Buffer.from(JSON.stringify(shaped.blakQube), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const checksum = createHash("sha256").update(ciphertext).digest("hex");
  const keyCiphertext = wrapContentKey(master, contentKey);
  contentKey.fill(0); // key never outlives this frame

  // Commitment, not the user id — the MetaQube slug is a public row.
  const subjectRef = commitment("iqube:persona", scope);

  const cid = await uploadCiphertextToAutoDrive(
    ciphertext,
    `persona-${type}-${subjectRef}.enc`
  );
  const payloadPointer = cid ?? `supabase:iqube_mint_stubs/${subjectRef}`;

  // Reuse the existing trinity when this persona has already been staged.
  const { data: existing } = await service
    .from("iqube_mint_stubs")
    .select("id, meta_qube_id, blak_qube_id, token_qube_id")
    .eq("user_id", caller.userId)
    .eq("iqube_type", iqubeType)
    .maybeSingle();

  const displayName =
    type === "knyt" ? "KNYT Persona iQube" : "Qripto Persona iQube";

  let metaQubeId = (existing?.meta_qube_id as string | null) ?? null;
  if (metaQubeId) {
    await updateMetaQube(metaQubeId, { metadata: shaped.metaQube });
  } else {
    metaQubeId = await createMetaQube({
      name: `${displayName} ${subjectRef}`,
      slug: `persona-${type}-${subjectRef}`,
      qubeType: "DataQube",
      tags: ["persona", type],
      description: String(shaped.metaQube.description ?? displayName),
      metadata: shaped.metaQube,
    });
  }

  let blakQubeId = (existing?.blak_qube_id as string | null) ?? null;
  const blakParams = {
    cid: payloadPointer,
    payloadType: "application/json",
    provider: (cid ? "autonomys" : "supabase") as "autonomys" | "supabase",
    encryptionAlg: "AES-256-GCM",
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    size: ciphertext.length,
    checksum,
  };
  if (blakQubeId) {
    await updateBlakQubePayload(blakQubeId, blakParams);
  } else {
    blakQubeId = await createBlakQube(blakParams);
  }

  // The TokenQube's wrapped key is stable across re-stages (same derivation),
  // so it is written once and thereafter carries the chain anchor.
  let tokenQubeId = (existing?.token_qube_id as string | null) ?? null;
  if (!tokenQubeId) {
    tokenQubeId = await createTokenQube({
      keyCiphertext,
      wrappingAlg: "AES-256-GCM",
      keyType: "AES-256",
      accessPolicy: { subject_ref: subjectRef, persona_type: type },
    });
  }

  const now = new Date().toISOString();
  const { data: stub, error: stubErr } = await service
    .from("iqube_mint_stubs")
    .upsert(
      {
        user_id: caller.userId,
        iqube_type: iqubeType,
        metaqube_payload: shaped.metaQube,
        // bytea over PostgREST takes the `\x<hex>` literal. A raw Buffer
        // serialises to {"type":"Buffer","data":[…]} and lands as garbage.
        blakqube_ciphertext: toByteaLiteral(ciphertext),
        blakqube_iv: toByteaLiteral(iv),
        blakqube_auth_tag: toByteaLiteral(authTag),
        autonomys_cid: cid,
        meta_qube_id: metaQubeId,
        blak_qube_id: blakQubeId,
        token_qube_id: tokenQubeId,
        status: "staged",
        updated_at: now,
        ...(existing ? {} : { created_at: now }),
      },
      { onConflict: "user_id,iqube_type" }
    )
    .select("*")
    .single();

  if (stubErr) throw new Error(stubErr.message);

  const [meta, blak, token] = await Promise.all([
    getMetaQube(metaQubeId),
    getBlakQube(blakQubeId),
    getTokenQube(tokenQubeId),
  ]);

  return projectTrinity(
    stub as Record<string, unknown>,
    meta,
    blak,
    token,
    personaWalletAddress(caller.row),
    usingDevKey
  );
}
