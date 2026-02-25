import { NextRequest, NextResponse } from "next/server";
import { postMenuActionPayload } from "../../v1/runtime/_lib/runtimeShell";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const result = postMenuActionPayload(request, body);
  return NextResponse.json(result.body, { status: result.status });
}

