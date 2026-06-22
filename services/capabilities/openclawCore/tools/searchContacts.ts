/**
 * search-contacts tool — persona address book lookup.
 *
 * Searches persona_contacts (imported from Google Contacts, iPhone vCard,
 * iCloud, LinkedIn, Outlook, or generic CSV) for contacts matching the
 * given query term. Returns up to `limit` results (default 20, max 100).
 *
 * Needs T0 (personaId) so declare needsServerContext: true.
 *
 * Input:
 *   { query: string; source?: string; limit?: number }
 *
 * Output summary example:
 *   'search-contacts: 3 contacts found for "Project Liberty"'
 */

import { createClient } from '@supabase/supabase-js';
import { registerTool } from '../registry';
import type { OpenClawToolResult } from '../types';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

registerTool({
  name: 'search-contacts',
  description:
    'Search the persona\'s personal address book (imported from Google Contacts, iPhone, iCloud, LinkedIn, Outlook, or CSV). ' +
    'Use when the user asks about a specific person, company, email address, phone number, or contacts affiliated with a project or topic.',
  needsServerContext: true,
  handler: async (input, serverContext): Promise<OpenClawToolResult> => {
    if (!serverContext?.personaId) {
      return {
        ok: false,
        reason: 'server-context-required',
        detail: 'search-contacts needs T0 personaId — not available out-of-process',
      };
    }

    const q = typeof input.query === 'string' ? input.query.trim() : '';
    const source = typeof input.source === 'string' ? input.source.trim() : '';
    const limit = Math.min(Number(input.limit ?? 20), 100);

    try {
      let query = db()
        .from('persona_contacts')
        .select(
          'display_name, first_name, last_name, organization, job_title, email, email_2, phone, phone_2, address, source',
        )
        .eq('persona_id', serverContext.personaId)
        .limit(limit);

      if (source) query = query.eq('source', source);

      if (q) {
        query = (query as any).textSearch(
          'fts',
          q.split(/\s+/).map((w: string) => w + ':*').join(' & '),
          { config: 'english', type: 'plain' },
        );
      } else {
        query = query.order('display_name', { ascending: true });
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const contacts = (data ?? []).map((c: any) => ({
        name: c.display_name,
        organization: c.organization ?? undefined,
        jobTitle: c.job_title ?? undefined,
        email: c.email ?? undefined,
        email2: c.email_2 ?? undefined,
        phone: c.phone ?? undefined,
        phone2: c.phone_2 ?? undefined,
        address: c.address ?? undefined,
        source: c.source,
      }));

      const summary = contacts.length > 0
        ? `search-contacts: ${contacts.length} contact${contacts.length !== 1 ? 's' : ''} found for "${q || '(all)'}"`
        : `search-contacts: no contacts found for "${q}"`;

      return {
        ok: true,
        data: { contacts, total: contacts.length, query: q || null, source: source || null },
        summary,
      };
    } catch (err) {
      return {
        ok: false,
        reason: 'query-failed',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
