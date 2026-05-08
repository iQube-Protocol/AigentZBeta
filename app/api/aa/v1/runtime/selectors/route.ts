import { NextRequest, NextResponse } from "next/server";
import { postSelectorsPayload } from "../_lib/runtimeShell";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return NextResponse.json(await postSelectorsPayload(request, body));
}

