/**
 * Fix tab names in imported Kn0wdZ content
 * Changes 'developer' → 'dev' and 'executive' → 'exec' to match admin portal
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

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixTabNames() {
  console.log('Updating imported articles tab names...\n');

  // Get articles with 'developer' tab
  const { data: devArticles } = await supabase
    .from('content')
    .select('*')
    .eq('placement->>section', '21knowdz')
    .eq('placement->>tab', 'developer');

  console.log(`Found ${devArticles?.length || 0} articles with tab='developer'`);

  // Update to 'dev'
  for (const article of devArticles || []) {
    const placement = article.placement as any;
    placement.tab = 'dev';
    
    const { error } = await supabase
      .from('content')
      .update({ placement })
      .eq('id', article.id);
    
    if (error) {
      console.error(`✗ Error updating "${article.title}":`, error.message);
    } else {
      console.log(`✓ Updated: ${article.title} (developer → dev)`);
    }
  }

  // Get articles with 'executive' tab
  const { data: execArticles } = await supabase
    .from('content')
    .select('*')
    .eq('placement->>section', '21knowdz')
    .eq('placement->>tab', 'executive');

  console.log(`\nFound ${execArticles?.length || 0} articles with tab='executive'`);

  // Update to 'exec'
  for (const article of execArticles || []) {
    const placement = article.placement as any;
    placement.tab = 'exec';
    
    const { error } = await supabase
      .from('content')
      .update({ placement })
      .eq('id', article.id);
    
    if (error) {
      console.error(`✗ Error updating "${article.title}":`, error.message);
    } else {
      console.log(`✓ Updated: ${article.title} (executive → exec)`);
    }
  }

  console.log('\n✅ Tab names updated successfully!');
  console.log('\nNow admin portal articles will be prioritized on the site.');
}

fixTabNames();
