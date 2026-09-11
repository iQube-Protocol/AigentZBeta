/**
 * Conversation/email safety fix (2026-08-27) — Part 2 of the People/
 * conversation regression, treated as INDEPENDENT of the ContactGraph 504
 * (see tests/contactgraph-people-projection-batching.test.ts for that half).
 *
 * OBSERVED DEFECT: aigentMe replied "Opening the Gmail composer..." to
 * "send an email to Abi Atanda with our latest business plan attached
 * inviting him to invest" while the People panel showed a failed search, an
 * empty recipient field, and no person selected — i.e. it claimed readiness
 * for BOTH a recipient and an attachment that were never actually resolved.
 *
 * ROOT CAUSES, TWO SEPARATE CODE LOCATIONS:
 *
 *   1. app/data/personas.ts's aigent-me system prompt EXPLICITLY instructed
 *      the LLM: "If you don't know who the recipient is, still open the
 *      composer" — and said nothing about attachment verification. The LLM
 *      followed its instructions correctly; the instructions themselves were
 *      unsafe (and self-contradicted the SAME prompt's own "Never imply an
 *      action was completed unless it was" Tone rule).
 *
 *   2. app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx's
 *      openComposeByKind (the "send it again" / chat-evolved-draft resend
 *      path) queried /api/contacts?limit=1 and, on ANY failure or zero
 *      results, fell back to using the raw, unresolved NAME STRING as the
 *      composer's "to" value — silently degrading a search failure into a
 *      value that LOOKS like a resolved recipient but is neither an email
 *      address nor a resolved contact.
 *
 * Neither defect is fixable by "increase the timeout" — both are about
 * WHETHER the workflow may claim readiness, not how long it waits.
 *
 * Document/attachment RESOLUTION for a fuzzy reference like "our latest
 * business plan" does not exist anywhere in this codebase today (confirmed
 * by search — no resolveDocument/resolveAttachment/attachmentCandidate
 * capability). Building that capability is a genuine feature gap, not a
 * regression, and is out of scope for this review-only branch; this fix
 * instead closes the SAFETY property that matters regardless of whether that
 * feature ever ships: the assistant must never CLAIM an attachment is
 * present when none was found.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const PERSONAS = 'app/data/personas.ts';
const WELCOME_SPLIT_TAB = 'app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx';
const DRAFT_EMAIL_ROUTE = 'app/api/assistant/draft-email/route.ts';
const RESOLVE_RECIPIENT = 'services/contacts/resolveRecipient.ts';
const DRAFT_EMAIL_SERVICE = 'services/agents/draftEmail.ts';

describe('aigent-me system prompt — no longer instructs the LLM to open/claim the composer without resolution', () => {
  it('the unsafe "still open the composer" instruction for an unknown recipient is gone', () => {
    const code = readSource(PERSONAS);
    expect(code).not.toContain('If you don’t know who the recipient is, still open the composer');
    expect(code).not.toContain("If you don't know who the recipient is, still open the composer");
  });

  it('the prompt now requires BOTH a verified recipient and a verified attachment before saying "Opening the Gmail composer..."', () => {
    const code = readSource(PERSONAS);
    const emailSectionAt = code.indexOf('## Email — opening the Gmail composer');
    expect(emailSectionAt).toBeGreaterThan(-1);
    const nextSectionAt = code.indexOf('\n## ', emailSectionAt + 10);
    const emailSection = code.slice(emailSectionAt, nextSectionAt > -1 ? nextSectionAt : emailSectionAt + 4000);
    expect(emailSection).toContain('STOP and say so plainly');
    expect(emailSection).toMatch(/exactly one verified person with a real email address/);
    expect(emailSection).toMatch(/exactly one verified, named artifact\/version/);
    expect(emailSection).toContain('Never fabricate an email address or a document reference to satisfy this gate');
  });

  it('the prompt ties the gate to the pre-existing "Never imply an action was completed" / "Never fabricate" hard rules rather than contradicting them', () => {
    const code = readSource(PERSONAS);
    expect(code).toContain('Never imply an action was completed unless it was');
    expect(code).toContain('Never fabricate.');
    const emailSectionAt = code.indexOf('## Email — opening the Gmail composer');
    const nextSectionAt = code.indexOf('\n## ', emailSectionAt + 10);
    const emailSection = code.slice(emailSectionAt, nextSectionAt > -1 ? nextSectionAt : emailSectionAt + 4000);
    expect(emailSection).toMatch(/your own "Never fabricate" hard rule/);
  });

  it('the prompt still names the composer as the correct DESTINATION (never regresses to "I cannot send emails directly")', () => {
    const code = readSource(PERSONAS);
    expect(code).toContain('Do NOT say "I cannot send emails directly."');
  });
});

describe('openComposeByKind — the chat-evolved-draft recipient prefill never guesses', () => {
  it('the raw-name fallback ("let resolvedTo = searchName") is gone — a bare display name is never used as the composer "to" value', () => {
    const code = stripComments(readSource(WELCOME_SPLIT_TAB));
    expect(code).not.toContain('let resolvedTo = searchName;');
    expect(code).toContain("let resolvedTo = '';");
  });

  it('the search bound was raised from limit=1 to a real bound so genuine ambiguity (2+ matches) is detectable', () => {
    const code = stripComments(readSource(WELCOME_SPLIT_TAB));
    expect(code).not.toContain('/api/contacts?q=${encodeURIComponent(searchName)}&limit=1');
    expect(code).toContain('/api/contacts?q=${encodeURIComponent(searchName)}&limit=5');
  });

  it('resolvedTo is only ever set from an ACTUAL email address, and only when exactly one candidate has one — never the first of several, never a bare name', () => {
    const code = stripComments(readSource(WELCOME_SPLIT_TAB));
    const fnAt = code.indexOf('const openComposeByKind = useCallback(');
    expect(fnAt).toBeGreaterThan(-1);
    const fnEnd = code.indexOf('}, [pendingEmailDraft, composerPrefill]);', fnAt);
    const fnBody = code.slice(fnAt, fnEnd);
    expect(fnBody).toContain("typeof c.email === 'string' && c.email.trim().length > 0");
    expect(fnBody).toContain('if (withEmail.length === 1) resolvedTo = withEmail[0].email;');
    // No branch assigns resolvedTo from `.display_name`, `hit`, or the bare
    // `searchName` — the only assignment is the single-match branch above.
    expect(fnBody).not.toMatch(/resolvedTo\s*=\s*(hit|searchName|.*display_name)/);
  });
});

describe('the ALREADY-well-built canonical recipient/attachment resolution this fix builds on, untouched', () => {
  it('resolveRecipientFromPrompt treats 2+ matches as genuine ambiguity and 0 matches as not-found — never guesses either way', () => {
    const code = stripComments(readSource(RESOLVE_RECIPIENT));
    expect(code).toContain("if (candidates.length === 1) return { status: 'resolved', candidate: candidates[0] };");
    expect(code).toContain("return { status: 'ambiguous', candidates };");
    expect(code).toContain("return { status: 'not-found' };");
  });

  it('draft-email/route.ts surfaces ambiguity to the caller rather than silently picking a candidate', () => {
    const stripped = stripComments(readSource(DRAFT_EMAIL_ROUTE));
    expect(stripped).toContain("resolution.status === 'ambiguous'");
    expect(stripped).toContain('recipientAmbiguity = resolution.candidates;');
    // The "never guess" rationale is documented in the route's own comment —
    // read unstripped so the comment text itself is checked.
    const raw = readSource(DRAFT_EMAIL_ROUTE);
    expect(raw).toMatch(/Never guess — the draft proceeds with "to" left for the operator/);
  });

  it('draftEmail.ts already forbids inventing a recipient email address', () => {
    const code = stripComments(readSource(DRAFT_EMAIL_SERVICE));
    expect(code).toContain('Never invent recipient email addresses.');
  });

  it('draftEmail.ts already forbids claiming an attachment reference with no real artifact behind it (the ATTACHMENT URL RULE)', () => {
    const code = stripComments(readSource(DRAFT_EMAIL_SERVICE));
    expect(code).toContain('ATTACHMENT URL RULE');
    expect(code).toContain('OMIT the reference entirely rather than promise something that is not there');
  });
});
