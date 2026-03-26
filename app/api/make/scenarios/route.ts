import { NextRequest, NextResponse } from "next/server";
import { listMakeScenarios } from "@/services/workflows/adapters/makeAdapter";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId") ?? undefined;

    const scenarios = await listMakeScenarios(teamId);
    return NextResponse.json({ scenarios });
  } catch (err: any) {
    const msg: string = err?.message ?? "Failed to list Make scenarios";
    const status = msg.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
