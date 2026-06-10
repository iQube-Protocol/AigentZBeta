/**
 * Polity Passport Bureau canary tests — data layer invariants.
 *
 * Mirrors the access-spine canary pattern (tests/access-spine.test.ts).
 * Enforces:
 *   1. No PII columns in passport tables (self-custody vault rule)
 *   2. Migration SQL status enums match the status machine enums
 *   3. Citizen irrevocability CHECK constraint present in migration
 *   4. ANCHORABLE_ACTION_TYPES includes all passport receipt types
 *   5. Citizen renewal uses proof-of-aliveness evidence
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  CITIZEN_PASSPORT_STATUSES,
  PARTICIPANT_PASSPORT_STATUSES,
  CITIZEN_TRANSITION_RULES,
  PARTICIPANT_TRANSITION_RULES,
  citizenTransitionRule,
} from '@/services/passport/passportStatusMachine';

import { shouldAnchorActionType } from '@/services/dvn/activityReceiptDvnPipeline';

import {
  BUREAU_SYNTHETIC_EMAIL_DOMAIN,
  validateBureauUsername,
  syntheticEmailForUsername,
  isBureauSyntheticEmail,
  didPublicRef,
  mintKybeDid,
  recoveryPolicyStub,
} from '@/services/passport/bureauIdentityService';

const migrationSql = readFileSync(
  path.resolve(__dirname, '../supabase/migrations/20260610000000_polity_passport_bureau.sql'),
  'utf-8',
);

describe('self-custody vault enforcement — no PII in passport tables', () => {
  const PII_COLUMN_PATTERNS = [
    'first_name', 'last_name', 'full_name', 'given_name', 'family_name',
    'email_address', 'phone_number', 'date_of_birth', 'birth_date',
    'street_address', 'postal_code', 'zip_code', 'city', 'country',
    'social_security', 'ssn', 'national_id', 'tax_id',
    'passport_number', 'drivers_license', 'id_number',
    'biometric', 'fingerprint', 'face_image', 'photo_url',
    'ip_address', 'device_id', 'browser_fingerprint',
  ];

  it('migration SQL contains no PII-shaped column names', () => {
    const lower = migrationSql.toLowerCase();
    for (const pattern of PII_COLUMN_PATTERNS) {
      expect(lower).not.toContain(pattern);
    }
  });

  it('every table stores private data as vault refs only', () => {
    expect(migrationSql).toContain('vault_content_id');
    expect(migrationSql).toContain('vault_content_hash');
    expect(migrationSql).not.toMatch(/\bpersonal_data\b/i);
    expect(migrationSql).not.toMatch(/\bplaintext_\w+/i);
  });
});

describe('migration ↔ status machine enum sync', () => {
  it('citizen_status CHECK enum matches CITIZEN_PASSPORT_STATUSES', () => {
    const match = migrationSql.match(
      /citizen_status\s+text[\s\S]*?CHECK\s*\(citizen_status IS NULL OR citizen_status IN\s*\(([\s\S]*?)\)\)/,
    );
    expect(match).not.toBeNull();
    const enumValues = match![1]
      .split(',')
      .map((s) => s.trim().replace(/'/g, ''))
      .filter(Boolean);
    expect(enumValues).toEqual([...CITIZEN_PASSPORT_STATUSES]);
  });

  it('participant_status CHECK enum matches PARTICIPANT_PASSPORT_STATUSES', () => {
    const match = migrationSql.match(
      /participant_status\s+text[\s\S]*?CHECK\s*\(participant_status IS NULL OR participant_status IN\s*\(([\s\S]*?)\)\)/,
    );
    expect(match).not.toBeNull();
    const enumValues = match![1]
      .split(',')
      .map((s) => s.trim().replace(/'/g, ''))
      .filter(Boolean);
    expect(enumValues).toEqual([...PARTICIPANT_PASSPORT_STATUSES]);
  });
});

describe('citizen irrevocability — DB-level enforcement', () => {
  it('citizen_irrevocable CHECK constraint exists', () => {
    expect(migrationSql).toContain('CONSTRAINT citizen_irrevocable CHECK');
    expect(migrationSql).toContain("passport_class != 'citizen' OR revoked = false");
  });

  it('passport_remains_valid column is CHECK-enforced true', () => {
    expect(migrationSql).toContain('passport_remains_valid boolean NOT NULL DEFAULT true');
    expect(migrationSql).toContain('CHECK (passport_remains_valid = true)');
  });

  it('citizen_passport_revocation_allowed is CHECK-enforced false', () => {
    expect(migrationSql).toContain('citizen_passport_revocation_allowed boolean NOT NULL DEFAULT false');
    expect(migrationSql).toContain('CHECK (citizen_passport_revocation_allowed = false)');
  });
});

describe('DVN anchorable action types — passport receipt coverage', () => {
  const PASSPORT_RECEIPT_TYPES = [
    'passport_application_submitted',
    'passport_issued',
    'passport_status_changed',
    'passport_revoked',
    'passport_privilege_changed',
    'passport_infraction_recorded',
  ];

  it('all passport receipt types are anchorable', () => {
    for (const type of PASSPORT_RECEIPT_TYPES) {
      expect(shouldAnchorActionType(type)).toBe(true);
    }
  });
});

describe('citizen renewal — proof-of-aliveness', () => {
  it('renewal_due → active requires renewal_proof_of_aliveness evidence', () => {
    const rule = citizenTransitionRule('renewal_due', 'active');
    expect(rule).toBeDefined();
    expect(rule!.evidence).toBe('renewal_proof_of_aliveness');
  });

  it('dormancy recovery edges still use continuity_proof', () => {
    for (const from of ['expired_non_renewal', 'dormant', 'inactive_presumed'] as const) {
      const rule = citizenTransitionRule(from, 'active');
      expect(rule).toBeDefined();
      expect(rule!.evidence).toBe('continuity_proof');
    }
  });
});

describe('bureau identity — synthetic-email auth helpers (Stage 2)', () => {
  it('synthetic email uses the canonical internal domain', () => {
    expect(BUREAU_SYNTHETIC_EMAIL_DOMAIN).toBe('passport.metame.internal');
    expect(syntheticEmailForUsername('Ada-Lovelace')).toBe(
      'ada-lovelace@passport.metame.internal',
    );
    expect(isBureauSyntheticEmail('x@passport.metame.internal')).toBe(true);
    expect(isBureauSyntheticEmail('x@gmail.com')).toBe(false);
  });

  it('username validation: 3–32 lowercase alphanumeric + hyphens', () => {
    expect(validateBureauUsername('ada').ok).toBe(true);
    expect(validateBureauUsername('ada-lovelace-42').ok).toBe(true);
    expect(validateBureauUsername('ab').ok).toBe(false);
    expect(validateBureauUsername('Ada').ok).toBe(false);
    expect(validateBureauUsername('-ada').ok).toBe(false);
    expect(validateBureauUsername('ada-').ok).toBe(false);
    expect(validateBureauUsername('ada lovelace').ok).toBe(false);
    expect(validateBureauUsername('a'.repeat(33)).ok).toBe(false);
  });

  it('didPublicRef is a 16-hex commitment, deterministic, non-reversing', () => {
    const ref = didPublicRef('did:kybe:ppb:abc');
    expect(ref).toMatch(/^[0-9a-f]{16}$/);
    expect(didPublicRef('did:kybe:ppb:abc')).toBe(ref);
    expect(ref).not.toContain('did:');
  });

  it('minted kybe DIDs use the ppb namespace and are unique', () => {
    const a = mintKybeDid();
    const b = mintKybeDid();
    expect(a).toMatch(/^did:kybe:ppb:[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });

  it('recovery policy stub is account-scope only and warns on self-custody', () => {
    const withEmail = recoveryPolicyStub(true);
    const without = recoveryPolicyStub(false);
    expect(withEmail.scope).toBe('account_recovery_only');
    expect(without.scope).toBe('account_recovery_only');
    expect(without.warning).toContain('self-custodied');
    expect(withEmail.warning).toContain('ACCOUNT access only');
  });
});

describe('bureau identity — T0 leak canaries (Stage 2)', () => {
  const bindRouteSrc = readFileSync(
    path.resolve(__dirname, '../app/api/passport/identity/bind/route.ts'),
    'utf-8',
  );
  const serviceSrc = readFileSync(
    path.resolve(__dirname, '../services/passport/bureauIdentityService.ts'),
    'utf-8',
  );

  it('bind route never serializes personaId, kybe_did, or root did_uri', () => {
    // The response object must not carry T0 fields. We assert the route only
    // serializes the commitment-ref fields.
    expect(bindRouteSrc).toContain('kybePublicRef');
    expect(bindRouteSrc).toContain('rootDidPublicRef');
    expect(bindRouteSrc).not.toMatch(/personaId:\s*result\.personaId/);
    expect(bindRouteSrc).not.toMatch(/kybeDid:\s*/);
    expect(bindRouteSrc).not.toMatch(/rootDid:\s*(?!PublicRef)/);
  });

  it('bureau service routes caller auth through the spine, not a parallel resolver', () => {
    expect(bindRouteSrc).toContain('getCallerIdentityContext');
    expect(serviceSrc).not.toContain('getCurrentPersona');
  });
});

describe('participant automation stubs', () => {
  it('system-initiated participant transitions are flagged as automatable', () => {
    const systemOnly = [
      { from: 'submitted', to: 'pending_approval' },
      { from: 'provisionally_issued', to: 'expired' },
      { from: 'approved', to: 'expired' },
    ] as const;
    for (const { from, to } of systemOnly) {
      const rule = PARTICIPANT_TRANSITION_RULES.find(
        (r) => r.from === from && r.to === to,
      );
      expect(rule?.automatable).toBe(true);
    }
  });
});
