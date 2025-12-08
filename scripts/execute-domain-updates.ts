#!/usr/bin/env tsx
/**
 * Execute Domain Assignments in QubeBase
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bsjhfvctmduxhohtllly.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzamhmdmN0bWR1eGhvaHRsbGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDgyNTgsImV4cCI6MjA3MzEyNDI1OH0.JVDp4-F6EEXqVQ8sts2Z8KQg168aZ1YdtY53RRM_s7M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Domain assignments from analyze script
const DOMAIN_ASSIGNMENTS = {
  scrolls: [
    '37266d3b-7ee1-4d0f-ac42-72e296550dc5',
    '14d03c09-461a-4055-9901-f9ef9a10e9ec',
    '17d3796d-8dea-45b6-b988-b9a946f84138',
    'a818daa3-0737-420e-a496-ff236d061bd2',
    '0b335670-b63d-4006-a89f-dfbc2e2835f7',
    'a3c56b25-326c-445b-8da2-225da1a8639d',
    '1edd2b19-c502-4e32-929c-2e79aed1fe06',
    '3e307627-7643-470f-ba99-ae928fe83566',
    '126c0e3e-ebe2-4c8f-9080-82418949ea6a',
    '19873fde-8495-46ca-a5e3-ede6d4bb1f25',
    '613f5dbe-ccd5-4a07-9c84-dc17ad893eca',
    '9a6e9be7-7187-485f-b2b5-ede1727c52e2',
    'ea4a83a8-5537-483a-9632-6a1590f0c608',
    '141cd45f-a4c8-46bb-9c4f-f15bd6fda84e',
    'd69a2436-ee82-4068-a9e4-731e8c449b92'
  ],
  pennydrops: [
    '5d1c3a7d-0bac-4522-ac45-62826ea80b37',
    'bb3e3c34-8b4a-4ab0-9916-c466702fd8ae',
    'ab80184d-ccf7-448b-9532-089a3b11b5ee',
    'a47b5eab-1542-4137-8e5a-395aafbc620e',
    'a76b3c3a-71ca-4ecd-ba59-02b14d7df934',
    'f990cf0f-fbb6-4f68-a3d2-10d168ad9cb0',
    '02681a52-ee6e-4cba-9fa0-a4ab8b74a1a8',
    '45a9c162-5dba-460c-a1c3-2ae678eb71cb',
    '94585945-59d2-4dcd-b953-56b1e5c3a135',
    'd63a1602-3337-4d56-b1c5-cdcdf21e3aec',
    '266c041c-355e-4dc7-b4a1-9093ae9a502a',
    '6e074ac1-f666-46ef-ac63-ca706f18801b',
    '56f70d60-a4bc-41ef-b703-f4916b563aee',
    '889b939e-dfea-4937-8350-984bf84c93bf',
    'db1cf2b7-379a-4d46-bdca-ce22567a8da2',
    '9b7c3b59-1192-44d3-bad4-543c06000c9b',
    'd51579d4-6dad-48d6-9c1a-5b0904fd46f4'
  ],
  kn0wdz: [
    '2335afed-bdf2-4d3e-a7ab-113a726c3723',
    '7ba84950-599a-454c-8f78-1ecd916eac56',
    'ed0a851e-1ddb-4803-a236-e447054a558e',
    '2b26df84-7573-4899-bf57-d7e0d374e066',
    '2a8b7b36-7d38-480d-b89a-032ab367c635',
    '1c89d604-106f-4ed4-8477-eafe3fd3a3a4',
    '83763ce3-b4f3-46eb-8717-1c8639fabe05',
    '19268e34-d1a7-465c-8925-8cb43ffd194c',
    '2a3b19cd-2260-4046-875d-c91c257c7e73',
    'b87fb671-2f6a-46f6-9a36-4187c727ea02',
    'e6093b39-e696-4262-ae0c-79a09e9af6d1',
    '41b262dc-9074-4929-bd01-e0d3093572ec',
    'e531a208-0ea5-416d-a994-89dadf61de5c',
    'aab61786-b3ce-4421-aa71-b7d007089de2',
    '7b47fe3e-872e-4317-a860-a03fb3bd8579'
  ]
};

async function executeDomainUpdates() {
  console.log('⚙️  Executing Domain Assignments in QubeBase...\n');
  
  let totalUpdated = 0;
  
  for (const [domain, ids] of Object.entries(DOMAIN_ASSIGNMENTS)) {
    const emoji = domain === 'pennydrops' ? '💧' : domain === 'scrolls' ? '📜' : '💻';
    console.log(`${emoji} Updating ${ids.length} items to '${domain}'...`);
    
    const { data, error } = await supabase
      .from('content')
      .update({ domain })
      .in('id', ids)
      .select('id, title, domain');
    
    if (error) {
      console.error(`  ❌ Error:`, error.message);
      continue;
    }
    
    console.log(`  ✅ Updated ${data?.length || 0} items\n`);
    totalUpdated += data?.length || 0;
  }
  
  console.log(`Total updated: ${totalUpdated} items\n`);
  
  // Verify distribution
  console.log('Verifying distribution...\n');
  const { data: distribution, error: distError } = await supabase
    .from('content')
    .select('domain')
    .eq('status', 'published');
  
  if (distError) {
    console.error('❌ Error verifying:', distError.message);
    return;
  }
  
  const counts: Record<string, number> = {};
  distribution.forEach(item => {
    counts[item.domain] = (counts[item.domain] || 0) + 1;
  });
  
  console.log('Final Distribution:');
  console.log('─────────────────────');
  Object.entries(counts).sort().forEach(([domain, count]) => {
    const emoji = domain === 'pennydrops' ? '💧' : domain === 'scrolls' ? '📜' : domain === 'kn0wdz' ? '💻' : domain === 'signals' ? '📡' : '❓';
    console.log(`  ${emoji} ${domain}: ${count} items`);
  });
  console.log('\n');
  
  console.log('✅ Domain assignments complete!\n');
  console.log('Next step: Re-fetch content to update the app');
  console.log('  pnpm tsx scripts/fetch-qubebase-content.ts\n');
}

executeDomainUpdates().catch(console.error);
