import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('aigentMe email composition regressions', () => {
  it('submits the current Gmail attachment selection instead of a stale closure', () => {
    const gmail = source('components/metame/connections/ComposeGmailDraftModal.tsx');
    expect(gmail).toContain(
      '[to, subject, bodyText, cc, bcc, attachmentUploadIds, onCreate, onClose]',
    );
    expect(gmail).toContain('...(attachmentUploadIds.length > 0 ? { attachmentUploadIds } : {})');
  });

  it('submits current Marketa campaign, cohort and attachment state', () => {
    const marketa = source('components/metame/connections/ComposeMarketaEmailModal.tsx');
    expect(marketa).toContain(
      '[to, subject, bodyText, cc, bcc, fromName, campaignId, cohortId, attachmentUploadIds, onCreate, onClose]',
    );
  });

  it('carries material recipient ambiguity from the canonical resolver into an operator choice', () => {
    const route = source('app/api/assistant/draft-email/route.ts');
    const host = source('app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx');
    const gmail = source('components/metame/connections/ComposeGmailDraftModal.tsx');

    expect(route).toContain('recipientAmbiguity = resolution.candidates');
    expect(host).toContain('recipientAmbiguity?: Array<{ contactId: string; displayName: string | null; email: string }>');
    expect(gmail).toContain('More than one matching contact was found. Choose the address to use:');
    expect(gmail).toContain('setTo(candidate.email)');
  });
});
