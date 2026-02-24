/**
 * Import Episode 1 QriptoMedia content
 * Ingests articles for home-hero, latest-news, second-hero, pennydrops, and 21knowdz sections
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importEpisode1Content() {
  console.log('📚 Starting Episode 1 QriptoMedia content import...\n');

  // Read the JSON file
  const jsonPath = path.resolve(__dirname, 'episode1_qriptomedia.json');
  
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ File not found: episode1_qriptomedia.json');
    console.log('Please create this file in the scripts/ directory with your content array.');
    process.exit(1);
  }

  const contentData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  
  console.log(`Found ${contentData.length} articles to import\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of contentData) {
    try {
      // Check if article already exists by slug
      const { data: existing } = await supabase
        .from('content')
        .select('id, title')
        .eq('slug', item.slug)
        .single();

      if (existing) {
        console.log(`⏭️  Skipping existing: "${item.title}"`);
        skipped++;
        continue;
      }

      // Remove badge and image fields - they're not in the database schema
      const { badge, image, ...cleanItem } = item;

      // Insert new content
      const { error } = await supabase
        .from('content')
        .insert(cleanItem);

      if (error) {
        console.error(`✗ Error importing "${item.title}":`, error.message);
        errors++;
      } else {
        console.log(`✓ Imported: "${item.title}" → ${item.placement.section}`);
        imported++;
      }
    } catch (err) {
      console.error(`✗ Exception importing "${item.title}":`, err);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Import Summary:');
  console.log(`   ✓ Imported: ${imported}`);
  console.log(`   ⏭️  Skipped:  ${skipped}`);
  console.log(`   ✗ Errors:   ${errors}`);
  console.log('='.repeat(60));

  if (imported > 0) {
    console.log('\n✅ Episode 1 content is now available in the Codex!');
  }
}

importEpisode1Content().catch(console.error);
