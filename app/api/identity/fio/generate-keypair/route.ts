/**
 * POST /api/identity/fio/generate-keypair
 *
 * Generates a FIO key pair server-side. bip39 and FIOSDK use Node.js built-ins
 * that are not available in the browser bundle — this route keeps them server-only.
 */

import { NextResponse } from "next/server";
import { FIOService } from "@/services/identity/fioService";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const keys = await FIOService.generateKeyPair();
    return NextResponse.json(keys);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Key generation failed" },
      { status: 500 }
    );
  }
}
