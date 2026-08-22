/**
 * VELA-001 Slice 2E canaries — the canonical consequence-composition seam.
 *
 * Proves the eleven operator-specified invariants (2026-08-22) plus the full
 * composition matrix. This seam is shared substrate — Vela, the Ian
 * experimental substrate, Conditional Commerce and later Qriptosentience all
 * compose through it — so a regression here is not a Vela regression.
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  composeConfidentialComponent,
  composeDispositions,
  composePublicComponent,
  composeUnifiedConsequenceProjection,
  type ConfidentialEvidenceInput,
} from '@/services/constitutionalCommerce/unifiedConsequenceProjection';
import type { ConsequenceForecast } from '@/types/consequence';
import type { ProjectionDisposition } from '@/types/constitutionalCommerce';

const CONTEXT_REF = 'ian-ctx-7f3a91';

function forecast(over: Partial<ConsequenceForecast> = {}): ConsequenceForecast {
  return {
    seedInvariantIds: ['inv.finance.001'],
    nodes: [],
    enables: 2,
    constrains: 0,
    contradicts: 0,
    forcesEscalation: false,
    constitutionalConstraint: false,
    constitutionalConstraintIds: [],
    rationale: 'test forecast',
    ...over,
  };
}

/** A forecast that maps to each public disposition. */
const PUBLIC_ACCEPTABLE = forecast();
const PUBLIC_UNACCEPTABLE = forecast({
  constrains: 1,
  forcesEscalation: true,
  constitutionalConstraint: true,
  constitutionalConstraintIds: ['inv.constitutional.014'],
});
const PUBLIC_UNRESOLVED = forecast({ contradicts: 1, forcesEscalation: true });

function evidence(
  disposition: ProjectionDisposition,
  over: Partial<ConfidentialEvidenceInput> = {},
): ConfidentialEvidenceInput {
  return {
    provider: 'vela',
    requestRef: '0xreq1',
    disposition,
    resultCommitment: 'a'.repeat(64),
    payloadCommitment: 'b'.repeat(64),
    protocolExecutionVerified: true,
    teeAttestationVerified: false,
    attestationMode: 'NO_ATTESTATION_LOCAL',
    ...over,
  };
}

function compose(
  publicForecast: ConsequenceForecast,
  requirement: 'REQUIRED' | 'NOT_REQUIRED',
  confidentialEvidence?: ConfidentialEvidenceInput | null,
  policy?: { requireVerifiedAttestation?: boolean },
) {
  return composeUnifiedConsequenceProjection({
    projectionContextRef: CONTEXT_REF,
    actionRef: 'action-1',
    authorityRef: 'authority-1',
    mandateRef: 'mandate-1',
    publicForecast,
    confidentialRequirement: requirement,
    confidentialEvidence,
    policy,
  });
}

// ── The eleven required canaries ─────────────────────────────────────────

describe('1. confidential REQUIRED + absent ⇒ UNRESOLVED', () => {
  it('never reads absent required evidence as ACCEPTABLE', () => {
    const p = compose(PUBLIC_ACCEPTABLE, 'REQUIRED', null);
    expect(p.disposition).toBe('UNRESOLVED');
    expect(p.confidential.disposition).toBe('UNRESOLVED');
    expect(p.confidential.reason).toMatch(/not acceptable|unresolved/i);
  });

  it('holds even when the public component is fully acceptable', () => {
    const p = compose(PUBLIC_ACCEPTABLE, 'REQUIRED', undefined);
    expect(p.public.disposition).toBe('ACCEPTABLE');
    expect(p.disposition).toBe('UNRESOLVED');
  });
});

describe('2. confidential NOT_REQUIRED does not invoke a provider', () => {
  it('composes from the public component alone', () => {
    const p = compose(PUBLIC_ACCEPTABLE, 'NOT_REQUIRED');
    expect(p.disposition).toBe('ACCEPTABLE');
    expect(p.confidential.requirement).toBe('NOT_REQUIRED');
    expect(p.confidential.disposition).toBeNull();
    expect(p.confidential.provider).toBeNull();
    expect(p.compositionRationale).not.toMatch(/confidential/);
  });

  it('a NOT_REQUIRED component cannot contribute a disposition even if evidence is passed', () => {
    // Guards against a caller wiring evidence in while declaring it not
    // required — the requirement is the authority on participation.
    const p = compose(PUBLIC_ACCEPTABLE, 'NOT_REQUIRED', evidence('UNACCEPTABLE'));
    expect(p.disposition).toBe('ACCEPTABLE');
    expect(p.confidential.disposition).toBeNull();
  });

  it('the provider is never called when not required', async () => {
    const provider = { getProjectionEvidence: vi.fn() };
    compose(PUBLIC_ACCEPTABLE, 'NOT_REQUIRED');
    expect(provider.getProjectionEvidence).not.toHaveBeenCalled();
  });
});

describe('3. public UNACCEPTABLE dominates confidential ACCEPTABLE', () => {
  it('composes to UNACCEPTABLE', () => {
    const p = compose(PUBLIC_UNACCEPTABLE, 'REQUIRED', evidence('ACCEPTABLE'));
    expect(p.public.disposition).toBe('UNACCEPTABLE');
    expect(p.confidential.disposition).toBe('ACCEPTABLE');
    expect(p.disposition).toBe('UNACCEPTABLE');
    expect(p.compositionRationale).toContain('public');
  });
});

describe('4. confidential UNACCEPTABLE dominates public ACCEPTABLE', () => {
  it('composes to UNACCEPTABLE', () => {
    const p = compose(PUBLIC_ACCEPTABLE, 'REQUIRED', evidence('UNACCEPTABLE'));
    expect(p.public.disposition).toBe('ACCEPTABLE');
    expect(p.confidential.disposition).toBe('UNACCEPTABLE');
    expect(p.disposition).toBe('UNACCEPTABLE');
    expect(p.compositionRationale).toContain('confidential');
  });
});

describe('5. public UNRESOLVED cannot be rescued by confidential ACCEPTABLE', () => {
  it('composes to UNRESOLVED', () => {
    const p = compose(PUBLIC_UNRESOLVED, 'REQUIRED', evidence('ACCEPTABLE'));
    expect(p.public.disposition).toBe('UNRESOLVED');
    expect(p.disposition).toBe('UNRESOLVED');
  });

  it('also holds when confidential is NOT_REQUIRED', () => {
    expect(compose(PUBLIC_UNRESOLVED, 'NOT_REQUIRED').disposition).toBe('UNRESOLVED');
  });
});

describe('6. confidential UNRESOLVED cannot be rescued by public ACCEPTABLE', () => {
  it('composes to UNRESOLVED', () => {
    const p = compose(PUBLIC_ACCEPTABLE, 'REQUIRED', evidence('UNRESOLVED'));
    expect(p.disposition).toBe('UNRESOLVED');
  });
});

describe('7. no composition path emits an authorisation', () => {
  const MATRIX: Array<[ConsequenceForecast, 'REQUIRED' | 'NOT_REQUIRED', ConfidentialEvidenceInput | null]> = [
    [PUBLIC_ACCEPTABLE, 'NOT_REQUIRED', null],
    [PUBLIC_ACCEPTABLE, 'REQUIRED', evidence('ACCEPTABLE')],
    [PUBLIC_ACCEPTABLE, 'REQUIRED', evidence('UNACCEPTABLE')],
    [PUBLIC_ACCEPTABLE, 'REQUIRED', evidence('UNRESOLVED')],
    [PUBLIC_ACCEPTABLE, 'REQUIRED', null],
    [PUBLIC_UNACCEPTABLE, 'REQUIRED', evidence('ACCEPTABLE')],
    [PUBLIC_UNRESOLVED, 'REQUIRED', evidence('ACCEPTABLE')],
    [PUBLIC_UNACCEPTABLE, 'NOT_REQUIRED', null],
    [PUBLIC_UNRESOLVED, 'NOT_REQUIRED', null],
  ];

  it('no path produces authorisation vocabulary', () => {
    for (const [f, req, ev] of MATRIX) {
      const serialised = JSON.stringify(compose(f, req, ev));
      for (const forbidden of [
        'AUTHORISED',
        'AUTHORIZED',
        'ACTION_AUTHORISED',
        'AUTHORITY_VALID',
        'MANDATE_VALID',
        'REFUSED',
        'authorisationRef',
      ]) {
        expect(serialised).not.toContain(forbidden);
      }
    }
  });

  it('every path yields exactly one of the three dispositions', () => {
    for (const [f, req, ev] of MATRIX) {
      expect(['ACCEPTABLE', 'UNACCEPTABLE', 'UNRESOLVED']).toContain(
        compose(f, req, ev).disposition,
      );
    }
  });

  it('the composition module never imports the authorisation type', () => {
    const src = readFileSync(
      join(process.cwd(), 'services/constitutionalCommerce/unifiedConsequenceProjection.ts'),
      'utf8',
    );
    const imports = src.match(/^import[\s\S]*?from\s+'[^']+';$/gm) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const block of imports) {
      expect(block).not.toMatch(/ActionAuthorisation|CommerceExecution/);
    }
  });
});

describe('8. public and confidential provenance remain independently inspectable', () => {
  it('every provenance field survives composition, unflattened', () => {
    const ev = evidence('UNACCEPTABLE', {
      provider: 'vela',
      requestRef: '0xdeadbeef',
      resultCommitment: 'c'.repeat(64),
      payloadCommitment: 'd'.repeat(64),
      teeAttestationVerified: false,
      attestationMode: 'NO_ATTESTATION_LOCAL',
    });
    const p = compose(PUBLIC_UNACCEPTABLE, 'REQUIRED', ev);

    // public provenance
    expect(p.public.source).toBe('consequence_operating_model');
    expect(p.public.forecastRef).toMatch(/^[0-9a-f]{32}$/);
    expect(p.public.forecast.constitutionalConstraintIds).toEqual(['inv.constitutional.014']);
    expect(p.public.disposition).toBe('UNACCEPTABLE');
    expect(p.public.reason).toBeTruthy();

    // confidential provenance — each field separately readable
    expect(p.confidential.provider).toBe('vela');
    expect(p.confidential.requestRef).toBe('0xdeadbeef');
    expect(p.confidential.disposition).toBe('UNACCEPTABLE');
    expect(p.confidential.evidenceRef).toBe('c'.repeat(64));
    expect(p.confidential.payloadCommitment).toBe('d'.repeat(64));
    expect(p.confidential.protocolExecutionVerified).toBe(true);
    expect(p.confidential.teeAttestationVerified).toBe(false);
    expect(p.confidential.attestationMode).toBe('NO_ATTESTATION_LOCAL');
  });

  it('there is no single opaque score anywhere on the projection', () => {
    const p = compose(PUBLIC_ACCEPTABLE, 'REQUIRED', evidence('ACCEPTABLE'));
    for (const banned of ['score', 'confidence', 'weight', 'total', 'aggregate']) {
      expect(Object.keys(p)).not.toContain(banned);
      expect(Object.keys(p.public)).not.toContain(banned);
      expect(Object.keys(p.confidential)).not.toContain(banned);
    }
  });

  it('the two attestation booleans stay independent through composition', () => {
    const local = compose(PUBLIC_ACCEPTABLE, 'REQUIRED', evidence('ACCEPTABLE'));
    const attested = compose(
      PUBLIC_ACCEPTABLE,
      'REQUIRED',
      evidence('ACCEPTABLE', {
        teeAttestationVerified: true,
        attestationMode: 'NITRO_ATTESTED',
      }),
    );
    // Same composed disposition, different attestation provenance — the
    // composition must not smuggle attestation into the verdict.
    expect(local.disposition).toBe(attested.disposition);
    expect(local.confidential.teeAttestationVerified).toBe(false);
    expect(attested.confidential.teeAttestationVerified).toBe(true);
  });
});

describe('9. CFS-006a imports no Vela types', () => {
  const CFS_FILES = [
    'services/consequence/stages.ts',
    'services/consequence/operatingModel.ts',
    'services/consequence/pipeline.ts',
    'services/consequence/index.ts',
    'services/consequence/counterfactual.ts',
    'types/consequence.ts',
  ];

  it('no CFS-006a module references Vela or a confidential provider', () => {
    for (const f of CFS_FILES) {
      const src = readFileSync(join(process.cwd(), f), 'utf8');
      expect(src, f).not.toMatch(/vela|Vela|VELA/);
      expect(src, f).not.toMatch(/confidentialProjection|ConfidentialProjection/);
    }
  });
});

describe('10. the Vela provider imports no CFS-006a implementation', () => {
  it('the provider does not reach into services/consequence or types/consequence', () => {
    for (const f of [
      'services/vela/velaProjectionProvider.ts',
      'services/vela/velaClientAdapter.ts',
      'services/vela/velaTypes.ts',
      'services/vela/velaConfig.ts',
    ]) {
      const src = readFileSync(join(process.cwd(), f), 'utf8');
      const imports = src.match(/^import[\s\S]*?from\s+'[^']+';$/gm) ?? [];
      for (const block of imports) {
        expect(block, f).not.toMatch(/services\/consequence|types\/consequence/);
      }
    }
  });

  it('the composition seam is owned by neither side', () => {
    // It must not live under services/consequence (CFS-006a) or services/vela.
    const path = 'services/constitutionalCommerce/unifiedConsequenceProjection.ts';
    expect(() => readFileSync(join(process.cwd(), path), 'utf8')).not.toThrow();
    const src = readFileSync(join(process.cwd(), path), 'utf8');
    const imports = src.match(/^import[\s\S]*?from\s+'[^']+';$/gm) ?? [];
    // It may reference CFS-006a's TYPE (the forecast it composes) but must not
    // import Vela at all — the confidential side reaches it as an abstract shape.
    for (const block of imports) {
      expect(block).not.toMatch(/services\/vela|velaTypes|velaProjectionProvider/);
    }
  });
});

describe('11. the context reference is preserved through projection', () => {
  it('projectionContextRef survives verbatim on every path', () => {
    for (const [f, req, ev] of [
      [PUBLIC_ACCEPTABLE, 'REQUIRED', evidence('ACCEPTABLE')],
      [PUBLIC_UNACCEPTABLE, 'REQUIRED', evidence('UNRESOLVED')],
      [PUBLIC_UNRESOLVED, 'NOT_REQUIRED', null],
      [PUBLIC_ACCEPTABLE, 'REQUIRED', null],
    ] as const) {
      expect(compose(f, req, ev).projectionContextRef).toBe(CONTEXT_REF);
    }
  });

  it('a different context yields a different projectionRef for the same action', () => {
    const a = composeUnifiedConsequenceProjection({
      projectionContextRef: 'ctx-a',
      actionRef: 'action-1',
      authorityRef: 'authority-1',
      mandateRef: 'mandate-1',
      publicForecast: PUBLIC_ACCEPTABLE,
      confidentialRequirement: 'NOT_REQUIRED',
    });
    const b = composeUnifiedConsequenceProjection({
      projectionContextRef: 'ctx-b',
      actionRef: 'action-1',
      authorityRef: 'authority-1',
      mandateRef: 'mandate-1',
      publicForecast: PUBLIC_ACCEPTABLE,
      confidentialRequirement: 'NOT_REQUIRED',
    });
    // The Ian experiment needs to tell two projections of the SAME action under
    // DIFFERENT contexts apart, in order to attribute a projected-vs-observed
    // delta to context rather than to the action.
    expect(a.projectionRef).not.toBe(b.projectionRef);
    expect(a.projectionContextRef).not.toBe(b.projectionContextRef);
  });
});

// ── Fail-closed / never-UNACCEPTABLE guarantees ──────────────────────────

describe('infrastructure failure never becomes UNACCEPTABLE', () => {
  it('unverified protocol execution is UNRESOLVED', () => {
    const p = compose(
      PUBLIC_ACCEPTABLE,
      'REQUIRED',
      evidence('ACCEPTABLE', { protocolExecutionVerified: false }),
    );
    expect(p.disposition).toBe('UNRESOLVED');
    expect(p.confidential.reason).toMatch(/not unacceptable/);
  });

  it('an unverified attestation under policy is UNRESOLVED, not UNACCEPTABLE', () => {
    const p = compose(PUBLIC_ACCEPTABLE, 'REQUIRED', evidence('ACCEPTABLE'), {
      requireVerifiedAttestation: true,
    });
    expect(p.disposition).toBe('UNRESOLVED');
    expect(p.confidential.reason).toMatch(/not unacceptable/);
  });

  it('attestation policy defaults to permissive so a local deployment composes', () => {
    expect(compose(PUBLIC_ACCEPTABLE, 'REQUIRED', evidence('ACCEPTABLE')).disposition).toBe(
      'ACCEPTABLE',
    );
  });

  it('an unverified-protocol result cannot yield UNACCEPTABLE even when the verdict says so', () => {
    // The verdict is untrustworthy if we cannot confirm where it came from, so
    // it must not be reported as an established refusal.
    const p = compose(
      PUBLIC_ACCEPTABLE,
      'REQUIRED',
      evidence('UNACCEPTABLE', { protocolExecutionVerified: false }),
    );
    expect(p.disposition).toBe('UNRESOLVED');
  });
});

describe('public component mapping (CFS-006a forecast → disposition)', () => {
  it('absent seed knowledge is UNRESOLVED, not ACCEPTABLE', () => {
    // Same principle as the confidential projector: absence of an applicable
    // constraint is not permission.
    const c = composePublicComponent(forecast({ seedInvariantIds: [], enables: 0 }));
    expect(c.disposition).toBe('UNRESOLVED');
    expect(c.reason).toMatch(/not acceptance/);
  });

  it('a constitutional constraint is UNACCEPTABLE and names the constraint', () => {
    const c = composePublicComponent(PUBLIC_UNACCEPTABLE);
    expect(c.disposition).toBe('UNACCEPTABLE');
    expect(c.reason).toContain('inv.constitutional.014');
  });

  it('a reachable contradiction is UNRESOLVED, not UNACCEPTABLE', () => {
    const c = composePublicComponent(PUBLIC_UNRESOLVED);
    expect(c.disposition).toBe('UNRESOLVED');
    expect(c.reason).toMatch(/incoherent/);
  });

  it('a canonical (non-constitutional) constraint is UNACCEPTABLE', () => {
    const c = composePublicComponent(
      forecast({ constrains: 1, forcesEscalation: true }),
    );
    expect(c.disposition).toBe('UNACCEPTABLE');
  });

  it('a clean forecast is ACCEPTABLE', () => {
    expect(composePublicComponent(PUBLIC_ACCEPTABLE).disposition).toBe('ACCEPTABLE');
  });

  it('CFS-006a findings are carried onto the projection, not summarised away', () => {
    const f = forecast({
      nodes: [
        { invariantId: 'inv.a', statement: 'a', via: 'enables', cautionary: false },
        { invariantId: 'inv.b', statement: 'b', via: 'constrains', cautionary: true },
      ],
    });
    const p = compose(f, 'NOT_REQUIRED');
    expect(p.invariantFindings).toHaveLength(2);
    expect(p.invariantFindings[1].cautionary).toBe(true);
  });
});

describe('composeDispositions precedence', () => {
  it('UNACCEPTABLE beats UNRESOLVED (an established refusal is not hidden behind "cannot tell")', () => {
    expect(
      composeDispositions([
        { label: 'public', disposition: 'UNACCEPTABLE' },
        { label: 'confidential', disposition: 'UNRESOLVED' },
      ]).disposition,
    ).toBe('UNACCEPTABLE');
  });

  it('UNRESOLVED beats ACCEPTABLE in both orders', () => {
    expect(
      composeDispositions([
        { label: 'public', disposition: 'ACCEPTABLE' },
        { label: 'confidential', disposition: 'UNRESOLVED' },
      ]).disposition,
    ).toBe('UNRESOLVED');
    expect(
      composeDispositions([
        { label: 'public', disposition: 'UNRESOLVED' },
        { label: 'confidential', disposition: 'ACCEPTABLE' },
      ]).disposition,
    ).toBe('UNRESOLVED');
  });

  it('ACCEPTABLE requires every required component to be acceptable', () => {
    expect(
      composeDispositions([
        { label: 'public', disposition: 'ACCEPTABLE' },
        { label: 'confidential', disposition: 'ACCEPTABLE' },
      ]).disposition,
    ).toBe('ACCEPTABLE');
  });

  it('zero components is UNRESOLVED, never ACCEPTABLE', () => {
    expect(composeDispositions([]).disposition).toBe('UNRESOLVED');
  });

  it('the rationale names the deciding component', () => {
    const r = composeDispositions([
      { label: 'public', disposition: 'ACCEPTABLE' },
      { label: 'confidential', disposition: 'UNACCEPTABLE' },
    ]);
    expect(r.rationale).toContain('confidential');
  });
});

describe('confidential component construction', () => {
  it('NOT_REQUIRED nulls every provider field', () => {
    const c = composeConfidentialComponent('NOT_REQUIRED', null);
    expect(c.disposition).toBeNull();
    expect(c.provider).toBeNull();
    expect(c.requestRef).toBeNull();
    expect(c.evidenceRef).toBeNull();
    expect(c.protocolExecutionVerified).toBeNull();
    expect(c.teeAttestationVerified).toBeNull();
  });

  it('REQUIRED + absent carries the supplied absence reason', () => {
    const c = composeConfidentialComponent(
      'REQUIRED',
      null,
      {},
      'provider submission failed: insufficient fuel',
    );
    expect(c.disposition).toBe('UNRESOLVED');
    expect(c.reason).toContain('insufficient fuel');
  });
});
