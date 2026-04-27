import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const EVM_RE = /^0x[0-9a-fA-F]{40}$/;

function isEvmAddress(val: string): boolean {
  return EVM_RE.test(val);
}

/**
 * GET /api/identity/resolve-recipient?q=<input>
 *
 * Resolves a recipient string to an EVM address for iQube minting.
 * Accepts:
 *   - 0x…          EVM address (pass-through, validated)
 *   - @knyt         Persona shorthand — looks up knyt_handle in persona tables
 *   - @qripto       Persona shorthand — looks up knyt_handle in qripto persona table
 *   - name@domain   Full FIO handle — resolves via FIO service
 *
 * Returns: { resolvedAddress, type, display }
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  if (!q) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  // ── EVM address pass-through ────────────────────────────────────────────────
  if (isEvmAddress(q)) {
    return NextResponse.json({ resolvedAddress: q, type: "evm", display: q });
  }

  // Normalise: strip leading @
  const normalised = q.startsWith("@") ? q.slice(1) : q;

  // ── Persona table lookup (for @knyt, @qripto, or any knyt_handle / fio_handle) ─
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    const sb = createClient(supabaseUrl, serviceKey);

    for (const table of ["nakamoto_knyt_personas", "nakamoto_qripto_personas"] as const) {
      try {
        const { data } = await sb
          .from(table)
          .select("*")
          .or(`knyt_handle.ilike.${normalised},fio_handle.ilike.${normalised}`)
          .limit(1)
          .maybeSingle();

        if (data) {
          const row = data as Record<string, unknown>;
          const evmAddress = row["EVM-Public-Key"] as string | null | undefined;
          const fioHandle = row["fio_handle"] as string | null | undefined;
          if (evmAddress && isEvmAddress(evmAddress)) {
            return NextResponse.json({
              resolvedAddress: evmAddress,
              type: "persona",
              display: `@${normalised}`,
              fioHandle: fioHandle ?? null,
            });
          }
        }
      } catch {
        // continue to next table
      }
    }
  }

  // ── FIO handle (name@domain) — resolve via FIO service ─────────────────────
  if (normalised.includes("@")) {
    try {
      const { getFIOService } = await import("@/services/identity/fioService");
      const fio = getFIOService();
      await fio.initialize({
        endpoint: process.env.FIO_API_ENDPOINT || "https://fio.eosusa.io/v1/",
        chainId: process.env.FIO_CHAIN_ID || "21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c",
      });
      const addresses = await fio.getPublicAddresses(normalised) as Record<string, string>;
      const evmAddress = addresses.ETH || addresses.MATIC || null;
      if (evmAddress && isEvmAddress(evmAddress)) {
        return NextResponse.json({ resolvedAddress: evmAddress, type: "fio", display: normalised });
      }
    } catch {
      // FIO not configured or handle has no EVM address mapped
    }
  }

  return NextResponse.json(
    {
      error: `Cannot resolve "${q}" — enter a 0x EVM address, FIO handle (name@domain), or persona handle (@knyt, @qripto)`,
    },
    { status: 404 },
  );
}
