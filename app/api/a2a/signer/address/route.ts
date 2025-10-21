export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { AgentKeyService } from "@/services/identity/agentKeyService";

export async function GET(req: NextRequest) {
  try {
    // Get agentId from query params, default to aigent-z
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId') || 'aigent-z';
    
    // Get agent private key from Supabase
    const keyService = new AgentKeyService();
    const agentKeys = await keyService.getAgentKeys(agentId);
    
    if (!agentKeys?.evmPrivateKey) {
      return new Response(JSON.stringify({ ok: false, error: "Agent private key not found" }), { status: 500, headers: { "content-type": "application/json" } });
    }
    
    const { ethers } = await import("ethers");
    const wallet = new ethers.Wallet(agentKeys.evmPrivateKey);
    return new Response(JSON.stringify({ ok: true, address: wallet.address, agentId }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
