/**
 * fs-cross wallet-conversion capability binding (AEE-Next, 2026-09-01).
 *
 * Operator directive: "the governing requirement is capability READINESS,
 * not capability EXERCISE." At `fs-cross`, the real wallet-conversion
 * capability (services/ctp/primitives/walletAssetConvert.ts's registered
 * CTP primitive) must be discoverable/projectable by AEE, carried via the
 * EXISTING `ExperienceHandoff.capabilityFocus` field (never a new field or
 * wrapper), and reachable once the FS journey resolves its own authority —
 * but crossing must NEVER perform a conversion or imply one happened.
 *
 * Source-level structural proof — this repo's established pattern for
 * client-bundle wiring (see financial-sovereignty-crossing-chain.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { WALLET_CONVERSION_CAPABILITY_ID } from '@/services/financialServices/walletConversionCapability';
import { PRIMITIVE_ID as WALLET_CONVERT_REAL_PRIMITIVE_ID } from '@/services/ctp/primitives/walletAssetConvert';
import { assembleExperiencePrescription } from '@/services/adaptive/experiencePrescriptionAssembly';
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import type { JourneyAeeOutcome } from '@/services/adaptive/journeyAeeOrchestrator';

describe('the capability id is backed by the REAL registered CTP primitive, never a parallel string', () => {
  it('walletConversionCapability.ts literally equals walletAssetConvert.ts\'s own PRIMITIVE_ID', () => {
    expect(WALLET_CONVERSION_CAPABILITY_ID).toBe(WALLET_CONVERT_REAL_PRIMITIVE_ID);
    expect(WALLET_CONVERSION_CAPABILITY_ID).toBe('ctp.wallet.asset.convert');
  });
});

describe('AEE projects the capability as available at fs-cross — readiness, never exercise', () => {
  function outcome(targetStageId: string | null): JourneyAeeOutcome {
    return {
      nbe: { disposition: 'act', targetStageId, rationale: 'test' },
      crossingRecommended: false,
    } as unknown as JourneyAeeOutcome;
  }

  it('assembleExperiencePrescription sets props.capabilityFocus at fs-cross', () => {
    const prescription = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee: outcome('fs-cross'),
      matrixCalibration: null,
      surfaceTemplate: 'liquidui:test',
    });
    expect(prescription).not.toBeNull();
    expect(prescription!.props?.capabilityFocus).toEqual([WALLET_CONVERSION_CAPABILITY_ID]);
  });

  it('does NOT set capabilityFocus for any other stage (e.g. fs-explore) — never over-projected', () => {
    const prescription = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee: outcome('fs-explore'),
      matrixCalibration: null,
      surfaceTemplate: 'liquidui:test',
    });
    expect(prescription).not.toBeNull();
    expect(prescription!.props?.capabilityFocus).toBeUndefined();
  });

  it('assembleExperiencePrescription performs no I/O — pure, no wallet/CTP call possible from this path', () => {
    const src = stripComments(readSource('services/adaptive/experiencePrescriptionAssembly.ts'));
    expect(src).not.toMatch(/\bawait\b/);
    expect(src).not.toMatch(/constitutionalRuntime|convertWalletAsset|ctp_transition_evidence/);
  });
});

describe('Cross carries the SAME capability id through the EXISTING ExperienceHandoff.capabilityFocus field', () => {
  const src = stripComments(readSource('components/journey/FinancialSovereigntyPrepareCrossStage.tsx'));

  it('imports the single shared constant, never a hand-copied literal', () => {
    expect(src).toMatch(/import \{ WALLET_CONVERSION_CAPABILITY_ID \} from '@\/services\/financialServices\/walletConversionCapability'/);
  });

  it('sets capabilityFocus on the createExperienceHandoff call — the EXISTING field, no new field/wrapper introduced', () => {
    expect(src).toMatch(/capabilityFocus:\s*\[WALLET_CONVERSION_CAPABILITY_ID\]/);
  });

  it('never calls the wallet-conversion route or the CTP runtime directly — crossing never performs a conversion', () => {
    expect(src).not.toMatch(/constitutionalRuntime|convertWalletAsset|\/api\/wallet\/qct\/convert/);
  });

  it('does not add a second ExperienceHandoff field for this — the type itself gains nothing new', () => {
    const typeSrc = stripComments(readSource('types/experienceHandoff.ts'));
    // capabilityFocus already existed before this change; assert the type
    // file's own field count/shape is untouched by grepping for exactly one
    // declaration of it.
    const matches = typeSrc.match(/capabilityFocus\??:/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

describe('the FS Bridge front door records capability READINESS from the handoff — never authority, never execution', () => {
  const src = stripComments(readSource('components/journey/FinancialServicesBridgeFrontDoor.tsx'));

  it('imports the same shared capability constant', () => {
    expect(src).toMatch(/import \{ WALLET_CONVERSION_CAPABILITY_ID \} from '@\/services\/financialServices\/walletConversionCapability'/);
  });

  it('reads handoff.capabilityFocus and stores a readiness flag keyed by the exported sessionStorage key', () => {
    expect(src).toMatch(/handoff\.capabilityFocus/);
    expect(src).toMatch(/FS_BRIDGE_WALLET_CAPABILITY_KEY/);
    expect(src).toMatch(/export const FS_BRIDGE_WALLET_CAPABILITY_KEY = 'fsHandoffWalletConversionCapabilityAvailable'/);
  });

  it('never invokes the wallet-conversion route or the CTP runtime from the handoff-consuming effect — readiness is recorded, never exercised', () => {
    expect(src).not.toMatch(/constitutionalRuntime|convertWalletAsset|\/api\/wallet\/qct\/convert/);
  });

  it('the journey definition this front door mounts (HORIZEN_MONEYPENNY_JOURNEY) is untouched by this change — normal authority resolution still governs reachability', () => {
    expect(src).toMatch(/HORIZEN_MONEYPENNY_JOURNEY/);
    // No new stage, no new completionEvidence literal referencing the
    // capability id was introduced into the journey definition itself.
    const journeySrc = stripComments(readSource('services/journey/horizenMoneyPennyJourney.ts'));
    expect(journeySrc).not.toMatch(/ctp\.wallet\.asset\.convert/);
  });
});

describe('capability availability is never conflated with a successful conversion (2026-09-01 acceptance)', () => {
  it('nothing in the fs-cross wiring path writes or reads ctp_transition_evidence', () => {
    const files = [
      'services/adaptive/experiencePrescriptionAssembly.ts',
      'components/journey/FinancialSovereigntyPrepareCrossStage.tsx',
      'components/journey/FinancialServicesBridgeFrontDoor.tsx',
      'services/financialServices/walletConversionCapability.ts',
    ];
    for (const f of files) {
      const src = stripComments(readSource(f));
      expect(src).not.toMatch(/ctp_transition_evidence/);
    }
  });
});
