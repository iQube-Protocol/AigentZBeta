/**
 * VELA-001 Slice 2E — LIVE composition proof.
 *
 * Composes a CFS-006a public forecast with a REAL confidential projection from
 * the live local Vela projector, in the same `ConsequenceProjection`, through
 * the neutral composition seam
 * (`services/constitutionalCommerce/unifiedConsequenceProjection.ts`).
 *
 * The confidential half is always genuinely live: each case submits an
 * encrypted payload on-chain, the enclave executes the WASM projector, and the
 * verdict is decrypted from the per-user event.
 *
 * The public half prefers the real invariant store. Where `SUPABASE_URL` /
 * `SUPABASE_ANON_KEY` are absent (as in an offline sandbox),
 * `forecastConsequences()` cannot reach the store, and the script falls back to
 * locally-constructed forecasts of CFS-006a's own `ConsequenceForecast` type —
 * clearly labelled in the output. The composition under test is identical
 * either way; only the provenance of the public component's data changes, and
 * the script always says which it used.
 *
 * Usage:
 *   npx tsx scripts/vela-slice2e-live-composition.ts \
 *     --app <applicationId> --evm-key <hex> --p521-key <hex>
 */

import { VelaConfidentialProjectionProvider } from '../services/vela/velaProjectionProvider';
import { VelaClientAdapter, velaCryptoSelfTest } from '../services/vela/velaClientAdapter';
import { VELA_LOCAL_DEPLOYMENT } from '../services/vela/velaConfig';
import { forecastConsequences } from '../services/consequence/stages';
import {
  composeUnifiedConsequenceProjection,
  type ConfidentialEvidenceInput,
} from '../services/constitutionalCommerce/unifiedConsequenceProjection';
import type { ConsequenceForecast } from '../types/consequence';
import type {
  ConfidentialProjectionIdentitySet,
  ProjectionDisposition,
} from '../types/constitutionalCommerce';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) throw new Error(`missing required argument --${name}`);
  return process.argv[i + 1];
}

const APP_ID = arg('app');
const EVM_KEY = arg('evm-key');
const P521_KEY = arg('p521-key');
const CONTEXT_REF = 'ian-ctx-slice2e-live';

const IDENTITIES: ConfidentialProjectionIdentitySet = {
  authorityPrincipal: 'local-principal-ref',
  mandateSigner: 'local-principal-ref',
  confidentialRequester: 'local-agent-wallet',
  confidentialPrivacyIdentity: 'local-agent-wallet',
  executionSigner: 'local-agent-wallet',
};

/** CFS-006a's real type; data source labelled at runtime. */
function localForecast(kind: 'acceptable' | 'unacceptable'): ConsequenceForecast {
  if (kind === 'unacceptable') {
    return {
      seedInvariantIds: ['inv.finance.001'],
      nodes: [
        {
          invariantId: 'inv.constitutional.mandate-scope',
          statement: 'an action must remain within its mandate scope',
          via: 'constrains',
          cautionary: true,
        },
      ],
      enables: 0,
      constrains: 1,
      contradicts: 0,
      forcesEscalation: true,
      constitutionalConstraint: true,
      constitutionalConstraintIds: ['inv.constitutional.mandate-scope'],
      rationale: 'bounded by a constitutional constraint',
    };
  }
  return {
    seedInvariantIds: ['inv.finance.001'],
    nodes: [
      {
        invariantId: 'inv.finance.settlement-ready',
        statement: 'settlement path is available',
        via: 'enables',
        cautionary: false,
      },
    ],
    enables: 1,
    constrains: 0,
    contradicts: 0,
    forcesEscalation: false,
    constitutionalConstraint: false,
    constitutionalConstraintIds: [],
    rationale: 'no reachable constraint or contradiction',
  };
}

/** Try the real invariant store; report which source was used. */
async function resolvePublicForecast(
  kind: 'acceptable' | 'unacceptable',
): Promise<{ forecast: ConsequenceForecast; source: string }> {
  try {
    const live = await forecastConsequences(['inv.finance.001']);
    return { forecast: live, source: 'LIVE_INVARIANT_STORE (CFS-006a forecastConsequences)' };
  } catch (err) {
    return {
      forecast: localForecast(kind),
      source: `LOCAL_FORECAST_FIXTURE — invariant store unreachable (${(err as Error).message.slice(0, 60)})`,
    };
  }
}

interface Case {
  label: string;
  publicKind: 'acceptable' | 'unacceptable';
  /** null = do not invoke the provider at all (tests REQUIRED + absent). */
  confidentialInputs: Record<string, number> | null;
  requirement: 'REQUIRED' | 'NOT_REQUIRED';
  expect: ProjectionDisposition;
  why: string;
}

const CASES: Case[] = [
  {
    label: 'public ACCEPTABLE + confidential ACCEPTABLE',
    publicKind: 'acceptable',
    requirement: 'REQUIRED',
    confidentialInputs: {
      currentBalance: 10_000,
      currentExposure: 2_000,
      proposedSpend: 500,
      privateSpendLimit: 1_000,
      privateRiskLimit: 5_000,
    },
    expect: 'ACCEPTABLE',
    why: 'both required components acceptable',
  },
  {
    label: 'public ACCEPTABLE + confidential UNACCEPTABLE',
    publicKind: 'acceptable',
    requirement: 'REQUIRED',
    confidentialInputs: {
      currentBalance: 10_000,
      currentExposure: 4_800,
      proposedSpend: 500,
      privateSpendLimit: 1_000,
      privateRiskLimit: 5_000,
    },
    expect: 'UNACCEPTABLE',
    why: 'confidential UNACCEPTABLE dominates public ACCEPTABLE',
  },
  {
    label: 'public UNACCEPTABLE + confidential ACCEPTABLE',
    publicKind: 'unacceptable',
    requirement: 'REQUIRED',
    confidentialInputs: {
      currentBalance: 10_000,
      currentExposure: 2_000,
      proposedSpend: 500,
      privateSpendLimit: 1_000,
      privateRiskLimit: 5_000,
    },
    expect: 'UNACCEPTABLE',
    why: 'public UNACCEPTABLE dominates confidential ACCEPTABLE',
  },
  {
    label: 'public ACCEPTABLE + confidential REQUIRED but absent',
    publicKind: 'acceptable',
    requirement: 'REQUIRED',
    confidentialInputs: null,
    expect: 'UNRESOLVED',
    why: 'missing required confidential evidence is UNRESOLVED, never ACCEPTABLE',
  },
  {
    label: 'public ACCEPTABLE + confidential NOT_REQUIRED',
    publicKind: 'acceptable',
    requirement: 'NOT_REQUIRED',
    confidentialInputs: null,
    expect: 'ACCEPTABLE',
    why: 'no confidential component required — no provider invoked',
  },
];

async function main() {
  console.log('— Vela crypto self-test');
  velaCryptoSelfTest();
  console.log('  ✓\n');

  const transport = new VelaClientAdapter({
    deployment: VELA_LOCAL_DEPLOYMENT,
    requesterPrivateKeyHex: EVM_KEY,
    requesterP521PrivateKeyHex: P521_KEY,
    maxFeeValueWei: 1_000_000n,
  });
  const provider = new VelaConfidentialProjectionProvider(transport, APP_ID);

  let providerInvocations = 0;
  let failures = 0;

  for (const c of CASES) {
    console.log(`— ${c.label}`);
    console.log(`  expect ${c.expect} — ${c.why}`);

    const { forecast, source } = await resolvePublicForecast(c.publicKind);
    console.log(`  public source   ${source}`);

    let confidentialEvidence: ConfidentialEvidenceInput | null = null;

    if (c.confidentialInputs && c.requirement === 'REQUIRED') {
      const before = providerInvocations;
      providerInvocations++;
      const prepared = await provider.prepareProjection({
        actionRef: `slice2e-${c.label.replace(/\W+/g, '-').toLowerCase()}`,
        mandateRef: 'live-mandate-1',
        identities: IDENTITIES,
        confidentialInputs: c.confidentialInputs,
        publicContext: { policyVersion: 'v1', actionType: 'payment' },
      });
      const submission = await provider.submitProjection(prepared);

      let status = await provider.getProjectionStatus(submission.requestRef);
      for (let i = 0; i < 60 && status.state === 'OBSERVING'; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        status = await provider.getProjectionStatus(submission.requestRef);
      }

      const ev = await provider.getProjectionEvidence(submission.requestRef);
      const ver = await provider.verifyProjectionEvidence(ev);
      console.log(
        `  confidential    LIVE request ${submission.requestRef.slice(0, 18)}… verdict ${ev.disposition} ` +
          `(invocation #${before + 1})`,
      );

      confidentialEvidence = {
        provider: 'vela',
        requestRef: ev.requestRef,
        disposition: ev.disposition,
        resultCommitment: ev.resultCommitment,
        payloadCommitment: ev.payloadCommitment,
        protocolExecutionVerified: ver.protocolExecutionVerified,
        teeAttestationVerified: ver.teeAttestationVerified,
        attestationMode: ver.attestationMode,
      };
    } else {
      console.log(
        `  confidential    ${c.requirement === 'NOT_REQUIRED' ? 'NOT_REQUIRED — provider not invoked' : 'REQUIRED but absent — provider not invoked'}`,
      );
    }

    const projection = composeUnifiedConsequenceProjection({
      projectionContextRef: CONTEXT_REF,
      actionRef: `slice2e-${c.label.replace(/\W+/g, '-').toLowerCase()}`,
      authorityRef: 'live-authority-1',
      mandateRef: 'live-mandate-1',
      publicForecast: forecast,
      confidentialRequirement: c.requirement,
      confidentialEvidence,
      confidentialAbsenceReason:
        c.requirement === 'REQUIRED' && !c.confidentialInputs
          ? 'confidential projection deliberately not produced for this case'
          : undefined,
    });

    console.log(`  COMPOSED        ${projection.disposition}`);
    console.log(`    rationale     ${projection.compositionRationale}`);
    console.log(
      `    public        ${projection.public.disposition} · forecastRef ${projection.public.forecastRef.slice(0, 12)}…`,
    );
    console.log(
      `    confidential  ${projection.confidential.requirement} · ${projection.confidential.disposition ?? 'n/a'} ` +
        `· provider ${projection.confidential.provider ?? 'none'} ` +
        `· protoVerified ${projection.confidential.protocolExecutionVerified ?? 'n/a'} ` +
        `· attested ${projection.confidential.teeAttestationVerified ?? 'n/a'}`,
    );
    console.log(`    contextRef    ${projection.projectionContextRef}`);

    // Provenance must remain independently inspectable, and no authorisation
    // vocabulary may appear anywhere in the composed projection.
    const serialised = JSON.stringify(projection);
    const emitsAuthorisation = [
      'AUTHORISED',
      'AUTHORIZED',
      'ACTION_AUTHORISED',
      'AUTHORITY_VALID',
      'MANDATE_VALID',
      'authorisationRef',
    ].some((t) => serialised.includes(t));

    const provenanceIntact =
      projection.projectionContextRef === CONTEXT_REF &&
      projection.public.disposition !== undefined &&
      projection.public.forecast !== undefined &&
      (c.requirement === 'NOT_REQUIRED'
        ? projection.confidential.provider === null
        : true);

    const ok =
      projection.disposition === c.expect && !emitsAuthorisation && provenanceIntact;

    if (!ok) {
      failures++;
      console.log('  ✗ FAILED');
      if (projection.disposition !== c.expect) {
        console.log(`    expected ${c.expect}, got ${projection.disposition}`);
      }
      if (emitsAuthorisation) console.log('    composition emitted authorisation vocabulary');
      if (!provenanceIntact) console.log('    provenance was not preserved');
    } else {
      console.log('  ✓ PASS');
    }
    console.log();
  }

  console.log(`— Result: ${CASES.length - failures}/${CASES.length} passed`);
  console.log(
    `— Provider invocations: ${providerInvocations} (expected 3 — the two absent/not-required cases must not invoke it)`,
  );
  if (providerInvocations !== 3) {
    console.log('  ✗ provider invocation count wrong');
    process.exit(1);
  }
  if (failures > 0) process.exit(1);
  console.log('\nLIVE COMPOSITION PROOF COMPLETE');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
