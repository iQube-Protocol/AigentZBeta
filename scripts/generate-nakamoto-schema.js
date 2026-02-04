const fs = require('fs');
const path = require('path');

const SOURCE_URL = process.env.SUPABASE_SOURCE_URL;
const SOURCE_KEY = process.env.SUPABASE_SOURCE_SERVICE_ROLE_KEY;
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.join(process.cwd(), 'supabase/migrations/20260108_nakamoto_schema.sql');

if (!SOURCE_URL || !SOURCE_KEY) {
  console.error('Missing SUPABASE_SOURCE_URL or SUPABASE_SOURCE_SERVICE_ROLE_KEY');
  process.exit(1);
}

function mapType(prop) {
  if (!prop) return 'text';

  if (prop.format === 'jsonb') return 'jsonb';

  if (prop.type === 'array') {
    if (prop.format && prop.format.endsWith('[]')) return prop.format;
    const itemType = prop.items?.type || 'string';
    if (itemType === 'integer') return 'integer[]';
    if (itemType === 'number') return 'numeric[]';
    if (itemType === 'boolean') return 'boolean[]';
    if (itemType === 'object') return 'jsonb[]';
    return 'text[]';
  }

  const format = prop.format || '';
  if (format === 'uuid') return 'uuid';
  if (format === 'timestamp with time zone') return 'timestamptz';
  if (format === 'timestamp without time zone') return 'timestamp';
  if (format === 'date') return 'date';
  if (format === 'integer') return 'integer';
  if (format === 'bigint') return 'bigint';
  if (format === 'numeric') return 'numeric';
  if (format === 'boolean') return 'boolean';
  if (format === 'text') return 'text';
  if (format === 'character varying') return 'text';

  if (prop.type === 'integer') return 'integer';
  if (prop.type === 'number') return 'numeric';
  if (prop.type === 'boolean') return 'boolean';
  if (prop.type === 'string') return 'text';

  return 'text';
}

function formatDefault(value, type) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return `''`;
    if (/^[a-z_]+\(\)$/i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) return trimmed;
    if (/\bnow\(|gen_random_uuid\(|uuid_generate|current_timestamp|timezone\(/i.test(trimmed)) return trimmed;
    if (trimmed.includes('::')) return trimmed;
    if (type.endsWith('[]')) {
      if (trimmed === '[]') return `'{}'`;
    }
    return `'${trimmed.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return null;
}

function isPrimaryKey(prop) {
  const desc = prop?.description || '';
  return desc.includes('Primary Key') || desc.includes('<pk/>');
}

(async () => {
  const resp = await fetch(`${SOURCE_URL}/rest/v1/`, {
    headers: { apikey: SOURCE_KEY, Authorization: `Bearer ${SOURCE_KEY}` },
  });

  if (!resp.ok) {
    console.error('Failed to fetch OpenAPI:', resp.status, await resp.text());
    process.exit(1);
  }

  const spec = await resp.json();
  const tables = Array.from(new Set(Object.keys(spec.paths || {})
    .map((p) => p.replace(/^\//, '').split('/')[0])
    .filter(Boolean)))
    .sort();

  const definitions = spec.definitions || {};

  const statements = [];
  statements.push('-- Auto-generated Nakamoto schema mirror');
  statements.push('-- Source: ' + SOURCE_URL);
  statements.push('-- Generated at: ' + new Date().toISOString());
  statements.push('');

  for (const table of tables) {
    const def = definitions[table];
    if (!def) {
      console.warn('Skipping missing definition for', table);
      continue;
    }

    const props = def.properties || {};
    const required = new Set(def.required || []);
    const pkCols = [];
    const columnLines = [];

    for (const [col, prop] of Object.entries(props)) {
      const colName = '"' + col.replace(/"/g, '""') + '"';
      const colType = mapType(prop);
      const notNull = required.has(col) ? ' NOT NULL' : '';
      const defaultValue = formatDefault(prop.default, colType);
      const defaultClause = defaultValue ? ` DEFAULT ${defaultValue}` : '';

      if (isPrimaryKey(prop)) {
        pkCols.push(colName);
      }

      columnLines.push(`  ${colName} ${colType}${defaultClause}${notNull}`);
    }

    if (pkCols.length > 0) {
      columnLines.push(`  PRIMARY KEY (${pkCols.join(', ')})`);
    }

    const targetTable = `nakamoto_${table}`;
    statements.push(`CREATE TABLE IF NOT EXISTS public."${targetTable}" (`);
    statements.push(columnLines.join(',\n'));
    statements.push(');');
    statements.push('');
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, statements.join('\n'));
  console.log('Wrote', OUTPUT_PATH);
})();
