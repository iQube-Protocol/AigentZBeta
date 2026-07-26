/**
 * Invite → auto-channel — pins the safety contract (source-level, no DB import):
 *  - the channel opens only when the invitation opted in (open_peer_channel) and
 *    the issuer is known and is not the claimant;
 *  - it is best-effort — a channel failure NEVER blocks the access grant;
 *  - both principal refs are derived SERVER-SIDE (no raw ref crosses the wire);
 *  - createAccessInvitation only writes the new column when opted in (safe pre-migration).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'services', 'passport', 'participationAccess.ts'), 'utf8');

describe('Invite → auto-channel', () => {
  it('opens only when opted in, issuer known, and not a self-channel', () => {
    const fn = src.slice(src.indexOf('async function maybeOpenInviteChannel'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    expect(body).toMatch(/!inv\.open_peer_channel \|\| !inv\.issuer_persona_id/);
    expect(body).toMatch(/inv\.issuer_persona_id === claimantPersonaId/); // no self-channel
  });

  it('is best-effort — wrapped in try/catch, returns null on failure (never throws into the claim)', () => {
    const fn = src.slice(src.indexOf('async function maybeOpenInviteChannel'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    expect(body).toMatch(/try \{[\s\S]*?\} catch \{[\s\S]*?return null;/);
  });

  it('derives the claimant ref SERVER-SIDE via personaPublicRef (no raw ref on the wire)', () => {
    // Matches the INVARIANT, not one call's formatting. The original regex
    // pinned a single-line two-argument call; the call later gained a third
    // argument (access-domain tagging) and wrapped across lines, so a
    // still-compliant implementation read as a T0-leak failure.
    const call = src.slice(src.indexOf('createOrGetChannel('));
    const args = call.slice(0, call.indexOf(');'));
    // The counterparty is the DERIVED public ref...
    expect(args).toMatch(/personaPublicRef\(\s*claimantPersonaId\s*\)/);
    // ...and the raw persona id is never passed BARE. Wrapped uses are removed
    // first, so what remains is only an unwrapped occurrence -- otherwise the
    // guard flags `personaPublicRef(claimantPersonaId)` itself, which is the
    // compliant form it exists to require.
    const unwrapped = args.replace(/personaPublicRef\(\s*claimantPersonaId\s*\)/g, '<derived>');
    expect(unwrapped).not.toContain('claimantPersonaId');
  });

  it('the grant is created BEFORE the channel attempt — channel never gates access', () => {
    const claim = src.slice(src.indexOf('export async function claimAccessInvitation'));
    const grantIdx = claim.indexOf("from('access_grants')\n    .insert");
    const channelIdx = claim.indexOf('maybeOpenInviteChannel');
    expect(grantIdx).toBeGreaterThan(0);
    expect(channelIdx).toBeGreaterThan(grantIdx);
  });

  it('createAccessInvitation only writes open_peer_channel when opted in (safe on un-migrated DB)', () => {
    expect(src).toMatch(/\.\.\.\(input\.openPeerChannel === true \? \{ open_peer_channel: true \} : \{\}\)/);
  });
});
