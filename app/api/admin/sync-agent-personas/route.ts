import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Sync Agent Personas API
 * 
 * Ensures all agent personas have the correct @aigent FIO handles
 * and links them to the agent_keys table via persona_id
 * 
 * Domain Rules:
 * - @aigent: Reserved for AI agents only
 * - @qripto: For human personas (content & reputation)
 * - @knyt: For human personas (gaming & rewards)
 */

const AGENT_PERSONAS = [
  { agentId: 'aigent-z', fioHandle: 'aigentz@aigent', name: 'Aigent Z' },
  { agentId: 'aigent-moneypenny', fioHandle: 'moneypenny@aigent', name: 'Aigent MoneyPenny' },
  { agentId: 'aigent-kn0w1', fioHandle: 'kn0w1@aigent', name: 'Aigent Kn0w1' },
  { agentId: 'aigent-nakamoto', fioHandle: 'nakamoto@aigent', name: 'Aigent Nakamoto' },
];

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// GET - Check current state of agent personas
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    
    // Get all agent personas - query for exact @aigent handles
    const agentHandles = AGENT_PERSONAS.map(a => a.fioHandle);
    const { data: personas, error: personaError } = await supabase
      .from('persona')
      .select('id, fio_handle, world_id_status, created_at')
      .in('fio_handle', agentHandles);

    if (personaError) {
      console.error('Error fetching personas:', personaError);
    }

    // Get agent_keys with persona links
    const { data: agentKeys, error: keysError } = await supabase
      .from('agent_keys')
      .select('agent_id, agent_name, fio_handle, persona_id, evm_address, btc_address, solana_address')
      .in('agent_id', ['aigent-z', 'aigent-moneypenny', 'aigent-kn0w1', 'aigent-nakamoto']);

    if (keysError) {
      console.error('Error fetching agent_keys:', keysError);
    }

    // Check for mismatches
    const issues: string[] = [];
    
    for (const agent of AGENT_PERSONAS) {
      const persona = personas?.find(p => p.fio_handle === agent.fioHandle);
      const keys = agentKeys?.find(k => k.agent_id === agent.agentId);
      
      if (!persona) {
        issues.push(`Missing persona for ${agent.fioHandle}`);
      }
      
      if (!keys) {
        issues.push(`Missing agent_keys for ${agent.agentId}`);
      } else {
        if (keys.fio_handle !== agent.fioHandle) {
          issues.push(`FIO handle mismatch for ${agent.agentId}: ${keys.fio_handle} should be ${agent.fioHandle}`);
        }
        if (persona && keys.persona_id !== persona.id) {
          issues.push(`Persona ID not linked for ${agent.agentId}`);
        }
      }
      
      // Check for wrong domain (@qripto instead of @aigent)
      const wrongDomainPersona = personas?.find(p => 
        p.fio_handle === agent.fioHandle.replace('@aigent', '@qripto')
      );
      if (wrongDomainPersona) {
        issues.push(`Found @qripto persona that should be @aigent: ${wrongDomainPersona.fio_handle}`);
      }
    }

    return NextResponse.json({
      ok: true,
      personas: personas || [],
      agentKeys: agentKeys || [],
      expectedAgents: AGENT_PERSONAS,
      issues,
      needsSync: issues.length > 0,
    });

  } catch (error) {
    console.error('[SyncAgentPersonas] GET Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// POST - Sync agent personas
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const results: any[] = [];

    for (const agent of AGENT_PERSONAS) {
      const agentResult: any = { agentId: agent.agentId, fioHandle: agent.fioHandle, actions: [] };

      // Step 1: Update any @qripto handles to @aigent
      const wrongHandle = agent.fioHandle.replace('@aigent', '@qripto');
      const { data: updatedPersona, error: updateError } = await supabase
        .from('persona')
        .update({ fio_handle: agent.fioHandle })
        .eq('fio_handle', wrongHandle)
        .select()
        .maybeSingle();

      if (updatedPersona) {
        agentResult.actions.push(`Updated persona from ${wrongHandle} to ${agent.fioHandle}`);
      }

      // Step 2: Check if persona exists with correct handle
      let { data: persona, error: personaError } = await supabase
        .from('persona')
        .select('id, fio_handle')
        .eq('fio_handle', agent.fioHandle)
        .maybeSingle();

      // Step 3: Create persona if it doesn't exist
      if (!persona) {
        const { data: newPersona, error: createError } = await supabase
          .from('persona')
          .insert({
            fio_handle: agent.fioHandle,
            default_identity_state: 'semi_anonymous',
            world_id_status: 'agent_declared',
            app_origin: 'aigentiq',
          })
          .select()
          .single();

        if (createError) {
          agentResult.actions.push(`Error creating persona: ${createError.message}`);
        } else {
          persona = newPersona;
          agentResult.actions.push(`Created persona with ID ${newPersona.id}`);
        }
      } else {
        agentResult.actions.push(`Persona exists with ID ${persona.id}`);
      }

      // Step 4: Link agent_keys to persona
      if (persona) {
        const { data: updatedKeys, error: linkError } = await supabase
          .from('agent_keys')
          .update({ 
            persona_id: persona.id,
            fio_handle: agent.fioHandle 
          })
          .eq('agent_id', agent.agentId)
          .select('agent_id, persona_id, fio_handle')
          .maybeSingle();

        if (linkError) {
          agentResult.actions.push(`Error linking agent_keys: ${linkError.message}`);
        } else if (updatedKeys) {
          agentResult.actions.push(`Linked agent_keys to persona ${persona.id}`);
          agentResult.personaId = persona.id;
        }
      }

      results.push(agentResult);
    }

    return NextResponse.json({
      ok: true,
      message: 'Agent personas synced',
      results,
    });

  } catch (error) {
    console.error('[SyncAgentPersonas] POST Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
