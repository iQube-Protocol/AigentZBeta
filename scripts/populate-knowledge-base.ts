/**
 * Script to populate the Knowledge Base with existing Codex content
 * 
 * Run with: npx ts-node scripts/populate-knowledge-base.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface CodexAsset {
  id: string;
  title: string;
  asset_kind: string;
  auto_drive_cid: string;
  episode_number?: number;
  display_mode?: string;
  extracted_text?: string;
  series?: string;
  created_at: string;
}

// Chunking configuration
const MAX_CHUNK_SIZE = 500; // words
const OVERLAP_SIZE = 50; // words

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function chunkText(text: string): Array<{ content: string; index: number; wordCount: number }> {
  const chunks: Array<{ content: string; index: number; wordCount: number }> = [];
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  
  let currentChunk = '';
  let currentWordCount = 0;
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const paragraphWords = countWords(paragraph);
    
    if (currentWordCount + paragraphWords > MAX_CHUNK_SIZE && currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        wordCount: currentWordCount,
      });
      
      // Start new chunk with overlap
      const words = currentChunk.split(/\s+/);
      const overlapText = words.slice(-Math.min(OVERLAP_SIZE, words.length)).join(' ');
      currentChunk = overlapText + '\n\n' + paragraph;
      currentWordCount = Math.min(OVERLAP_SIZE, words.length) + paragraphWords;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentWordCount += paragraphWords;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      wordCount: currentWordCount,
    });
  }

  return chunks;
}

function getContentCategory(assetKind: string): string {
  switch (assetKind) {
    case 'background_lore_doc': return 'world_building';
    case 'game_concept_doc': return 'technical';
    case 'twenty_one_sats_concept': return 'lore';
    case 'cover_pdf': return 'episode_content';
    default: return 'general';
  }
}

async function processAsset(asset: CodexAsset): Promise<boolean> {
  const text = asset.extracted_text;
  if (!text || text.trim().length === 0) {
    console.log(`  Skipping ${asset.title} - no extracted text`);
    return false;
  }

  // Check if already processed
  const { data: existing } = await supabase
    .from('codex_kb_documents')
    .select('id')
    .eq('source_cid', asset.auto_drive_cid)
    .single();

  if (existing) {
    console.log(`  Skipping ${asset.title} - already in KB`);
    return false;
  }

  // Create document
  const wordCount = countWords(text);
  const chunks = chunkText(text);

  const { data: doc, error: docError } = await supabase
    .from('codex_kb_documents')
    .insert({
      source_type: 'pdf',
      source_id: asset.id,
      source_cid: asset.auto_drive_cid,
      title: asset.title,
      domain: 'metaKnyts',
      series: asset.series || 'metaKnyts',
      episode_number: asset.episode_number,
      content_category: getContentCategory(asset.asset_kind),
      tags: [asset.asset_kind],
      extraction_status: 'completed',
      extracted_at: new Date().toISOString(),
      word_count: wordCount,
      chunk_count: chunks.length,
    })
    .select()
    .single();

  if (docError || !doc) {
    console.error(`  Error creating document for ${asset.title}:`, docError);
    return false;
  }

  // Create chunks
  const chunkRecords = chunks.map(chunk => ({
    document_id: doc.id,
    content: chunk.content,
    chunk_index: chunk.index,
    chunk_type: 'text',
    character_refs: [],
    location_refs: [],
    word_count: chunk.wordCount,
    token_count: Math.ceil(chunk.wordCount * 1.3),
  }));

  const { error: chunkError } = await supabase
    .from('codex_kb_chunks')
    .insert(chunkRecords);

  if (chunkError) {
    console.error(`  Error creating chunks for ${asset.title}:`, chunkError);
    return false;
  }

  console.log(`  ✓ ${asset.title}: ${chunks.length} chunks, ${wordCount} words`);
  return true;
}

async function processCharacters(): Promise<number> {
  console.log('\nProcessing characters...');
  
  const { data: characters, error } = await supabase
    .from('codex_characters')
    .select('*')
    .eq('series', 'metaKnyts');

  if (error || !characters) {
    console.error('Error fetching characters:', error);
    return 0;
  }

  let processed = 0;
  for (const char of characters) {
    // Check if already processed
    const { data: existing } = await supabase
      .from('codex_kb_documents')
      .select('id')
      .eq('source_type', 'character')
      .eq('source_id', char.id)
      .single();

    if (existing) {
      console.log(`  Skipping ${char.digiterra_name} - already in KB`);
      continue;
    }

    // Build character content
    const content = [
      `# ${char.digiterra_name}`,
      char.terra_name ? `Terra Name: ${char.terra_name}` : '',
      char.profile ? `\n## Profile\n${char.profile}` : '',
      char.affiliation ? `\nAffiliation: ${char.affiliation}` : '',
      char.base ? `Base: ${char.base}` : '',
      char.origin_ethnicity ? `Origin: ${char.origin_ethnicity}` : '',
    ].filter(Boolean).join('\n');

    if (content.length < 50) {
      console.log(`  Skipping ${char.digiterra_name} - insufficient content`);
      continue;
    }

    const wordCount = countWords(content);

    const { data: doc, error: docError } = await supabase
      .from('codex_kb_documents')
      .insert({
        source_type: 'character',
        source_id: char.id,
        title: char.digiterra_name,
        domain: 'metaKnyts',
        series: 'metaKnyts',
        content_category: 'character_lore',
        tags: ['character', char.affiliation || 'unknown'].filter(Boolean),
        extraction_status: 'completed',
        extracted_at: new Date().toISOString(),
        word_count: wordCount,
        chunk_count: 1,
      })
      .select()
      .single();

    if (docError || !doc) {
      console.error(`  Error creating document for ${char.digiterra_name}:`, docError);
      continue;
    }

    // Create single chunk for character
    const { error: chunkError } = await supabase
      .from('codex_kb_chunks')
      .insert({
        document_id: doc.id,
        content,
        chunk_index: 0,
        chunk_type: 'text',
        character_refs: [char.digiterra_name],
        location_refs: char.base ? [char.base] : [],
        word_count: wordCount,
        token_count: Math.ceil(wordCount * 1.3),
      });

    if (chunkError) {
      console.error(`  Error creating chunk for ${char.digiterra_name}:`, chunkError);
      continue;
    }

    // Create entity for character
    await supabase
      .from('codex_kb_entities')
      .upsert({
        name: char.digiterra_name,
        entity_type: 'character',
        domain: 'metaKnyts',
        canonical_id: char.id,
        aliases: char.terra_name ? [char.terra_name] : [],
        description: char.profile?.substring(0, 500),
        mention_count: 1,
        document_count: 1,
      }, {
        onConflict: 'name,entity_type,domain',
      });

    console.log(`  ✓ ${char.digiterra_name}: 1 chunk, ${wordCount} words`);
    processed++;
  }

  return processed;
}

async function processEpisodes(): Promise<number> {
  console.log('\nProcessing episodes...');
  
  const { data: episodes, error } = await supabase
    .from('codex_episodes')
    .select('*')
    .eq('series', 'metaKnyts');

  if (error || !episodes) {
    console.error('Error fetching episodes:', error);
    return 0;
  }

  let processed = 0;
  for (const ep of episodes) {
    // Check if already processed
    const { data: existing } = await supabase
      .from('codex_kb_documents')
      .select('id')
      .eq('source_type', 'episode')
      .eq('source_id', ep.id)
      .single();

    if (existing) {
      console.log(`  Skipping Episode ${ep.episode_number} - already in KB`);
      continue;
    }

    // Build episode content
    const content = [
      `# Episode ${ep.issue_number}: ${ep.title}`,
      ep.knytcard_focus ? `Focus: ${ep.knytcard_focus}` : '',
      ep.synopsis ? `\n## Synopsis\n${ep.synopsis}` : '',
      ep.intro_quote ? `\n> "${ep.intro_quote}"` : '',
      ep.end_quote ? `\n> "${ep.end_quote}"` : '',
    ].filter(Boolean).join('\n');

    if (content.length < 50) {
      console.log(`  Skipping Episode ${ep.episode_number} - insufficient content`);
      continue;
    }

    const wordCount = countWords(content);

    const { data: doc, error: docError } = await supabase
      .from('codex_kb_documents')
      .insert({
        source_type: 'episode',
        source_id: ep.id,
        title: `Episode ${ep.issue_number}: ${ep.title}`,
        domain: 'metaKnyts',
        series: 'metaKnyts',
        episode_number: ep.episode_number,
        content_category: 'episode_content',
        tags: ['episode', ep.knytcard_focus || 'various'].filter(Boolean),
        extraction_status: 'completed',
        extracted_at: new Date().toISOString(),
        word_count: wordCount,
        chunk_count: 1,
      })
      .select()
      .single();

    if (docError || !doc) {
      console.error(`  Error creating document for Episode ${ep.episode_number}:`, docError);
      continue;
    }

    // Create single chunk for episode
    const { error: chunkError } = await supabase
      .from('codex_kb_chunks')
      .insert({
        document_id: doc.id,
        content,
        chunk_index: 0,
        chunk_type: 'text',
        character_refs: ep.knytcard_focus ? [ep.knytcard_focus] : [],
        location_refs: [],
        word_count: wordCount,
        token_count: Math.ceil(wordCount * 1.3),
      });

    if (chunkError) {
      console.error(`  Error creating chunk for Episode ${ep.episode_number}:`, chunkError);
      continue;
    }

    console.log(`  ✓ Episode ${ep.issue_number}: ${ep.title} - 1 chunk, ${wordCount} words`);
    processed++;
  }

  return processed;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Populating Codex Knowledge Base');
  console.log('='.repeat(60));

  // Process lore documents with extracted text
  console.log('\nProcessing lore documents...');
  const { data: assets, error } = await supabase
    .from('codex_media_assets')
    .select('*')
    .in('asset_kind', ['background_lore_doc', 'game_concept_doc', 'twenty_one_sats_concept'])
    .not('extracted_text', 'is', null);

  if (error) {
    console.error('Error fetching assets:', error);
    return;
  }

  let loreProcessed = 0;
  for (const asset of assets || []) {
    const success = await processAsset(asset as CodexAsset);
    if (success) loreProcessed++;
  }

  // Process characters
  const charsProcessed = await processCharacters();

  // Process episodes
  const episodesProcessed = await processEpisodes();

  // Get final stats
  const { count: docCount } = await supabase
    .from('codex_kb_documents')
    .select('*', { count: 'exact', head: true });

  const { count: chunkCount } = await supabase
    .from('codex_kb_chunks')
    .select('*', { count: 'exact', head: true });

  const { count: entityCount } = await supabase
    .from('codex_kb_entities')
    .select('*', { count: 'exact', head: true });

  console.log('\n' + '='.repeat(60));
  console.log('Knowledge Base Population Complete');
  console.log('='.repeat(60));
  console.log(`Lore documents processed: ${loreProcessed}`);
  console.log(`Characters processed: ${charsProcessed}`);
  console.log(`Episodes processed: ${episodesProcessed}`);
  console.log(`Total documents: ${docCount}`);
  console.log(`Total chunks: ${chunkCount}`);
  console.log(`Total entities: ${entityCount}`);
}

main().catch(console.error);
