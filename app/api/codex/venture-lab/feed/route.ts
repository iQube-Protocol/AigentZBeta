/**
 * GET /api/codex/venture-lab/feed
 *
 * Returns a unified agent message feed for the Relationship Builder showcase.
 * Two sources merged by timestamp (newest first):
 *
 *   1. Bridge packets — committed JSON files in docs/qubetalk-bridge/outbox/
 *      These are real Claude→Codex coordination messages; always populated.
 *
 *   2. Live QubeTalk — marketa.marketa_qubetalk_messages via service role
 *      (no persona auth required here — service role bypass).
 *
 * Query params:
 *   thread?  — filter by thread name (dev-exec, spec, api-wiring, etc.)
 *   limit?   — max messages (default 20)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface FeedMessage {
  id: string;
  fromAgent: string;
  fromAgentLabel: string;
  thread: string;
  title: string;
  body: string;
  severity: "info" | "warn" | "blocker";
  source: "bridge" | "live";
  createdAt: string;
  metadata?: Record<string, unknown>;
}

function readBridgePackets(threadFilter?: string): FeedMessage[] {
  const outboxDir = path.join(process.cwd(), "docs", "qubetalk-bridge", "outbox");
  let files: string[] = [];
  try {
    files = fs.readdirSync(outboxDir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const packets: FeedMessage[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(outboxDir, file), "utf-8");
      const packet = JSON.parse(raw) as {
        from_agent?: { id?: string; label?: string } | string;
        thread?: string;
        title?: string;
        body?: string;
        severity?: string;
        metadata?: Record<string, unknown>;
        created_at?: string;
      };

      const thread = packet.thread ?? "dev-exec";
      if (threadFilter && thread !== threadFilter) continue;

      const fromAgent =
        typeof packet.from_agent === "string"
          ? packet.from_agent
          : (packet.from_agent?.id ?? "claude-code");
      const fromAgentLabel =
        typeof packet.from_agent === "object"
          ? (packet.from_agent?.label ?? fromAgent)
          : fromAgent;

      // Derive timestamp from filename (pattern: agent-YYYY-MM-DDTHH-MM-SSZ.json)
      const tsMatch = file.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)/);
      const createdAt = tsMatch
        ? tsMatch[1].replace(/T(\d{2})-(\d{2})-(\d{2})Z/, "T$1:$2:$3Z")
        : packet.created_at ?? new Date(0).toISOString();

      packets.push({
        id: `bridge_${file.replace(".json", "")}`,
        fromAgent,
        fromAgentLabel,
        thread,
        title: packet.title ?? "(untitled)",
        body:  packet.body  ?? "",
        severity: (packet.severity as FeedMessage["severity"]) ?? "info",
        source: "bridge",
        createdAt,
        metadata: packet.metadata,
      });
    } catch {
      // skip malformed packets
    }
  }

  return packets;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const threadFilter = searchParams.get("thread") ?? undefined;
  const limit        = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

  // ── Bridge packets (always available) ────────────────────────────────────────
  const bridgeMessages = readBridgePackets(threadFilter);

  // ── Live QubeTalk messages (best-effort via service role) ─────────────────────
  let liveMessages: FeedMessage[] = [];
  const supabase = getSupabaseServer();
  if (supabase) {
    try {
      let q = supabase
        .schema("marketa")
        .from("marketa_qubetalk_messages")
        .select("message_id, from_agent_id, content, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (threadFilter) {
        q = q.eq("metadata->>thread", threadFilter);
      }

      const { data } = await q;
      if (data) {
        liveMessages = (data as Array<{
          message_id: string;
          from_agent_id: string;
          content: { text?: string; type?: string };
          metadata?: Record<string, unknown>;
          created_at: string;
        }>).map((row) => ({
          id:             `live_${row.message_id}`,
          fromAgent:      row.from_agent_id,
          fromAgentLabel: row.from_agent_id,
          thread:         (row.metadata?.thread as string) ?? "live",
          title:          (row.metadata?.title as string) ?? row.content?.type ?? "message",
          body:           row.content?.text ?? "",
          severity:       "info" as const,
          source:         "live" as const,
          createdAt:      row.created_at,
          metadata:       row.metadata,
        }));
      }
    } catch {
      // marketa schema may not be set up — ignore
    }
  }

  // ── Merge, sort newest first, cap at limit ────────────────────────────────────
  const all = [...liveMessages, ...bridgeMessages].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const feed = all.slice(0, limit);

  return NextResponse.json({
    ok: true,
    data: {
      feed,
      total: feed.length,
      sources: { bridge: bridgeMessages.length, live: liveMessages.length },
    },
  });
}
