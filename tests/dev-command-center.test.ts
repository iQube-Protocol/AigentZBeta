/**
 * Development Command Center tests — Operation Chrysalis Phase 1
 *
 * Validates the five MVP capabilities:
 * 1. Intent Distillation Engine
 * 2. Context Pack Generator
 * 3. Capability Gap Analyzer
 * 4. Consequence Canvas
 * 5. Post-Prompt Consequence Validator
 * + Development Loop state machine
 */

import {
  createEmptyIntent,
  refineIntent,
  isIntentComplete,
  buildIntentSummary,
  createEmptyContextPack,
  addContextItem,
  estimateTokens,
  buildContextPackSummary,
  getSourcePaths,
  createEmptyGapAnalysis,
  addExistingCapability,
  addMissingCapability,
  buildGapAnalysisSummary,
  createEmptyCanvas,
  createConsequenceEntry,
  addShouldHappen,
  addShouldNeverHappen,
  buildConsequenceCanvasSummary,
  createEmptyValidationReport,
  addValidationItem,
  buildValidationSummary,
  createDevLoopSession,
  canAdvance,
  advanceStage,
  getStageIndex,
  getStageLabel,
  buildImplementationPackage,
  detectRequestedStage,
  buildStageInstructionBlock,
  extractStageProposals,
  looksLikeUnfulfilledProposalPromise,
  applyStageProposal,
  stageCapsuleId,
  PROPOSAL_KIND_TO_CAPSULE,
} from '@/services/devCommandCenter';

// ─── Capability 1: Intent Distillation ─────────────────────────────────────

describe('Intent Distillation Engine', () => {
  it('creates an empty intent from raw input', () => {
    const intent = createEmptyIntent('Build Executive Mobility Travel');
    expect(intent.rawInput).toBe('Build Executive Mobility Travel');
    expect(intent.status).toBe('draft');
    expect(intent.goal).toBe('');
    expect(intent.intentId).toMatch(/^dci-/);
  });

  it('refines an intent with structured fields', () => {
    const intent = createEmptyIntent('Build something');
    const refined = refineIntent(intent, {
      goal: 'Build Executive Mobility Travel service',
      users: ['Executives', 'Travel coordinators'],
      desiredOutcomes: ['Travel booking', 'Accommodation integration'],
      successCriteria: ['Booking triggers accommodation workflow'],
    });
    expect(refined.status).toBe('refined');
    expect(refined.goal).toBe('Build Executive Mobility Travel service');
    expect(refined.users).toHaveLength(2);
  });

  it('detects complete vs incomplete intents', () => {
    const empty = createEmptyIntent('test');
    expect(isIntentComplete(empty)).toBe(false);

    const complete = refineIntent(empty, {
      goal: 'Build X',
      users: ['User A'],
      desiredOutcomes: ['Outcome 1'],
      successCriteria: ['Criterion 1'],
    });
    expect(isIntentComplete(complete)).toBe(true);
  });

  it('builds a markdown summary', () => {
    const intent = refineIntent(createEmptyIntent('Build X'), {
      goal: 'Build X',
      users: ['User A'],
      desiredOutcomes: ['Outcome 1'],
      successCriteria: ['Criterion 1'],
      constraints: ['Must not break Y'],
    });
    const summary = buildIntentSummary(intent);
    expect(summary).toContain('## Development Intent: Build X');
    expect(summary).toContain('Must not break Y');
  });
});

// ─── Capability 2: Context Pack Generator ──────────────────────────────────

describe('Context Pack Generator', () => {
  it('creates an empty context pack', () => {
    const pack = createEmptyContextPack('dci-001');
    expect(pack.intentId).toBe('dci-001');
    expect(pack.items).toHaveLength(0);
  });

  it('adds and classifies context items', () => {
    let pack = createEmptyContextPack('dci-001');
    pack = addContextItem(pack, {
      sourceKind: 'codebase',
      sourcePath: 'services/passport/',
      title: 'Passport Bureau',
      relevanceScore: 95,
      excerpt: 'Passport credential management',
      reuseSignal: 'reuse',
    });
    pack = addContextItem(pack, {
      sourceKind: 'architecture',
      sourcePath: 'codexes/packs/aigency/',
      title: 'Architecture Docs',
      relevanceScore: 70,
      excerpt: 'System architecture',
      reuseSignal: 'reference',
    });
    expect(pack.items).toHaveLength(2);
    expect(pack.reuseFirst).toHaveLength(1);
    expect(pack.buildNewLast).toHaveLength(1);
  });

  it('sorts items by relevance score descending', () => {
    let pack = createEmptyContextPack('dci-001');
    pack = addContextItem(pack, {
      sourceKind: 'codebase', sourcePath: 'a', title: 'Low', relevanceScore: 30, excerpt: '', reuseSignal: 'reference',
    });
    pack = addContextItem(pack, {
      sourceKind: 'codebase', sourcePath: 'b', title: 'High', relevanceScore: 90, excerpt: '', reuseSignal: 'reuse',
    });
    expect(pack.items[0].title).toBe('High');
    expect(pack.items[1].title).toBe('Low');
  });

  it('estimates tokens from text', () => {
    expect(estimateTokens('hello world')).toBeGreaterThan(0);
    expect(estimateTokens('')).toBe(0);
  });

  it('returns source paths for known kinds', () => {
    expect(getSourcePaths('governance').length).toBeGreaterThan(0);
    expect(getSourcePaths('codebase').length).toBeGreaterThan(0);
  });
});

// ─── Capability 3: Capability Gap Analyzer ─────────────────────────────────

describe('Capability Gap Analyzer', () => {
  it('creates an empty gap analysis', () => {
    const analysis = createEmptyGapAnalysis('dci-001');
    expect(analysis.existing).toHaveLength(0);
    expect(analysis.missing).toHaveLength(0);
    expect(analysis.reuseRatio).toBe(0);
  });

  it('computes reuse ratio', () => {
    let analysis = createEmptyGapAnalysis('dci-001');
    analysis = addExistingCapability(analysis, {
      name: 'Passport Bureau', location: 'services/passport/', description: 'Credential management', reuseStrategy: 'use_directly', confidence: 95,
    });
    analysis = addExistingCapability(analysis, {
      name: 'CRM', location: 'services/crm/', description: 'Contact management', reuseStrategy: 'extend', confidence: 85,
    });
    analysis = addMissingCapability(analysis, {
      name: 'Travel Workflow', description: 'Booking management', estimatedComplexity: 'medium', dependencies: [], suggestedLocation: 'services/travel/',
    });
    expect(analysis.reuseRatio).toBeCloseTo(2 / 3);
    expect(analysis.existing).toHaveLength(2);
    expect(analysis.missing).toHaveLength(1);
  });

  it('builds a markdown summary', () => {
    let analysis = createEmptyGapAnalysis('dci-001');
    analysis = addExistingCapability(analysis, {
      name: 'Passport Bureau', location: 'services/passport/', description: 'test', reuseStrategy: 'use_directly', confidence: 95,
    });
    const summary = buildGapAnalysisSummary(analysis);
    expect(summary).toContain('Passport Bureau');
    expect(summary).toContain('100%');
  });
});

// ─── Capability 4: Consequence Canvas ──────────────────────────────────────

describe('Consequence Canvas', () => {
  it('creates an empty canvas', () => {
    const canvas = createEmptyCanvas('dci-001');
    expect(canvas.shouldHappen).toHaveLength(0);
    expect(canvas.shouldNeverHappen).toHaveLength(0);
  });

  it('adds should-happen consequences', () => {
    let canvas = createEmptyCanvas('dci-001');
    const entry = createConsequenceEntry('Travel booking creates receipt', 'workflow', 'critical');
    canvas = addShouldHappen(canvas, entry);
    expect(canvas.shouldHappen).toHaveLength(1);
    expect(canvas.shouldHappen[0].description).toBe('Travel booking creates receipt');
    expect(canvas.shouldHappen[0].category).toBe('workflow');
  });

  it('adds should-never-happen consequences', () => {
    let canvas = createEmptyCanvas('dci-001');
    const entry = createConsequenceEntry('Data leak outside sovereignty boundary', 'governance', 'critical');
    canvas = addShouldNeverHappen(canvas, entry);
    expect(canvas.shouldNeverHappen).toHaveLength(1);
  });

  it('builds a markdown summary', () => {
    let canvas = createEmptyCanvas('dci-001');
    canvas = { ...canvas, successState: 'Travel workflow completes end-to-end' };
    canvas = addShouldHappen(canvas, createConsequenceEntry('Receipt created', 'workflow'));
    const summary = buildConsequenceCanvasSummary(canvas);
    expect(summary).toContain('Travel workflow completes end-to-end');
    expect(summary).toContain('Receipt created');
  });
});

// ─── Capability 5: Consequence Validator ───────────────────────────────────

describe('Consequence Validator', () => {
  it('creates an empty validation report', () => {
    const report = createEmptyValidationReport('dci-001', 'canvas-001');
    expect(report.overallVerdict).toBe('partial');
    expect(report.satisfied).toHaveLength(0);
  });

  it('computes pass verdict when all satisfied', () => {
    let report = createEmptyValidationReport('dci-001', 'canvas-001');
    report = addValidationItem(report, {
      consequenceId: 'ce-1', description: 'Receipt created', verdict: 'satisfied', evidence: 'Found in diff', severity: 'critical',
    });
    expect(report.overallVerdict).toBe('pass');
  });

  it('computes fail verdict on critical unresolved', () => {
    let report = createEmptyValidationReport('dci-001', 'canvas-001');
    report = addValidationItem(report, {
      consequenceId: 'ce-1', description: 'Missing receipt', verdict: 'unresolved', evidence: 'Not found', severity: 'critical',
    });
    expect(report.overallVerdict).toBe('fail');
  });

  it('computes fail verdict on unintended consequences', () => {
    let report = createEmptyValidationReport('dci-001', 'canvas-001');
    report = addValidationItem(report, {
      consequenceId: 'ce-1', description: 'All good', verdict: 'satisfied', evidence: 'ok', severity: 'medium',
    });
    report = addValidationItem(report, {
      consequenceId: 'ce-2', description: 'Data leak', verdict: 'unintended', evidence: 'Found exposed endpoint', severity: 'high',
    });
    expect(report.overallVerdict).toBe('fail');
  });

  it('builds a markdown summary', () => {
    let report = createEmptyValidationReport('dci-001', 'canvas-001');
    report = addValidationItem(report, {
      consequenceId: 'ce-1', description: 'Receipt created', verdict: 'satisfied', evidence: 'Found in diff', severity: 'medium',
    });
    const summary = buildValidationSummary(report);
    expect(summary).toContain('PASS');
    expect(summary).toContain('Receipt created');
  });
});

// ─── Development Loop State Machine ────────────────────────────────────────

describe('Development Loop', () => {
  it('creates a new session at intent_capture stage', () => {
    const session = createDevLoopSession();
    expect(session.stage).toBe('intent_capture');
    expect(session.intent).toBeNull();
    expect(session.sessionId).toMatch(/^dls-/);
  });

  it('cannot advance without completing current stage', () => {
    const session = createDevLoopSession();
    expect(canAdvance(session)).toBe(false);
  });

  it('advances through stages when prerequisites met', () => {
    let session = createDevLoopSession();
    session.intent = {
      intentId: 'dci-001', rawInput: 'test', goal: 'Build X',
      users: ['A'], constraints: [], desiredOutcomes: ['Y'],
      successCriteria: ['Z'], relatedVentures: [], relatedCartridges: [],
      priority: 'medium', status: 'refined',
      createdAt: '', updatedAt: '',
    };
    expect(canAdvance(session)).toBe(true);

    session = advanceStage(session);
    expect(session.stage).toBe('context_assembly');
  });

  it('returns correct stage labels', () => {
    expect(getStageLabel('intent_capture')).toBe('Intent Capture');
    expect(getStageLabel('consequence_validation')).toBe('Consequence Validation');
  });

  it('returns correct stage indices', () => {
    expect(getStageIndex('intent_capture')).toBe(0);
    expect(getStageIndex('complete')).toBe(6);
  });

  it('builds implementation package when all stages ready', () => {
    const session = createDevLoopSession();
    session.intent = {
      intentId: 'dci-001', rawInput: 'test', goal: 'Build X',
      users: ['A'], constraints: ['C1'], desiredOutcomes: ['O1'],
      successCriteria: ['S1'], relatedVentures: [], relatedCartridges: [],
      priority: 'medium', status: 'approved',
      createdAt: '', updatedAt: '',
    };
    session.contextPack = {
      intentId: 'dci-001', items: [], assembledAt: '',
      totalTokenEstimate: 0, reuseFirst: [], extendSecond: [], buildNewLast: [],
    };
    session.gapAnalysis = {
      intentId: 'dci-001', existing: [], missing: [], reuseRatio: 0, analysedAt: '',
    };
    session.consequenceCanvas = {
      intentId: 'dci-001', shouldHappen: [], shouldNeverHappen: [],
      workflowsActivated: [], systemsAffected: [], permissionsRequired: [],
      successState: 'Everything works', createdAt: '',
    };

    const pkg = buildImplementationPackage(session);
    expect(pkg).not.toBeNull();
    expect(pkg?.brief).toContain('Build X');
    expect(pkg?.brief).toContain('Everything works');
  });

  it('returns null package when stages incomplete', () => {
    const session = createDevLoopSession();
    expect(buildImplementationPackage(session)).toBeNull();
  });

  it('gates the implementation stage on an implementation brief', () => {
    const session = createDevLoopSession();
    session.stage = 'implementation';
    expect(canAdvance(session)).toBe(false);
    session.implementationBrief = '# Implementation Pack — Build X';
    expect(canAdvance(session)).toBe(true);
  });
});

// ─── ICE proposal routing + operator stage-request detection ────────────────
// Canaries: the Dev Command Center's capsule containment depends on these
// exact mappings; a silent change re-opens the empty-Validate-card trap.

describe('Stage Orchestrator routing', () => {
  it('pins proposal-kind → capsule routing (incl. implementation card)', () => {
    expect(PROPOSAL_KIND_TO_CAPSULE).toEqual({
      intent: 'intent',
      context_pack: 'context',
      gap_analysis: 'gap-analysis',
      consequence_canvas: 'consequence-canvas',
      implementation_brief: 'implementation',
      validation_report: 'validation',
    });
  });

  it('detects a validation request even when phrased around other stages', () => {
    expect(detectRequestedStage('Validate the implementation against the consequence canvas.')).toBe(
      'consequence_validation',
    );
    expect(detectRequestedStage('please validate the build')).toBe('consequence_validation');
  });

  it('detects implementation / development-start requests', () => {
    expect(detectRequestedStage('Produce the implementation brief for the current intent')).toBe(
      'implementation',
    );
    expect(detectRequestedStage('start the development phase')).toBe('implementation');
  });

  it('REGRESSION 2026-07-06: gap requests mentioning implementation stay gap requests', () => {
    expect(detectRequestedStage('analyze the gaps in the implementation')).toBe('gap_analysis');
    expect(detectRequestedStage('what capability gaps remain before we can implement this?')).toBe(
      'gap_analysis',
    );
    // bare "implement"/"implementation" no longer hijacks any stage
    expect(detectRequestedStage('how would the implementation look?')).toBeNull();
  });

  it('detects consequence and gap requests', () => {
    expect(detectRequestedStage('Model the consequences for the current intent')).toBe(
      'consequence_modeling',
    );
    expect(detectRequestedStage('Analyze capability gaps for the current intent')).toBe('gap_analysis');
  });

  it('returns null for messages with no stage signal (capsule/session stage decides)', () => {
    expect(detectRequestedStage('Give me a status update on the current dev loop')).toBeNull();
    expect(detectRequestedStage("I want to start a new development intent. Help me distill what I'm trying to build.")).toBe(
      'intent_capture',
    );
  });

  it('presents BOTH schemas when the detected stage differs from the context stage', () => {
    const block = buildStageInstructionBlock('consequence_validation', 'consequence_modeling');
    expect(block).toContain('validation_report');
    expect(block).toContain('consequence_canvas');
    expect(block).toContain('Alternate stage');
  });

  it('presents a single schema when there is no alternate', () => {
    const block = buildStageInstructionBlock('gap_analysis', null);
    expect(block).toContain('gap_analysis');
    expect(block).not.toContain('Alternate stage');
  });

  it('puts the mandatory fence contract LAST and demands exactly one fence (finding 4)', () => {
    const single = buildStageInstructionBlock('context_assembly', null);
    expect(single).toContain('Fence contract (MANDATORY');
    expect(single.indexOf('Fence contract (MANDATORY')).toBeGreaterThan(single.indexOf('Rules:'));
    expect(single).toContain('You MUST end your reply with exactly ONE');
    const dual = buildStageInstructionBlock('gap_analysis', 'context_assembly');
    expect(dual).toContain('subordinate — emit ONE of the two schemas, never both');
    expect(dual.indexOf('Fence contract (MANDATORY')).toBeGreaterThan(dual.indexOf('Alternate stage'));
  });

  it('contains the never-promise rule and the worked example fence (field report 2026-07-06)', () => {
    // Layer 2: the fence IS the preparation — narrating a "preparation step"
    // with zero fences is the promise-without-production failure mode.
    const block = buildStageInstructionBlock('context_assembly', null);
    expect(block).toContain('NEVER say you are preparing or will prepare a proposal');
    expect(block).toContain('the fence IS the preparation');
    expect(block).toContain('There is no separate preparation step');
    // Layer 3: few-shot anchor — a minimal worked intent example, clearly
    // marked as format-only so it is never copied as content.
    expect(block).toContain('EXAMPLE FORMAT ONLY');
    expect(block).toContain('"kind": "intent"');
    expect(block).toContain('never copy this content');
    // Both survive the dual-schema variant too.
    const dual = buildStageInstructionBlock('gap_analysis', 'context_assembly');
    expect(dual).toContain('NEVER say you are preparing or will prepare a proposal');
    expect(dual).toContain('EXAMPLE FORMAT ONLY');
  });

  it('pins the advance→next-capsule mapping used by approval flow-through (finding 3)', () => {
    expect(stageCapsuleId('intent_capture')).toBe('intent');
    expect(stageCapsuleId('context_assembly')).toBe('context');
    expect(stageCapsuleId('gap_analysis')).toBe('gap-analysis');
    expect(stageCapsuleId('consequence_modeling')).toBe('consequence-canvas');
    expect(stageCapsuleId('implementation')).toBe('implementation');
    expect(stageCapsuleId('consequence_validation')).toBe('validation');
    expect(stageCapsuleId('complete')).toBeNull();
  });
});

// ─── ICE fence extraction — resilience canaries (operator findings 2026-07-06) ──
// Finding 5 root cause: strict JSON.parse dropped nearly-valid fences (trailing
// commas, literal newlines in strings) SILENTLY, reading as "nothing arrived"
// at gap analysis. These canaries pin the lenient-but-honest extraction.

describe('Stage proposal extraction (resilient fence parsing)', () => {
  const wellFormedGap = JSON.stringify({
    kind: 'gap_analysis',
    summary: 'Gap report for travel workflow',
    data: {
      existing: [{ name: 'Passport Bureau', location: 'services/passport/', description: 'creds', reuseStrategy: 'extend', confidence: 0.9 }],
      missing: [{ name: 'Travel Workflow', description: 'booking', estimatedComplexity: 'medium', dependencies: [], suggestedLocation: 'services/travel/' }],
    },
  });

  it('extracts a fence preceded by prose, stripping the fence from cleanText', () => {
    const reply = `Here is my gap analysis of the platform.\n\n\`\`\`stage_data\n${wellFormedGap}\n\`\`\``;
    const { cleanText, proposals } = extractStageProposals(reply);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].kind).toBe('gap_analysis');
    expect(cleanText).toBe('Here is my gap analysis of the platform.');
    expect(cleanText).not.toContain('stage_data');
  });

  it('parses a fence with no newline after the stage_data tag', () => {
    const reply = `\`\`\`stage_data ${wellFormedGap} \`\`\``;
    const { proposals } = extractStageProposals(reply);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].kind).toBe('gap_analysis');
  });

  it('parses DUAL fences — both land, order preserved (first drives auto-open)', () => {
    const intentFence = JSON.stringify({ kind: 'intent', summary: 'Intent', data: { goal: 'Build X' } });
    const reply = `Two artifacts:\n\`\`\`stage_data\n${wellFormedGap}\n\`\`\`\nand\n\`\`\`stage_data\n${intentFence}\n\`\`\``;
    const { proposals } = extractStageProposals(reply);
    expect(proposals).toHaveLength(2);
    expect(proposals[0].kind).toBe('gap_analysis');
    expect(proposals[1].kind).toBe('intent');
  });

  it('repairs a trailing-comma fence instead of dropping it', () => {
    const body = `{
  "kind": "gap_analysis",
  "summary": "Gap report",
  "data": {
    "existing": [
      { "name": "Passport Bureau", "location": "services/passport/", "description": "creds", "reuseStrategy": "extend", "confidence": 0.9, },
    ],
    "missing": [],
  },
}`;
    const { proposals } = extractStageProposals(`Prose first.\n\`\`\`stage_data\n${body}\n\`\`\``);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].kind).toBe('gap_analysis');
    expect((proposals[0].data.existing as unknown[]).length).toBe(1);
  });

  it('repairs literal newlines inside string values', () => {
    const body = `{
  "kind": "consequence_canvas",
  "summary": "Canvas",
  "data": {
    "shouldHappen": [{ "description": "line one
line two", "category": "workflow", "severity": "high" }],
    "shouldNeverHappen": [],
    "successState": "done"
  }
}`;
    const { proposals } = extractStageProposals(`\`\`\`stage_data\n${body}\n\`\`\``);
    expect(proposals).toHaveLength(1);
    const entries = proposals[0].data.shouldHappen as Array<{ description: string }>;
    expect(entries[0].description).toBe('line one\nline two');
  });

  it('drops a hopelessly malformed fence WITHOUT throwing, keeping the narrative', () => {
    const reply = 'Narrative stands.\n```stage_data\nnot json at all {{{\n```';
    const { cleanText, proposals } = extractStageProposals(reply);
    expect(proposals).toHaveLength(0);
    expect(cleanText).toBe('Narrative stands.');
  });

  it('drops fences with unknown kinds without throwing', () => {
    const reply = `\`\`\`stage_data\n${JSON.stringify({ kind: 'mystery', summary: 'x', data: {} })}\n\`\`\``;
    const { proposals } = extractStageProposals(reply);
    expect(proposals).toHaveLength(0);
  });
});

// ─── Fence-enforcement promise heuristic (operator field report 2026-07-06) ──
// Deployed test on gpt-4o-mini: the copilot narrated "I will now prepare a
// context proposal… This proposal is now awaiting your approval" with ZERO
// stage_data fences — no pending card, empty right pane, stalled loop. The
// chat route uses this pure heuristic (after checking proposals.length === 0)
// to trigger exactly ONE follow-up provider call demanding the fence alone.

describe('looksLikeUnfulfilledProposalPromise', () => {
  it('matches promise phrasing that narrates a proposal without producing it', () => {
    expect(looksLikeUnfulfilledProposalPromise('I will now prepare a context proposal for your review.')).toBe(true);
    expect(looksLikeUnfulfilledProposalPromise('This proposal is now awaiting your approval.')).toBe(true);
    expect(looksLikeUnfulfilledProposalPromise('Hold on while I assemble the gap report.')).toBe(true);
    expect(looksLikeUnfulfilledProposalPromise('I am preparing the consequence canvas now.')).toBe(true);
    expect(looksLikeUnfulfilledProposalPromise('I will now generate the validation report for you.')).toBe(true);
    expect(looksLikeUnfulfilledProposalPromise('Let me propose the next steps as a card.')).toBe(true);
  });

  it('does NOT match ordinary narration without promise words', () => {
    expect(looksLikeUnfulfilledProposalPromise('Here is the analysis of your gaps.')).toBe(false);
    expect(looksLikeUnfulfilledProposalPromise('The current stage is gap_analysis and you can advance when ready.')).toBe(false);
    expect(looksLikeUnfulfilledProposalPromise('Your right pane shows the intent capsule with the approved goal.')).toBe(false);
    expect(looksLikeUnfulfilledProposalPromise('')).toBe(false);
  });

  it('never triggers on text that still carries a stage_data fence', () => {
    // The route checks proposals.length === 0 FIRST, so extracted-fence
    // replies never reach the heuristic — but the helper is pinned safe
    // standalone too: a fence present means nothing is unfulfilled.
    const withFence =
      'I will now prepare the proposal.\n```stage_data\n{"kind":"intent","summary":"x","data":{"goal":"y"}}\n```';
    expect(looksLikeUnfulfilledProposalPromise(withFence)).toBe(false);
  });
});

// ─── applyStageProposal — gap payload tolerance + advance gate (finding 5) ──

describe('applyStageProposal gap analysis (coercion + advance)', () => {
  const gapData = {
    existing: [{ name: 'Passport Bureau', location: 'services/passport/', description: 'creds', reuseStrategy: 'extend', confidence: 0.9 }],
    missing: [{ name: 'Travel Workflow', description: 'booking', estimatedComplexity: 'medium', dependencies: ['crm'], suggestedLocation: 'services/travel/' }],
  };

  it('populates existing/missing from the canonical field names', () => {
    const session = createDevLoopSession();
    const next = applyStageProposal(session, { kind: 'gap_analysis', summary: 'g', data: gapData });
    expect(next.gapAnalysis?.existing).toHaveLength(1);
    expect(next.gapAnalysis?.missing).toHaveLength(1);
    expect(next.gapAnalysis?.existing[0].name).toBe('Passport Bureau');
  });

  it('coerces existingCapabilities/missingCapabilities payload variants', () => {
    const session = createDevLoopSession();
    const next = applyStageProposal(session, {
      kind: 'gap_analysis',
      summary: 'g',
      data: { existingCapabilities: gapData.existing, missingCapabilities: gapData.missing },
    });
    expect(next.gapAnalysis?.existing).toHaveLength(1);
    expect(next.gapAnalysis?.missing).toHaveLength(1);
  });

  it('sets gapAnalysis non-null even for empty payloads so approval can advance past gap analysis', () => {
    let session = createDevLoopSession();
    session = { ...session, stage: 'gap_analysis' };
    const next = applyStageProposal(session, { kind: 'gap_analysis', summary: 'g', data: {} });
    expect(next.gapAnalysis).not.toBeNull();
    expect(canAdvance(next)).toBe(true);
    expect(advanceStage(next).stage).toBe('consequence_modeling');
  });
});

// ─── DCIR D1 — event stream + observation seam (CFS-020, observe-mode) ──────
// Canaries: the event stream is tier-disciplined from birth (no T0 keys,
// summaries are labels not bodies), the ring buffer never grows past its
// cap, and the observation seam stays bounded. A silent change here either
// leaks identifiers into copilot-bound payloads or unbounds the prompt.

import {
  emitDcirEvent,
  appendDcirEvent,
  compactDcirEvents,
  renderObservationLines,
  devStageProposalReceivedEvent,
  devProposalApprovedEvent,
  devProposalDismissedEvent,
  devStageAdvancedEvent,
  devCapsuleOpenedEvent,
  devCapsuleClosedEvent,
  devImplementationPackGeneratedEvent,
  devDeploymentProposedEvent,
  DCIR_EVENT_BUFFER_CAP,
  DCIR_EVENT_SUMMARY_MAX,
  DCIR_OBSERVATION_WINDOW,
  DCIR_OBSERVATION_LINE_MAX,
} from '@/services/dcir/eventStream';
import type { DcirEvent, DcirEventKind } from '@/types/dcir';

const DCIR_EVENT_KINDS: readonly DcirEventKind[] = [
  'DocumentCreated', 'DocumentEdited', 'SelectionChanged',
  'RecommendationAccepted', 'RecommendationRejected',
  'ArtifactApproved', 'ArtifactRejected', 'UndoPerformed',
  'NavigationOccurred', 'WorkflowAdvanced', 'ToolOutputProduced',
  'ConversationTurn', 'PersonaChanged', 'SystemEvent',
];

/** Exactly the DcirEvent contract keys — nothing more may ever travel. */
const DCIR_EVENT_KEYS = [
  'id', 'kind', 'runtime', 'summary', 'tier', 'artefactRefs', 'capsuleScope', 'occurredAt',
].sort();

const FORBIDDEN_IDENTIFIER_KEYS = ['personaId', 'authProfileId', 'rootDid', 'fioHandle', 'caseId'];

function allDevHelperEvents(): DcirEvent[] {
  return [
    devStageProposalReceivedEvent('gap_analysis', 'gap-analysis'),
    devProposalApprovedEvent('gap_analysis', 'gap-analysis'),
    devProposalDismissedEvent('consequence_canvas', 'consequence-canvas'),
    devStageAdvancedEvent('intent_capture', 'context_assembly'),
    devCapsuleOpenedEvent('intent'),
    devCapsuleClosedEvent('intent'),
    devImplementationPackGeneratedEvent(),
    devDeploymentProposedEvent(),
  ];
}

describe('DCIR D1 event stream (observe-mode canaries)', () => {
  it('enforces the ring-buffer cap, keeping the newest events', () => {
    let log: DcirEvent[] = [];
    for (let i = 0; i < DCIR_EVENT_BUFFER_CAP + 10; i++) {
      log = appendDcirEvent(log, emitDcirEvent({
        kind: 'SystemEvent', runtime: 'observation', summary: `event ${i}`,
      }));
    }
    expect(log).toHaveLength(DCIR_EVENT_BUFFER_CAP);
    // oldest fell off, newest survived
    expect(log[0].summary).toBe('event 10');
    expect(log[log.length - 1].summary).toBe(`event ${DCIR_EVENT_BUFFER_CAP + 9}`);
  });

  it('bounds every summary to a label, never a body', () => {
    const e = emitDcirEvent({
      kind: 'DocumentCreated', runtime: 'action', summary: 'x'.repeat(10_000),
    });
    expect(e.summary.length).toBeLessThanOrEqual(DCIR_EVENT_SUMMARY_MAX);
    for (const helper of allDevHelperEvents()) {
      expect(helper.summary.length).toBeLessThanOrEqual(DCIR_EVENT_SUMMARY_MAX);
    }
  });

  it('emits ONLY the DcirEvent contract shape — no forbidden identifier keys, kind on the union', () => {
    for (const e of allDevHelperEvents()) {
      expect(Object.keys(e as unknown as Record<string, unknown>).sort()).toEqual(DCIR_EVENT_KEYS);
      expect(DCIR_EVENT_KINDS).toContain(e.kind);
      expect(['t1-browser-safe', 't2-network-safe']).toContain(e.tier);
      const serialized = JSON.stringify(e);
      for (const forbidden of FORBIDDEN_IDENTIFIER_KEYS) {
        expect(serialized).not.toContain(forbidden);
      }
    }
  });

  it('pins the Dev Command Center helper vocabulary (kind + runtime + capsule scope)', () => {
    expect(devStageProposalReceivedEvent('intent', 'intent')).toMatchObject({
      kind: 'ToolOutputProduced', runtime: 'conversational', capsuleScope: 'intent',
    });
    expect(devProposalApprovedEvent('intent', 'intent')).toMatchObject({
      kind: 'RecommendationAccepted', runtime: 'observation', capsuleScope: 'intent',
    });
    expect(devProposalDismissedEvent('intent', 'intent')).toMatchObject({
      kind: 'RecommendationRejected', runtime: 'observation', capsuleScope: 'intent',
    });
    expect(devStageAdvancedEvent('a', 'b')).toMatchObject({
      kind: 'WorkflowAdvanced', runtime: 'observation',
    });
    expect(devStageAdvancedEvent('intent_capture', 'context_assembly').summary).toContain(
      'intent_capture → context_assembly',
    );
    expect(devCapsuleOpenedEvent('context')).toMatchObject({
      kind: 'NavigationOccurred', runtime: 'observation', capsuleScope: 'context',
    });
    expect(devCapsuleClosedEvent('context')).toMatchObject({
      kind: 'NavigationOccurred', runtime: 'observation', capsuleScope: 'context',
    });
    expect(devImplementationPackGeneratedEvent()).toMatchObject({
      kind: 'DocumentCreated', runtime: 'action', capsuleScope: 'implementation',
    });
    expect(devDeploymentProposedEvent()).toMatchObject({
      kind: 'SystemEvent', runtime: 'action', capsuleScope: 'implementation',
    });
  });

  it('compacts the observation window to the newest events, newest last', () => {
    let log: DcirEvent[] = [];
    for (let i = 0; i < 30; i++) {
      log = appendDcirEvent(log, devCapsuleOpenedEvent(`capsule-${i}`));
    }
    const compact = compactDcirEvents(log);
    expect(compact).toHaveLength(DCIR_OBSERVATION_WINDOW);
    expect(compact[compact.length - 1]).toContain('capsule-29');
    expect(compact[0]).toContain(`capsule-${30 - DCIR_OBSERVATION_WINDOW}`);
  });

  it('renders ground-context observation lines bounded and shape-defensive', () => {
    // bounded count
    const many = Array.from({ length: 40 }, (_, i) => `event ${i}`);
    expect(renderObservationLines(many)).toHaveLength(DCIR_OBSERVATION_WINDOW);
    // bounded line length
    const long = renderObservationLines(['y'.repeat(5_000)]);
    expect(long[0].length).toBeLessThanOrEqual(DCIR_OBSERVATION_LINE_MAX);
    // defensive on untyped JSON from the client
    expect(renderObservationLines(undefined)).toEqual([]);
    expect(renderObservationLines('not-an-array')).toEqual([]);
    expect(renderObservationLines([1, null, { a: 1 }, 'kept', ''])).toEqual(['kept']);
  });
});
