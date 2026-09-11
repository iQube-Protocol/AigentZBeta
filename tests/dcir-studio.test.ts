/**
 * DCIR Studio Composer expansion canaries (CFS-020 D1+, third surface —
 * operator direction 2026-07: "once we're happy with DCIR we can then expand
 * it to aigentMe and the studio composer"). These pin the observe-mode-first
 * discipline for the Studio Composer so a silent change cannot leak a T0
 * identifier into an event/snapshot/ground-context payload or break the
 * event vocabulary the next copilot turn reads.
 *
 *   1. Each studio event constructor emits the ratified kind + a T2-safe
 *      summary (template slug / skill kind / provider / device labels only —
 *      never the experience name, prompt body, or asset URL).
 *   2. The snapshot's workflow surface is "studio-composer" and its persona
 *      stays null on the seam.
 *   3. compaction + snapshot + mining round-trip carries NO T0 identifier.
 */

import { describe, it, expect } from 'vitest';
import {
  studioSessionStartedEvent,
  studioExperienceComposedEvent,
  studioSkillOutputEvent,
  studioExperiencePublishedEvent,
  studioPreviewRenderedEvent,
  appendDcirEvent,
  compactDcirEvents,
} from '@/services/dcir/eventStream';
import {
  buildStateSnapshot,
  mineBehaviouralInvariants,
  compactBehaviouralInvariants,
} from '@/services/dcir/stateEngine';
import type { DcirEvent } from '@/types/dcir';

const T0_IDENTIFIERS = ['personaId', 'authProfileId', 'rootDid', 'fioHandle', 'kybeAttestation'];

function buildSession(): DcirEvent[] {
  return [
    studioSessionStartedEvent('ai-image-generation'),
    studioSkillOutputEvent('image-bundle (2 assets)', 'openai'),
    studioSkillOutputEvent('article-draft'),
    studioSkillOutputEvent('video', 'venice'),
    studioExperienceComposedEvent('ai-image-generation'),
    studioPreviewRenderedEvent('mobile'),
    studioExperiencePublishedEvent(),
  ].reduce<DcirEvent[]>((log, e) => appendDcirEvent(log, e), []);
}

describe('DCIR studio composer — event vocabulary (canaries)', () => {
  it('emits the ratified kinds for each lifecycle moment', () => {
    expect(studioSessionStartedEvent('ai-image-generation').kind).toBe('WorkflowAdvanced');
    expect(studioExperienceComposedEvent('ai-image-generation').kind).toBe('DocumentCreated');
    expect(studioSkillOutputEvent('video', 'venice').kind).toBe('ToolOutputProduced');
    expect(studioExperiencePublishedEvent().kind).toBe('SystemEvent');
    expect(studioPreviewRenderedEvent('mobile').kind).toBe('SystemEvent');
  });

  it('summaries are category labels only (kind + slug/provider/device)', () => {
    expect(studioSessionStartedEvent('ai-article-draft').summary).toBe(
      'composition session started: ai-article-draft',
    );
    expect(studioSkillOutputEvent('video', 'venice').summary).toBe(
      'skill output produced: video (venice)',
    );
    expect(studioSkillOutputEvent('article-draft').summary).toBe(
      'skill output produced: article-draft',
    );
    expect(studioExperiencePublishedEvent().summary).toBe('experience published to registry');
    expect(studioPreviewRenderedEvent('desktop').summary).toBe('preview rendered: desktop');
  });

  it('every event is tier-safe (t1-browser-safe or t2-network-safe, never a T0 tier)', () => {
    for (const e of buildSession()) {
      expect(['t1-browser-safe', 't2-network-safe']).toContain(e.tier);
    }
  });

  it('the composed experience feeds the snapshot artefact list as a label', () => {
    const events = buildSession();
    const snapshot = buildStateSnapshot(events, { surface: 'studio-composer' });
    expect(snapshot.activeArtefacts).toContain('experience composed: ai-image-generation');
  });
});

describe('DCIR studio composer — tier discipline (no T0 leakage)', () => {
  it('never carries a T0 identifier through events → snapshot → ground context', () => {
    const events = buildSession();
    const snapshot = buildStateSnapshot(events, {
      surface: 'studio-composer',
      workflowStage: 'active',
      activeCapsule: 'customizer',
    });
    const ground = {
      surface: 'studio-composer',
      recentEvents: compactDcirEvents(events),
      stateSnapshot: snapshot,
      observedPatterns: compactBehaviouralInvariants(mineBehaviouralInvariants(events)),
    };
    const serialized = JSON.stringify(ground);
    for (const forbidden of T0_IDENTIFIERS) {
      expect(serialized).not.toContain(forbidden);
    }
    // The snapshot's persona field is deliberately never populated on this seam.
    expect(snapshot.persona).toBeNull();
    expect(snapshot.workflow).toEqual({
      surface: 'studio-composer',
      stage: 'active',
      activeCapsule: 'customizer',
    });
  });

  it('compaction is bounded and order-stable (newest last)', () => {
    const events = buildSession();
    const compact = compactDcirEvents(events);
    expect(compact.length).toBe(events.length);
    expect(compact[compact.length - 1]).toContain('experience published to registry');
    expect(compactDcirEvents(events)).toEqual(compactDcirEvents(events));
  });
});
