/**
 * Script to add reputation buckets to existing personas in Supabase
 * Run with: npx tsx scripts/add-reputation-to-personas.ts
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
  process.exit(1);
}

const reputationData = [
  { fio_handle: 'alice_blockchain', skill_category: 'blockchain_development', bucket_level: 4, score: 85 },
  { fio_handle: 'bob_defi', skill_category: 'defi', bucket_level: 3, score: 72 },
  { fio_handle: 'charlie_nft', skill_category: 'nft', bucket_level: 3, score: 65 },
  { fio_handle: 'diana_web3', skill_category: 'web3', bucket_level: 2, score: 55 },
  { fio_handle: 'eve_smartcontracts', skill_category: 'smart_contracts', bucket_level: 2, score: 40 }
];

async function addReputationToPersonas() {
  console.log('🚀 Adding reputation buckets to personas...\n');

  const supabase = createClient(supabaseUrl, supabaseKey);

  for (const rep of reputationData) {
    try {
      // Find persona by fio_handle
      const { data: persona, error: personaError } = await supabase
        .from('persona')
        .select('id')
        .eq('fio_handle', rep.fio_handle)
        .single();

      if (personaError || !persona) {
        console.log(`⚠️  Persona not found: ${rep.fio_handle}`);
        continue;
      }

      // Check if reputation bucket already exists
      const { data: existing } = await supabase
        .from('reputation_bucket')
        .select('id')
        .eq('persona_id', persona.id)
        .single();

      if (existing) {
        console.log(`   ⏭️  Reputation already exists for ${rep.fio_handle}`);
        continue;
      }

      // Create reputation bucket
      const { data: bucket, error: bucketError } = await supabase
        .from('reputation_bucket')
        .insert({
          persona_id: persona.id,
          partition_id: persona.id, // Use persona ID as partition ID
          skill_category: rep.skill_category,
          bucket_level: rep.bucket_level,
          score: rep.score,
          evidence_count: 0,
          last_synced_at: new Date().toISOString()
        })
        .select()
        .single();

      if (bucketError) {
        console.error(`   ❌ Failed to create reputation for ${rep.fio_handle}:`, bucketError.message);
        continue;
      }

      console.log(`✅ Created reputation for ${rep.fio_handle}:`);
      console.log(`   📊 Bucket: ${rep.bucket_level} | Score: ${rep.score} | Category: ${rep.skill_category}\n`);

    } catch (error: any) {
      console.error(`❌ Error processing ${rep.fio_handle}:`, error.message);
    }
  }

  console.log('\n✨ Reputation buckets added!');
  console.log('\n📋 Verify with:');
  console.log('SELECT p.fio_handle, rb.skill_category, rb.bucket_level, rb.score');
  console.log('FROM persona p');
  console.log('JOIN reputation_bucket rb ON rb.persona_id = p.id;');
  console.log('\n🎯 Visit: http://localhost:3000/admin/reputation\n');
}

// Run the script
addReputationToPersonas().catch(console.error);
