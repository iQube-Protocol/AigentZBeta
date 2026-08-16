/**
 * KNYTS Bridge campaign activation — Gates A-D canaries
 * (`KNYT_BRIDGE_CAMPAIGN_IMPLEMENTATION_SPEC_CLAUDE_CODE.md`).
 *
 * Behavioral tests where the unit has no live-DB dependency (config matrix,
 * email normalization); structural/source-authority canaries for the
 * DB-backed routes/services, per this repo's established preference order
 * (tests/_lib/sourceAuthority.ts) — a live Supabase harness does not exist
 * in this test suite, so route/service WIRING and INVARIANTS (idempotency
 * key construction, independent-lane gating, absence of protected-table
 * access, single reward primitive) are verified from the real AST/source,
 * not re-derived assumptions.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';
import {
  KNYTS_BRIDGE_REWARD_MATRIX,
  getKnytsBridgeKickstarterUrl,
} from '@/services/journey/knytsBridgeCampaignConfig';
import { normalizeEmail } from '@/services/crm/campaignContactResolver';

describe('Campaign config — reward matrix encodes the constitutional distinctions', () => {
  it('a Kickstarter preview click never grants Knightcoin or Standing (click is not follow)', () => {
    const rule = KNYTS_BRIDGE_REWARD_MATRIX.kickstarter_preview_clicked;
    expect(rule.knytcoin).toBe(0);
    expect(rule.standingEligible).toBe(false);
  });

  it('a confirmed Kickstarter follow independently qualifies for all three outputs', () => {
    const rule = KNYTS_BRIDGE_REWARD_MATRIX.kickstarter_follow_confirmed;
    expect(rule.knytcoin).toBeGreaterThan(0);
    expect(rule.reputationDelta).toBeGreaterThan(0);
    expect(rule.standingEligible).toBe(true);
  });

  it('a like affects Reputation/reward but is never directly Standing-eligible', () => {
    const rule = KNYTS_BRIDGE_REWARD_MATRIX.crossing_story_liked;
    expect(rule.knytcoin).toBeGreaterThan(0);
    expect(rule.reputationDelta).toBeGreaterThan(0);
    expect(rule.standingEligible).toBe(false);
  });

  it('the 5-unique-likes threshold event is its own, separately Standing-eligible action', () => {
    const rule = KNYTS_BRIDGE_REWARD_MATRIX.crossing_story_engagement_threshold_reached;
    expect(rule.standingEligible).toBe(true);
    expect(rule.guardrail).toMatch(/once|threshold/i);
  });

  it('sharing alone (no qualified visit yet) is not Standing-eligible', () => {
    expect(KNYTS_BRIDGE_REWARD_MATRIX.bridge_shared.standingEligible).toBe(false);
  });

  it('every action type in the vocabulary has a matrix entry (no silent fallthrough)', () => {
    const actionTypes = [
      'campaign_preregistered',
      'kickstarter_preview_clicked',
      'kickstarter_follow_confirmed',
      'bridge_shared',
      'qualified_campaign_visit',
      'crossing_story_published',
      'crossing_story_liked',
      'crossing_story_engagement_threshold_reached',
      'campaign_referral_converted',
    ] as const;
    for (const type of actionTypes) {
      expect(KNYTS_BRIDGE_REWARD_MATRIX[type], `missing matrix entry for ${type}`).toBeDefined();
    }
  });

  it('the Kickstarter URL is the real, already-live campaign project, not a placeholder', () => {
    const url = getKnytsBridgeKickstarterUrl();
    expect(url).toContain('kickstarter.com/projects/430245948/metaknyt');
    expect(url).not.toMatch(/example\.com|placeholder|TODO/i);
  });
});

describe('normalizeEmail — dedupe key construction', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Alice@Example.COM  ')).toBe('alice@example.com');
  });
});

describe('CRM contact dedupe hierarchy — resolveCampaignContact structural invariants', () => {
  const SRC = stripComments(readSource('services/crm/campaignContactResolver.ts'));

  it('never writes campaign_state/kickstarter_clicked_at/kickstarter_backed_at on nakamoto_knyt_personas', () => {
    // Those columns are owned by the live email-send/tracking pipeline —
    // this resolver must only append campaign_tags.
    expect(SRC).not.toMatch(/campaign_state\s*:/);
    expect(SRC).not.toMatch(/kickstarter_clicked_at\s*:/);
    expect(SRC).not.toMatch(/kickstarter_backed_at\s*:/);
  });

  it('checks authenticated linkage before falling back to email match (precedence order)', () => {
    const idIdx = SRC.indexOf(".eq('id', activePersonaId)");
    const emailIdx = SRC.indexOf(".ilike('email', normalizedEmail)");
    expect(idIdx, 'authenticated-id lookup not found').toBeGreaterThan(-1);
    expect(emailIdx, 'email lookup not found').toBeGreaterThan(-1);
    expect(idIdx).toBeLessThan(emailIdx);
  });

  it('a later authenticated session links a prospect without overwriting an existing linkage', () => {
    const idx = SRC.indexOf('identity_persona_id: activePersonaId');
    expect(idx).toBeGreaterThan(-1);
    const nearby = SRC.slice(idx, idx + 200);
    expect(nearby).toContain(".is('identity_persona_id', null)");
  });
});

describe('Campaign evidence ledger — idempotency is checked before write, every time', () => {
  const SRC = stripComments(readSource('services/campaign/knytsBridgeCampaignEvidence.ts'));

  it('reads the existing row by (campaign_id, idempotency_key) before inserting', () => {
    const readIdx = SRC.indexOf("eq('idempotency_key', input.idempotencyKey)");
    const insertIdx = SRC.indexOf('.insert(insertPayload)');
    expect(readIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(readIdx).toBeLessThan(insertIdx);
  });

  it('a race on insert re-reads rather than surfacing a fabricated duplicate error', () => {
    const guardIdx = SRC.indexOf('if (insertError || !inserted)');
    expect(guardIdx, 'insert-failure guard not found').toBeGreaterThan(-1);
    const raceBlock = SRC.slice(guardIdx, guardIdx + 800);
    expect(raceBlock).toContain("eq('idempotency_key', input.idempotencyKey)");
    expect(raceBlock).toContain('if (raced)');
  });

  it('dual-writes into the existing recordCampaignEvent only when a persona is known', () => {
    const idx = SRC.indexOf('if (input.personaId) {');
    expect(idx).toBeGreaterThan(-1);
    const block = SRC.slice(idx, SRC.indexOf('}', SRC.indexOf('recordCampaignEvent(', idx)) + 400);
    expect(block).toContain('recordCampaignEvent(');
  });

  it('each of the three *_applied_at markers is guarded by is(..., null) — no double-mark', () => {
    const guards = SRC.match(/\.is\('(reputation|standing|reward)_applied_at', null\)/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Triple projector — Gate B independence invariants', () => {
  const SRC = stripComments(readSource('services/campaign/knytsBridgeCampaignProjector.ts'));

  it('Reputation, Standing and Reward are each gated on their OWN rule field, not on each other’s outcome', () => {
    expect(SRC).toMatch(/rule\.reputationDelta/);
    expect(SRC).toMatch(/rule\.standingEligible/);
    expect(SRC).toMatch(/rule\.knytcoin/);
    // None of the three blocks reads outcome.reputation/standing/reward as an
    // INPUT to another lane's gate (only ever assigned to, never branched on).
    expect(SRC).not.toMatch(/if\s*\(\s*outcome\.reputation\.applied/);
    expect(SRC).not.toMatch(/if\s*\(\s*outcome\.standing\.applied/);
  });

  it('Standing requires an identity_persona_id linkage and withholds with a named reason otherwise', () => {
    expect(SRC).toContain("select('identity_persona_id')");
    expect(SRC).toContain('person_grade_anchor_unresolved');
    expect(SRC).toContain('markStandingOutcome');
  });

  it('Reputation write keys on crmPersonaId (persona-grade), never on a raw identity/root/kybe id', () => {
    const idx = SRC.indexOf('createReputationEvent({');
    const block = SRC.slice(idx, idx + 300);
    expect(block).toContain('personaId: evidence.crmPersonaId');
    expect(block).not.toMatch(/kybeId|rootIdentityId/);
  });

  it('the campaign_contribution sourceType is used for reputation events (additive, not a repurposed existing one)', () => {
    expect(SRC).toContain("sourceType: 'campaign_contribution'");
  });

  it('Reward credits KNYT through the ONE deployed ledger primitive (creditKnyt) — no parallel balance write', () => {
    expect(SRC).toContain('creditKnyt(');
    expect(SRC).not.toMatch(/wallet_balances['"]\s*\)\s*\.\s*(insert|upsert)/);
    expect(SRC).not.toMatch(/reward_grants['"]\s*\)\s*\.\s*insert/);
  });

  it('never touches the identity spine directly (root_identity / polity_passport_records / kybe tables)', () => {
    expect(SRC).not.toMatch(/root_identity|polity_passport_records|kybe_identity|wallet_alias_commitments/);
  });
});

describe('book-interest route — Gate A pre-registration, no silent anonymous discard', () => {
  const SRC = stripComments(readSource('app/api/journey/knyts-bridge/choose/book-interest/route.ts'));

  it('no longer silently discards unauthenticated submissions ({persisted:false} branch removed)', () => {
    expect(SRC).not.toMatch(/persisted:\s*false/);
  });

  it('resolves the CRM contact BEFORE recording evidence (dedupe precedes the ledger write)', () => {
    const resolveIdx = SRC.indexOf('resolveCampaignContact(');
    const recordIdx = SRC.indexOf('recordKnytsBridgeEvidence(');
    expect(resolveIdx).toBeGreaterThan(-1);
    expect(recordIdx).toBeGreaterThan(-1);
    expect(resolveIdx).toBeLessThan(recordIdx);
  });

  it('idempotency key is scoped to the normalized email (once per campaign/person)', () => {
    expect(SRC).toContain('`campaign_preregistered:${normalizedEmail}`');
  });

  it('only projects outputs (Gate B) on a genuinely NEW evidence row — never re-runs on a repeat submission', () => {
    const idx = SRC.indexOf('if (isNew)');
    expect(idx).toBeGreaterThan(-1);
    const block = SRC.slice(idx, idx + 100);
    expect(block).toContain('projectKnytsBridgeEvidenceOutputs');
  });

  it('returns the centralized Kickstarter URL rather than a client-side hard-coded one', () => {
    expect(SRC).toContain('getKnytsBridgeKickstarterUrl()');
  });
});

describe('kickstarter-click route — a click can never self-promote to a confirmed follow', () => {
  const SRC = stripComments(readSource('app/api/journey/knyts-bridge/choose/kickstarter-click/route.ts'));

  it('records only kickstarter_preview_clicked — the confirmed-follow action type never appears', () => {
    expect(SRC).toContain("actionType: 'kickstarter_preview_clicked'");
    expect(SRC).not.toContain('kickstarter_follow_confirmed');
  });

  it('evidence grade is observed, not verified/external-confirmed', () => {
    expect(SRC).toContain("evidenceGrade: 'observed'");
  });

  it('idempotency is per (actor, day) so repeated clicks in one day do not farm the signal', () => {
    expect(SRC).toContain('dayBucket');
    expect(SRC).toMatch(/kickstarter_preview_clicked:\$\{idempotencySubject\}:\$\{dayBucket\}/);
  });
});

describe('Crossing Story like route — self-like, cap, and threshold invariants', () => {
  const SRC = stripComments(readSource('app/api/journey/knyts-bridge/community/[id]/like/route.ts'));

  it('rejects a self-like before any DB write', () => {
    const idx = SRC.indexOf('self-like-not-allowed');
    const insertIdx = SRC.indexOf("from('knyts_bridge_story_likes')\n    .insert");
    expect(idx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(insertIdx);
  });

  it('relies on the DB unique constraint for duplicate-like detection (idempotent, not app-level guessing)', () => {
    expect(SRC).toContain('alreadyLiked');
    expect(SRC).toMatch(/duplicate/i);
  });

  it('enforces a daily rewarded-like cap per liking actor', () => {
    expect(SRC).toContain('DAILY_REWARDED_LIKE_CAP');
    expect(SRC).toContain('underDailyCap');
  });

  it('the 5-unique-like threshold event is recorded once per content id, for the AUTHOR not the liker', () => {
    expect(SRC).toContain('LIKE_THRESHOLD_COUNT');
    expect(SRC).toMatch(/crossing_story_engagement_threshold_reached:\$\{contentId\}/);
    const idx = SRC.indexOf("actionType: 'crossing_story_engagement_threshold_reached'");
    const block = SRC.slice(Math.max(0, idx - 400), idx);
    expect(block).toContain('content.creator_persona_id');
  });
});

describe('Community-content publish route — Crossing Story evidence is scoped to the campaign tag only', () => {
  const SRC = stripComments(readSource('app/api/community-content/[id]/publish/route.ts'));

  it('only records knyts-bridge evidence when campaign_tag matches this campaign — every other cartridge publish is unaffected', () => {
    expect(SRC).toContain('row.campaign_tag === KNYTS_BRIDGE_CAMPAIGN_ID');
  });

  it('the evidence write is wrapped so a failure never blocks the underlying publish', () => {
    const idx = SRC.indexOf('KNYTS_BRIDGE_CAMPAIGN_ID) {');
    const block = SRC.slice(idx, idx + 900);
    expect(block).toContain('try {');
    expect(block).toContain('catch (err)');
  });
});

describe('Operator metrics route — admin-gated, same gate as the existing Crossing-of-the-Week admin route', () => {
  const SRC = stripComments(readSource('app/api/journey/knyts-bridge/operator-metrics/route.ts'));

  it('uses requireAdminPersona — never a hand-rolled admin check', () => {
    const graph = importAuthority(readSource('app/api/journey/knyts-bridge/operator-metrics/route.ts'));
    expect(graph.records.some((r) => r.names.includes('requireAdminPersona'))).toBe(true);
    expect(SRC).toContain('await requireAdminPersona(req)');
  });

  it('reports the dedupe split (existing-investor reactivation vs new prospect) required by spec §12', () => {
    expect(SRC).toContain('existingInvestorReactivations');
    expect(SRC).toContain('newProspects');
  });
});

describe('CHOOSE surface — existing five destinations regress cleanly, sixth becomes campaign pre-registration', () => {
  const SRC = stripComments(readSource('components/journey/KnytsBridgeChooseSurface.tsx'));

  it('the Store, CI, CFS Pilot, Ask Kn0w1 and Share destinations are all still present, unchanged', () => {
    expect(SRC).toContain('Explore the KNYT Store');
    expect(SRC).toContain('Learn about the Constitutional Internet');
    expect(SRC).toContain('Apply to join the Constitutional Financial Services Pilot');
    expect(SRC).toContain('Ask Kn0w1');
    expect(SRC).toContain('Share the Bridge');
  });

  it('SocialSharingModal is still mounted with the same campaign id — no new share tracker', () => {
    expect(SRC).toContain('SocialSharingModal');
    expect(SRC).toContain('campaignId={KNYTS_BRIDGE_CAMPAIGN_ID}');
  });

  it('the first card is now campaign pre-registration copy, not the graphic-novel reserve copy', () => {
    expect(SRC).toContain('Get first access to the metaKnyt Kickstarter');
    expect(SRC).not.toContain('Reserve metaKnyt Agentic Graphic Novel');
  });

  it('the Kickstarter follow CTA records a click before opening the URL, never opens a hard-coded URL', () => {
    expect(SRC).toContain('/api/journey/knyts-bridge/choose/kickstarter-click');
    expect(SRC).not.toMatch(/kickstarter\.com/);
  });
});
