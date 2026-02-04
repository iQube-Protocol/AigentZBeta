/**
 * Apply RLS policy fix to allow authenticated users to view draft content
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('Applying RLS policy fix for draft content visibility...\n');

  const migrationSQL = `
-- Add policy for authenticated users to view all content (including drafts)
CREATE POLICY "Authenticated users can view all content"
  ON public.content
  FOR SELECT
  TO authenticated
  USING (true);
  `;

  try {
    // Execute the SQL directly using the service role
    const { error } = await supabase.rpc('exec_sql', { query: migrationSQL });
    
    if (error) {
      // If exec_sql doesn't exist, try alternative approach
      console.log('Direct SQL execution not available, using alternative method...');
      
      // The policy needs to be created via Supabase Dashboard SQL Editor
      console.log('\n⚠️  Please run the following SQL in your Supabase Dashboard SQL Editor:');
      console.log('=' .repeat(80));
      console.log(migrationSQL);
      console.log('=' .repeat(80));
      console.log('\nSteps:');
      console.log('1. Go to your Supabase Dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the SQL above');
      console.log('4. Click "Run"');
      console.log('\nThis will allow authenticated users to see draft articles in the admin portal.');
      return;
    }

    console.log('✅ RLS policy applied successfully!');
    console.log('\nAuthenticated users can now view draft content in the admin portal.');
    console.log('Draft articles will remain visible after unpublishing.');
    
  } catch (error) {
    console.error('Error applying migration:', error);
    console.log('\n⚠️  Please run the migration manually in Supabase Dashboard:');
    console.log('File: supabase/migrations/20260101_fix_content_rls_for_drafts.sql');
  }
}

applyMigration();
