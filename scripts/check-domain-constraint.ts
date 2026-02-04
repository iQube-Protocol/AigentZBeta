#!/usr/bin/env tsx
/**
 * Check the domain constraint in QubeBase
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bsjhfvctmduxhohtllly.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzamhmdmN0bWR1eGhvaHRsbGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDgyNTgsImV4cCI6MjA3MzEyNDI1OH0.JVDp4-F6EEXqVQ8sts2Z8KQg168aZ1YdtY53RRM_s7M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkConstraint() {
  console.log('🔍 Checking current domain values in content table...\n');
  
  // Get all unique domain values currently in use
  const { data, error } = await supabase
    .from('content')
    .select('domain')
    .not('domain', 'is', null);
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  const uniqueDomains = [...new Set(data.map(item => item.domain))];
  
  console.log('Current domain values in database:');
  console.log('─────────────────────────────────\n');
  uniqueDomains.sort().forEach(domain => {
    console.log(`  - ${domain}`);
  });
  
  console.log('\n');
  console.log('Expected domains from spec:');
  console.log('─────────────────────────────\n');
  console.log('  - pennydrops');
  console.log('  - scrolls');
  console.log('  - kn0wdz');
  console.log('  - signals');
  
  console.log('\n');
  console.log('💡 The check constraint likely only allows the current values.');
  console.log('   You need to ALTER the constraint to add the new domains.\n');
}

checkConstraint().catch(console.error);
