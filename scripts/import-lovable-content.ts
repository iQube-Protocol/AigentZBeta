#!/usr/bin/env tsx

/**
 * Import content from Lovable JSON export into QubeBase
 * 
 * This script:
 * 1. Parses Lovable's JSON structure
 * 2. Maps fields to QubeBase schema
 * 3. Includes modalities (read/watch/listen/link)
 * 4. Preserves placement (section, position, imageScale, imageX, imageY)
 * 5. Assigns correct domain and status
 * 
 * Usage:
 *   pnpm tsx scripts/import-lovable-content.ts <path-to-lovable.json>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Type definitions based on JSON spec
interface ContentModalities {
  read?: {
    text: string;
    duration?: string;
  };
  watch?: {
    video_url: string;
    duration?: string;
    thumbnail?: string;
  };
  listen?: {
    audio_url: string;
    duration?: string;
    cover_image?: string;
  };
  link?: {
    url: string;
    allow_embed?: boolean;
  };
}

interface PlacementData {
  section: string;
  tab?: string;
  position: number;
  imageScale?: number;
  imageX?: number;
  imageY?: number;
  imagePosition?: string;
}

interface LovableContent {
  id?: string;
  title: string;
  excerpt?: string;
  thumbnail?: string;
  domain: string;
  placement: PlacementData;
  modalities?: ContentModalities;
  tags?: string[];
  format?: string;
  type?: string;
  status?: 'draft' | 'published';
  issue_ref?: string;
  author_id?: string;
  author_type?: 'agent' | 'human';
  // Add more fields as needed based on Lovable structure
}

interface QubeBaseContent {
  id?: string;
  title: string;
  excerpt: string;
  thumbnail: string | null;
  domain: string;
  format: string;
  type: string;
  status: 'draft' | 'published';
  placement: PlacementData;
  modalities: ContentModalities | null;
  tags: string[];
  duration: string | null;
  issue_ref: string;
  author_id: string | null;
  author_type: 'agent' | 'human' | null;
  content: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
}

/**
 * Calculate reading duration from markdown text
 */
function calculateReadingDuration(text: string): string {
  const wordsPerMinute = 200;
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes} min read`;
}

/**
 * Map Lovable content to QubeBase schema
 */
function mapToQubeBase(lovableContent: LovableContent): QubeBaseContent {
  // Auto-calculate reading duration if read modality exists
  if (lovableContent.modalities?.read?.text && !lovableContent.modalities.read.duration) {
    lovableContent.modalities.read.duration = calculateReadingDuration(
      lovableContent.modalities.read.text
    );
  }

  return {
    id: lovableContent.id,
    title: lovableContent.title,
    excerpt: lovableContent.excerpt || '',
    thumbnail: lovableContent.thumbnail || null,
    domain: lovableContent.domain,
    format: lovableContent.format || 'article',
    type: lovableContent.type || 'article',
    status: lovableContent.status || 'published',
    placement: {
      section: lovableContent.placement.section,
      tab: lovableContent.placement.tab || '',
      position: lovableContent.placement.position,
      imageScale: lovableContent.placement.imageScale || 100,
      imageX: lovableContent.placement.imageX || 50,
      imageY: lovableContent.placement.imageY || 50,
      imagePosition: lovableContent.placement.imagePosition || 'center',
    },
    modalities: lovableContent.modalities || null,
    tags: lovableContent.tags || [],
    duration: lovableContent.modalities?.read?.duration || 
              lovableContent.modalities?.watch?.duration ||
              lovableContent.modalities?.listen?.duration || null,
    issue_ref: lovableContent.issue_ref || '#0',
    author_id: lovableContent.author_id || null,
    author_type: lovableContent.author_type || null,
    content: {}, // Legacy field, keep empty
  };
}

/**
 * Import content into QubeBase
 */
async function importContent(content: QubeBaseContent[]) {
  console.log(`\n📦 Importing ${content.length} items...`);

  for (const item of content) {
    try {
      const { data, error } = await supabase
        .from('content')
        .upsert(item, { onConflict: 'id' });

      if (error) {
        console.error(`❌ Error importing "${item.title}":`, error.message);
      } else {
        console.log(`✅ Imported: ${item.title} (${item.domain}/${item.placement.section})`);
      }
    } catch (err) {
      console.error(`❌ Exception importing "${item.title}":`, err);
    }
  }
}

/**
 * Main import function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: pnpm tsx scripts/import-lovable-content.ts <path-to-lovable.json>');
    console.log('\nOr paste JSON content when prompted...\n');
    
    // Could add interactive mode here if needed
    process.exit(0);
  }

  const jsonPath = args[0];
  
  console.log('📦 Lovable Content Importer');
  console.log('════════════════════════════\n');
  
  // Read JSON file
  const fs = await import('fs');
  let lovableData: LovableContent[];
  
  try {
    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    lovableData = JSON.parse(fileContent);
    
    if (!Array.isArray(lovableData)) {
      console.error('❌ JSON must be an array of content items');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error reading JSON file:', err);
    process.exit(1);
  }

  console.log(`📄 Found ${lovableData.length} content items\n`);

  // Map to QubeBase schema
  const qubeBaseContent = lovableData.map(mapToQubeBase);

  // Group by domain for summary
  const byDomain = qubeBaseContent.reduce((acc, item) => {
    acc[item.domain] = (acc[item.domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📊 Content Distribution:');
  Object.entries(byDomain).forEach(([domain, count]) => {
    console.log(`   ${domain}: ${count} items`);
  });

  console.log('\n⚠️  This will UPSERT content (update if exists, insert if new)');
  console.log('   Existing content with same ID will be updated.\n');

  // Import
  await importContent(qubeBaseContent);

  console.log('\n✅ Import complete!');
  console.log('\nNext steps:');
  console.log('1. Run: pnpm tsx scripts/fetch-qubebase-content.ts');
  console.log('2. Refresh the app to see updated content');
  console.log('3. Verify modalities are working (read/watch/listen buttons)');
}

main().catch(console.error);
