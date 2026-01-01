/**
 * Apply RLS policy fix using direct SQL execution
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyRLSFix() {
  console.log('Applying RLS policy fix for draft content visibility...\n');

  try {
    // First, check if the policy already exists
    const { data: existingPolicies, error: checkError } = await supabase
      .from('pg_policies')
      .select('policyname')
      .eq('tablename', 'content')
      .eq('policyname', 'Authenticated users can view all content');

    if (checkError) {
      console.log('Note: Could not check existing policies (this is normal)');
    }

    // Use the REST API to execute raw SQL via service role
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        query: `
          CREATE POLICY "Authenticated users can view all content"
          ON public.content
          FOR SELECT
          TO authenticated
          USING (true);
        `
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    console.log('✅ RLS policy applied successfully!');
    console.log('\nAuthenticated users can now view draft content in the admin portal.');
    console.log('Draft articles will remain visible after unpublishing.');
    
  } catch (error: any) {
    console.error('Error applying migration:', error.message);
    console.log('\n📋 Manual Steps Required:');
    console.log('=' .repeat(80));
    console.log('Please run this SQL in your Supabase Dashboard SQL Editor:');
    console.log('');
    console.log(`CREATE POLICY "Authenticated users can view all content"`);
    console.log(`  ON public.content`);
    console.log(`  FOR SELECT`);
    console.log(`  TO authenticated`);
    console.log(`  USING (true);`);
    console.log('=' .repeat(80));
    console.log('\nSteps:');
    console.log('1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
    console.log('2. Paste the SQL above');
    console.log('3. Click "Run"');
    console.log('\nOr run the migration file:');
    console.log('supabase/migrations/20260101_fix_content_rls_for_drafts.sql');
  }
}

applyRLSFix();
