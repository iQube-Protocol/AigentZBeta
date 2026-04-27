/**
 * POST /api/identity/root-did/bind
 *
 * Binds the authenticated user's auth.uid() to a Root DID, then discovers and
 * links all matching Persona rows (knyt + qripto) via user_id or email fallback.
 *
 * Safe to call on every login — fully idempotent. If the root_identity already
 * exists for this auth_user_id it is returned as-is; persona rows are re-scanned
 * and any newly discovered matches are stamped.
 *
 * GET /api/identity/root-did/bind
 *
 * Returns the current user's root DID and their bound persona list.
 * Returns { rootDid: null, personas: [] } when no binding exists yet (not an error).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// ─── Supabase clients ─────────────────────────────────────────────────────────

function createAuthClient(authHeader: string | null): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase configuration missing");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? anon;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Service role key missing");
  return createClient(url, key);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PersonaType = "knyt" | "qripto";

interface PersonaBinding {
  personaType: PersonaType;
  payloadRowId: string;
  didPersonaId: string;
  fioHandle: string | null;
  evmAddress: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function personaTable(type: PersonaType): string {
  return type === "knyt" ? "nakamoto_knyt_personas" : "nakamoto_qripto_personas";
}

function extractHandle(row: Record<string, unknown>): string | null {
  for (const key of ["fio_handle", "knyt_handle", "KNYT-ID", "Qripto-ID"]) {
    if (typeof row[key] === "string" && row[key]) return row[key] as string;
  }
  return null;
}

/**
 * Find a payload row for the given persona type matched by user_id first,
 * then email fallback. Returns null if nothing found.
 */
async function findPayloadRow(
  service: SupabaseClient,
  type: PersonaType,
  userId: string,
  email: string | null
): Promise<Record<string, unknown> | null> {
  const table = personaTable(type);

  const { data: byUserId } = await service
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (byUserId) return byUserId as Record<string, unknown>;

  if (email) {
    const { data: byEmail } = await service
      .from(table)
      .select("*")
      .ilike("Email", email)
      .maybeSingle();
    if (byEmail) return byEmail as Record<string, unknown>;
  }

  return null;
}

/**
 * Find or create a DiDQube `persona` row for a given payload row.
 * If one already exists (matched by payload_row_id), return it.
 */
async function upsertPersonaDid(
  service: SupabaseClient,
  rootId: string,
  type: PersonaType,
  payloadRowId: string,
  fioHandle: string | null
): Promise<string> {
  // Check if already bound
  const { data: existing } = await service
    .from("did_persona")
    .select("id")
    .eq("payload_row_id", payloadRowId)
    .eq("persona_type", type)
    .maybeSingle();

  if (existing) return (existing as Record<string, unknown>).id as string;

  // Create new persona DID row
  const { data: created, error } = await service
    .from("did_persona")
    .insert({
      root_id: rootId,
      persona_type: type,
      payload_row_id: payloadRowId,
      fio_handle: fioHandle,
      default_identity_state: "semi_identifiable",
      app_origin: "aigentzbeta",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create persona DID: ${error.message}`);
  return (created as Record<string, unknown>).id as string;
}

/**
 * Stamp did_persona_id and user_id (if missing) back onto the payload row.
 */
async function stampPayloadRow(
  service: SupabaseClient,
  type: PersonaType,
  payloadRowId: string,
  didPersonaId: string,
  userId: string
): Promise<void> {
  const table = personaTable(type);
  const patch: Record<string, unknown> = {
    did_persona_id: didPersonaId,
    updated_at: new Date().toISOString(),
  };

  // Fetch current row to check if user_id is already set
  const { data: current } = await service
    .from(table)
    .select("user_id")
    .eq("id", payloadRowId)
    .maybeSingle();

  const currentUserId = (current as Record<string, unknown> | null)?.user_id;
  if (!currentUserId) patch.user_id = userId;

  await service.from(table).update(patch).eq("id", payloadRowId);
}

// ─── GET — return current binding ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthClient(request.headers.get("Authorization"));
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceClient();

    const { data: root } = await service
      .from("root_identity")
      .select("id, did_uri, display_name, primary_email, kyc_status, created_at")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!root) {
      return NextResponse.json({ rootDid: null, personas: [] });
    }

    const rootRow = root as Record<string, unknown>;

    // Load bound personas
    const { data: personaRows } = await service
      .from("did_persona")
      .select("id, persona_type, payload_row_id, fio_handle")
      .eq("root_id", rootRow.id as string);

    const personas = (personaRows ?? []).map((p) => {
      const pr = p as Record<string, unknown>;
      return {
        didPersonaId: pr.id,
        personaType: pr.persona_type,
        payloadRowId: pr.payload_row_id,
        fioHandle: pr.fio_handle ?? null,
      };
    });

    return NextResponse.json({
      rootDid: rootRow.did_uri,
      rootId: rootRow.id,
      displayName: rootRow.display_name ?? null,
      primaryEmail: rootRow.primary_email ?? null,
      kycStatus: rootRow.kyc_status ?? "unverified",
      createdAt: rootRow.created_at,
      personas,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ─── POST — bind / sync ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = createAuthClient(request.headers.get("Authorization"));
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceClient();

    // ── 1. Find or create root_identity for this auth user ──────────────────
    let rootId: string;
    let rootDidUri: string;
    let isNew = false;

    const { data: existingRoot } = await service
      .from("root_identity")
      .select("id, did_uri")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (existingRoot) {
      const er = existingRoot as Record<string, unknown>;
      rootId = er.id as string;
      rootDidUri = er.did_uri as string;
    } else {
      // Generate Root DID URI from auth user id — deterministic, stable
      rootDidUri = `did:root:${user.id}`;

      // Resolve dev kybe stub id
      const { data: kybeStub } = await service
        .from("kybe_identity")
        .select("id")
        .eq("kybe_did", "did:kybe:dev:stub:v1")
        .maybeSingle();

      const kybeId = kybeStub ? (kybeStub as Record<string, unknown>).id as string : null;

      const { data: newRoot, error: rootErr } = await service
        .from("root_identity")
        .insert({
          auth_user_id: user.id,
          did_uri: rootDidUri,
          kybe_id: kybeId,
          kybe_hash: kybeId ? `dev:stub:${user.id}` : null,
          primary_email: user.email ?? null,
          display_name: user.user_metadata?.full_name ?? null,
          kyc_status: "unverified",
        })
        .select("id")
        .single();

      if (rootErr) {
        // Race condition — another request may have created it; retry fetch
        const { data: retryRoot } = await service
          .from("root_identity")
          .select("id, did_uri")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (!retryRoot) {
          return NextResponse.json(
            { error: `Failed to create root identity: ${rootErr.message}` },
            { status: 500 }
          );
        }
        const rr = retryRoot as Record<string, unknown>;
        rootId = rr.id as string;
        rootDidUri = rr.did_uri as string;
      } else {
        rootId = (newRoot as Record<string, unknown>).id as string;
        isNew = true;
      }
    }

    // ── 2. Discover and bind persona rows ────────────────────────────────────
    const bindings: PersonaBinding[] = [];
    const personaTypes: PersonaType[] = ["knyt", "qripto"];

    for (const type of personaTypes) {
      const payloadRow = await findPayloadRow(service, type, user.id, user.email ?? null);
      if (!payloadRow) continue;

      const payloadRowId = payloadRow.id as string;
      const fioHandle = extractHandle(payloadRow);
      const evmAddress =
        typeof payloadRow["EVM-Public-Key"] === "string" ? payloadRow["EVM-Public-Key"] : null;

      const didPersonaId = await upsertPersonaDid(
        service, rootId, type, payloadRowId, fioHandle
      );

      await stampPayloadRow(service, type, payloadRowId, didPersonaId, user.id);

      bindings.push({ personaType: type, payloadRowId, didPersonaId, fioHandle, evmAddress });
    }

    return NextResponse.json({
      rootDid: rootDidUri,
      rootId,
      isNew,
      personas: bindings,
      message: isNew
        ? "Root DID created and personas bound."
        : `Root DID exists — synced ${bindings.length} persona(s).`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
