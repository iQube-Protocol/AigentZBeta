/**
 * /api/admin/registry/docs
 *
 * Stage 8+ — Docs tab data source.
 *
 *   GET                       → list available docs
 *   GET ?path=<allowed-path>  → return markdown content
 *
 * Security: explicit allowlist. Path-traversal-proof — only paths
 * registered in DOC_ALLOWLIST are readable. Any other path returns 404.
 *
 * Admin-gated (the PRD trail is internal documentation).
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { ensureCorpusHydrated, corpusReadFile } from '@/services/knowledge/packCorpusStore';
import path from 'path';
import { getActivePersona } from '@/services/identity/getActivePersona';

interface DocEntry {
  id: string;
  path: string;
  label: string;
  group: 'primary' | 'prd' | 'stage' | 'audit';
  order: number;
  description?: string;
}

const DOC_ALLOWLIST: ReadonlyArray<DocEntry> = [
  // Primary contract
  {
    id: 'legibility-profile',
    path: 'docs/iqube-agent-legibility-profile.md',
    label: 'iQube Agent Legibility Profile (shipped)',
    group: 'primary',
    order: 0,
    description: 'Canonical agent-facing contract. Read first.',
  },
  {
    id: 'score-derivation',
    path: 'docs/iqube-score-derivation.md',
    label: 'iQube Score Derivation Reference',
    group: 'primary',
    order: 1,
    description: 'Per-primitive sensitivity/accuracy/verifiability/risk derivation rules.',
  },

  // PRD trail
  {
    id: 'prd-v0.1',
    path: 'codexes/packs/agentiq/updates/2026-05-30_prd-canonical-iqube-registry-operating-plane-v0.1.md',
    label: 'PRD v0.1 — Canonical iQube Registry Operating Plane',
    group: 'prd',
    order: 0,
  },
  {
    id: 'prd-v0.2',
    path: 'codexes/packs/agentiq/updates/2026-05-30_prd-canonical-iqube-registry-operating-plane-v0.2-addendum.md',
    label: 'PRD v0.2 Addendum — Reviewer guardrails + 3 clarifications',
    group: 'prd',
    order: 1,
  },
  {
    id: 'prd-v0.3',
    path: 'codexes/packs/agentiq/updates/2026-05-30_prd-canonical-iqube-registry-operating-plane-v0.3-alignment.md',
    label: 'PRD v0.3 Alignment — shipped legibility profile reconciliation',
    group: 'prd',
    order: 2,
  },
  {
    id: 'prd-v1.0',
    path: 'codexes/packs/agentiq/updates/2026-05-30_prd-canonical-iqube-registry-operating-plane-v1.0.md',
    label: 'PRD v1.0 Consolidated — implementation-ready',
    group: 'prd',
    order: 3,
    description: 'The implementation contract. References every authority.',
  },
  {
    id: 'prd-v1.1',
    path: 'codexes/packs/agentiq/updates/2026-05-30_prd-canonical-iqube-registry-operating-plane-v1.1-guardrails.md',
    label: 'PRD v1.1 Guardrails — operator-confirmed decisions',
    group: 'prd',
    order: 4,
  },

  // Stage 0 audit + follow-up
  {
    id: 'stage-0-audit',
    path: 'codexes/packs/agentiq/updates/2026-05-30_stage-0-audit-report.md',
    label: 'Stage 0 Audit Report',
    group: 'audit',
    order: 0,
  },
  {
    id: 'stage-1-to-2',
    path: 'codexes/packs/agentiq/updates/2026-05-30_stage-1-to-2-transition.md',
    label: 'Stage 1 → 2 Transition (operator answers)',
    group: 'audit',
    order: 1,
  },

  // Stage close reports
  {
    id: 'stage-1-close',
    path: 'codexes/packs/agentiq/updates/2026-05-30_stage-1-close-report.md',
    label: 'Stage 1 — Schema + types',
    group: 'stage',
    order: 1,
  },
  {
    id: 'stage-2-close',
    path: 'codexes/packs/agentiq/updates/2026-05-30_stage-2-close-report.md',
    label: 'Stage 2 — Resolver + projections + backfill + CI gates',
    group: 'stage',
    order: 2,
  },
  {
    id: 'stage-3-4-close',
    path: 'codexes/packs/agentiq/updates/2026-05-31_stage-3-and-4-close-report.md',
    label: 'Stage 3 + 4 — Lifecycle + Canonization + legacy migration',
    group: 'stage',
    order: 3,
  },
  {
    id: 'stage-5-close',
    path: 'codexes/packs/agentiq/updates/2026-05-31_stage-5-close-report.md',
    label: 'Stage 5 — Mint saga',
    group: 'stage',
    order: 5,
  },
  {
    id: 'stage-6-close',
    path: 'codexes/packs/agentiq/updates/2026-05-31_stage-6-close-report.md',
    label: 'Stage 6 — DVN block ledger + receipts',
    group: 'stage',
    order: 6,
  },
  {
    id: 'stage-7-close',
    path: 'codexes/packs/agentiq/updates/2026-05-31_stage-7-close-report.md',
    label: 'Stage 7 — AigentQube governance',
    group: 'stage',
    order: 7,
  },
  {
    id: 'stage-8-close',
    path: 'codexes/packs/agentiq/updates/2026-05-31_stage-8-close-report.md',
    label: 'Stage 8 — iqube-registry cartridge tabs',
    group: 'stage',
    order: 8,
  },
  {
    id: 'stage-9-close',
    path: 'codexes/packs/agentiq/updates/2026-05-31_stage-9-close-report.md',
    label: 'Stage 9 — Phase 2 stubs',
    group: 'stage',
    order: 9,
  },
  {
    id: 'legacy-registry-phase-a-close',
    path: 'codexes/packs/agentiq/updates/2026-05-31_legacy-registry-phase-a-close-report.md',
    label: 'Legacy /registry Integration — Phase A close',
    group: 'stage',
    order: 10,
    description: 'Read path complete: list + detail + identity filters + score display + analytics banner.',
  },
  {
    id: 'legacy-registry-phase-b-close',
    path: 'codexes/packs/agentiq/updates/2026-05-31_legacy-registry-phase-b-close-report.md',
    label: 'Legacy /registry Integration — Phase B close',
    group: 'stage',
    order: 11,
    description: 'Write path + mint canonicalisation + batch mint complete. 9 commits.',
  },
  {
    id: 'legacy-registry-phase-c-close',
    path: 'codexes/packs/agentiq/updates/2026-05-31_legacy-registry-phase-c-close-report.md',
    label: 'Legacy /registry Integration — Phase C close (integration shipped)',
    group: 'stage',
    order: 12,
    description: 'Component lift + cartridge grid/modal/intake + legacy route deprecation. End of three-phase integration.',
  },
];

async function requireAdmin(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  if (!persona.cartridgeFlags?.isAdmin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { persona };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const docPath = url.searchParams.get('path');

  if (!docPath) {
    // Return the catalog
    return NextResponse.json({
      docs: [...DOC_ALLOWLIST].sort((a, b) => {
        const groupOrder = { primary: 0, prd: 1, audit: 2, stage: 3 };
        const ga = groupOrder[a.group];
        const gb = groupOrder[b.group];
        if (ga !== gb) return ga - gb;
        return a.order - b.order;
      }),
      total: DOC_ALLOWLIST.length,
    });
  }

  // Allowlist enforcement — path must match an entry exactly.
  const entry = DOC_ALLOWLIST.find((d) => d.path === docPath);
  if (!entry) {
    return NextResponse.json(
      { error: 'doc_not_in_allowlist', requested: docPath },
      { status: 404 },
    );
  }

  const fullPath = path.join(process.cwd(), entry.path);

  try {
    // Pack docs (codexes/packs/**) read through the corpus seam (remote in the
    // Lambda where their .md bodies are no longer bundled); the two docs/*.md
    // legibility files stay on the bundled filesystem.
    let content: string | null;
    if (entry.path.startsWith('codexes/packs/')) {
      await ensureCorpusHydrated();
      content = corpusReadFile(fullPath);
    } else {
      content = await readFile(fullPath, 'utf-8');
    }
    if (content === null) {
      return NextResponse.json({ error: 'read_failed', detail: 'not found' }, { status: 500 });
    }
    return NextResponse.json({
      doc: entry,
      content,
      bytes: content.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'read_failed', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
