export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

/**
 * Debug endpoint to check critical environment variables
 * Helps diagnose A2A transaction failures
 */
export async function GET(req: NextRequest) {
  const envCheck = {
    // Supabase
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    
    // Agent Keys
    AGENT_KEY_ENCRYPTION_SECRET: !!process.env.AGENT_KEY_ENCRYPTION_SECRET,
    NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET: !!process.env.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET,
    
    // Treasury & Signer
    TREASURY_PRIVATE_KEY: !!process.env.TREASURY_PRIVATE_KEY,
    SIGNER_PRIVATE_KEY: !!process.env.SIGNER_PRIVATE_KEY,
    SIGNER_URL: !!process.env.SIGNER_URL,
    NEXT_PUBLIC_SIGNER_URL: !!process.env.NEXT_PUBLIC_SIGNER_URL,
    
    // Admin
    ADMIN_TOKEN: !!process.env.ADMIN_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
    
    // RPC Endpoints
    NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA: !!process.env.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA,
    NEXT_PUBLIC_RPC_SEPOLIA: !!process.env.NEXT_PUBLIC_RPC_SEPOLIA,
    NEXT_PUBLIC_RPC_ARB_SEPOLIA: !!process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA,
    NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA: !!process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA,
    NEXT_PUBLIC_RPC_BASE_SEPOLIA: !!process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA,
    NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA: !!process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA,
    NEXT_PUBLIC_RPC_POLYGON_AMOY: !!process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY,
    
    // Base URL
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL
  };

  // Check for critical missing vars
  const criticalMissing = [];
  
  if (!envCheck.SUPABASE_URL && !envCheck.NEXT_PUBLIC_SUPABASE_URL) {
    criticalMissing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  }
  
  if (!envCheck.SUPABASE_SERVICE_ROLE_KEY && !envCheck.SUPABASE_ANON_KEY) {
    criticalMissing.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  }
  
  if (!envCheck.TREASURY_PRIVATE_KEY) {
    criticalMissing.push('TREASURY_PRIVATE_KEY (required for funding)');
  }
  
  if (!envCheck.AGENT_KEY_ENCRYPTION_SECRET && !envCheck.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET) {
    criticalMissing.push('AGENT_KEY_ENCRYPTION_SECRET (required for agent keys)');
  }
  
  if (process.env.NODE_ENV === 'production' && !envCheck.ADMIN_TOKEN) {
    criticalMissing.push('ADMIN_TOKEN (required for admin APIs in production)');
  }

  const rpcMissing = [];
  if (!envCheck.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA && !envCheck.NEXT_PUBLIC_RPC_SEPOLIA) {
    rpcMissing.push('Ethereum Sepolia RPC');
  }
  if (!envCheck.NEXT_PUBLIC_RPC_ARB_SEPOLIA && !envCheck.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA) {
    rpcMissing.push('Arbitrum Sepolia RPC');
  }
  if (!envCheck.NEXT_PUBLIC_RPC_BASE_SEPOLIA) {
    rpcMissing.push('Base Sepolia RPC');
  }
  if (!envCheck.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA) {
    rpcMissing.push('Optimism Sepolia RPC');
  }
  if (!envCheck.NEXT_PUBLIC_RPC_POLYGON_AMOY) {
    rpcMissing.push('Polygon Amoy RPC');
  }

  return new Response(JSON.stringify({
    ok: criticalMissing.length === 0,
    environment: process.env.NODE_ENV,
    envCheck,
    criticalMissing,
    rpcMissing,
    recommendations: {
      ...(criticalMissing.length > 0 && {
        critical: `Set these environment variables: ${criticalMissing.join(', ')}`
      }),
      ...(rpcMissing.length > 0 && {
        rpc: `Configure RPC endpoints for: ${rpcMissing.join(', ')}`
      }),
      ...(process.env.NODE_ENV === 'production' && !envCheck.ADMIN_TOKEN && {
        admin: 'Set ADMIN_TOKEN for production admin API access'
      })
    }
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
