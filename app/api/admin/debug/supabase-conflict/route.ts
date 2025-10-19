export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { AgentKeyService } from "@/services/identity/agentKeyService";
import { createClient } from '@supabase/supabase-js';

/**
 * Comprehensive diagnostic endpoint for QubeBase SDK vs Direct Supabase client conflicts
 * Usage: GET /api/admin/debug/supabase-conflict?agentId=aigent-z
 */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId') || 'aigent-z';
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    agentId,
    purpose: 'Diagnose QubeBase SDK conflicts with A2A payment system',
    tests: {} as any,
    analysis: {} as any
  };

  console.log(`🔍 Starting Supabase conflict diagnosis for ${agentId}`);

  // Test 1: AgentKeyService (Current Payment System)
  console.log('1️⃣ Testing AgentKeyService (Payment System)...');
  try {
    const keyService = new AgentKeyService();
    const agentKeys = await keyService.getAgentKeys(agentId);
    
    diagnostics.tests.agentKeyService = {
      name: 'AgentKeyService (A2A Payments)',
      status: agentKeys && agentKeys.evmPrivateKey ? 'success' : 'failed',
      keysFound: !!agentKeys,
      hasEvmPrivateKey: !!agentKeys?.evmPrivateKey,
      evmAddress: agentKeys?.evmAddress,
      evmKeyValid: agentKeys?.evmPrivateKey?.startsWith('0x') && agentKeys?.evmPrivateKey?.length === 66
    };
  } catch (error: any) {
    diagnostics.tests.agentKeyService = {
      name: 'AgentKeyService (A2A Payments)',
      status: 'error',
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    };
  }

  // Test 2: Direct Supabase Client (Same pattern as AgentKeyService)
  console.log('2️⃣ Testing Direct Supabase Client...');
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const directClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data, error } = await directClient
      .from('agent_keys')
      .select('agent_id, evm_private_key_encrypted, evm_address')
      .eq('agent_id', agentId)
      .single();

    diagnostics.tests.directSupabaseClient = {
      name: 'Direct Supabase Client',
      status: error ? 'failed' : 'success',
      error: error?.message,
      dataFound: !!data,
      hasEncryptedKey: !!data?.evm_private_key_encrypted,
      credentials: {
        url: supabaseUrl?.substring(0, 30) + '...',
        keyType: supabaseKey?.startsWith('eyJ') ? 'JWT (service_role)' : 'anon'
      }
    };
  } catch (error: any) {
    diagnostics.tests.directSupabaseClient = {
      name: 'Direct Supabase Client',
      status: 'error',
      error: error.message
    };
  }

  // Test 3: QubeBase SDK Client
  console.log('3️⃣ Testing QubeBase SDK Client...');
  try {
    const { initAgentiqClient } = await import('@qriptoagentiq/core-client');
    const client = initAgentiqClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });

    const { data, error } = await client.supabase
      .from('agent_keys')
      .select('agent_id, evm_address')
      .eq('agent_id', agentId)
      .single();

    diagnostics.tests.qubebaseClient = {
      name: 'QubeBase SDK Client',
      status: error ? 'failed' : 'success',
      error: error?.message,
      dataFound: !!data
    };
  } catch (error: any) {
    diagnostics.tests.qubebaseClient = {
      name: 'QubeBase SDK Client',
      status: 'error',
      error: error.message
    };
  }

  // Test 4: Concurrent Usage (Real-world scenario)
  console.log('4️⃣ Testing Concurrent Usage (AgentiQBootstrap + A2A)...');
  try {
    // Initialize QubeBase SDK globally (like AgentiQBootstrap does)
    const { initAgentiqClient } = await import('@qriptoagentiq/core-client');
    const qubeClient = initAgentiqClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    });

    // Then use AgentKeyService (like A2A payments do)
    const keyService = new AgentKeyService();
    
    // Run both simultaneously (real-world scenario)
    const [qubeResult, agentResult] = await Promise.all([
      qubeClient.supabase.from('persona').select('id').limit(1),
      keyService.getAgentKeys(agentId)
    ]);

    diagnostics.tests.concurrentUsage = {
      name: 'Concurrent Usage Test',
      status: (qubeResult.error || !agentResult) ? 'failed' : 'success',
      qubeError: qubeResult.error?.message,
      agentKeysRetrieved: !!agentResult,
      scenario: 'Simulates AgentiQBootstrap + A2A payment happening simultaneously'
    };
  } catch (error: any) {
    diagnostics.tests.concurrentUsage = {
      name: 'Concurrent Usage Test',
      status: 'error',
      error: error.message
    };
  }

  // Test 5: Environment Variable Analysis
  diagnostics.tests.environmentAnalysis = {
    name: 'Environment Variables',
    supabaseUrl: {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      resolved: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
    },
    supabaseKeys: {
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      agentKeyServicePrefers: 'SUPABASE_SERVICE_ROLE_KEY',
      qubaseSDKUses: 'First available key'
    },
    encryption: {
      AGENT_KEY_ENCRYPTION_SECRET: !!process.env.AGENT_KEY_ENCRYPTION_SECRET,
      NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET: !!process.env.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET
    }
  };

  // Analysis and Diagnosis
  const tests = diagnostics.tests;
  
  diagnostics.analysis = {
    criticalIssue: tests.agentKeyService?.status !== 'success',
    conflictDetected: tests.concurrentUsage?.status !== 'success',
    rootCause: null as string | null,
    recommendations: [] as string[],
    nextSteps: [] as string[]
  };

  // Determine root cause
  if (tests.agentKeyService?.status !== 'success' && tests.directSupabaseClient?.status === 'success') {
    diagnostics.analysis.rootCause = 'AgentKeyService implementation issue (not Supabase client conflict)';
    diagnostics.analysis.recommendations.push('Debug AgentKeyService decrypt/getAgentKeys methods');
  } else if (tests.agentKeyService?.status !== 'success' && tests.directSupabaseClient?.status !== 'success') {
    diagnostics.analysis.rootCause = 'Supabase connection/credentials issue';
    diagnostics.analysis.recommendations.push('Check Supabase credentials and database connectivity');
  } else if (tests.concurrentUsage?.status !== 'success') {
    diagnostics.analysis.rootCause = 'QubeBase SDK conflicts with AgentKeyService during concurrent usage';
    diagnostics.analysis.recommendations.push('CONFIRMED: Need unified Supabase client pattern');
  } else if (tests.agentKeyService?.status === 'success') {
    diagnostics.analysis.rootCause = 'AgentKeyService working - issue may be elsewhere in A2A payment flow';
    diagnostics.analysis.recommendations.push('Check A2A transfer API and funding endpoints');
  }

  // Next steps based on diagnosis
  if (diagnostics.analysis.conflictDetected) {
    diagnostics.analysis.nextSteps = [
      '1. Create unified QubeBase SDK service factory for iQube ecosystem',
      '2. Design multi-tenant architecture for registry and navigation',
      '3. Migrate AgentKeyService to use QubeBase SDK',
      '4. Ensure service role key support in QubeBase SDK',
      '5. Test all payment flows after migration',
      '6. Update all services to use unified pattern'
    ];
  } else if (diagnostics.analysis.criticalIssue) {
    diagnostics.analysis.nextSteps = [
      '1. Debug AgentKeyService decrypt method',
      '2. Check agent_keys table data integrity',
      '3. Verify encryption key consistency',
      '4. Test key retrieval manually'
    ];
  }

  console.log(`🔍 Diagnosis complete. Root cause: ${diagnostics.analysis.rootCause}`);

  return new Response(JSON.stringify(diagnostics, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
