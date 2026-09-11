/**
 * Venture Report deliberation — inference-to-brief bridge repair (2026-09-04).
 *
 * Reported defect: the operator's own stated purpose for a venture report
 * ("The report should focus on X — with Y, Z emphasis") was silently
 * dropped at three points:
 *   1. extractBriefContextFromPrompt() never extracted purpose/emphasis at
 *      all — only disclosure/period/audience.
 *   2. The chat route computed nothing to extract it INTO — the deliberation
 *      action payload carried only the intent detection, never the
 *      extracted brief-spec fields (extractBriefContextFromPrompt and
 *      suggestDeliberationFromPrompt were imported but never called).
 *   3. AigentMeWelcomeSplitTab.tsx's handleSuggestedDeliberation() and the
 *      NBE-approval deliberation branch both called initializeDeliberation()
 *      and threw away whatever context WAS available, producing a
 *      genuinely blank brief either way.
 *
 * Also fixed in the same pass: VentureReportBriefSpec.purpose is a closed
 * category, never free text — a raw sentence saved into it directly was a
 * schema mismatch; a downstream artifactId-vs-id field-name bug that left
 * a successfully-created report's brief transitioning to 'drafted' with an
 * empty artifact reference; and a generation-error banner that was wired to
 * state but never rendered once a brief existed.
 */
import { describe, it, expect } from 'vitest';
import { extractBriefContextFromPrompt } from '@/services/deliberativeArtifact/deliberationIntentDetector';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('extractBriefContextFromPrompt — purpose/customPurpose/emphasis extraction', () => {
  it('extracts the reported sentence into purpose:custom + customPurpose + emphasis', () => {
    const prompt =
      'The report should focus on the research lab, stack and venture studio restructure - ' +
      'with the sovereign runtime, trusted intelligence and constitutional computing emphasis';
    const spec = extractBriefContextFromPrompt(prompt, 'venture-report');
    expect(spec.purpose).toBe('custom');
    expect(spec.customPurpose).toBe('The report should focus on the research lab, stack and venture studio restructure');
    expect(spec.emphasis).toEqual(['sovereign runtime', 'trusted intelligence', 'constitutional computing']);
    // (article-stripped: the raw clause reads "the sovereign runtime, ...")
  });

  it('never discards the operator\'s sentence even when no emphasis clause is present', () => {
    const prompt = 'Focus the report on our partnership pipeline this quarter';
    const spec = extractBriefContextFromPrompt(prompt, 'venture-report');
    expect(spec.purpose).toBe('custom');
    expect(spec.customPurpose).toBe(prompt);
    expect(spec.emphasis).toBeUndefined();
  });

  it('also populates purpose/customPurpose for venture-reintroduction prompts', () => {
    const prompt = 'Reintroduce the venture to our seed investors with a pivot-explanation emphasis';
    const spec = extractBriefContextFromPrompt(prompt, 'venture-reintroduction');
    expect(spec.purpose).toBe('custom');
    expect(typeof spec.customPurpose).toBe('string');
  });

  it('leaves purpose/customPurpose unset for an empty prompt', () => {
    const spec = extractBriefContextFromPrompt('', 'venture-report');
    expect(spec.purpose).toBeUndefined();
    expect(spec.customPurpose).toBeUndefined();
  });

  it('still extracts disclosure and period exactly as before — this is additive, not a rewrite', () => {
    const spec = extractBriefContextFromPrompt('An internal report on where we are now', 'venture-report');
    expect(spec.disclosure).toBe('internal');
    expect(spec.periodStart).toBe('current');
  });
});

describe('the chat route computes and returns extractedBriefSpec — never leaves it for the client to invent', () => {
  const src = stripComments(readSource('app/api/codex/chat/route.ts'));

  it('calls extractBriefContextFromPrompt inside the deliberation-intent branch', () => {
    const branchStart = src.indexOf('deliberationIntent.confidence >= 0.7');
    expect(branchStart).toBeGreaterThan(-1);
    const block = src.slice(branchStart, branchStart + 1200);
    expect(block).toMatch(/extractedBriefSpec:\s*extractBriefContextFromPrompt\(message, deliberationIntent\.artifactType\)/);
  });
});

describe('AigentMeWelcomeSplitTab adopts inferred brief context instead of initializing blank', () => {
  const src = stripComments(readSource('app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx'));

  it('handleSuggestedDeliberation merges action.extractedBriefSpec via updateBriefSpec + updateBriefCompleteness', () => {
    const fnStart = src.indexOf('const handleSuggestedDeliberation = useCallback');
    expect(fnStart).toBeGreaterThan(-1);
    const block = src.slice(fnStart, fnStart + 1200);
    expect(block).toMatch(/action\.extractedBriefSpec/);
    expect(block).toMatch(/updateBriefCompleteness\(updateBriefSpec\(brief, inferredSpec\)\)/);
  });

  it('the NBE-approval deliberation branch extracts context from the action rationale/label, never a bare initializeDeliberation', () => {
    const branchStart = src.indexOf('if (requiresDeliberation(artifactType)) {');
    expect(branchStart).toBeGreaterThan(-1);
    const block = src.slice(branchStart, branchStart + 1500);
    expect(block).toMatch(/extractBriefContextFromPrompt\(action\.rationale \|\| action\.label \|\| ''/);
    expect(block).toMatch(/updateBriefCompleteness\(updateBriefSpec\(newBrief, inferredSpec\)\)/);
  });

  it('handleGenerateVentureReport reads created.artifactId, never created.id (ArtifactCardData has no .id field)', () => {
    const fnStart = src.indexOf('const handleGenerateVentureReport = useCallback');
    expect(fnStart).toBeGreaterThan(-1);
    const fnEnd = src.indexOf('[deliberationBrief, deliberationGenerating, personaId, handleComposeGoogleDoc]', fnStart);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const body = src.slice(fnStart, fnEnd);
    expect(body).toMatch(/created as ArtifactCardData \| undefined\)\?\.artifactId/);
    expect(body).not.toMatch(/\)\?\.id\b/);
  });
});

describe('VentureReportBriefLayout — purpose schema normalization + visible generation errors', () => {
  const src = stripComments(readSource('components/metame/welcome/layouts/VentureReportBriefLayout.tsx'));

  it('handleSaveField writes purpose:"custom" + customPurpose for a non-canonical free-text purpose, never the raw sentence into purpose', () => {
    const fnStart = src.indexOf('const handleSaveField = useCallback');
    expect(fnStart).toBeGreaterThan(-1);
    const block = src.slice(fnStart, fnStart + 1500);
    expect(block).toMatch(/purpose:\s*trimmed \? "custom"/);
    expect(block).toMatch(/customPurpose:\s*trimmed \|\| undefined/);
  });

  it('displays customPurpose (not the literal word "custom") when purpose is the custom category', () => {
    expect(src).toMatch(/purposeDisplayValue\s*=\s*spec\?\.purpose === "custom" \? \(spec\?\.customPurpose/);
  });

  it('renders a deliberationError banner INSIDE the populated-brief branch, not only the empty-brief branch', () => {
    const branchStart = src.indexOf('deliberationBrief ? (');
    const divStart = src.indexOf('<div className="space-y-5 lg:space-y-6">', branchStart);
    expect(divStart).toBeGreaterThan(-1);
    const block = src.slice(divStart, divStart + 900);
    expect(block).toMatch(/\{deliberationError && \(/);
  });
});
