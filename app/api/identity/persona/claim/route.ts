/**
 * POST /api/identity/persona/claim
 *
 * Claims an unclaimed persona (auth_profile_id = null) by FIO handle.
 * The caller must be authenticated. Proof of ownership is the FIO private key:
 * the client signs a server-issued nonce and we verify against fio_public_key.
 *
 * For MVP we accept the claim if the persona is unclaimed AND the caller supplies
 * the correct private key (verified by re-deriving the public key server-side).
 * A cryptographic challenge-response can replace this in production.
 *
 * Body: { fioHandle: string; privateKey: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getCallerUserId(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get("Authorization") || request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const anon = createClient(supabaseUrl, anonKey);
    const { data } = await anon.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch { return null; }
}

async function derivePublicKeyFromPrivate(privateKey: string): Promise<string | null> {
  try {
    const { FIOSDK } = await import("@fioprotocol/fiosdk");
    const result = FIOSDK.derivedPublicKey(privateKey);
    return result.publicKey ?? null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCallerUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as { fioHandle?: string; privateKey?: string };
    const { fioHandle, privateKey } = body;

    if (!fioHandle || !privateKey) {
      return NextResponse.json(
        { error: "fioHandle and privateKey are required" },
        { status: 400 }
      );
    }

    const service = createClient(supabaseUrl, serviceKey);

    // Find persona by FIO handle
    const { data: persona, error: fetchErr } = await service
      .from("personas")
      .select("id, fio_handle, fio_public_key, auth_profile_id, status")
      .ilike("fio_handle", fioHandle.toLowerCase())
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!persona) {
      return NextResponse.json({ error: "Persona not found for this FIO handle" }, { status: 404 });
    }

    const row = persona as Record<string, unknown>;

    // Already claimed by this user — idempotent
    if (row.auth_profile_id === userId) {
      return NextResponse.json({ ok: true, personaId: row.id, alreadyOwned: true });
    }

    // Claimed by someone else — reject
    if (row.auth_profile_id && row.auth_profile_id !== userId) {
      return NextResponse.json(
        { error: "This persona is already claimed by another account" },
        { status: 409 }
      );
    }

    // Unclaimed — verify ownership via private key → public key derivation
    const derivedPublicKey = await derivePublicKeyFromPrivate(privateKey);
    if (!derivedPublicKey) {
      return NextResponse.json(
        { error: "Could not derive public key from the provided private key" },
        { status: 400 }
      );
    }

    if (derivedPublicKey !== row.fio_public_key) {
      return NextResponse.json(
        { error: "Private key does not match this persona's public key" },
        { status: 403 }
      );
    }

    // Claim it
    const { error: updateErr } = await service
      .from("personas")
      .update({ auth_profile_id: userId, updated_at: new Date().toISOString() })
      .eq("id", String(row.id));

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, personaId: row.id, claimed: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
