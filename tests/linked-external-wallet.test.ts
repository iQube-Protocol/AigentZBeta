/**
 * Linked external wallets — beside the principal wallet, never inside it.
 *
 * The wallet-binding trace (#121) found the operator's real MetaMask address in
 * `personas.evm_address`, the PRINCIPAL address field, because the passport-mint
 * route persisted `body.ownerAddress` after validating it as well-FORMED. The
 * operator's ruling (2026-08-02) was to preserve the relationship and strip it
 * of principal authority.
 *
 * Every canary here guards a sentence of that ruling, because each one is a
 * thing that would be tempting to do and would silently re-create the defect:
 *
 *   > "Do not classify the existing MetaMask address as proven merely because
 *   >  it was submitted to the mint route."
 *   > "Neither may satisfy principal mandate authority."
 *   > "Do not make the principal-wallet resolver read external linked-wallet
 *   >  records."
 *   > "Leave the other 20 rows unchanged and non-signing."
 */

import { describe, it, expect } from 'vitest';

import {
  migrateAddressToLinkedBinding,
  verifyExternalControlProof,
  recordExternalControlProof,
  externalWalletCapability,
  externalWalletMaySignPrincipalMandate,
  WALLET_REPAIR_RECEIPT_TYPES,
  WALLET_REPAIR_SCOPE,
  SUBMISSION_IS_NOT_PROOF,
  type LinkedExternalWallet,
} from '@/services/wallet/linkedExternalWallet';
import {
  mayServeAsPrincipalSigner,
  mayProduceSignature,
  mayDisplayAsEvidence,
} from '@/services/wallet/pilotWalletException';
import { readSource, stripComments, forbiddenImportFindings } from './_lib/sourceAuthority';

const OPERATOR_PERSONA = 'persona-operator';
const METAMASK = '0xAbC0000000000000000000000000000000000123';

function migrated(): LinkedExternalWallet {
  return migrateAddressToLinkedBinding({
    id: 'lew-1',
    subjectPersonaId: OPERATOR_PERSONA,
    provider: 'metamask',
    chain: 'evm',
    address: METAMASK,
    originatingWritePath: 'passport-mint-route',
    createdAt: '2026-08-02T00:00:00.000Z',
  });
}

describe('a migrated binding is unproven, and there is no way to say otherwise', () => {
  it('starts unproven with no proof reference', () => {
    const w = migrated();
    expect(w.controlStatus).toBe('unproven');
    expect(w.proofRef).toBeNull();
    expect(w.provenAt).toBeNull();
  });

  it('records where the binding came from, so a platform-written row is distinguishable', () => {
    expect(migrated().originatingWritePath).toBe('passport-mint-route');
  });

  it('normalises the address, so a case difference cannot read as a different wallet', () => {
    expect(migrated().address).toBe(METAMASK.toLowerCase());
  });

  it('names WHY submission is not proof, rather than only that it is not', () => {
    // A bare "unproven" invites someone to fix the status. The sentence has to
    // survive so the next reader knows there is nothing to fix but a ceremony.
    expect(SUBMISSION_IS_NOT_PROOF).toMatch(/no nonce/i);
    expect(SUBMISSION_IS_NOT_PROOF).toMatch(/no signature/i);
    expect(SUBMISSION_IS_NOT_PROOF).toMatch(/well-formed/i);
  });

  it('offers no controlStatus parameter a caller could set to proven', () => {
    const src = stripComments(readSource('services/wallet/linkedExternalWallet.ts'));
    const fn = src.slice(src.indexOf('export function migrateAddressToLinkedBinding'));
    const signature = fn.slice(0, fn.indexOf('): LinkedExternalWallet'));
    expect(signature).not.toMatch(/controlStatus/);
    expect(signature).not.toMatch(/proofRef/);
  });
});

describe('the proof ceremony compares, rather than trusting', () => {
  const NONCE = 'nonce-abc-123';

  it('proves control when a fresh nonce is signed and the recovered address matches', () => {
    const out = verifyExternalControlProof({
      wallet: migrated(),
      issuedNonce: NONCE,
      signedNonce: NONCE,
      signature: '0xsig',
      recoveredAddress: METAMASK.toLowerCase(),
      subjectPersonaId: OPERATOR_PERSONA,
    });
    expect(out.proven).toBe(true);
    expect(out.refusal).toBeNull();
  });

  it('refuses when no nonce was issued — a replayed signature would otherwise pass', () => {
    const out = verifyExternalControlProof({
      wallet: migrated(),
      issuedNonce: null,
      signedNonce: NONCE,
      signature: '0xsig',
      recoveredAddress: METAMASK.toLowerCase(),
      subjectPersonaId: OPERATOR_PERSONA,
    });
    expect(out.proven).toBe(false);
    expect(out.refusal).toBe('NONCE_NOT_ISSUED');
  });

  it('refuses a signature over a different message', () => {
    const out = verifyExternalControlProof({
      wallet: migrated(),
      issuedNonce: NONCE,
      signedNonce: 'some-other-message',
      signature: '0xsig',
      recoveredAddress: METAMASK.toLowerCase(),
      subjectPersonaId: OPERATOR_PERSONA,
    });
    expect(out.refusal).toBe('NONCE_MISMATCH');
  });

  it('refuses when the signature recovers a DIFFERENT address — the load-bearing comparison', () => {
    const out = verifyExternalControlProof({
      wallet: migrated(),
      issuedNonce: NONCE,
      signedNonce: NONCE,
      signature: '0xsig',
      recoveredAddress: '0x9999999999999999999999999999999999999999',
      subjectPersonaId: OPERATOR_PERSONA,
    });
    expect(out.proven).toBe(false);
    expect(out.refusal).toBe('RECOVERED_ADDRESS_MISMATCH');
    // The detail must not read as "you have no wallet" — someone does hold a key.
    expect(out.detail).toMatch(/not the key for this wallet/i);
  });

  it("refuses another persona's proof against this binding", () => {
    const out = verifyExternalControlProof({
      wallet: migrated(),
      issuedNonce: NONCE,
      signedNonce: NONCE,
      signature: '0xsig',
      recoveredAddress: METAMASK.toLowerCase(),
      subjectPersonaId: 'persona-someone-else',
    });
    expect(out.refusal).toBe('WRONG_SUBJECT');
  });

  it('refuses a missing signature and a failed recovery as DIFFERENT facts', () => {
    const base = { wallet: migrated(), issuedNonce: NONCE, signedNonce: NONCE, subjectPersonaId: OPERATOR_PERSONA };
    expect(verifyExternalControlProof({ ...base, signature: null, recoveredAddress: null }).refusal).toBe(
      'NO_SIGNATURE',
    );
    expect(verifyExternalControlProof({ ...base, signature: '0xsig', recoveredAddress: null }).refusal).toBe(
      'RECOVERY_FAILED',
    );
  });

  it('will not record a proof from a refused outcome', () => {
    const w = migrated();
    const refused = verifyExternalControlProof({
      wallet: w,
      issuedNonce: null,
      signedNonce: null,
      signature: null,
      recoveredAddress: null,
      subjectPersonaId: OPERATOR_PERSONA,
    });
    const after = recordExternalControlProof(w, refused, 'sr-1', '2026-08-02T01:00:00.000Z');
    expect(after.controlStatus).toBe('unproven');
    expect(after.proofRef).toBeNull();
  });
});

describe('proof changes the capability and never lifts the ceiling', () => {
  function proven(): LinkedExternalWallet {
    const w = migrated();
    const out = verifyExternalControlProof({
      wallet: w,
      issuedNonce: 'n',
      signedNonce: 'n',
      signature: '0xsig',
      recoveredAddress: METAMASK.toLowerCase(),
      subjectPersonaId: OPERATOR_PERSONA,
    });
    return recordExternalControlProof(w, out, 'sr-1', '2026-08-02T01:00:00.000Z');
  }

  it('moves EXTERNAL_UNPROVEN to EXTERNAL_PROVEN — the difference is real', () => {
    expect(externalWalletCapability(migrated())).toBe('EXTERNAL_UNPROVEN');
    expect(externalWalletCapability(proven())).toBe('EXTERNAL_PROVEN');
  });

  it('never becomes SIGNER_CONFIGURED — proof is not custody', () => {
    expect(externalWalletCapability(proven())).not.toBe('SIGNER_CONFIGURED');
  });

  it('NEITHER state may serve as principal signer — the operator was explicit', () => {
    expect(mayServeAsPrincipalSigner('EXTERNAL_UNPROVEN')).toBe(false);
    expect(mayServeAsPrincipalSigner('EXTERNAL_PROVEN')).toBe(false);
  });

  it('neither state may produce a platform signature', () => {
    expect(mayProduceSignature('EXTERNAL_UNPROVEN')).toBe(false);
    expect(mayProduceSignature('EXTERNAL_PROVEN')).toBe(false);
  });

  it('both may be displayed — preserving the relationship is the whole point', () => {
    expect(mayDisplayAsEvidence('EXTERNAL_UNPROVEN')).toBe(true);
    expect(mayDisplayAsEvidence('EXTERNAL_PROVEN')).toBe(true);
  });

  it('maySignPrincipalMandate is false for every wallet in every state', () => {
    expect(externalWalletMaySignPrincipalMandate(migrated())).toBe(false);
    expect(externalWalletMaySignPrincipalMandate(proven())).toBe(false);
    expect(migrated().maySignPrincipalMandate).toBe(false);
    expect(proven().maySignPrincipalMandate).toBe(false);
  });

  it('ignores its argument, so no spread-constructed wallet can flip it', () => {
    const forged = { ...migrated(), maySignPrincipalMandate: true } as unknown as LinkedExternalWallet;
    expect(externalWalletMaySignPrincipalMandate(forged)).toBe(false);
  });
});

describe('the principal resolver never reads linked external wallets', () => {
  it('does not import this module', () => {
    const src = readSource('services/identity/personaAddressResolver.ts');
    expect(
      forbiddenImportFindings(
        src,
        ['externalWalletCapability', 'migrateAddressToLinkedBinding', 'verifyExternalControlProof'],
        ['wallet/linkedExternalWallet'],
      ),
    ).toEqual([]);
  });

  it('never queries the linked-wallet table', () => {
    const src = stripComments(readSource('services/identity/personaAddressResolver.ts'));
    expect(src).not.toMatch(/linked_external_wallets/);
  });
});

describe('the schema encodes the constraints rather than defaulting to them', () => {
  const sql = readSource('supabase/migrations/20260930001100_linked_external_wallets.sql');

  it('forbids may_sign_principal_mandate = true by CHECK, not by default', () => {
    expect(sql).toMatch(/may_sign_principal_mandate\s+BOOLEAN NOT NULL DEFAULT FALSE/);
    expect(sql).toMatch(/CHECK \(may_sign_principal_mandate = FALSE\)/);
  });

  it('forbids a proven row with no proof reference', () => {
    expect(sql).toMatch(/control_status = 'proven' AND proof_ref IS NOT NULL AND proven_at IS NOT NULL/);
  });

  it('holds no key material', () => {
    expect(sql).not.toMatch(/private_key|encrypted_private_key|key_material|mnemonic|seed_phrase/i);
  });

  it('is service-role only, like signing_requests', () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/auth\.role\(\) = 'service_role'/);
  });

  it('records why wallet_alias_commitments could not carry this', () => {
    // Without the reason written down, "why is there a second wallet table?"
    // has an obvious wrong answer and someone will merge them.
    expect(sql).toMatch(/wallet_alias_commitments/);
    // Tolerant of the SQL comment line-wrap: `commitment\n-- hashes`.
    expect(sql).toMatch(/commitment(\s|-|\n)+hashes/i);
  });
});

describe('the repair is scoped to one persona', () => {
  it('applies to the active operator persona only', () => {
    expect(WALLET_REPAIR_SCOPE.appliesTo).toMatch(/active operator persona only/i);
  });

  it('prohibits every bulk action the operator named', () => {
    const prohibited = WALLET_REPAIR_SCOPE.prohibited.join(' | ').toLowerCase();
    expect(prohibited).toMatch(/bulk migration/);
    expect(prohibited).toMatch(/bulk provisioning/);
    expect(prohibited).toMatch(/erasing recorded addresses/);
  });

  it('permits an inventory, which is the point of not acting', () => {
    expect(WALLET_REPAIR_SCOPE.permitted.join(' ')).toMatch(/remediation inventory/i);
  });
});

describe('the five receipt types stay five', () => {
  it('names each repair fact separately', () => {
    expect([...WALLET_REPAIR_RECEIPT_TYPES]).toEqual([
      'address_only_placeholder_superseded',
      'external_wallet_binding_migrated',
      'principal_wallet_provisioned',
      'principal_wallet_control_proven',
      'external_wallet_control_proven',
    ]);
  });

  it('keeps principal and external control proof distinguishable in the ledger', () => {
    expect(WALLET_REPAIR_RECEIPT_TYPES).toContain('principal_wallet_control_proven');
    expect(WALLET_REPAIR_RECEIPT_TYPES).toContain('external_wallet_control_proven');
  });

  it('every type is accepted by the activity_receipts constraint', () => {
    const sql = readSource('supabase/migrations/20260930001200_wallet_repair_receipt_types.sql');
    for (const t of WALLET_REPAIR_RECEIPT_TYPES) expect(sql).toContain(`'${t}'`);
  });
});
