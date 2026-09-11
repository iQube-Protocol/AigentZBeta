/**
 * lifecycleMirror — one-way, best-effort projection of the software/artifact
 * production cycle into Linear (ratified by operator 2026-07-12).
 *
 * LINEAR IS A MIRROR, NEVER A SOURCE OF TRUTH (CFS-017 observe-mode-first):
 * receipts + artifact records stay canonical; this module only REFLECTS the
 * cycle so the operator can track projects/programs in Linear as phases move.
 * Every failure path is a soft-fail (the artifactRecordStore pattern): key
 * absent, team unset, API down, or timeout ⇒ the production pipeline is
 * untouched and the mirror reports { mirrored: false, reason } honestly.
 *
 * Phase → Linear workflow-state TYPE (portable across teams — we match on the
 * built-in state `type`, never on team-specific state names):
 *   intent_declared      → backlog     (issue creation is the declaration)
 *   pack_generated       → unstarted   (Todo)
 *   artifact_produced    → started     (In Progress)
 *   deployment_proposed  → started     (+ comment marking D1 review)
 *   published            → completed   (promotion / anchored publication)
 *
 * Issues are keyed by a deterministic T2-safe marker `[AR:<hash12>]` appended
 * to the title — derived one-way from (delegate, profile, brief) so every
 * route in the cycle (produce, promote, publish) converges on the SAME issue
 * without any shared mutable state.
 *
 * TIER DISCIPLINE (PARAMOUNT — Linear is an EXTERNAL service): only T2-safe
 * content crosses this seam — operator-authored goal text, receipt ids,
 * content-hash prefixes, tier labels, delegate slugs. NEVER a personaId,
 * authProfileId, or any other T0 identifier.
 *
 * Config: `LINEAR_API_KEY` (write-scoped; same var the read-only CDE route
 * uses) + `LINEAR_TEAM_KEY` (the target team's key, e.g. "ENG" — operator-set;
 * when absent the mirror lists the workspace's team keys in its warn so the
 * operator can pick without guessing).
 */

import { createHash } from 'crypto';

const LINEAR_GRAPHQL = 'https://api.linear.app/graphql';
/** Hard deadline per mirror call — the production route's latency budget is
 *  never held hostage by a slow api.linear.app (mirrors the CDE read route). */
const MIRROR_TIMEOUT_MS = 6000;

export type LifecyclePhase =
  | 'intent_declared'
  | 'pack_generated'
  | 'artifact_produced'
  | 'deployment_proposed'
  | 'published';

/** Linear built-in workflow state types (the portable vocabulary). */
export type LinearStateType = 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

export const PHASE_TO_STATE_TYPE: Record<LifecyclePhase, LinearStateType> = {
  intent_declared: 'backlog',
  pack_generated: 'unstarted',
  artifact_produced: 'started',
  deployment_proposed: 'started',
  published: 'completed',
};

export interface LifecycleMirrorEvent {
  /** Producing delegate slug ('operator' when none) — part of the issue key. */
  delegate: string;
  /** Artifact profile ('software', 'documentation', 'studio-composition', …). */
  profile: string;
  /** The operator-authored goal/brief — the issue title + part of the key. */
  brief: string;
  phase: LifecyclePhase;
  /** T2-safe transition note (receipt ids, hash prefixes, standing) — becomes
   *  a comment on the issue. */
  note?: string;
}

export interface MirrorResult {
  mirrored: boolean;
  reason?: string;
  issueIdentifier?: string;
  issueUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Pure helpers (canary-pinned in tests/linear-mirror.test.ts)
// ─────────────────────────────────────────────────────────────────────────

/** Deterministic one-way key for a production — same (delegate, profile,
 *  brief) always converges on the same Linear issue. T2-safe by construction. */
export function mirrorKeyFor(delegate: string, profile: string, brief: string): string {
  return createHash('sha256').update(`ar:${delegate}:${profile}:${brief.trim()}`).digest('hex').slice(0, 12);
}

/** The title marker the mirror searches on. */
export function markerFor(key: string): string {
  return `[AR:${key}]`;
}

/** Issue title: goal text (truncated) + the key marker. */
export function issueTitleFor(brief: string, key: string): string {
  const head = brief.trim().replace(/\s+/g, ' ').slice(0, 180);
  return `${head} ${markerFor(key)}`;
}

/** Issue description written once at creation — the cycle legend. */
export function issueBodyFor(event: LifecycleMirrorEvent): string {
  return [
    `**Artifact Runtime production** — mirrored from the platform (receipts are the source of truth).`,
    '',
    `- Delegate: \`${event.delegate}\``,
    `- Profile: \`${event.profile}\``,
    `- Brief: ${event.brief.trim().slice(0, 1000)}`,
    '',
    `_Cycle: intent → pack → produced → deployment proposed → published. This issue advances as receipts land; it is never edited by hand as a control surface._`,
  ].join('\n');
}

/** Comment body for a phase transition. */
export function transitionCommentFor(phase: LifecyclePhase, note?: string): string {
  const labels: Record<LifecyclePhase, string> = {
    intent_declared: 'Intent declared',
    pack_generated: 'Implementation pack generated',
    artifact_produced: 'Artifact produced (operational)',
    deployment_proposed: 'Deployment proposed (D1 — execution stays human)',
    published: 'Published / promoted to constitutional',
  };
  return note ? `**${labels[phase]}**\n${note}` : `**${labels[phase]}**`;
}

/** Pick the target workflow state id for a phase from a team's states: the
 *  lowest-position state of the mapped type, with an honest fallback chain
 *  (teams differ in which types they enable). Pure. */
export function pickStateId(
  states: Array<{ id: string; type: string; position: number }>,
  phase: LifecyclePhase,
): string | null {
  const fallbacks: Record<LinearStateType, LinearStateType[]> = {
    triage: ['triage', 'backlog', 'unstarted'],
    backlog: ['backlog', 'triage', 'unstarted'],
    unstarted: ['unstarted', 'backlog', 'started'],
    started: ['started', 'unstarted'],
    completed: ['completed'],
    canceled: ['canceled'],
  };
  for (const type of fallbacks[PHASE_TO_STATE_TYPE[phase]]) {
    const candidates = states.filter((s) => s.type === type).sort((a, b) => a.position - b.position);
    if (candidates.length) return candidates[0].id;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Linear GraphQL client (server-side; key never leaves the server)
// ─────────────────────────────────────────────────────────────────────────

async function linearQuery<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
  signal: AbortSignal,
): Promise<T> {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`Linear API ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  if (!json.data) throw new Error('Linear API returned no data');
  return json.data;
}

const TEAM_QUERY = `
  query MirrorTeam($key: String!) {
    teams(filter: { key: { eq: $key } }, first: 1) {
      nodes { id key states { nodes { id name type position } } }
    }
  }
`;

const TEAMS_LIST_QUERY = `
  query MirrorTeams { teams(first: 50) { nodes { key name } } }
`;

const FIND_ISSUE_QUERY = `
  query MirrorFindIssue($marker: String!, $teamKey: String!) {
    issues(filter: { title: { contains: $marker }, team: { key: { eq: $teamKey } } }, first: 1) {
      nodes { id identifier url state { type } }
    }
  }
`;

const CREATE_ISSUE_MUTATION = `
  mutation MirrorCreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) { success issue { id identifier url } }
  }
`;

const UPDATE_ISSUE_MUTATION = `
  mutation MirrorUpdateIssue($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) { success }
  }
`;

const CREATE_COMMENT_MUTATION = `
  mutation MirrorComment($input: CommentCreateInput!) {
    commentCreate(input: $input) { success }
  }
`;

// ─────────────────────────────────────────────────────────────────────────
// The mirror
// ─────────────────────────────────────────────────────────────────────────

/**
 * Reflect one lifecycle transition into Linear: find-or-create the production's
 * issue (keyed by the T2-safe marker), advance its workflow state to the
 * phase's mapped type, and append the transition comment. Best-effort +
 * soft-fail — NEVER throws; a failed mirror is a warn + honest result, and the
 * calling production route is unaffected.
 */
export async function mirrorLifecycleToLinear(event: LifecycleMirrorEvent): Promise<MirrorResult> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) return { mirrored: false, reason: 'LINEAR_API_KEY not set' };
  const teamKey = process.env.LINEAR_TEAM_KEY?.trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MIRROR_TIMEOUT_MS);
  try {
    // No team configured — list the workspace's team keys so the operator can
    // pick without guessing (No-Guessing rule applied to ourselves).
    if (!teamKey) {
      try {
        const data = await linearQuery<{ teams: { nodes: Array<{ key: string; name: string }> } }>(
          apiKey, TEAMS_LIST_QUERY, {}, controller.signal,
        );
        const keys = data.teams.nodes.map((t) => `${t.key} (${t.name})`).join(', ') || 'none visible to this key';
        console.warn(`[linear mirror] LINEAR_TEAM_KEY not set — set it to one of: ${keys}`);
        return { mirrored: false, reason: `LINEAR_TEAM_KEY not set — available: ${keys}` };
      } catch (e) {
        return { mirrored: false, reason: `LINEAR_TEAM_KEY not set (team listing failed: ${e instanceof Error ? e.message : String(e)})` };
      }
    }

    const teamData = await linearQuery<{
      teams: { nodes: Array<{ id: string; key: string; states: { nodes: Array<{ id: string; name: string; type: string; position: number }> } }> };
    }>(apiKey, TEAM_QUERY, { key: teamKey }, controller.signal);
    const team = teamData.teams.nodes[0];
    if (!team) return { mirrored: false, reason: `Linear team '${teamKey}' not found` };

    const stateId = pickStateId(team.states.nodes, event.phase);
    const key = mirrorKeyFor(event.delegate, event.profile, event.brief);
    const marker = markerFor(key);

    const found = await linearQuery<{ issues: { nodes: Array<{ id: string; identifier: string; url: string }> } }>(
      apiKey, FIND_ISSUE_QUERY, { marker, teamKey }, controller.signal,
    );
    let issue = found.issues.nodes[0] ?? null;

    if (!issue) {
      const created = await linearQuery<{ issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string } | null } }>(
        apiKey,
        CREATE_ISSUE_MUTATION,
        {
          input: {
            teamId: team.id,
            title: issueTitleFor(event.brief, key),
            description: issueBodyFor(event),
            ...(stateId ? { stateId } : {}),
          },
        },
        controller.signal,
      );
      if (!created.issueCreate.success || !created.issueCreate.issue) {
        return { mirrored: false, reason: 'issueCreate failed' };
      }
      issue = created.issueCreate.issue;
    } else if (stateId) {
      await linearQuery<{ issueUpdate: { success: boolean } }>(
        apiKey, UPDATE_ISSUE_MUTATION, { id: issue.id, input: { stateId } }, controller.signal,
      );
    }

    await linearQuery<{ commentCreate: { success: boolean } }>(
      apiKey,
      CREATE_COMMENT_MUTATION,
      { input: { issueId: issue.id, body: transitionCommentFor(event.phase, event.note) } },
      controller.signal,
    );

    return { mirrored: true, issueIdentifier: issue.identifier, issueUrl: issue.url };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const reason = aborted
      ? `Linear API timed out after ${MIRROR_TIMEOUT_MS}ms`
      : err instanceof Error ? err.message : String(err);
    console.warn(`[linear mirror] ${event.phase} mirror skipped: ${reason}`);
    return { mirrored: false, reason };
  } finally {
    clearTimeout(timer);
  }
}
