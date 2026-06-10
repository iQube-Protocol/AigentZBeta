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
