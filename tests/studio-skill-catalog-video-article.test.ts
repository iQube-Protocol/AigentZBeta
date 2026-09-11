/**
 * Studio catalog registration canary for the 24-second video + article skill
 * (Implementation Pack f34e7ed6, 2026-07-14).
 *
 * The skill, its services, route, and runner shipped 2026-07-13 — but the skill
 * was never registered in STUDIO_SKILLS, the single source of truth for the
 * Workflows tab display AND the registry intake seeds (buildStudioRegistryIntakes
 * → intakeService.submitIntake). An unregistered native skill is exactly the
 * "improper asset management → registry conflicts" boundary the pack warns
 * against. These tests pin the registration:
 *   1. the entry exists, is a SkillQube, and points at the REAL route;
 *   2. it does NOT collide with the distinct manual video_article_bundle;
 *   3. it flows into the registry intake payloads deterministically.
 */

import { describe, it, expect } from 'vitest';
import {
  STUDIO_SKILLS,
  STUDIO_BUNDLES,
  buildStudioRegistryIntakes,
} from '@/services/composer/studioSkillCatalog';

const SKILL_ID = 'skill:video_article_24s';
const ROUTE = '/api/skills/video-article';

describe('24-second video + article skill is registered in the Studio catalog', () => {
  const entry = STUDIO_SKILLS.find((s) => s.id === SKILL_ID);

  it('exists as a SkillQube pointing at the real route', () => {
    expect(entry).toBeDefined();
    expect(entry?.assetClass).toBe('SkillQube');
    expect(entry?.invokeEndpoint).toBe(ROUTE); // must match app/api/skills/video-article/route.ts
  });

  it('declares the route contract: groundings required, plan outputs present', () => {
    const groundings = entry?.interfaceSchema.inputs.find((i) => i.name === 'groundings');
    expect(groundings?.required).toBe(true);
    const outputs = entry?.interfaceSchema.outputs.map((o) => o.name) ?? [];
    expect(outputs).toContain('brief');
    expect(outputs).toContain('article');
    expect(outputs).toContain('alignment'); // Automated Content Alignment surfaced
    expect(outputs).toContain('renderPlan'); // Rendering Optimization surfaced
  });

  it('is distinct from the manual Video + Article Bundle (no duplication)', () => {
    const bundle = STUDIO_BUNDLES.find((b) => b.id === 'workflow:video_article_bundle');
    expect(bundle).toBeDefined();
    // The bundle is a manual multi-block WorkflowQube; the skill is a single-call
    // SkillQube with its own endpoint. Different asset classes, different ids.
    expect(bundle?.assetClass).toBe('WorkflowQube');
    expect(entry?.id).not.toBe(bundle?.id);
  });
});

describe('the skill reaches the registry intake pipeline', () => {
  it('buildStudioRegistryIntakes includes a payload for the skill', () => {
    const intakes = buildStudioRegistryIntakes('tenant-x', 'persona-y');
    const payloads = intakes.map((i) => i.sourcePayload as { assetId?: string; metadata?: { invokeEndpoint?: string } });
    const mine = payloads.find((p) => p.assetId === SKILL_ID);
    expect(mine).toBeDefined();
    expect(mine?.metadata?.invokeEndpoint).toBe(ROUTE);
  });
});
