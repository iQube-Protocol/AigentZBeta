export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

/**
 * Debug endpoint to check if environment variables are loaded
 */
export async function GET(req: NextRequest) {
  // SECURITY (2026-07-30): this endpoint previously returned a 50-character
  // preview of DFX_IDENTITY_PEM (an ICP identity PRIVATE KEY) in a plain HTTP
  // response, with no authentication on the route at all. Reduced to boolean
  // presence checks only -- a length or partial value is never necessary for
  // health monitoring, and is itself a secret-fragment leak. Also never a
  // NEXT_PUBLIC_-prefixed fallback for a credential: see
  // app/api/identity/persona/route.ts for why.
  const envVars = {
    // ICP Identity
    hasDfxIdentityPem: !!process.env.DFX_IDENTITY_PEM,

    // RPC Endpoints
    rpcSepolia: process.env.NEXT_PUBLIC_RPC_SEPOLIA || 'NOT SET',
    rpcEthereumSepolia: process.env.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA || 'NOT SET',
    rpcPolygonAmoy: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY || 'NOT SET',
    rpcBaseSepolia: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'NOT SET',

    // Supabase
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,

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
