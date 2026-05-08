import { NextRequest, NextResponse } from "next/server";
import { getShellConfigPayload } from "../../v1/runtime/_lib/runtimeShell";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json(await getShellConfigPayload(request));
}

