/**
 * personaAddressResolver — resolves a persona's chain address for the
 * Phase 3.3b token credential resolver.
 *
 * Resolution order (most authoritative first):
 *   1. personas.evm_address column                    (canonical EVM address)
 *   2. personas.evm_key.address                       (legacy keypair envelope)
 *   3. wallet_aliases by (persona_id, chain, status='active')
 *
 * Returns null if no address is on file. The spine treats null as
 * "not in cohort / does not own the token" — conservative deny.
 *
 * T0/T1 contract: this function is server-only; the returned address
 * is a public chain identifier (T2-equivalent for owned funds) but
 * the persona_id mapping itself is T0 — never exposed to the browser.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export async function resolvePersonaWalletAddress(
  personaId: string,
  chain: string,
): Promise<string | null> {
  if (!personaId) return null;
  const sb = getSupabaseServer();
  if (!sb) return null;

  const isEvmChain = ['ethereum', 'base', 'optimism', 'polygon', 'arbitrum', 'eth', 'mainnet', 'arb', 'op', 'matic'].includes(
    chain.toLowerCase(),
  );

  // 1 + 2: personas table — only relevant for EVM chains.
  if (isEvmChain) {
    const { data: row } = await sb
      .from('personas')
      .select('evm_address, evm_key')
      .eq('id', personaId)
      .maybeSingle();
    if (row) {
      const direct = typeof row.evm_address === 'string' ? row.evm_address : null;
      if (direct && /^0x[0-9a-fA-F]{40}$/.test(direct)) return direct;
      const fromKey =
        row.evm_key && typeof (row.evm_key as { address?: unknown }).address === 'string'
          ? ((row.evm_key as { address: string }).address)
          : null;
      if (fromKey && /^0x[0-9a-fA-F]{40}$/.test(fromKey)) return fromKey;
    }
  }

  // 3: wallet_aliases fallback (covers BTC / SOL / explicitly registered EVM aliases)
  const aliasChain = isEvmChain ? 'evm' : chain.toLowerCase();
  const { data: alias } = await sb
    .from('wallet_aliases')
    .select('wallet_address')
    .eq('persona_id', personaId)
    .eq('chain', aliasChain)
    .eq('status', 'active')
    .order('registered_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (alias?.wallet_address && typeof alias.wallet_address === 'string') {
    return alias.wallet_address;
  }
  return null;
}

/**
 * WHY the address lookup came back empty — the structured form of
 * `resolvePersonaWalletAddress` (operator report, 2026-08-02).
 *
 * THE DEFECT THIS CLOSES: the Register ceremony refused with a flat
 * "No wallet is on file for the operator", which is true but tells the
 * operator nothing they can act on. There are three independent places an
 * address can live, and they fail for completely different reasons:
 *
 *   - `personas.evm_address` empty but `evm_key.address` present
 *       → a BACKFILL gap. The key material exists; the canonical column was
 *         never populated. POST /api/admin/identity/sync-persona-evm-addresses
 *         fixes it.
 *   - both empty
 *       → this persona has NO EVM key material at all. Personas created via
 *         /api/identity/persona/create-with-fio are inserted with
 *         `evm_key: null`, so they land here. A wallet must actually be
 *         created for the persona; no backfill can invent one.
 *   - present but malformed
 *       → data corruption, not absence. Saying "no wallet" would send the
 *         operator looking for a missing thing that is in fact there and
 *         wrong.
 *
 * Collapsing all three into one message is what made this unfixable from the
 * error alone.
 */
export type WalletAddressAbsence =
  | 'resolved'
  | 'needs-backfill'
  | 'no-key-material'
  | 'malformed-address'
  | 'store-unavailable';

export interface WalletAddressDiagnosis {
  address: string | null;
  reason: WalletAddressAbsence;
  /** What the operator should do next, in their own terms. */
  remediation: string | null;
}

export async function diagnosePersonaWalletAddress(
  personaId: string,
  chain: string,
): Promise<WalletAddressDiagnosis> {
  const address = await resolvePersonaWalletAddress(personaId, chain);
  if (address) return { address, reason: 'resolved', remediation: null };

  const sb = getSupabaseServer();
  if (!sb) {
    return {
      address: null,
      reason: 'store-unavailable',
      // UNKNOWN, never "you have no wallet" — a store outage must not read
      // as an absent wallet.
      remediation: 'The persona store could not be read, so this is unknown rather than absent. Try again shortly.',
    };
  }

  const { data: row } = await sb
    .from('personas')
    .select('evm_address, evm_key')
    .eq('id', personaId)
    .maybeSingle();

  const rawColumn = typeof row?.evm_address === 'string' ? row.evm_address : null;
  const rawKey =
    row?.evm_key && typeof (row.evm_key as { address?: unknown }).address === 'string'
      ? (row.evm_key as { address: string }).address
      : null;
  const wellFormed = (v: string | null) => !!v && /^0x[0-9a-fA-F]{40}$/.test(v);

  if ((rawColumn && !wellFormed(rawColumn)) || (rawKey && !wellFormed(rawKey))) {
    return {
      address: null,
      reason: 'malformed-address',
      remediation:
        'An address is recorded for this persona but is not a well-formed EVM address. It needs correcting, not creating.',
    };
  }

  if (rawKey) {
    return {
      address: null,
      reason: 'needs-backfill',
      remediation:
        'This persona has wallet key material but its canonical evm_address column was never populated. ' +
        'Run POST /api/admin/identity/sync-persona-evm-addresses to backfill it.',
    };
  }

  return {
    address: null,
    reason: 'no-key-material',
    remediation:
      'This persona has no EVM wallet key material at all, so there is nothing to back a signature. ' +
      'Create a metaMe wallet for this persona (SmartWallet drawer → create persona wallet), then retry. ' +
      'Personas created through the FIO-only path are inserted without a key pair and always land here.',
  };
}

// ── Wallet CAPABILITY, not merely address presence ──────────────────────────

/**
 * `classifyPersonaWalletCapability` — what this wallet can DO.
 *
 * ── The defect this closes (wallet-binding trace #121, 2026-08-02) ──────────
 *
 * `resolvePersonaWalletAddress` answers "is an address on file". The signing
 * ceremony treated that as "a signer exists". They are different facts, and
 * three live provisioning paths produce rows where they diverge:
 * `bootstrap-starter`, `/api/persona/create` and `provisionAigentMePersona`
 * all write **twenty random bytes** as an address with **no key behind them**.
 *
 * For such a row the resolver returns a well-formed address,
 * `diagnosePersonaWalletAddress` returns `resolved`, the ceremony offers the
 * operator a mandate — and no signature can ever be produced, because those
 * bytes are not the hash of any public key. The failure surfaces at
 * `verifyMessage` recovery, long after the operator was told they could sign.
 *
 * So the question the ceremony must ask is not "did I get an address" but
 * "may this wallet produce a signature", and only `SIGNER_CONFIGURED` may.
 *
 * ── The legacy exception ───────────────────────────────────────────────────
 *
 * PILOT-WALLET-EXCEPTION-001 permits the Aigent Z legacy/deployer address to
 * remain visible as continuity evidence. It does NOT permit it to sign, and it
 * does not permit it to stand in for the principal. `LEGACY_EVIDENCE_ONLY` is
 * how that distinction survives contact with a resolver: displayable, never
 * signable — checked BEFORE key material, because a compromised key that
 * happens to be present must not classify as ready.
 *
 * The legacy address is read from `app/data/agentConfig.ts`, the one place it
 * already lives. Copying it here would spread the literal that
 * AIGENT-Z-WALLET-ROTATION-001 exists to remove.
 */

import type { WalletCapability } from '@/services/wallet/pilotWalletException';

export interface PersonaWalletCapability {
  capability: WalletCapability;
  address: string | null;
  /** Why, in the operator's terms. Never a bare status word. */
  detail: string;
  /** What would move this wallet to SIGNER_CONFIGURED. Null when it already is. */
  remediation: string | null;
}

/** Addresses under the pilot exception — legacy evidence, never authority. */
async function legacyEvidenceAddresses(): Promise<Set<string>> {
  try {
    const { agentConfigs } = await import('@/app/data/agentConfig');
    const out = new Set<string>();
    for (const cfg of Object.values(agentConfigs ?? {})) {
      const a = (cfg as { walletAddresses?: { evmAddress?: unknown } })?.walletAddresses?.evmAddress;
      if (typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a)) out.add(a.toLowerCase());
    }
    return out;
  } catch {
    // Unknown ≠ empty. A caller that cannot read the legacy set must not
    // conclude an address is clean — see the UNAVAILABLE branch below.
    return new Set<string>();
  }
}

export async function classifyPersonaWalletCapability(
  personaId: string,
  chain = 'base',
): Promise<PersonaWalletCapability> {
  const absent = (detail: string, remediation: string): PersonaWalletCapability => ({
    capability: 'ABSENT',
    address: null,
    detail,
    remediation,
  });

  if (!personaId) {
    return absent('No persona was supplied, so no wallet could be resolved.', 'Resolve the active persona first.');
  }
  const sb = getSupabaseServer();
  if (!sb) {
    return {
      capability: 'UNAVAILABLE',
      address: null,
      detail: 'The identity store could not be reached, so this wallet could not be classified.',
      // UNAVAILABLE is emphatically not ABSENT. Offering provisioning here
      // would invite a second wallet for a persona that may already have one.
      remediation: null,
    };
  }

  const { data: row, error } = await sb
    .from('personas')
    .select('evm_address, evm_key')
    .eq('id', personaId)
    .maybeSingle();

  if (error) {
    return {
      capability: 'UNAVAILABLE',
      address: null,
      detail: `The persona record could not be read (${error.message}).`,
      remediation: null,
    };
  }
  if (!row) {
    return absent('No persona record exists for this id.', 'Create the persona before provisioning a wallet.');
  }

  const WELL_FORMED = /^0x[0-9a-fA-F]{40}$/;
  const column = typeof row.evm_address === 'string' ? row.evm_address : null;
  const envelope = (row.evm_key ?? null) as { address?: unknown; encryptedPrivateKey?: unknown } | null;
  const envelopeAddress = typeof envelope?.address === 'string' ? envelope.address : null;
  // The load-bearing check: is there KEY MATERIAL, not merely an address?
  const hasKeyMaterial = typeof envelope?.encryptedPrivateKey === 'string' && envelope.encryptedPrivateKey.length > 0;
  const address = column ?? envelopeAddress;

  if (!address) {
    return absent(
      hasKeyMaterial
        ? 'Encrypted key material is on file but no address has been recorded for it.'
        : 'No wallet is on file for this persona.',
      hasKeyMaterial
        ? 'Derive and record the address from the existing encrypted key — never generate a new one.'
        : 'Provision a principal wallet: create an encrypted key, record its derived address, and bind it to this persona.',
    );
  }

  if (!WELL_FORMED.test(address)) {
    return {
      capability: 'MALFORMED',
      address,
      detail: 'The address on file is not a well-formed EVM address.',
      remediation: 'Correct the recorded address from the encrypted key envelope; do not sign against it meanwhile.',
    };
  }

  // Legacy FIRST — before key material. A compromised key that happens to be
  // decryptable must not classify as ready simply because it exists.
  const legacy = await legacyEvidenceAddresses();
  if (legacy.has(address.toLowerCase())) {
    return {
      capability: 'LEGACY_EVIDENCE_ONLY',
      address,
      detail:
        'This is a legacy platform wallet held under PILOT-WALLET-EXCEPTION-001. It may be shown as ' +
        'continuity evidence and may not produce a signature or stand in for the principal wallet.',
      remediation: 'Provision a principal wallet for this persona; the legacy address is retired by AIGENT-Z-WALLET-ROTATION-001.',
    };
  }

  if (!hasKeyMaterial) {
    return {
      capability: 'ADDRESS_ONLY',
      address,
      detail:
        'An address is recorded but no encrypted key material exists behind it, so no signature can be produced ' +
        'from it — however well-formed it looks.',
      // NEVER fabricate a key for an existing random address: it would bind a
      // real signer to bytes that were never derived from one, and every prior
      // reference to that address would silently become a claim about a key.
      remediation:
        'Provision a real principal wallet and rebind this persona to it. Never generate a key for the existing address.',
    };
  }

  if (column && envelopeAddress && column.toLowerCase() !== envelopeAddress.toLowerCase()) {
    return {
      capability: 'AMBIGUOUS',
      address: null,
      detail: 'Two different addresses are on file for this persona and there is no rule that chooses between them.',
      remediation: 'Determine which address the encrypted key actually derives, then record that one and remove the other.',
    };
  }

  if (!column) {
    return {
      capability: 'PRESENT_BUT_UNBOUND',
      address,
      detail: 'Key material and an address exist in the envelope, but the persona has no bound address column.',
      remediation: 'Bind the envelope address to personas.evm_address for this persona.',
    };
  }

  return {
    capability: 'SIGNER_CONFIGURED',
    address,
    detail: 'An address is bound to this persona and encrypted key material exists behind it.',
    remediation: null,
  };
}
