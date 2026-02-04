import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AgentKeyService } from '@/services/identity/agentKeyService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Database Health Check Endpoint
 * Verifies critical tables exist and have expected data
 * 
 * GET /api/health/database
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        ok: false,
        error: 'Missing Supabase credentials',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const health: any = {
      ok: true,
      timestamp: new Date().toISOString(),
      database: supabaseUrl.includes('bsjhfvctmduxhohtllly') ? 'Core Hub' : 'Unknown',
      tables: {},
      warnings: []
    };

    // Check agent_keys table
    try {
      const { data: agentKeys, error: agentKeysError } = await supabase
        .from('agent_keys')
        .select('agent_id, evm_address', { count: 'exact', head: false });
      
      health.tables.agent_keys = {
        exists: !agentKeysError,
        count: agentKeys?.length || 0,
        error: agentKeysError?.message
      };

      if (!agentKeysError && agentKeys) {
        const expectedAgents = ['aigent-z', 'aigent-moneypenny', 'aigent-nakamoto', 'aigent-kn0w1'];
        const missingAgents = expectedAgents.filter(id => !agentKeys.find(k => k.agent_id === id));
        
        if (missingAgents.length > 0) {
          health.warnings.push(`Missing agent keys: ${missingAgents.join(', ')}`);
          health.ok = false;
        }
        
        health.tables.agent_keys.agents = agentKeys.map(k => k.agent_id);
      } else {
        health.ok = false;
        health.warnings.push('agent_keys table missing or inaccessible');
      }
    } catch (err: any) {
      health.tables.agent_keys = { exists: false, error: err.message };
      health.ok = false;
    }

    // Test decryption (validates encryption key is correct)
    try {
      const agentKeyService = new AgentKeyService();
      const testKey = await agentKeyService.getAgentKeys('aigent-z');
      
      health.tables.agent_keys.canDecrypt = !!testKey?.evmPrivateKey;
      health.tables.agent_keys.encryptionKeyValid = !!testKey?.evmPrivateKey;
      
      if (!testKey?.evmPrivateKey) {
        health.warnings.push('Cannot decrypt agent keys - check AGENT_KEY_ENCRYPTION_SECRET');
        health.ok = false;
      }
    } catch (err: any) {
      health.tables.agent_keys.canDecrypt = false;
      health.tables.agent_keys.encryptionError = err.message;
      health.warnings.push(`Decryption failed: ${err.message}`);
      health.ok = false;
    }

    // Check iqube_templates table
    try {
      const { count: templateCount, error: templateError } = await supabase
        .from('iqube_templates')
        .select('*', { count: 'exact', head: true });
      
      health.tables.iqube_templates = {
        exists: !templateError,
        count: templateCount || 0,
        error: templateError?.message
      };

      if (!templateError && (templateCount || 0) < 6) {
        health.warnings.push(`iqube_templates has only ${templateCount} rows, expected at least 6`);
      }
      
      if (templateError) {
        health.ok = false;
        health.warnings.push('iqube_templates table missing or inaccessible');
      }
    } catch (err: any) {
      health.tables.iqube_templates = { exists: false, error: err.message };
      health.ok = false;
    }

    // Check knowledge_base table
    try {
      const { count: kbCount, error: kbError } = await supabase
        .from('knowledge_base')
        .select('*', { count: 'exact', head: true });
      
      health.tables.knowledge_base = {
        exists: !kbError,
        count: kbCount || 0,
        error: kbError?.message
      };

      if (kbError) {
        health.warnings.push('knowledge_base table missing or inaccessible');
      }
    } catch (err: any) {
      health.tables.knowledge_base = { exists: false, error: err.message };
    }

    // Check tenants table
    try {
      const { count: tenantCount, error: tenantError } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true });
      
      health.tables.tenants = {
        exists: !tenantError,
        count: tenantCount || 0,
        error: tenantError?.message
      };

      if (tenantError) {
        health.warnings.push('tenants table missing or inaccessible');
      }
    } catch (err: any) {
      health.tables.tenants = { exists: false, error: err.message };
    }

    // Check persona table (DIDQube)
    try {
      const { count: personaCount, error: personaError } = await supabase
        .from('personas')
        .select('*', { count: 'exact', head: true });
      
      health.tables.persona = {
        exists: !personaError,
        count: personaCount || 0,
        error: personaError?.message
      };

      if (personaError) {
        health.warnings.push('persona table missing or inaccessible');
      }
    } catch (err: any) {
      health.tables.persona = { exists: false, error: err.message };
    }

    return NextResponse.json(health, { 
      status: health.ok ? 200 : 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });

  } catch (error: any) {
    console.error('[Health Check] Unexpected error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Unexpected error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
