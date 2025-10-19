export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { UniversalQubeService, createPaymentService, createIdentityService, createRegistryService, createNavigationService } from "@/services/core/UniversalQubeService";
import { AgentKeyServiceV2 } from "@/services/identity/agentKeyService.v2";

/**
 * Comprehensive test endpoint for Universal iQube Service
 * Tests all service factories and validates ecosystem integration
 */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId') || 'aigent-z';
  
  const testResults = {
    timestamp: new Date().toISOString(),
    agentId,
    purpose: 'Test Universal iQube Service for ecosystem integration',
    services: {} as any,
    compatibility: {} as any,
    recommendations: [] as string[]
  };

  console.log(`🧪 Testing Universal iQube Service for ${agentId}`);

  // Test 1: Payment Service (AgentKeyService V2)
  console.log('1️⃣ Testing Payment Service with AgentKeyService V2...');
  try {
    const paymentService = createPaymentService();
    const agentKeyServiceV2 = new AgentKeyServiceV2();
    
    // Test health check
    const health = await agentKeyServiceV2.healthCheck();
    
    // Test key retrieval
    const keys = await agentKeyServiceV2.getAgentKeys(agentId);
    
    testResults.services.payment = {
      name: 'Payment Service (AgentKeyService V2)',
      status: keys ? 'success' : 'failed',
      health,
      keysRetrieved: !!keys,
      evmAddress: keys?.evmAddress,
      serviceHealth: await paymentService.healthCheck()
    };
  } catch (error: any) {
    testResults.services.payment = {
      name: 'Payment Service (AgentKeyService V2)',
      status: 'error',
      error: error.message
    };
  }

  // Test 2: Identity Service
  console.log('2️⃣ Testing Identity Service...');
  try {
    const identityService = createIdentityService();
    
    const personaData = await identityService.executeQuery(
      async (client) => {
        const { data, error } = await client
          .from('persona')
          .select('id, fio_handle, agent_id')
          .limit(3);
        return { data, error };
      },
      { serviceType: 'identity' }
    );

    testResults.services.identity = {
      name: 'Identity Service',
      status: personaData.error ? 'failed' : 'success',
      error: personaData.error?.message,
      personasFound: personaData.data?.length || 0,
      serviceHealth: await identityService.healthCheck()
    };
  } catch (error: any) {
    testResults.services.identity = {
      name: 'Identity Service',
      status: 'error',
      error: error.message
    };
  }

  // Test 3: Registry Service (Future iQube Registry)
  console.log('3️⃣ Testing Registry Service...');
  try {
    const registryService = createRegistryService();
    
    // Test basic connectivity for future registry tables
    const registryTest = await registryService.executeQuery(
      async (client) => {
        // Test with existing table for now, will be registry tables in future
        const { data, error } = await client
          .from('persona')
          .select('count')
          .limit(1);
        return { success: !error, error };
      },
      { serviceType: 'registry' }
    );

    testResults.services.registry = {
      name: 'Registry Service (Future iQube Registry)',
      status: registryTest.success ? 'success' : 'failed',
      error: registryTest.error?.message,
      note: 'Ready for iQube Registry integration',
      serviceHealth: await registryService.healthCheck()
    };
  } catch (error: any) {
    testResults.services.registry = {
      name: 'Registry Service',
      status: 'error',
      error: error.message
    };
  }

  // Test 4: Navigation Service (Universal Menu & Cross-Agent Navigation)
  console.log('4️⃣ Testing Navigation Service...');
  try {
    const navigationService = createNavigationService();
    
    const navigationTest = await navigationService.executeQuery(
      async (client) => {
        // Test agent discovery for cross-agent navigation
        const { data, error } = await client
          .from('agent_keys')
          .select('agent_id, agent_name')
          .order('agent_name');
        return { data, error };
      },
      { serviceType: 'navigation' }
    );

    testResults.services.navigation = {
      name: 'Navigation Service (Universal Menu)',
      status: navigationTest.error ? 'failed' : 'success',
      error: navigationTest.error?.message,
      agentsDiscovered: navigationTest.data?.length || 0,
      agents: navigationTest.data?.map(a => ({ id: a.agent_id, name: a.agent_name })) || [],
      note: 'Ready for cross-agent navigation system',
      serviceHealth: await navigationService.healthCheck()
    };
  } catch (error: any) {
    testResults.services.navigation = {
      name: 'Navigation Service',
      status: 'error',
      error: error.message
    };
  }

  // Test 5: Multi-Tenant Capabilities
  console.log('5️⃣ Testing Multi-Tenant Capabilities...');
  try {
    const paymentService = createPaymentService();
    
    // Test tenant context
    const tenantTest = await paymentService.executeQuery(
      async (client) => {
        const { data, error } = await client
          .from('agent_keys')
          .select('agent_id, agent_name, evm_address')
          .neq('agent_id', agentId)
          .limit(2);
        return { data, error };
      },
      { 
        tenantContext: {
          agentId: 'system',
          permissions: ['admin'],
          serviceAccess: ['payment', 'identity', 'registry']
        }
      }
    );

    testResults.services.multiTenant = {
      name: 'Multi-Tenant Support',
      status: tenantTest.error ? 'failed' : 'success',
      error: tenantTest.error?.message,
      otherAgentsFound: tenantTest.data?.length || 0,
      note: 'Ready for multi-agent applications'
    };
  } catch (error: any) {
    testResults.services.multiTenant = {
      name: 'Multi-Tenant Support',
      status: 'error',
      error: error.message
    };
  }

  // Compatibility Tests
  console.log('6️⃣ Testing Backward Compatibility...');
  
  // Test original AgentKeyService still works
  try {
    const { AgentKeyService } = await import('@/services/identity/agentKeyService');
    const originalService = new AgentKeyService();
    const originalKeys = await originalService.getAgentKeys(agentId);
    
    testResults.compatibility.originalAgentKeyService = {
      status: originalKeys ? 'success' : 'failed',
      keysRetrieved: !!originalKeys,
      note: 'Original service still functional during migration'
    };
  } catch (error: any) {
    testResults.compatibility.originalAgentKeyService = {
      status: 'error',
      error: error.message
    };
  }

  // Analysis and Recommendations
  const allServices = Object.values(testResults.services);
  const successfulServices = allServices.filter((service: any) => service.status === 'success');
  const failedServices = allServices.filter((service: any) => service.status === 'failed' || service.status === 'error');

  testResults.recommendations = [];

  if (successfulServices.length === allServices.length) {
    testResults.recommendations.push('✅ All services working - Ready for production migration');
    testResults.recommendations.push('🚀 Universal Service ready for iQube ecosystem integration');
    testResults.recommendations.push('📋 Proceed with AgentKeyService migration to V2');
  } else if (failedServices.length > 0) {
    testResults.recommendations.push(`❌ ${failedServices.length} service(s) failed - Debug before migration`);
    failedServices.forEach((service: any) => {
      testResults.recommendations.push(`🔧 Fix ${service.name}: ${service.error || 'Unknown error'}`);
    });
  }

  if (testResults.services.payment?.status === 'success') {
    testResults.recommendations.push('💳 Payment service ready - A2A transactions should work');
  }

  if (testResults.services.identity?.status === 'success' && testResults.services.registry?.status === 'success') {
    testResults.recommendations.push('🆔 Identity & Registry services ready for iQube integration');
  }

  if (testResults.services.navigation?.status === 'success') {
    testResults.recommendations.push('🧭 Navigation service ready for universal menu system');
  }

  console.log(`🧪 Universal Service test complete. Success rate: ${successfulServices.length}/${allServices.length}`);

  return new Response(JSON.stringify(testResults, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
