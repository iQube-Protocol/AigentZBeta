/**
 * POST /api/contacts/vcard-import
 *
 * Accepts a multipart/form-data upload with a single .vcf file (vCard 2.1/3.0/4.0).
 * Parses the vCard text and upserts contacts into persona_contacts.
 *
 * iPhone export: Settings → Contacts → Import — exports a single .vcf with
 * all contacts. macOS export: Contacts app → select all → File → Export vCard.
 *
 * 10 MB file limit. Idempotent on (persona_id, source, source_id) where
 * source_id is the vCard UID field (or a hash of display_name+email when absent).
 *
 * Response: { ok, imported, skipped, total }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;

interface ParsedContact {
  uid: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  emails: string[];
  phones: string[];
  org: string | null;
  title: string | null;
  address: string | null;
  notes: string | null;
}

/** Decode quoted-printable encoding (common in vCard 2.1) */
function decodeQP(s: string): string {
  return s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16))
  );
}

/** Unfold vCard lines (RFC 6350 §3.2: CRLF + single space/tab = continuation) */
function unfold(text: string): string {
  return text.replace(/\r?\n[ \t]/g, '');
}

/** Extract a property value, handling encoding and multiple values */
function prop(lines: string[], name: string): string | null {
  const re = new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, 'im');
  const m = unfold(lines.join('\n')).match(re);
  if (!m) return null;
  const valueStr = m[1].trim();
  // Handle quoted-printable
  if (lines.join('\n').match(new RegExp(`${name}[^:]*ENCODING=QUOTED-PRINTABLE`, 'i'))) {
    return decodeQP(valueStr);
  }
  return valueStr;
}

/** Extract all values for a repeated property (e.g. EMAIL, TEL) */
function propAll(lines: string[], name: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`^${name}(?:;[^:]*)?:(.+)$`, 'gim');
  const text = unfold(lines.join('\n'));
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = m[1].trim();
    if (v) results.push(v);
  }
  return results;
}

function parseVCards(text: string): ParsedContact[] {
  // Split on BEGIN:VCARD / END:VCARD blocks
  const blocks = text.split(/BEGIN:VCARD/i).slice(1);
  const contacts: ParsedContact[] = [];

  for (const block of blocks) {
    const end = block.indexOf('END:VCARD');
    const body = (end >= 0 ? block.slice(0, end) : block).trim();
    const lines = body.split(/\r?\n/);

    const uid = prop(lines, 'UID');
    const fnVal = prop(lines, 'FN');

    // N field: Last;First;Middle;Prefix;Suffix
    const nVal = prop(lines, 'N');
    let firstName: string | null = null;
    let lastName: string | null = null;
    if (nVal) {
      const parts = nVal.split(';');
      lastName = parts[0]?.trim() || null;
      firstName = parts[1]?.trim() || null;
    }

    const emails = propAll(lines, 'EMAIL').map(e => e.toLowerCase().trim()).filter(Boolean);
    const phones = propAll(lines, 'TEL').map(p => p.replace(/\s/g, '').trim()).filter(Boolean);

    // ORG: Company;Division
    const orgVal = prop(lines, 'ORG');
    const org = orgVal ? orgVal.split(';')[0]?.trim() || null : null;
    const title = prop(lines, 'TITLE');

    // ADR: PO;Extended;Street;City;Region;Postal;Country
    const adrVal = prop(lines, 'ADR');
    let address: string | null = null;
    if (adrVal) {
      address = adrVal.split(';').filter(Boolean).join(', ') || null;
    }

    const notes = prop(lines, 'NOTE');
    const displayName = fnVal?.trim() || [firstName, lastName].filter(Boolean).join(' ') || emails[0] || null;

    if (!displayName && !emails[0] && !phones[0]) continue;

    contacts.push({ uid, displayName, firstName, lastName, emails, phones, org, title, address, notes });
  }

  return contacts;
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  // ?source=icloud lets iCloud exports be tagged separately from iPhone vCards
  const sourceParam = req.nextUrl.searchParams.get('source');
  const source: 'vcard' | 'icloud' = sourceParam === 'icloud' ? 'icloud' : 'vcard';

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'File exceeds 10 MB limit' }, { status: 413 });
  }

  const ext = file.name.toLowerCase();
  if (!ext.endsWith('.vcf') && !ext.endsWith('.vcard')) {
    return NextResponse.json({ ok: false, error: 'File must be a .vcf vCard export' }, { status: 400 });
  }

  const text = await file.text();
  const parsed = parseVCards(text);

  if (parsed.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, skipped: 0, total: 0 });
  }

  const supabase = getSupabaseServer();

  const rows = parsed.map(c => {
    // Derive a stable source_id: prefer UID, fall back to hash of name+email
    const sourceId = c.uid?.trim() ||
      createHash('sha256').update((c.displayName ?? '') + (c.emails[0] ?? '')).digest('hex').slice(0, 24);

    return {
      persona_id: persona.personaId,
      source,
      source_id: sourceId,
      display_name: c.displayName,
      first_name: c.firstName,
      last_name: c.lastName,
      organization: c.org,
      job_title: c.title,
      email: c.emails[0] ?? null,
      email_2: c.emails[1] ?? null,
      email_3: c.emails[2] ?? null,
      phone: c.phones[0] ?? null,
      phone_2: c.phones[1] ?? null,
      address: c.address,
      notes: c.notes,
      updated_at: new Date().toISOString(),
    };
  });

  const BATCH = 200;
  let imported = 0;
  let firstError: string | null = null;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('persona_contacts')
      .upsert(batch, { onConflict: 'persona_id,source,source_id', ignoreDuplicates: false });
    if (error) {
      console.error('[contacts/vcard-import] upsert error:', error.message);
      firstError ??= error.message;
    } else {
      imported += batch.length;
    }
  }

  if (firstError && imported === 0) {
    return NextResponse.json(
      { ok: false, error: 'Import failed', detail: firstError, imported: 0, skipped: parsed.length, total: parsed.length },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, imported, skipped: parsed.length - imported, total: parsed.length });
}
