/**
 * OCSGA early invitation entry + Citizen Passport routing (2026-08-25).
 *
 * Constitutional distinction under test: Invitation = collaboration/
 * admission context. Citizen Passport = human personhood/presence. A valid
 * invite must never be treated as proof of personhood, Passport issuance,
 * authority, delegation, artifact ownership, or completion of later
 * exchange stages.
 *
 * Source-authority canaries (this repo's convention — no
 * @testing-library/react in tests/), covering the 8 canaries named in the
 * operator directive:
 *
 *   1. No invite → Orient unchanged → Establish Presence usable → invite
 *      can still be added later.
 *   2. Valid invite + no Citizen Passport → Establish Presence opens
 *      directly at Citizen Passport (routeTo: 'citizen').
 *   3. Valid invite + existing Citizen Passport → no duplicate application
 *      (routeTo left undefined; PassportBureauApplyTab's own existing
 *      "already hold a Passport" branch is untouched and takes over).
 *   4. Invite never satisfies passportIssued.
 *   5. Invite never satisfies delegation or any reciprocal-artifact
 *      evidence on its own (joining ≠ depositing/freezing/signing/crossing).
 *   6. Same invite entered twice creates no duplicate association/evidence
 *      (joinExchange's own idempotency, unmodified).
 *   7. Early invite and later invite paths call the SAME canonical
 *      invitation service (/api/research/exchanges/join) — no second
 *      schema/validator/route.
 *   8. Existing late-entry invitation flow remains backward-compatible.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ORIENT_PANEL = 'components/journey/IanOrientationPanel.tsx';
const IAN_JOURNEY_TAB = 'app/triad/components/codex/tabs/IanJourneyTab.tsx';
const IAN_STATE_ROUTE = 'app/api/journey/ian/state/route.ts';
const IRL_EXCHANGE_TAB = 'app/triad/components/codex/tabs/IRLExchangeTab.tsx';
const RECIPROCAL_EXCHANGE_SERVICE = 'services/research/reciprocalExchange.ts';
const PASSPORT_BUREAU_APPLY_TAB = 'app/triad/components/codex/tabs/PassportBureauApplyTab.tsx';
const JOURNEY_TYPES = 'types/journey.ts';
const CANONICAL_JOIN_ROUTE = '/api/research/exchanges/join';

describe('canary 7 — early and later invitation entry call the SAME canonical service, never a second one', () => {
  it('IanOrientationPanel (early) calls the canonical join route', () => {
    const code = stripComments(readSource(ORIENT_PANEL));
    expect(code).toContain(`personaFetch('${CANONICAL_JOIN_ROUTE}'`);
  });

  it('IRLExchangeTab (later) calls the SAME canonical join route', () => {
    const code = stripComments(readSource(IRL_EXCHANGE_TAB));
    expect(code).toContain(`personaFetch("${CANONICAL_JOIN_ROUTE}"`);
  });

  it('no second invitation-acceptance API route was created', () => {
    // The canonical route is app/api/research/exchanges/join/route.ts —
    // assert no sibling ian-scoped invitation route exists.
    expect(existsSync(join(process.cwd(), 'app/api/journey/ian/invite'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'app/api/journey/ian/orient/invite'))).toBe(false);
  });

  it('no second invitation validator/schema was added to reciprocalExchange.ts beyond the existing findExchangeByInviteCode/joinExchange pair', () => {
    const code = stripComments(readSource(RECIPROCAL_EXCHANGE_SERVICE));
    const joinFns = (code.match(/export async function (join\w*|findExchangeByInviteCode|inviteCounterparty)\(/g) ?? []).length;
    // Exactly the three pre-existing functions: inviteCounterparty, findExchangeByInviteCode, joinExchange.
    expect(joinFns).toBe(3);
  });
});

describe('canary 1 — no invite: Orient and Establish Presence are unchanged, invite stays addable later', () => {
  it('IanOrientationPanel still has its original, independent acknowledge action', () => {
    const code = stripComments(readSource(ORIENT_PANEL));
    expect(code).toContain("/api/journey/ian/orient/acknowledge");
    expect(code).toContain("'I understand — continue'");
  });

  it('the invitation field is optional — it never disables or gates the acknowledge button', () => {
    const code = stripComments(readSource(ORIENT_PANEL));
    const buttonAt = code.indexOf('onClick={handleClick}');
    const disabledAt = code.indexOf('disabled={busy}', buttonAt);
    expect(disabledAt).toBeGreaterThan(-1);
    // `busy` is derived only from acknowledging/waitingForSignIn — never
    // from invite state (applyingInvite / inviteBusy / inviteError).
    const busyDeclAt = code.indexOf('const busy = acknowledging || waitingForSignIn;');
    expect(busyDeclAt).toBeGreaterThan(-1);
  });

  it('when no activeExchangeId, the invite section renders the optional input, not a hard requirement', () => {
    const code = stripComments(readSource(ORIENT_PANEL));
    expect(code).toContain('Invitation code (optional)');
    expect(code).toContain('it&apos;s never required');
  });

  it('IanJourneyTab returns routeTo: undefined for the Passport surface when no invite is associated', () => {
    const code = stripComments(readSource(IAN_JOURNEY_TAB));
    expect(code).toContain('const hasInvite = Boolean(runtimeState?.activeExchangeId);');
    expect(code).toContain("const routeTo = hasInvite && !hasCitizenPassport ? ('citizen' as const) : undefined;");
  });

  it('the later IRLExchangeTab join box remains reachable when no exchange exists yet', () => {
    const code = stripComments(readSource(IRL_EXCHANGE_TAB));
    expect(code).toContain('list && list.length === 0');
    expect(code).toContain('Join with an invitation code');
  });
});

describe('canary 2 — valid invite + no Citizen Passport → Establish Presence routes directly to citizen', () => {
  it('routeTo resolves to \'citizen\' exactly when hasInvite is true and hasCitizenPassport is false', () => {
    const code = stripComments(readSource(IAN_JOURNEY_TAB));
    const at = code.indexOf("if (surfaceRef.ref === 'venture-participate-apply')");
    expect(at).toBeGreaterThan(-1);
    const block = code.slice(at, code.indexOf('return { routeTo };', at) + 'return { routeTo };'.length);
    expect(block).toContain("const hasInvite = Boolean(runtimeState?.activeExchangeId);");
    expect(block).toContain('const hasCitizenPassport = runtimeState?.citizenPassportUsable === true;');
    expect(block).toContain("hasInvite && !hasCitizenPassport ? ('citizen' as const) : undefined");
  });

  it('routeTo never resolves to \'delegate\'/agent sponsorship from an invitation alone', () => {
    const code = stripComments(readSource(IAN_JOURNEY_TAB));
    const at = code.indexOf("if (surfaceRef.ref === 'venture-participate-apply')");
    const block = code.slice(at, code.indexOf('return { routeTo };', at) + 20);
    expect(block).not.toMatch(/'delegate'/);
  });

  it("PassportBureauApplyTab's routeTo='citizen' auto-routes to the Citizen path, not the class chooser", () => {
    const code = stripComments(readSource(PASSPORT_BUREAU_APPLY_TAB));
    expect(code).toContain("handleClassChoice(routeTo === 'delegate' ? 'participant' : 'citizen');");
  });
});

describe('canary 3 — valid invite + existing Citizen Passport → no duplicate application', () => {
  it('routeTo is left undefined (not overridden) once citizenPassportUsable is true, deferring to the existing observer truth', () => {
    const code = stripComments(readSource(IAN_JOURNEY_TAB));
    const at = code.indexOf("if (surfaceRef.ref === 'venture-participate-apply')");
    const block = code.slice(at, code.indexOf('return { routeTo };', at) + 'return { routeTo };'.length);
    // The ternary's else-branch (hasCitizenPassport === true) resolves to
    // undefined — no second branch anywhere overrides it back to a class.
    expect(block).toMatch(/hasInvite && !hasCitizenPassport \? \('citizen' as const\) : undefined;/);
    expect(block).not.toMatch(/: 'citizen'\s*;/); // no fallback assigns 'citizen' unconditionally
  });

  it("PassportBureauApplyTab's own existing usable-status short-circuit is untouched", () => {
    const code = stripComments(readSource(PASSPORT_BUREAU_APPLY_TAB));
    expect(code).toContain('/api/passport/usable-status');
    expect(code).toContain('You already hold a Polity Citizen Passport');
  });
});

describe('canary 4 — invite never satisfies passportIssued', () => {
  it("the Ian state route's passport stage evidence derives ONLY from the passport_issued receipt, never from activeExchangeId/citizenPassportUsable", () => {
    const code = stripComments(readSource(IAN_STATE_ROUTE));
    const passportLineAt = code.indexOf("passport: { passport_issued: hasReceiptType('passport_issued') }");
    expect(passportLineAt).toBeGreaterThan(-1);
  });

  it('citizenPassportUsable is computed from the canonical Citizen Passport read, never from the exchange/invite lookup', () => {
    const code = stripComments(readSource(IAN_STATE_ROUTE));
    const inviteBlockAt = code.indexOf('const mine = await listMyExchanges(admin, personaId);');
    const citizenAt = code.indexOf('loadUsableCitizenPassportForAuthProfile(admin, authProfileId)');
    expect(inviteBlockAt).toBeGreaterThan(-1);
    expect(citizenAt).toBeGreaterThan(inviteBlockAt); // computed separately, after/outside the exchange lookup
    expect(code).toContain('citizenPassportUsable = credential.ok && isPassportUsable(credential.passport);');
  });
});

describe('canary 5 — invite never satisfies delegation or any reciprocal-artifact evidence on its own', () => {
  it('delegation_active is computed independently of activeExchangeId/joinExchange', () => {
    const code = stripComments(readSource(IAN_STATE_ROUTE));
    expect(code).toContain("const delegationActive = await hasActiveDelegation(personaId).catch(() => false);");
    // hasActiveDelegation is never passed exchangeId/activeExchangeId.
    expect(code).not.toMatch(/hasActiveDelegation\(personaId,\s*activeExchangeId/);
  });

  it('deposit/freeze/sign/cross evidence derive from the REAL artifact/exchange-status view, not merely from having an associated exchange', () => {
    const code = stripComments(readSource(IAN_STATE_ROUTE));
    expect(code).toContain('yourDeposited = view.view.yourArtifact !== null;');
    expect(code).toContain('yourFrozen = Boolean(view.view.yourArtifact?.frozen);');
    expect(code).toContain('yourSigned = Boolean(view.view.yourArtifact?.signed);');
    expect(code).toContain('crossed = hasCrossed(view.view.exchange.status);');
    // These four all come from getExchangeView's real fields — never
    // hardcoded to `true` merely because activeExchangeId is set.
    expect(code).not.toMatch(/yourDeposited\s*=\s*true;/);
  });

  it('joinExchange itself only ever writes counterparty_persona_id + status — never artifact/freeze/sign fields', () => {
    const code = stripComments(readSource(RECIPROCAL_EXCHANGE_SERVICE));
    const fnAt = code.indexOf('export async function joinExchange(');
    expect(fnAt).toBeGreaterThan(-1);
    const nextFnAt = code.indexOf('\nexport async function', fnAt + 10);
    const fnBody = code.slice(fnAt, nextFnAt > -1 ? nextFnAt : fnAt + 3000);
    expect(fnBody).toContain('counterparty_persona_id: input.personaId');
    expect(fnBody).not.toMatch(/frozen\s*:/);
    expect(fnBody).not.toMatch(/signed\s*:/);
  });
});

describe('canary 6 — same invite entered twice creates no duplicate association/evidence', () => {
  it("joinExchange's own idempotent re-join branch is present and unmodified", () => {
    const code = stripComments(readSource(RECIPROCAL_EXCHANGE_SERVICE));
    expect(code).toContain(
      'if (exchange.counterpartyPersonaId === input.personaId) return { ok: true, exchange };',
    );
  });

  it('IanOrientationPanel never writes a second, parallel association record — it only calls the canonical join route and re-reads observer state', () => {
    const code = stripComments(readSource(ORIENT_PANEL));
    expect(code).not.toMatch(/localStorage\.setItem\(['"]ocsga.*invite/i);
    expect(code).toContain('requestStateRefresh();');
  });

  it('the panel shows an "associated" state instead of re-offering the input once activeExchangeId is present — no accidental re-submission surface', () => {
    const code = stripComments(readSource(ORIENT_PANEL));
    expect(code).toContain('Invitation associated');
    expect(code).toContain('const inviteSection = activeExchangeId ? (');
  });
});

describe('canary 8 — existing late-entry invitation flow remains backward-compatible', () => {
  it('IRLExchangeTab still exposes joinCode state, joinByCode, and the canonical route call, unchanged in shape', () => {
    const code = stripComments(readSource(IRL_EXCHANGE_TAB));
    expect(code).toContain('const [joinCode, setJoinCode] = useState("");');
    expect(code).toContain('async function joinByCode()');
    expect(code).toContain('method: "POST"');
    expect(code).toContain('body: JSON.stringify({ code: joinCode.trim() })');
  });

  it('once an exchange already exists, the box is replaced by an associated-summary line rather than removed with no explanation', () => {
    const code = stripComments(readSource(IRL_EXCHANGE_TAB));
    expect(code).toContain("You&apos;re already associated with a collaboration exchange — select it below.");
  });

  it('the exchange list itself is never hidden — clicking through to select an exchange still works regardless of invite-box visibility', () => {
    const code = stripComments(readSource(IRL_EXCHANGE_TAB));
    expect(code).toContain('onClick={() => setSelectedId(e.id)}');
  });
});

describe('the invitation reference is a first-class, documented Journey Spine extension — never a hidden side channel', () => {
  it('activeExchangeId and citizenPassportUsable are declared on JourneyRuntimeState as optional extensions', () => {
    const code = stripComments(readSource(JOURNEY_TYPES));
    expect(code).toContain('activeExchangeId?: string | null;');
    expect(code).toContain('citizenPassportUsable?: boolean;');
  });

  it('both fields are folded into responseState so they survive the JourneyRunSurface json.state unwrap', () => {
    const code = stripComments(readSource(IAN_STATE_ROUTE));
    expect(code).toContain(
      'const responseState: JourneyRuntimeState = { ...journeyState, interactionContext, activeExchangeId, citizenPassportUsable };',
    );
  });
});

describe('Orient completion copy — updated per the ratified semantics', () => {
  it('no longer says "Identity comes next"', () => {
    const code = stripComments(readSource(ORIENT_PANEL));
    expect(code).not.toContain('Identity comes next');
  });

  it('says "Constitutional presence comes next" (or the Personhood variant)', () => {
    const code = stripComments(readSource(ORIENT_PANEL));
    expect(code).toMatch(/Constitutional presence comes next|Personhood comes next/);
  });
});
