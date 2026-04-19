import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getMarketaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: "marketa" } });
}

function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const marketa = getMarketaClient();
  const pub     = getPublicClient();

  const [pendingRes, approvedRes, deliveredRes, rewardsRes] = await Promise.allSettled([
    marketa
      ? marketa.from("packs").select("id", { count: "exact", head: true }).eq("status", "pending_review")
      : Promise.resolve({ count: 0, error: null }),
    marketa
      ? marketa.from("packs").select("id", { count: "exact", head: true }).eq("status", "approved")
      : Promise.resolve({ count: 0, error: null }),
    pub
      ? pub.from("marketa_delivery_logs").select("id", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null }),
    pub
      ? pub.from("marketa_reward_actions").select("amount, reward_type").not("amount", "is", null)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const packsPendingApproval = pendingRes.status === "fulfilled" ? (pendingRes.value.count ?? 0) : 0;
  const packsApproved        = approvedRes.status === "fulfilled" ? (approvedRes.value.count ?? 0) : 0;
  const packsSent            = deliveredRes.status === "fulfilled" ? (deliveredRes.value.count ?? 0) : 0;

  let rewardsKnyt = 0;
  let rewardsQc   = 0;
  if (rewardsRes.status === "fulfilled" && Array.isArray(rewardsRes.value.data)) {
    for (const row of rewardsRes.value.data as Array<{ amount: number; reward_type: string }>) {
      if (row.reward_type === "knyt") rewardsKnyt += row.amount ?? 0;
      else if (row.reward_type === "qcent") rewardsQc += row.amount ?? 0;
    }
  }

  return NextResponse.json({ packsPendingApproval, packsApproved, packsSent, rewardsKnyt, rewardsQc });
}
