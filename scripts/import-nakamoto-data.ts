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
  franchise: {
    name: string;
    slug: string;
    systemPrompt?: string;
    kbEndpoint?: string;
    uiUrl?: string;
    description?: string;
  };
  knowledgeBase: {
    documents: KBDocument[];
  };
  users: UserData[];
  interactions: InteractionData[];
}

interface KBDocument {
  id?: string;
  type: 'COYN' | 'KNYT' | 'iQube' | 'general';
  title: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  createdAt?: string;
}

interface UserData {
  id?: string;
  email?: string;
  name?: string;
  fioHandle?: string;
  walletAddress?: string;
  persona?: {
    type?: string;
    avatar?: string;
    preferences?: Record<string, any>;
  };
  createdAt?: string;
}

interface InteractionData {
  userId: string;
  sessionId?: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
  }>;
  agentId?: string;
  createdAt?: string;
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
      // Check if document already exists (by title + franchise)
      const { data: existing } = await supabase
        .from('knowledge_base')
        .select('id')
        .eq('franchise_id', franchiseId)
        .eq('title', doc.title)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from('knowledge_base')
        .insert({
          franchise_id: franchiseId,
          doc_type: doc.type,
          title: doc.title,
          content: doc.content,
          metadata: doc.metadata || {},
          embedding: doc.embedding,
          created_at: doc.createdAt || new Date().toISOString(),
        });

      if (error) {
        console.error(`   ❌ Error importing "${doc.title}":`, error.message);
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
    const fioHandle = user.fioHandle || user.email?.split('@')[0] + '@nakamoto' || `user_${Date.now()}`;

    try {
      // Check if persona already exists
      const { data: existing } = await supabase
        .from('persona')
        .select('id')
        .eq('fio_handle', fioHandle)
        .single();

      if (existing) {
        if (user.id) userIdMap.set(user.id, existing.id);
        skipped++;
        continue;
      }

      const { data: newPersona, error } = await supabase
        .from('persona')
        .insert({
          fio_handle: fioHandle,
          default_identity_state: user.persona?.type || 'semi_anonymous',
          app_origin: 'nakamoto',
          franchise_id: franchiseId,
          created_at: user.createdAt || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error(`   ❌ Error importing ${fioHandle}:`, error.message);
        errors++;
        continue;
      }

      if (user.id) userIdMap.set(user.id, newPersona.id);
      imported++;
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
      // Map old user ID to new persona ID
      const personaId = userIdMap.get(interaction.userId) || interaction.userId;

      const { error } = await supabase
        .from('chat_history')
        .insert({
          franchise_id: franchiseId,
          persona_id: personaId,
          session_id: interaction.sessionId || `session_${Date.now()}`,
          agent_id: interaction.agentId || 'nakamoto',
          messages: interaction.messages,
          created_at: interaction.createdAt || new Date().toISOString(),
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

  // Validate structure
  if (!data.franchise) {
    console.error('❌ Missing "franchise" in JSON');
    process.exit(1);
  }

  console.log(`\n📊 Data Summary:`);
  console.log(`   Franchise: ${data.franchise.name}`);
  console.log(`   KB Documents: ${data.knowledgeBase?.documents?.length || 0}`);
  console.log(`   Users: ${data.users?.length || 0}`);
  console.log(`   Interactions: ${data.interactions?.length || 0}`);

  // Import franchise
  const franchiseId = await importFranchise(data.franchise);
  if (!franchiseId) {
    console.error('❌ Failed to import franchise. Aborting.');
    process.exit(1);
  }

  // Store system prompt if provided
  if (data.franchise.systemPrompt) {
    console.log(`\n📝 System prompt provided (${data.franchise.systemPrompt.length} chars)`);
    // Store in franchise_config or similar table
    const { error } = await supabase
      .from('franchise_config')
      .upsert({
        franchise_id: franchiseId,
        key: 'system_prompt',
        value: data.franchise.systemPrompt,
      }, { onConflict: 'franchise_id,key' });

    if (error && error.code !== '42P01') {
      console.log(`   ⚠️ Could not store system prompt: ${error.message}`);
    } else if (!error) {
      console.log(`   ✅ System prompt stored`);
    }
  }

  // Import KB documents
  const kbResults = data.knowledgeBase?.documents?.length
    ? await importKnowledgeBase(data.knowledgeBase.documents, franchiseId)
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
