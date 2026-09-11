/**
 * POST /api/contacts/csv-import
 *
 * Accepts a multipart/form-data upload with a single CSV file and a
 * `source` field indicating where the export came from.
 *
 * Supported sources: 'linkedin' | 'outlook' | 'csv'
 *
 * LinkedIn export columns (Connections.csv):
 *   First Name, Last Name, Email Address, Company, Position, Connected On
 *
 * Outlook export columns (contacts.csv):
 *   First Name, Last Name, E-mail Address, Company, Job Title, Business Phone,
 *   Mobile Phone, Business Street, Notes
 *
 * Generic CSV — flexible column matching via lowercase trimmed header:
 *   first_name / first name / given_name, last_name / last name / family_name,
 *   email / email_address / e-mail address, phone / mobile phone / business phone,
 *   organization / company, job_title / position / title, address, notes
 *
 * 5 MB file limit. Idempotent on (persona_id, source, source_id) where
 * source_id = sha256(display_name + email).slice(0, 24).
 *
 * Response: { ok, imported, skipped, total }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const VALID_SOURCES = ['linkedin', 'outlook', 'csv'] as const;
type CsvSource = (typeof VALID_SOURCES)[number];

interface ParsedRow {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  org: string | null;
  title: string | null;
  address: string | null;
  notes: string | null;
}

/** Minimal CSV parser — handles quoted fields with commas, strips BOM */
function parseCsv(text: string): string[][] {
  const lines = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        fields.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    rows.push(fields.map(f => f.trim()));
  }
  return rows;
}

/** Resolve a column index from the header row by matching against aliases */
function col(headers: string[], ...aliases: string[]): number {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function val(row: string[], idx: number): string | null {
  if (idx < 0 || idx >= row.length) return null;
  return row[idx].trim() || null;
}

function parseLinkedin(rows: string[][]): ParsedRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const iFirst  = col(headers, 'first name', 'first_name');
  const iLast   = col(headers, 'last name', 'last_name');
  const iEmail  = col(headers, 'email address', 'email');
  const iOrg    = col(headers, 'company', 'organization');
  const iTitle  = col(headers, 'position', 'job title', 'title');

  return rows.slice(1).map(row => {
    const firstName = val(row, iFirst);
    const lastName  = val(row, iLast);
    const email     = val(row, iEmail)?.toLowerCase() ?? null;
    const org       = val(row, iOrg);
    const title     = val(row, iTitle);
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || email || null;
    return { firstName, lastName, displayName, email, phone: null, org, title, address: null, notes: null };
  }).filter(r => r.displayName || r.email);
}

function parseOutlook(rows: string[][]): ParsedRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const iFirst   = col(headers, 'first name', 'first_name');
  const iLast    = col(headers, 'last name', 'last_name');
  const iEmail   = col(headers, 'e-mail address', 'email address', 'email');
  const iOrg     = col(headers, 'company', 'organization');
  const iTitle   = col(headers, 'job title', 'title', 'position');
  const iPhone   = col(headers, 'mobile phone', 'business phone', 'phone');
  const iAddr    = col(headers, 'business street', 'home street', 'address');
  const iNotes   = col(headers, 'notes');

  return rows.slice(1).map(row => {
    const firstName = val(row, iFirst);
    const lastName  = val(row, iLast);
    const email     = val(row, iEmail)?.toLowerCase() ?? null;
    const phone     = val(row, iPhone);
    const org       = val(row, iOrg);
    const title     = val(row, iTitle);
    const address   = val(row, iAddr);
    const notes     = val(row, iNotes);
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || email || null;
    return { firstName, lastName, displayName, email, phone, org, title, address, notes };
  }).filter(r => r.displayName || r.email);
}

function parseGenericCsv(rows: string[][]): ParsedRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const iFirst  = col(headers, 'first_name', 'first name', 'given_name', 'given name');
  const iLast   = col(headers, 'last_name', 'last name', 'family_name', 'family name', 'surname');
  const iName   = col(headers, 'name', 'display_name', 'full_name', 'full name');
  const iEmail  = col(headers, 'email', 'email_address', 'e-mail', 'e-mail address', 'email address');
  const iPhone  = col(headers, 'phone', 'phone_number', 'mobile', 'mobile phone', 'cell');
  const iOrg    = col(headers, 'company', 'organization', 'org');
  const iTitle  = col(headers, 'title', 'job_title', 'job title', 'position', 'role');
  const iAddr   = col(headers, 'address', 'street', 'business street');
  const iNotes  = col(headers, 'notes', 'note', 'comments');

  return rows.slice(1).map(row => {
    const firstName = val(row, iFirst);
    const lastName  = val(row, iLast);
    const email     = val(row, iEmail)?.toLowerCase() ?? null;
    const phone     = val(row, iPhone);
    const org       = val(row, iOrg);
    const title     = val(row, iTitle);
    const address   = val(row, iAddr);
    const notes     = val(row, iNotes);
    const displayName = val(row, iName) ||
      [firstName, lastName].filter(Boolean).join(' ') || email || null;
    return { firstName, lastName, displayName, email, phone, org, title, address, notes };
  }).filter(r => r.displayName || r.email);
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const source = (formData.get('source') as string | null)?.trim() as CsvSource | null;

  if (!file) {
    return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
  }
  if (!source || !VALID_SOURCES.includes(source)) {
    return NextResponse.json(
      { ok: false, error: `source must be one of: ${VALID_SOURCES.join(', ')}` },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'File exceeds 5 MB limit' }, { status: 413 });
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json({ ok: false, error: 'File must be a .csv export' }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);

  let parsed: ParsedRow[];
  if (source === 'linkedin') parsed = parseLinkedin(rows);
  else if (source === 'outlook') parsed = parseOutlook(rows);
  else parsed = parseGenericCsv(rows);

  if (parsed.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, skipped: 0, total: 0 });
  }

  const supabase = getSupabaseServer();

  const dbRows = parsed.map(c => {
    const sourceId = createHash('sha256')
      .update((c.displayName ?? '') + (c.email ?? ''))
      .digest('hex')
      .slice(0, 24);
    return {
      persona_id: persona.personaId,
      source,
      source_id: sourceId,
      display_name: c.displayName,
      first_name: c.firstName,
      last_name: c.lastName,
      organization: c.org,
      job_title: c.title,
      email: c.email,
      phone: c.phone,
      address: c.address,
      notes: c.notes,
      updated_at: new Date().toISOString(),
    };
  });

  const BATCH = 200;
  let imported = 0;
  for (let i = 0; i < dbRows.length; i += BATCH) {
    const batch = dbRows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('persona_contacts')
      .upsert(batch, { onConflict: 'persona_id,source,source_id', ignoreDuplicates: false });
    if (error) {
      console.error('[contacts/csv-import] upsert error:', error.message);
    } else {
      imported += batch.length;
    }
  }

  return NextResponse.json({ ok: true, imported, skipped: parsed.length - imported, total: parsed.length });
}
