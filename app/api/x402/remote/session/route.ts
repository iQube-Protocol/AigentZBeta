export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

type RemoteSession = {
  id: string;
  did: string;
  persona: string;
  createdAt: number;
  expiresAt: number;
  caps: string[];
  status: "active" | "expired" | "revoked" | "completed";
};

const SESSIONS = new Map<string, RemoteSession>();

function createSession(args: { did: string; persona: string; ttlSec?: number; caps?: string[] }): RemoteSession {
  const id = `rc_${crypto.randomUUID()}`;
  const now = Date.now();
  const ttl = (args.ttlSec ?? 900) * 1000;
  const session: RemoteSession = {
    id,
    did: args.did,
    persona: args.persona,
    createdAt: now,
    expiresAt: now + ttl,
    caps: args.caps ?? [],
    status: "active",
  };
  SESSIONS.set(id, session);
  return session;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ttlSec = typeof body?.ttlSec === "number" ? body.ttlSec : 900;
    const caps = Array.isArray(body?.caps) ? body.caps : [];
    const persona =
      req.headers.get("x-persona-id") ||
      req.headers.get("x-identity-persona") ||
      "anonymous";
    const did =
      req.headers.get("x-identity-did") ||
      req.headers.get("x-did") ||
      (persona && persona !== "anonymous" ? `did:iq:${persona}` : "did:iq:anonymous");

    const session = createSession({ did, persona, ttlSec, caps });

    return NextResponse.json({
      sessionId: session.id,
      did: session.did,
      persona: session.persona,
      expiresIn: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "method_not_allowed", hint: "Use POST /api/x402/remote/session" },
    { status: 405 }
  );
}
