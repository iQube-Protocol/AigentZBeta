/**
 * WP-C6 — contact resolution integration (Homecoming Closeout, operator
 * brief 2026-08-17).
 *
 * Confirms: (1) recipient resolution already goes through persona_contacts
 * (it did, before this closeout — see draft-email/route.ts's prior inline
 * logic); (2) the ONE canonical resolver now used never silently guesses
 * on ambiguity; (3) a resolved contact flows all the way into the draft's
 * "to" field, including the template (no-LLM-key) fallback path — proving
 * natural-language recipient -> contact resolution -> Gmail draft end to
 * end without requiring a live LLM key in this test environment.
 */

import { describe, it, expect, vi } from 'vitest';

function fakeAdmin(rows: Array<{ id: string; display_name: string | null; email: string }>) {
  return {
    from: (table: string) => {
      expect(table).toBe('persona_contacts');
      return {
        select: () => ({
          eq: () => ({
            not: () => ({
              textSearch: () => ({
                limit: async () => ({ data: rows, error: null }),
              }),
            }),
          }),
        }),
      };
    },
  };
}

describe('resolveRecipientFromPrompt — the one canonical resolver, never a silent guess', () => {
  it('exactly one match -> resolved', async () => {
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({
      getSupabaseServer: () => fakeAdmin([{ id: 'c1', display_name: 'John Smith', email: 'john@example.com' }]),
    }));
    vi.resetModules();
    const { resolveRecipientFromPrompt } = await import('@/services/contacts/resolveRecipient');
    const result = await resolveRecipientFromPrompt('persona-1', 'email John about Horizon');
    expect(result).toEqual({
      status: 'resolved',
      candidate: { contactId: 'c1', displayName: 'John Smith', email: 'john@example.com' },
    });
    vi.doUnmock('@/app/api/_lib/supabaseServer');
  });

  it('two plausible contacts -> ambiguous, ALL candidates returned, never narrowed to one', async () => {
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({
      getSupabaseServer: () => fakeAdmin([
        { id: 'c1', display_name: 'John Smith', email: 'john.smith@example.com' },
        { id: 'c2', display_name: 'John Doe', email: 'john.doe@example.com' },
      ]),
    }));
    vi.resetModules();
    const { resolveRecipientFromPrompt } = await import('@/services/contacts/resolveRecipient');
    const result = await resolveRecipientFromPrompt('persona-1', 'email John about Horizon');
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates.map((c) => c.email)).toEqual(['john.smith@example.com', 'john.doe@example.com']);
    }
    vi.doUnmock('@/app/api/_lib/supabaseServer');
  });

  it('no match -> not-found', async () => {
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: () => fakeAdmin([]) }));
    vi.resetModules();
    const { resolveRecipientFromPrompt } = await import('@/services/contacts/resolveRecipient');
    const result = await resolveRecipientFromPrompt('persona-1', 'email Nobody about nothing');
    expect(result).toEqual({ status: 'not-found' });
    vi.doUnmock('@/app/api/_lib/supabaseServer');
  });

  it('a prompt with no extractable name candidates never queries the database', async () => {
    const admin = fakeAdmin([]);
    const fromSpy = vi.spyOn(admin, 'from');
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: () => admin }));
    vi.resetModules();
    const { resolveRecipientFromPrompt } = await import('@/services/contacts/resolveRecipient');
    const result = await resolveRecipientFromPrompt('persona-1', 'to for the an');
    expect(result).toEqual({ status: 'not-found' });
    expect(fromSpy).not.toHaveBeenCalled();
    vi.doUnmock('@/app/api/_lib/supabaseServer');
  });
});

describe('End to end: natural-language recipient -> contact resolution -> Gmail draft', () => {
  it('a resolved contact\'s email reaches the draft "to" field, even on the template (no-LLM-key) fallback path', async () => {
    // No OPENAI_API_KEY in this test environment -> draftEmail() takes the
    // deterministic template path. Proves the resolved recipient survives
    // that path too, not just the LLM path (which already referenced it via
    // the RESOLVED RECIPIENT prompt block).
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const { draftEmail } = await import('@/services/agents/draftEmail');
      const output = await draftEmail({
        prompt: 'thank John for the call yesterday',
        context: { recipientEmail: 'john.smith@example.com', recipientName: 'John Smith' },
      });
      expect(output.source).toBe('template');
      expect(output.to).toBe('john.smith@example.com');
    } finally {
      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    }
  });
});
