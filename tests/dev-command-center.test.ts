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
});
