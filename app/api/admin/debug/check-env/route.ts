export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

/**
 * Debug endpoint to check if environment variables are loaded
 */
export async function GET(req: NextRequest) {
  const envVars = {
    // ICP Identity
    hasDfxIdentityPem: !!(process.env.DFX_IDENTITY_PEM || process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM),
    dfxIdentityPemLength: (process.env.DFX_IDENTITY_PEM || process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM || '').length,
    dfxIdentityPemPreview: (process.env.DFX_IDENTITY_PEM || process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM || '').substring(0, 50) + '...',
    
    // RPC Endpoints
    rpcSepolia: process.env.NEXT_PUBLIC_RPC_SEPOLIA || 'NOT SET',
    rpcEthereumSepolia: process.env.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA || 'NOT SET',
    rpcPolygonAmoy: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY || 'NOT SET',
    rpcBaseSepolia: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'NOT SET',
    
    // Supabase
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseServiceKey: !!(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
    
    // ICP Canister IDs
    dvnCanisterId: process.env.DVN_CANISTER_ID || process.env.NEXT_PUBLIC_DVN_CANISTER_ID || 'NOT SET',
    rqhCanisterId: process.env.RQH_CANISTER_ID || process.env.NEXT_PUBLIC_RQH_CANISTER_ID || 'NOT SET',
    
    // Node environment
    nodeEnv: process.env.NODE_ENV,
    
    // Timestamp
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(envVars, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
