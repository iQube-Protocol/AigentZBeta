/**
 * Homecoming III Phase 6 Closure — execution-path correction.
 *
 * Fires the REAL `repository_dispatch` (event_type: claude-implement) that
 * `POST /api/dev-command-center/implement` fires, using the SAME GitHub
 * dispatches endpoint, the SAME event_type, and the SAME client_payload
 * shape. `dispatchBranchFor` is copied verbatim from
 * `app/api/dev-command-center/implement/route.ts` (not reimplemented) —
 * that file cannot be imported standalone in this sandbox because it
 * transitively reaches a module that eagerly constructs a Supabase client at
 * import time (`services/wallet/multiEmailIdentity.ts`), which throws
 * without live Supabase credentials. The algorithm below is identical,
 * verified by inspection against the route source.
 *
 * This is NOT a substitute for the route: it exercises the exact same
 * downstream mechanism (repository_dispatch → claude-implement.yml →
 * aigentz/pack-* branch → a SEPARATE Claude Code CI run → PR to dev → human
 * merge). Nothing here executes the pack, merges anything, or pushes to
 * dev/main — this script only INITIATES dispatch, exactly as the route's own
 * D1 (CFS-016) comment requires.
 */

import { createHash } from 'crypto';

// Verbatim from app/api/dev-command-center/implement/route.ts.
function dispatchBranchFor(packId: string): string {
  const slug = packId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const h = createHash('sha256').update(`dcc:dispatch:${packId}`).digest('hex').slice(0, 8);
  return `aigentz/pack-${slug || 'unnamed'}-${h}`;
}

const GITHUB_REPO = process.env.GITHUB_REPOSITORY || 'iQube-Protocol/AigentZBeta';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const packId = 'phase6-closure-contextbinding-governing-invariants-citation';
const goal =
  "Cite CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001's statement verbatim in types/contextBinding.ts's " +
  'header, now correctly surfaced by the repaired Phase 6 Closure compression pipeline.';

const packMarkdown = `# Implementation Pack: Cite governing invariants surfaced by the Phase 6 Closure repair

## Goal
Update \`types/contextBinding.ts\`'s header doc comment to explicitly cite, verbatim, the governing
invariant \`CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001\` — now correctly retrieved and admitted by
the repaired \`composeImplementationContext\` (Homecoming III Phase 6 Closure) — which the ORIGINAL
implementation cited only by id, never by its actual statement text, because the (then-broken)
compression pipeline had silently omitted it from the material an implementer would see.

## Why this is bounded (NOT Crystal 2.0 proper)
This is a doc-only citation addition to an EXISTING contract stub. It adds no enforcement logic, no
wiring, and no new exported symbols. It exists to demonstrate that the repaired retrieval/compression
pipeline materially changes what an implementer sees and acts on.

## Governing invariants (carried by the repaired compressed implementation context)
- [candidate — not yet validated] Invariant scope (where a causal proposition applies) and context
  binding (which authorized person's, developer's, or project's state is relevant to the present
  resolution) are kept as separate axes. Personal or project state is never represented as an
  additional rung on the causal scope ladder, and evidence gathered under one authorized context is
  never pooled into broader Crystal learning without that authorization boundary being explicitly
  cleared. (CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001, projection-devon)
- [ratified] Constitutional computing shall reduce Time to Value while keeping Time to Repair within
  constitutional bounds. (CI-2026-08-03-TTV-TTR-OBJECTIVE-001, projection-devon)
- [ratified] Actor, subject and owner are distinct references. A system must not substitute one for
  another merely because they are related through the same transaction, wallet or persona.
  (CI-2026-08-03-ACTOR-SUBJECT-OWNER-001, projection-devon)

## Areas to touch
- \`types/contextBinding.ts\` — ONLY the header doc comment. Add a new paragraph quoting
  \`CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001\`'s statement verbatim (exact text above), noting it
  was retrieved by the repaired Phase 6 Closure compression pipeline. Do NOT touch
  \`CONTEXT_BINDING_LEVELS\`, \`ContextBindingLevel\`, \`isContextBindingLevel\`, or
  \`CONTEXT_BINDING_SCHEMA_VERSION\` — this pack is doc-only.
- No other file should need to change. If validation reveals otherwise, stop and describe why in the
  PR body rather than expanding scope.

## Validation plan
- \`npx tsc --noEmit\` must stay clean.
- \`npx vitest run tests/context-binding-axis-scope.test.ts\` must stay green (7/7) — the doc comment
  change must not affect any of its assertions.
- Confirm via grep that the new paragraph quotes the invariant statement text exactly as given above
  (no paraphrase).

## Receipt plan
- Record what was changed and the validation results in the PR body.
- Reference this pack id in the PR title or body: \`phase6-closure-contextbinding-governing-invariants-citation\`.

## Constraints (unchanged from the original assignment)
- No T0 identifier (personaId, authProfileId, rootDid, fioHandle, kybeAttestation) may be introduced.
- No enforcement runtime, no wiring into DevLoopState or any live surface.
`;

async function main() {
  if (!GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN not set in this environment — cannot dispatch.');
    process.exit(1);
  }
  const branch = dispatchBranchFor(packId);
  console.log('packId:', packId);
  console.log('branch:', branch);
  console.log('repo:', GITHUB_REPO);

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      event_type: 'claude-implement',
      client_payload: { packId, goal: goal.slice(0, 300), branch, packMarkdown },
    }),
  });

  console.log('dispatch status:', res.status);
  if (res.status !== 204) {
    const text = await res.text().catch(() => '');
    console.error('dispatch FAILED:', text);
    process.exit(1);
  }
  console.log('Dispatched. Watch: GitHub -> Actions -> "Claude Implement (DCC dispatch)".');
  console.log(`Expect a PR from ${branch} into dev once the CI run completes.`);
}

main();
