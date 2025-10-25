/**
 * Script to create test personas with reputation buckets
 * Run with: npx tsx scripts/create-test-personas.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please ensure .env.local contains:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const testPersonas = [
  {
    fio_handle: 'alice_blockchain',
    default_identity_state: 'semi_identifiable',
    world_id_status: 'verified_human',
    app_origin: 'aigentzbeta',
    reputation: {
      skill_category: 'blockchain_development',
      initial_score: 85
    }
  },
  {
    fio_handle: 'bob_defi',
    default_identity_state: 'semi_anonymous',
    world_id_status: 'verified_human',
    app_origin: 'aigentzbeta',
    reputation: {
      skill_category: 'defi',
      initial_score: 72
    }
  },
  {
    fio_handle: 'charlie_nft',
    default_identity_state: 'identifiable',
    world_id_status: 'verified_human',
    app_origin: 'aigentzbeta',
    reputation: {
      skill_category: 'nft',
      initial_score: 65
    }
  },
  {
    fio_handle: 'diana_web3',
    default_identity_state: 'semi_anonymous',
    world_id_status: 'unverified',
    app_origin: 'aigentzbeta',
    reputation: {
      skill_category: 'web3',
      initial_score: 55
    }
  },
  {
    fio_handle: 'eve_smartcontracts',
    default_identity_state: 'anonymous',
    world_id_status: 'agent_declared',
    app_origin: 'aigentzbeta',
    reputation: {
      skill_category: 'smart_contracts',
      initial_score: 40
    }
  }
];

async function createTestPersonas() {
  console.log('🚀 Creating test personas with reputation...\n');

  const supabase = createClient(supabaseUrl, supabaseKey);

  for (const personaData of testPersonas) {
    try {
      // Create persona
      const { data: persona, error: personaError } = await supabase
        .from('persona')
        .insert({
          fio_handle: personaData.fio_handle,
          default_identity_state: personaData.default_identity_state,
          world_id_status: personaData.world_id_status,
          app_origin: personaData.app_origin
        })
        .select()
        .single();

      if (personaError) {
        console.error(`❌ Failed to create persona ${personaData.fio_handle}:`, personaError.message);
        continue;
      }

      console.log(`✅ Created persona: ${personaData.fio_handle} (${persona.id})`);

      // Create reputation bucket via API
      try {
        const response = await fetch(`http://localhost:3000/api/identity/persona/${persona.id}/reputation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skillCategory: personaData.reputation.skill_category,
            initialScore: personaData.reputation.initial_score
          })
        });

        const result = await response.json();

        if (result.ok) {
          console.log(`   ✅ Created reputation bucket: ${personaData.reputation.skill_category} (score: ${personaData.reputation.initial_score})`);
          console.log(`   📊 Bucket level: ${result.data.bucket}\n`);
        } else {
          console.error(`   ❌ Failed to create reputation:`, result.error);
        }
      } catch (apiError: any) {
        console.error(`   ❌ API error:`, apiError.message);
      }

    } catch (error: any) {
      console.error(`❌ Error processing ${personaData.fio_handle}:`, error.message);
    }
  }

  console.log('\n✨ Test persona creation complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Run the Supabase migration: 20251017_didqube_reputation.sql');
  console.log('2. Visit http://localhost:3000/admin/reputation to view personas');
  console.log('3. Test evidence submission for each persona');
  console.log('4. Verify reputation sync between IC canister and Supabase\n');
}

// Run the script
createTestPersonas().catch(console.error);
