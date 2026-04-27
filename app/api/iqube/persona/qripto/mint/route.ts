/**
 * POST /api/iqube/persona/qripto/mint
 *
 * Stages a Qripto Persona iQube for on-chain minting.
 * TODO: wire PERSONA_IQUBE_ENCRYPTION_KEY to FIO handle PPK for production.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, randomBytes } from "crypto";
import { shapeAsIQube, personaTable, createServerClient } from "../../_lib";

export const dynamic = "force-dynamic";

function getDevEncryptionKey(): Buffer {
  const keyHex = process.env.PERSONA_IQUBE_ENCRYPTION_KEY;
  if (keyHex && keyHex.length === 64) return Buffer.from(keyHex, "hex");
  return Buffer.alloc(32, 0);
}

function createAuthClient(authHeader: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase configuration missing");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? anon;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAuthClient(request.headers.get("Authorization"));
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: row, error: fetchErr } = await supabase
      .from(personaTable("qripto"))
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    // CRM email fallback: same as GET — if no user_id match, find by email
    let resolvedRow = row;
    if (!resolvedRow && user.email) {
      const service = createServerClient();
      const { data: crmRow } = await service
        .from(personaTable("qripto"))
        .select("*")
        .ilike("Email", user.email)
        .maybeSingle();
      if (crmRow) resolvedRow = crmRow;
    }

    if (!resolvedRow) return NextResponse.json({ error: "No Qripto persona found" }, { status: 404 });

    const shaped = shapeAsIQube(resolvedRow as Record<string, unknown>, "qripto", false);

    const key = getDevEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify(shaped.blakQube), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    const { data: stub, error: stubErr } = await supabase
      .from("iqube_mint_stubs")
      .insert({
        user_id: (resolvedRow as Record<string, unknown>).user_id ?? user.id,
        iqube_type: "qripto_persona",
        metaqube_payload: shaped.metaQube,
        blakqube_ciphertext: ciphertext,
        blakqube_iv: iv,
        status: "staged",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (stubErr) return NextResponse.json({ error: stubErr.message }, { status: 500 });

    const usingDevKey = !process.env.PERSONA_IQUBE_ENCRYPTION_KEY;

    return NextResponse.json({
      stub_id: stub.id,
      status: "staged",
      metaQube: shaped.metaQube,
      message: "Qripto Persona iQube staged for minting. Autonomys/chain write pending.",
      _devMode: usingDevKey
        ? "WARNING: using dev zero-key. Set PERSONA_IQUBE_ENCRYPTION_KEY for production."
        : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
