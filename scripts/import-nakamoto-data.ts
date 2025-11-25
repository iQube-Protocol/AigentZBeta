/**
 * Import Nakamoto Franchise Data to QubeBase
 * 
 * Usage:
 *   npx ts-node scripts/import-nakamoto-data.ts path/to/nakamoto-export.json
 * 
 * Or with environment variables:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/import-nakamoto-data.ts data.json
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface NakamotoExport {
  export_metadata?: {
    exported_at: string;
    source_system: string;
    version: string;
  };
  // New format
  kb_documents?: KBDocument[];
  system_prompt?: {
    app: string;
    scope: string;
    prompt_text: string;
  };
  // Legacy format
  franchise?: {
    name: string;
    slug: string;
    systemPrompt?: string;
    kbEndpoint?: string;
    uiUrl?: string;
    description?: string;
  };
  knowledgeBase?: {
    documents: KBDocument[];
  };
  users: UserData[];
  interactions: InteractionData[];
  stats?: Record<string, any>;
}

interface KBDocument {
  id?: string;
  slug?: string;
  type?: 'COYN' | 'KNYT' | 'iQube' | 'general';
  title: string;
  content?: string;
  content_text?: string;
  lang?: string;
  tags?: string[];
  domain?: string;
  topic?: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  createdAt?: string;
}

interface UserData {
  id?: string;
  source_user_id?: string;
  email?: string;
  name?: string;
  fioHandle?: string;
  fio_handle?: string;
  walletAddress?: string;
  wallet_address?: string;
  tenant_id?: string;
  status?: string;
  persona_type?: string;
  persona?: {
    type?: string;
    avatar?: string;
    preferences?: Record<string, any>;
  };
  invitation_status?: Record<string, any>;
  createdAt?: string;
  created_at?: string;
}

interface InteractionData {
  userId?: string;
  user_id?: string;
  sessionId?: string;
  session_id?: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
  }>;
  agentId?: string;
  agent_id?: string;
  createdAt?: string;
  created_at?: string;
}

// ============================================================================
// SETUP
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  console.log('\nSet them in your environment or .env.local file:');
  console.log('  export SUPABASE_URL="https://your-project.supabase.co"');
  console.log('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

async function ensureTablesExist(supabase: SupabaseClient) {
  console.log('📋 Checking required tables...\n');

  // Check if knowledge_base table exists, create if not
  const { error: kbError } = await supabase.from('knowledge_base').select('id').limit(1);
  if (kbError?.code === '42P01') {
    console.log('Creating knowledge_base table...');
    // Table doesn't exist - we'll create it via SQL
  }

  // Check if chat_history table exists
  const { error: chatError } = await supabase.from('chat_history').select('id').limit(1);
  if (chatError?.code === '42P01') {
    console.log('Creating chat_history table...');
  }
}

async function importFranchise(data: NakamotoExport['franchise']): Promise<string | null> {
  console.log(`\n🏢 Importing franchise: ${data.name}`);

  const { data: existing, error: fetchError } = await supabase
    .from('franchises')
    .select('id')
    .eq('slug', data.slug)
    .single();

  if (existing) {
    // Update existing franchise
    const { error } = await supabase
      .from('franchises')
      .update({
        name: data.name,
        description: data.description,
        kb_endpoint: data.kbEndpoint,
        ui_url: data.uiUrl,
        // Store system prompt in a config column or separate table
      })
      .eq('id', existing.id);

    if (error) {
      console.error(`   ❌ Error updating franchise:`, error.message);
      return null;
    }

    console.log(`   ✅ Updated existing franchise (ID: ${existing.id})`);
    return existing.id;
  }

  // Create new franchise
  const { data: newFranchise, error } = await supabase
    .from('franchises')
    .insert({
      name: data.name,
      slug: data.slug,
      description: data.description,
      kb_endpoint: data.kbEndpoint,
      ui_url: data.uiUrl,
      active: true,
    })
    .select()
    .single();

  if (error) {
    console.error(`   ❌ Error creating franchise:`, error.message);
    return null;
  }

  console.log(`   ✅ Created franchise (ID: ${newFranchise.id})`);
  return newFranchise.id;
}

async function importKnowledgeBase(
  documents: KBDocument[],
  franchiseId: string
): Promise<{ imported: number; skipped: number; errors: number }> {
  console.log(`\n📚 Importing ${documents.length} KB documents...`);

  let imported = 0, skipped = 0, errors = 0;

  for (const doc of documents) {
    try {
      const title = doc.title || doc.slug || 'Untitled';
      const content = doc.content || doc.content_text || '';
      
      // Determine doc type from domain or tags
      let docType = doc.type || 'general';
      if (!doc.type) {
        if (doc.domain?.includes('coyn') || doc.tags?.some(t => t.toLowerCase().includes('coyn'))) {
          docType = 'COYN';
        } else if (doc.domain?.includes('knyt') || doc.tags?.some(t => t.toLowerCase().includes('knyt'))) {
          docType = 'KNYT';
        } else if (doc.tags?.some(t => t.toLowerCase().includes('iqube'))) {
          docType = 'iQube';
        }
      }

      // Check if document already exists (by title + franchise)
      const { data: existing } = await supabase
        .from('knowledge_base')
        .select('id')
        .eq('franchise_id', franchiseId)
        .eq('title', title)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from('knowledge_base')
        .insert({
          franchise_id: franchiseId,
          doc_type: docType,
          title: title,
          content: content,
          metadata: {
            ...doc.metadata,
            slug: doc.slug,
            tags: doc.tags,
            domain: doc.domain,
            topic: doc.topic,
            lang: doc.lang,
          },
          created_at: doc.createdAt || new Date().toISOString(),
        });

      if (error) {
        console.error(`   ❌ Error importing "${title}":`, error.message);
        errors++;
        continue;
      }

      imported++;
    } catch (err: any) {
      console.error(`   ❌ Error importing "${doc.title}":`, err.message);
      errors++;
    }
  }

  console.log(`   ✅ Imported: ${imported}, ⏭️ Skipped: ${skipped}, ❌ Errors: ${errors}`);
  return { imported, skipped, errors };
}

async function importUsers(
  users: UserData[],
  franchiseId: string
): Promise<{ imported: number; skipped: number; errors: number; userIdMap: Map<string, string> }> {
  console.log(`\n👥 Importing ${users.length} users...`);

  let imported = 0, skipped = 0, errors = 0;
  const userIdMap = new Map<string, string>(); // old ID -> new ID

  for (const user of users) {
    // Handle various field name formats
    const sourceId = user.source_user_id || user.id;
    const email = user.email;
    const fioHandle = user.fioHandle || user.fio_handle || email?.split('@')[0] + '@nakamoto' || `user_${Date.now()}`;
    const personaType = user.persona_type || user.persona?.type || 'semi_anonymous';
    const createdAt = user.created_at || user.createdAt || new Date().toISOString();

    try {
      // Check if persona already exists by fio_handle
      const { data: existing } = await supabase
        .from('persona')
        .select('id')
        .eq('fio_handle', fioHandle)
        .single();

      if (existing) {
        if (sourceId) userIdMap.set(sourceId, existing.id);
        skipped++;
        continue;
      }

      const { data: newPersona, error } = await supabase
        .from('persona')
        .insert({
          fio_handle: fioHandle,
          default_identity_state: personaType === 'knyt' ? 'semi_anonymous' : personaType,
          app_origin: 'nakamoto',
          franchise_id: franchiseId,
          created_at: createdAt,
        })
        .select()
        .single();

      if (error) {
        console.error(`   ❌ Error importing ${fioHandle}:`, error.message);
        errors++;
        continue;
      }

      if (sourceId) userIdMap.set(sourceId, newPersona.id);
      imported++;
      
      // Log progress every 100 users
      if (imported % 100 === 0) {
        console.log(`   ... imported ${imported} users so far`);
      }
    } catch (err: any) {
      console.error(`   ❌ Error importing ${fioHandle}:`, err.message);
      errors++;
    }
  }

  console.log(`   ✅ Imported: ${imported}, ⏭️ Skipped: ${skipped}, ❌ Errors: ${errors}`);
  return { imported, skipped, errors, userIdMap };
}

async function importInteractions(
  interactions: InteractionData[],
  franchiseId: string,
  userIdMap: Map<string, string>
): Promise<{ imported: number; skipped: number; errors: number }> {
  console.log(`\n💬 Importing ${interactions.length} interaction histories...`);

  let imported = 0, skipped = 0, errors = 0;

  for (const interaction of interactions) {
    try {
      // Handle various field name formats
      const userId = interaction.userId || interaction.user_id;
      const sessionId = interaction.sessionId || interaction.session_id || `session_${Date.now()}`;
      const agentId = interaction.agentId || interaction.agent_id || 'nakamoto';
      const createdAt = interaction.createdAt || interaction.created_at || new Date().toISOString();
      
      // Map old user ID to new persona ID
      const personaId = userId ? (userIdMap.get(userId) || userId) : null;

      const { error } = await supabase
        .from('chat_history')
        .insert({
          franchise_id: franchiseId,
          persona_id: personaId,
          session_id: sessionId,
          agent_id: agentId,
          messages: interaction.messages,
          created_at: createdAt,
        });

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
          console.log('   ⚠️ chat_history table does not exist. Skipping interactions.');
          return { imported: 0, skipped: interactions.length, errors: 0 };
        }
        errors++;
        continue;
      }

      imported++;
      
      // Log progress every 100 interactions
      if (imported % 100 === 0) {
        console.log(`   ... imported ${imported} interactions so far`);
      }
    } catch (err: any) {
      errors++;
    }
  }

  console.log(`   ✅ Imported: ${imported}, ⏭️ Skipped: ${skipped}, ❌ Errors: ${errors}`);
  return { imported, skipped, errors };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const jsonPath = process.argv[2];

  if (!jsonPath) {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           Nakamoto Franchise Data Import Tool                    ║
╚══════════════════════════════════════════════════════════════════╝

Usage:
  npx ts-node scripts/import-nakamoto-data.ts <path-to-json>

JSON Format:
{
  "franchise": {
    "name": "Nakamoto",
    "slug": "nakamoto",
    "systemPrompt": "You are Nakamoto...",
    "kbEndpoint": "https://..."
  },
  "knowledgeBase": {
    "documents": [
      { "type": "COYN", "title": "...", "content": "..." },
      { "type": "KNYT", "title": "...", "content": "..." },
      { "type": "iQube", "title": "...", "content": "..." }
    ]
  },
  "users": [
    { "email": "...", "name": "...", "fioHandle": "...", "persona": {...} }
  ],
  "interactions": [
    { "userId": "...", "messages": [...], "agentId": "nakamoto" }
  ]
}

Example:
  npx ts-node scripts/import-nakamoto-data.ts ./data/nakamoto-export.json
`);
    process.exit(1);
  }

  const fullPath = path.resolve(jsonPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    process.exit(1);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           Nakamoto Franchise Data Import                         ║
╚══════════════════════════════════════════════════════════════════╝
`);

  console.log(`📂 Reading: ${fullPath}`);

  let data: NakamotoExport;
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    data = JSON.parse(content);
  } catch (err: any) {
    console.error(`❌ Error parsing JSON:`, err.message);
    process.exit(1);
  }

  // Handle both new and legacy formats
  const kbDocuments = data.kb_documents || data.knowledgeBase?.documents || [];
  const systemPrompt = data.system_prompt?.prompt_text || data.franchise?.systemPrompt;
  const franchiseName = data.export_metadata?.source_system || data.franchise?.name || 'Nakamoto';

  console.log(`\n📊 Data Summary:`);
  console.log(`   Source: ${franchiseName}`);
  console.log(`   KB Documents: ${kbDocuments.length}`);
  console.log(`   Users: ${data.users?.length || 0}`);
  console.log(`   Interactions: ${data.interactions?.length || 0}`);
  if (systemPrompt) {
    console.log(`   System Prompt: ${systemPrompt.length} chars`);
  }

  // Get or create Nakamoto franchise
  const { data: existingFranchise } = await supabase
    .from('franchises')
    .select('id')
    .eq('slug', 'nakamoto')
    .single();

  let franchiseId: string;
  if (existingFranchise) {
    franchiseId = existingFranchise.id;
    console.log(`\n🏢 Using existing Nakamoto franchise (ID: ${franchiseId})`);
  } else {
    const { data: newFranchise, error } = await supabase
      .from('franchises')
      .insert({
        name: 'Nakamoto',
        slug: 'nakamoto',
        description: 'Bitcoin-native AI agents and services',
        active: true,
      })
      .select()
      .single();

    if (error || !newFranchise) {
      console.error('❌ Failed to create franchise:', error?.message);
      process.exit(1);
    }
    franchiseId = newFranchise.id;
    console.log(`\n🏢 Created Nakamoto franchise (ID: ${franchiseId})`);
  }

  // Store system prompt if provided
  if (systemPrompt) {
    console.log(`\n📝 Storing system prompt (${systemPrompt.length} chars)`);
    const { error } = await supabase
      .from('franchise_config')
      .upsert({
        franchise_id: franchiseId,
        key: 'system_prompt',
        value: systemPrompt,
      }, { onConflict: 'franchise_id,key' });

    if (error && error.code !== '42P01') {
      console.log(`   ⚠️ Could not store system prompt: ${error.message}`);
    } else if (!error) {
      console.log(`   ✅ System prompt stored`);
    }
  }

  // Import KB documents
  const kbResults = kbDocuments.length
    ? await importKnowledgeBase(kbDocuments, franchiseId)
    : { imported: 0, skipped: 0, errors: 0 };

  // Import users
  const userResults = data.users?.length
    ? await importUsers(data.users, franchiseId)
    : { imported: 0, skipped: 0, errors: 0, userIdMap: new Map() };

  // Import interactions
  const interactionResults = data.interactions?.length
    ? await importInteractions(data.interactions, franchiseId, userResults.userIdMap)
    : { imported: 0, skipped: 0, errors: 0 };

  // Summary
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                       Import Complete                            ║
╠══════════════════════════════════════════════════════════════════╣
║  Franchise:    ${franchiseId.padEnd(44)}║
╠══════════════════════════════════════════════════════════════════╣
║  KB Documents: ${String(kbResults.imported).padStart(4)} imported, ${String(kbResults.skipped).padStart(4)} skipped, ${String(kbResults.errors).padStart(4)} errors   ║
║  Users:        ${String(userResults.imported).padStart(4)} imported, ${String(userResults.skipped).padStart(4)} skipped, ${String(userResults.errors).padStart(4)} errors   ║
║  Interactions: ${String(interactionResults.imported).padStart(4)} imported, ${String(interactionResults.skipped).padStart(4)} skipped, ${String(interactionResults.errors).padStart(4)} errors   ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

main().catch(console.error);
