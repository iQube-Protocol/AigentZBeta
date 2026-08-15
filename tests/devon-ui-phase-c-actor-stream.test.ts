/**
 * DevOn UI Refinement, Phase C canaries — the actor-event stream.
 *
 * Protects: provider-neutrality (no actorId-specific branching anywhere in
 * the type/renderer), non-persistence (actor activity never reaches
 * DevLoopState, DCIR, or any session-save path), and the authorization
 * boundary (`completed` and `awaiting-authorization` are distinct, never
 * conflated).
 */

import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import {
  ACTOR_EVENT_ACTIONS,
  DEFAULT_ACTION_LABEL,
  appendActorEvent,
  latestPerActor,
  type ActorEvent,
} from '@/components/devcommandcenter/actorEvents';

const ACTOR_EVENTS_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/devcommandcenter/actorEvents.ts'),
  'utf-8',
);
const STRIP_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/devcommandcenter/ActorActivityStrip.tsx'),
  'utf-8',
);
const TAB_SOURCE = readFileSync(
  path.join(process.cwd(), 'app/triad/components/codex/tabs/DevCommandCenterTab.tsx'),
  'utf-8',
);
const IMPLEMENTATION_LAYOUT_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/devcommandcenter/layouts/ImplementationLayout.tsx'),
  'utf-8',
);
const DEV_LOOP_STATE_SOURCE = readFileSync(
  path.join(process.cwd(), 'types/devCommandCenter.ts'),
  'utf-8',
);
const DCIR_TYPES_SOURCE = readFileSync(path.join(process.cwd(), 'types/dcir.ts'), 'utf-8');
const SMART_TRIAD_MESSAGE_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/smarttriad/copilot/SmartTriadInferenceRenderer.tsx'),
  'utf-8',
);

function eventOf(over: Partial<ActorEvent> & Pick<ActorEvent, 'actorId' | 'actorName' | 'action' | 'summary'>): ActorEvent {
  return { id: `t-${over.actorId}-${over.action}`, occurredAt: '2026-08-15T00:00:00.000Z', ...over };
}

describe('provider-neutrality — no actor gets special-cased rendering logic', () => {
  it('ActorActivityStrip.tsx contains no actorId-specific branching', () => {
    expect(STRIP_SOURCE).not.toMatch(/actorId\s*===\s*['"]/);
    expect(STRIP_SOURCE).not.toMatch(/['"]claude/i);
  });

  it('actorEvents.ts contains no actorId-specific branching (in code, not doc-comment examples)', () => {
    const codeOnly = ACTOR_EVENTS_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/actorId\s*===\s*['"]/);
  });

  it('a non-Claude actor (Security Reviewer) produces the identical shape as Claude Code', () => {
    const claude = appendActorEvent([], {
      actorId: 'claude-code',
      actorName: 'Claude Code',
      action: 'working',
      actionLabel: 'Implementing',
      summary: 'Implementing the pack',
    });
    const reviewer = appendActorEvent([], {
      actorId: 'security-reviewer',
      actorName: 'Security Reviewer',
      action: 'working',
      actionLabel: 'Reviewing',
      summary: 'Checking the auth boundary',
    });
    // Same fields present, same shape — only the data differs.
    expect(Object.keys(claude[0]).sort()).toEqual(Object.keys(reviewer[0]).sort());
  });

  it('an actor with no actionLabel falls back to a generic, action-derived label — never a hardcoded per-actor string', () => {
    const events = appendActorEvent([], {
      actorId: 'test-agent',
      actorName: 'Test Agent',
      action: 'working',
      summary: 'validating',
    });
    expect(events[0].actionLabel).toBeNull();
    // The renderer's fallback source, not this test's own opinion:
    expect(DEFAULT_ACTION_LABEL.working).toBe('Working');
  });

  it('the renderer falls back to DEFAULT_ACTION_LABEL, never the raw action string (caught live via screenshot: "completed" rendered lowercase instead of "Complete")', () => {
    expect(STRIP_SOURCE).toMatch(/event\.actionLabel \|\| DEFAULT_ACTION_LABEL\[event\.action\]/);
    expect(STRIP_SOURCE).not.toMatch(/event\.actionLabel \|\| event\.action[^A-Za-z]/);
  });
});

describe('non-persistence — actor activity never reaches DevLoopState, DCIR, or a session-save path', () => {
  it('DevLoopState (types/devCommandCenter.ts) has no actor/activity field', () => {
    expect(DEV_LOOP_STATE_SOURCE).not.toMatch(/actorEvents/i);
    expect(DEV_LOOP_STATE_SOURCE).not.toMatch(/currentActor/i);
  });

  it('types/dcir.ts is unmodified by this phase — no actor/provider identity field added to DcirEvent', () => {
    expect(DCIR_TYPES_SOURCE).not.toMatch(/actorId/);
    expect(DCIR_TYPES_SOURCE).not.toMatch(/actorName/);
  });

  it('DevCommandCenterTab.tsx holds actorEvents as component state, never inside session/setSession', () => {
    expect(TAB_SOURCE).toMatch(/const \[actorEvents, setActorEvents\] = useState<ActorEvent\[\]>\(\[\]\)/);
    // The state setter is never used to write onto `session`/DevLoopState.
    expect(TAB_SOURCE).not.toMatch(/setSession\([^)]*actorEvents/);
  });

  it('SmartTriadMessage is untouched — no new field added to support the actor stream', () => {
    expect(SMART_TRIAD_MESSAGE_SOURCE).toMatch(
      /interface SmartTriadMessage \{[\s\S]*?id: string;[\s\S]*?role: ['"]user['"] \| ['"]assistant['"] \| ['"]system['"];[\s\S]*?content: string;/,
    );
    expect(SMART_TRIAD_MESSAGE_SOURCE).not.toMatch(/actorId/);
  });

  it('the actor stream integrates via the streamSupplementItems seam, not by taking over controlled `messages`', () => {
    expect(TAB_SOURCE).toMatch(/streamSupplementItems=\{actorStreamSupplementItems\}/);
    expect(TAB_SOURCE).toMatch(/latestPerActor\(actorEvents\)\.map/);
    expect(TAB_SOURCE).not.toMatch(/<SmartTriadCopilotLayer[\s\S]{0,2000}?\bmessages=\{/);
  });

  it('SmartTriadCopilotLayer merges stream-supplement items into the scrolling message container, never a footer/tray', () => {
    const layoutPath = path.join(
      process.cwd(),
      'components/smarttriad/copilot/SmartTriadCopilotLayer.tsx',
    );
    const layoutSource = readFileSync(layoutPath, 'utf-8');
    expect(layoutSource).toMatch(/streamSupplementItems\?:\s*StreamSupplementItem\[\]/);
    // The merge is timestamp-sorted with messages, not appended after them.
    expect(layoutSource).toMatch(/\.sort\(\(a,\s*b\)\s*=>\s*a\.at\s*-\s*b\.at\)/);
  });
});

describe('the authorization boundary — completed and awaiting-authorization are distinct actions', () => {
  it('the action vocabulary has exactly the five required members, in order', () => {
    expect([...ACTOR_EVENT_ACTIONS]).toEqual(['invoked', 'working', 'completed', 'failed', 'awaiting-authorization']);
  });

  it('a completed event and an awaiting-authorization event are never the same action value', () => {
    const completed = eventOf({ actorId: 'claude-code', actorName: 'Claude Code', action: 'completed', summary: 'PR #42 ready' });
    const awaiting = eventOf({ actorId: 'devon', actorName: 'DevOn', action: 'awaiting-authorization', summary: 'Review and merge required' });
    expect(completed.action).not.toBe(awaiting.action);
    expect(DEFAULT_ACTION_LABEL[completed.action]).toBe('Complete');
    expect(DEFAULT_ACTION_LABEL[awaiting.action]).toBe('Awaiting authorization');
  });

  it('latestPerActor keeps completed Claude Code and awaiting-authorization DevOn as two separate, simultaneously visible rows', () => {
    const events: ActorEvent[] = [
      eventOf({ actorId: 'claude-code', actorName: 'Claude Code', action: 'completed', summary: 'PR #42 ready · validation summary' }),
      eventOf({ actorId: 'devon', actorName: 'DevOn', action: 'awaiting-authorization', summary: 'Review and merge required' }),
    ];
    const latest = latestPerActor(events);
    expect(latest).toHaveLength(2);
    expect(latest.map((e) => e.action).sort()).toEqual(['awaiting-authorization', 'completed']);
  });

  it('ImplementationLayout only wires the invoked transition — working/completed/failed are explicitly NOT fabricated here', () => {
    const onActorEventCalls = IMPLEMENTATION_LAYOUT_SOURCE.match(/onActorEvent\?\.\(\{[\s\S]*?\}\);/g) ?? [];
    expect(onActorEventCalls.length).toBe(1);
    expect(onActorEventCalls[0]).toMatch(/action:\s*["']invoked["']/);
    expect(onActorEventCalls[0]).not.toMatch(/action:\s*["'](working|completed|failed|awaiting-authorization)["']/);
  });
});

describe('latestPerActor — one row per actor, position stable across updates', () => {
  it('multiple events from the same actor collapse to the latest, at the actor’s first-seen position', () => {
    const events: ActorEvent[] = [
      eventOf({ actorId: 'aigent-z', actorName: 'Aigent Z', action: 'working', summary: 'Architecture review' }),
      eventOf({ actorId: 'claude-code', actorName: 'Claude Code', action: 'invoked', summary: 'Dispatched' }),
      eventOf({ actorId: 'claude-code', actorName: 'Claude Code', action: 'completed', summary: 'PR #42 ready' }),
    ];
    const latest = latestPerActor(events);
    expect(latest.map((e) => e.actorId)).toEqual(['aigent-z', 'claude-code']);
    expect(latest[1].action).toBe('completed');
  });
});
