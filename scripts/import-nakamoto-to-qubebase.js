const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SOURCE_URL = process.env.SUPABASE_SOURCE_URL;
const SOURCE_KEY = process.env.SUPABASE_SOURCE_SERVICE_ROLE_KEY;

if (!SOURCE_URL || !SOURCE_KEY) {
  console.error('Missing SUPABASE_SOURCE_URL or SUPABASE_SOURCE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Missing .env.local for target Supabase');
  process.exit(1);
}

const env = fs.readFileSync(envPath, 'utf-8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=([^\n\r]+)`, 'm'));
  return match ? match[1].trim() : null;
};

const TARGET_URL = getEnv('SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
const TARGET_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!TARGET_URL || !TARGET_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const source = createClient(SOURCE_URL, SOURCE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const target = createClient(TARGET_URL, TARGET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 500);
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
const TABLE_FILTER = (process.env.TABLES || '').split(',').map((t) => t.trim()).filter(Boolean);
const SEED_ONLY = String(process.env.SEED_ONLY || '').toLowerCase() === 'true';

function extractTablesFromSpec(spec) {
  return Array.from(new Set(Object.keys(spec.paths || {})
    .map((p) => p.replace(/^\//, '').split('/')[0])
    .filter(Boolean)))
    .sort();
}

function getPrimaryKeys(def) {
  const props = def?.properties || {};
  const pk = [];
  for (const [col, prop] of Object.entries(props)) {
    const desc = prop?.description || '';
    if (desc.includes('Primary Key') || desc.includes('<pk/>')) {
      pk.push(col);
    }
  }
  return pk;
}

function normalizeTier(value) {
  if (!value) return null;
  const cleaned = String(value).toUpperCase().replace(/[^A-Z]/g, '');
  if (cleaned.includes('SAT')) return 'SAT';
  if (cleaned.includes('ZERO')) return 'ZERO';
  if (cleaned.includes('FIRST')) return 'FIRST';
  if (cleaned.includes('KEJI')) return 'KEJI';
  if (cleaned.includes('KETA')) return 'KETA';
  return null;
}

function parseInvested(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tierFromInvested(amount) {
  if (amount >= 25000) return 'SAT';
  if (amount >= 1000) return 'ZERO';
  if (amount >= 500) return 'FIRST';
  if (amount >= 250) return 'KEJI';
  if (amount >= 100) return 'KETA';
  return 'NONE';
}

function repTierFromOrder(orderTier) {
  switch (orderTier) {
    case 'SAT': return 'R4_SAT';
    case 'ZERO': return 'R3_ZERO';
    case 'FIRST': return 'R2_FIRST';
    case 'KEJI': return 'R1_KEJI';
    case 'KETA': return 'R0_KETA';
    default: return 'R-';
  }
}

function bucketFromRepTier(repTier) {
  switch (repTier) {
    case 'R4_SAT': return 5;
    case 'R3_ZERO': return 4;
    case 'R2_FIRST': return 3;
    case 'R1_KEJI': return 2;
    case 'R0_KETA': return 1;
    default: return 0;
  }
}

async function fetchSpec(url, key) {
  const resp = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!resp.ok) {
    throw new Error(`OpenAPI fetch failed: ${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}

async function ensureTenant() {
  const { data: franchise } = await target
    .from('franchises')
    .select('id')
    .eq('slug', 'nakamoto')
    .maybeSingle();

  const { data: existing } = await target
    .from('tenants')
    .select('id')
    .eq('slug', 'nakamoto')
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await target
    .from('tenants')
    .insert({
      name: 'Nakamoto',
      slug: 'nakamoto',
      display_name: 'Nakamoto',
      status: 'active',
      active: true,
      franchise_id: franchise?.id || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return created.id;
}

async function loadExistingHandles(domains) {
  const handles = new Set();
  for (const domain of domains) {
    const { data, error } = await target
      .from('personas')
      .select('fio_handle')
      .ilike('fio_handle', `%@${domain}`);

    if (error) {
      console.warn('Failed to load existing handles:', error.message);
      continue;
    }
    (data || []).forEach((row) => {
      if (row.fio_handle) handles.add(row.fio_handle.toLowerCase());
    });
  }
  return handles;
}

function buildFioHandle(email, fallbackId, domain, existingHandles) {
  const local = (email || '').split('@')[0]?.trim();
  let handle = local ? `${local.toLowerCase()}@${domain}` : `${String(fallbackId).slice(0, 8)}@${domain}`;

  if (!existingHandles.has(handle)) return handle;

  const suffix = String(fallbackId).replace(/[^a-f0-9]/gi, '').slice(0, 6) || '000000';
  handle = local
    ? `${local.toLowerCase()}-${suffix}@${domain}`
    : `${String(fallbackId).slice(0, 8)}-${suffix}@${domain}`;

  return handle;
}

function buildDisplayName(firstName, lastName, email, fallback) {
  const full = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  const local = (email || '').split('@')[0]?.trim();
  if (local) return local;
  return fallback;
}

async function importTable(table, def) {
  const pk = getPrimaryKeys(def);
  const targetTable = `nakamoto_${table}`;
  let offset = 0;
  let total = 0;

  if (DRY_RUN) {
    const { count, error } = await source.from(table).select('*', { count: 'exact', head: true });
    if (error) throw error;
    console.log(`[${table}] DRY_RUN rows=${count ?? 0}`);
    return;
  }

  while (true) {
    let query = source.from(table).select('*').range(offset, offset + BATCH_SIZE - 1);
    if (pk.length > 0) {
      query = query.order(pk[0], { ascending: true });
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    total += data.length;

    const insertPayload = data;
    let insertQuery = target.from(targetTable);
    let insertResult;

    if (pk.length > 0) {
      insertResult = await insertQuery.upsert(insertPayload, { onConflict: pk.join(',') });
    } else {
      insertResult = await insertQuery.insert(insertPayload);
    }

    if (insertResult.error) {
      throw insertResult.error;
    }

    console.log(`[${table}] Imported ${total}`);
    offset += data.length;
  }
}

async function importPersonas(table, domain, tenantId, existingHandles) {
  let offset = 0;
  let total = 0;

  if (DRY_RUN) {
    const { count, error } = await source.from(table).select('*', { count: 'exact', head: true });
    if (error) throw error;
    console.log(`[${table}] DRY_RUN personas=${count ?? 0}`);
    return;
  }

  while (true) {
    let query = source.from(table).select('*').range(offset, offset + BATCH_SIZE - 1);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    const payload = data.map((row) => {
      const email = row['Email'] || row.email || '';
      const fallbackId = row.id || row.user_id;
      const fioHandle = buildFioHandle(email, fallbackId, domain, existingHandles);
      existingHandles.add(fioHandle.toLowerCase());

      const invested = parseInvested(row['Total-Invested'] || row.total_invested || row.total_invested_usd);
      const omTier = normalizeTier(row['OM-Tier-Status'] || row.om_tier_status);
      const orderTier = omTier || tierFromInvested(invested);
      const repTier = repTierFromOrder(orderTier);
      const bucket = bucketFromRepTier(repTier);

      return {
        id: row.id,
        type: 'human',
        fio_handle: fioHandle,
        fio_domain: domain,
        root_did: `did:iq:persona:${row.id}`,
        display_name: buildDisplayName(row['First-Name'], row['Last-Name'], email, fioHandle),
        avatar_uri: row.profile_image_url || null,
        evm_key: {},
        chain_addresses: {},
        evm_address: row['EVM-Public-Key'] || null,
        btc_address: row['BTC-Public-Key'] || null,
        status: 'active',
        tenant_id: tenantId,
        reputation_score: 0,
        reputation_bucket: bucket,
        order_tier: orderTier,
        reputation_tier: repTier,
        badges: [],
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || row.created_at || new Date().toISOString(),
      };
    });

    const { error: upsertError } = await target
      .from('personas')
      .upsert(payload, { onConflict: 'id' });

    if (upsertError) throw upsertError;

    total += payload.length;
    console.log(`[${table}] Seeded personas ${total}`);
    offset += data.length;
  }
}

async function main() {
  console.log('Fetching source schema...');
  const sourceSpec = await fetchSpec(SOURCE_URL, SOURCE_KEY);
  const tables = extractTablesFromSpec(sourceSpec);
  const defs = sourceSpec.definitions || {};

  console.log(`Found ${tables.length} tables in source.`);

  const tablesToImport = SEED_ONLY
    ? []
    : (TABLE_FILTER.length ? tables.filter((t) => TABLE_FILTER.includes(t)) : tables);

  for (const table of tablesToImport) {
    const def = defs[table];
    if (!def) {
      console.warn('Skipping missing definition for', table);
      continue;
    }

    console.log(`\nImporting ${table} -> nakamoto_${table}`);
    await importTable(table, def);
  }

  console.log('\nSeeding personas from knyt_personas and qripto_personas...');
  const tenantId = await ensureTenant();
  const existingHandles = await loadExistingHandles(['knyt', 'qripto']);

  await importPersonas('knyt_personas', 'knyt', tenantId, existingHandles);
  await importPersonas('qripto_personas', 'qripto', tenantId, existingHandles);

  console.log('Done.');
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
