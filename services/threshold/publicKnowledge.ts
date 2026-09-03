/**
 * publicKnowledge.ts — the public knowledge & discovery layer for the
 * Threshold MCP Bridge, spanning Qriptopian, IRL OS, AgentiQ OS, and Polity
 * Core (operator directive, 2026-09-03: "Complete the public knowledge and
 * discovery layer for the Threshold MCP Bridge").
 *
 * DESIGN — smallest coherent cross-cartridge interface, not four parallel
 * tool families (per the directive's §5). One adapter, one document shape,
 * one search function, branching internally per cartridge on top of
 * ALREADY-CANONICAL read paths:
 *
 *   - qriptopian  → the live app/api/codex/qripto/{papers,essays} routes
 *     (same server-to-server fetch pattern irlAdapter.ts already uses for
 *     IRL — never a second Supabase query path for the same content).
 *   - irl-os      → delegates straight to the injected IrlAdapter
 *     (ctx.irl) — the SAME public, already-audited /api/public/irl/* reads
 *     the existing list_shared_documents/read_shared_document tools use.
 *     This module adds no new IRL read path.
 *   - agentiq-os  → the SAME corpusReadPackFile() seam
 *     app/api/codex/packs/[packId]/file/route.ts uses, restricted to an
 *     EXPLICIT allowlist (never a directory scan — the pack's own
 *     "Updates" tab is not adminOnly but resolves to 474 internal
 *     engineering session files that must never leak through discovery).
 *   - polity-core → the same corpusReadPackFile() seam, restricted to an
 *     explicit allowlist that excludes the one adminOnly commentary tab
 *     (the Constitutional Internet working manuscript).
 *
 * ACCESS CONTROL — default-deny, allowlist-only. No cartridge branch below
 * ever lists a directory or accepts a caller-supplied path; every readable
 * document id is a member of a hardcoded, audited constant. This is
 * deliberate: per-document publication-status fields do not exist yet for
 * three of these four cartridges (confirmed by direct audit, 2026-09-03),
 * so "default-allow, gated by some field" is not an option — an allowlist
 * is the only sound posture available today. Widening a cartridge's
 * allowlist requires the SAME operator classification review as the
 * original one (never inferred from a tab's `enabled`/`adminOnly` flag
 * alone, and never from a repository/URL/domain/"active status" signal —
 * see this module's own audit trail in
 * codexes/packs/agentiq/updates/2026-09-03_threshold-public-knowledge-bridge.md).
 *
 * SEARCH — keyword only (substring/token match over title + excerpt +
 * resolved text), explicitly reported as such (`searchMode: 'keyword'`) in
 * every response. Semantic search over this content would route through
 * services/content/embeddingService.ts, which has a confirmed, live hazard
 * (processUnembeddedChunks() drains ALL domains with no scoping, including
 * the private `homecoming` KB) — this module never calls it. Wiring real
 * semantic search is out of scope for this pass; see the audit trail doc.
 *
 * PROVENANCE — read_public_document always returns the FULL resolved text's
 * sha256 alongside any requested page, so an agent reconstructing the full
 * text across pages can verify it against the same hash regardless of how
 * it was paginated.
 */

import { createHash } from 'crypto';
import { resilientFetch } from './resilientFetch';
import { corpusReadPackFile } from '../knowledge/packCorpusStore';
import type { IrlAdapter } from './irlAdapter';

export type PublicCartridgeId = 'qriptopian' | 'irl-os' | 'agentiq-os' | 'polity-core';

export type RatificationStatus = 'ratified' | 'explanatory' | 'experimental' | 'proposed' | 'historical';

export interface PublicCartridgeDescriptor {
  id: PublicCartridgeId;
  name: string;
  description: string;
  canonicalCartridgeId: string; // the real data/codex-configs.ts CodexConfig.id, for citation
}

export interface PublicDocumentSummary {
  id: string;
  cartridge: PublicCartridgeId;
  title: string;
  series?: string;
  edition?: string;
  status: RatificationStatus | 'published';
  canonicalLink: string;
  sourceKind: 'pack-markdown' | 'db-content' | 'db-media-asset';
}

export interface PublicDocumentPage {
  id: string;
  cartridge: PublicCartridgeId;
  title: string;
  series?: string;
  edition?: string;
  status: RatificationStatus | 'published';
  canonicalLink: string;
  text: string;
  offset: number;
  limit: number;
  totalLength: number;
  hasMore: boolean;
  sha256OfFullText: string;
  availableEditions?: string[];
}

export interface PublicKnowledgeAdapter {
  listCartridges(): PublicCartridgeDescriptor[];
  listDocuments(cartridge: PublicCartridgeId): Promise<{ ok: boolean; documents?: PublicDocumentSummary[]; error?: string }>;
  readDocument(
    cartridge: PublicCartridgeId,
    id: string,
    opts?: { edition?: string; offset?: number; limit?: number },
  ): Promise<{ ok: boolean; page?: PublicDocumentPage; error?: string }>;
  search(
    query: string,
    cartridge?: PublicCartridgeId,
  ): Promise<{ ok: boolean; searchMode: 'keyword'; results?: Array<{ cartridge: PublicCartridgeId; id: string; title: string; excerpt: string }>; error?: string }>;
  listCapabilities(cartridge?: PublicCartridgeId): { cartridge: PublicCartridgeId; capabilities: PublicCapability[] }[];
}

export interface PublicCapability {
  name: string;
  purpose: string;
  owningCartridge: PublicCartridgeId;
  status: 'live' | 'described-only' | 'planned';
  mutating: boolean;
  authorizationRequired: string | null;
  invocation: string;
}

// ── Cartridge descriptors ──────────────────────────────────────────────────

export const PUBLIC_CARTRIDGES: PublicCartridgeDescriptor[] = [
  {
    id: 'qriptopian',
    name: 'Qriptopian',
    description: 'The Qriptopian codex: published white papers (Polity Papers, COYN Thesis, Experience Sovereignty, Embodiment), the Thresholds essay series, and public magazine issues.',
    canonicalCartridgeId: 'qripto-codex',
  },
  {
    id: 'irl-os',
    name: 'IRL OS',
    description: 'The Invariant Research Lab public surface: research methodology, published (hash-verifiable) experiment results, and the shared open corpus.',
    canonicalCartridgeId: 'irl-os-cartridge',
  },
  {
    id: 'agentiq-os',
    name: 'AgentiQ OS',
    description: 'The public developer-facing surface of AgentiQ: agent/runtime guides, SDK quickstart, protocols, governance, and ratified constitutional capability briefs.',
    canonicalCartridgeId: 'agentiq-os-cartridge',
  },
  {
    id: 'polity-core',
    name: 'Polity Core',
    description: 'The authoritative constitutional repository: the ratified Constitution and charters, constitutional commentary (not itself binding law), and the amendment ledger.',
    canonicalCartridgeId: 'polity-core-cartridge',
  },
];

// ── AgentiQ OS allowlist (codexes/packs/agentiq-os/items/*, verified against
//    collections.json 2026-09-03 — all 16 public guide docs) plus the
//    Constitutional Capability Briefs subset of the (separately-packed)
//    agentiq updates stream (col_capabilities in codexes/packs/agentiq/
//    collections.json) — the ONLY files from that 474-file updates/
//    directory that are deliberately promoted to public capability briefs.
//    Never widen this by scanning updates/ — see this file's header. ──────

const AGENTIQ_OS_GUIDE_PATHS: Array<{ id: string; title: string; path: string }> = [
  { id: 'start-here', title: 'Start Here', path: 'items/start-here.md' },
  { id: 'what-is-agentiq-os', title: 'What is AgentiQ OS', path: 'items/what-is-agentiq-os.md' },
  { id: 'what-is-nanos', title: 'What is NanOS', path: 'items/what-is-nanos.md' },
  { id: 'protocols', title: 'Protocols', path: 'items/protocols.md' },
  { id: 'stack-overview', title: 'Stack Overview', path: 'items/stack-overview.md' },
  { id: 'dev-standards', title: 'Dev Standards', path: 'items/dev-standards.md' },
  { id: 'governance', title: 'Governance', path: 'items/governance.md' },
  { id: 'identity-sovereignty', title: 'Identity & Sovereignty', path: 'items/identity-sovereignty.md' },
  { id: 'bounded-delegation', title: 'Bounded Delegation', path: 'items/bounded-delegation.md' },
  { id: 'sdk-quickstart', title: 'SDK Quickstart', path: 'items/sdk-quickstart.md' },
  { id: 'reference-runtime', title: 'Reference: Runtime', path: 'items/reference-runtime.md' },
  { id: 'reference-studio', title: 'Reference: Studio', path: 'items/reference-studio.md' },
  { id: 'smarttriad', title: 'SmartTriad', path: 'items/smarttriad.md' },
  { id: 'liquid-ui', title: 'Liquid UI', path: 'items/liquid-ui.md' },
  { id: 'constitutional-financial-services', title: 'Constitutional Financial Services', path: 'items/constitutional-financial-services.md' },
  { id: 'agentiq-os-codex', title: 'AgentiQ OS Codex', path: 'items/agentiq-os-codex.md' },
];

const AGENTIQ_OS_CAPABILITY_BRIEF_PATHS: Array<{ id: string; title: string; path: string }> = [
  { id: 'ccb-metame-companion', title: 'CCB: metaMe Companion', path: 'updates/2026-07-24_ccb-metame-companion.md' },
  { id: 'ccb-financial-services-capability-suite', title: 'CCB: Financial Services Capability Suite', path: 'updates/2026-07-24_ccb-financial-services-capability-suite.md' },
  { id: 'ccb-moneypenny-runtime', title: 'CCB: MoneyPenny Runtime', path: 'updates/2026-07-24_ccb-moneypenny-runtime.md' },
  { id: 'companion-menu-system-invariants', title: 'Companion Menu System Invariants', path: 'updates/2026-07-27_companion-menu-system-invariants.md' },
  { id: 'ccb-invariant-discovery-engine', title: 'CCB: Invariant Discovery Engine', path: 'updates/2026-07-27_ccb-invariant-discovery-engine.md' },
  { id: 'ccb-invariant-resolution-engine', title: 'CCB: Invariant Resolution Engine', path: 'updates/2026-07-27_ccb-invariant-resolution-engine.md' },
  { id: 'ccb-invariant-projection-engine', title: 'CCB: Invariant Projection Engine', path: 'updates/2026-07-27_ccb-invariant-projection-engine.md' },
];

// ── Polity Core allowlist (codexes/packs/polity-core/, verified against
//    data/codex-configs.ts POLITY_CORE_CARTRIDGE's 15 non-adminOnly tabs +
//    collections.json, 2026-09-03). EXCLUDES the one adminOnly tab
//    (polity-core-commentary-constitutional-internet and everything under
//    items/commentary/constitutional-internet/**) — the working-manuscript
//    book project, never public. Status is each document's OWN self-declared
//    header (verified verbatim, not inferred), tagged with the taxonomy the
//    operator's own directive names (ratified/explanatory/experimental/
//    proposed/historical) rather than the engineering COMPLETION_LIFECYCLE
//    vocabulary, which governs invariant/resolution records, not editorial
//    constitutional documents (CLAUDE.md "Adding to This File" — a second
//    status vocabulary is fine where the domain genuinely differs; the
//    engineering ladder does not fit "commentary is not ratified law"). ──

const POLITY_CORE_PATHS: Array<{ id: string; title: string; path: string; status: RatificationStatus; series?: string }> = [
  { id: 'constitution', title: 'The Polity Constitution', path: 'items/CONSTITUTION.md', status: 'ratified' },
  { id: 'constitution-agentic-polity', title: 'The Constitution of the Agentic Polity', path: 'items/CONSTITUTION_OF_AGENTIC_POLITY.md', status: 'ratified', series: 'Polity Papers' },
  { id: 'invariant-intelligence', title: 'Invariant Intelligence (Foundational Constitutional Record)', path: 'constitutional-records/invariant-intelligence.md', status: 'ratified' },
  { id: 'agent-charter', title: 'Agent Charter', path: 'items/AGENT_CHARTER.md', status: 'ratified' },
  { id: 'delegation-framework', title: 'Delegation Framework', path: 'items/DELEGATION_FRAMEWORK.md', status: 'ratified' },
  { id: 'standing-charter', title: 'Standing Charter', path: 'items/STANDING_CHARTER.md', status: 'ratified' },
  { id: 'metacommons-charter', title: 'metaCommons Charter', path: 'items/METACOMMONS_CHARTER.md', status: 'ratified' },
  { id: 'founder-office-charter', title: 'Founder Office Charter', path: 'items/FOUNDER_OFFICE_CHARTER.md', status: 'ratified' },
  { id: 'standing-framework', title: 'Standing Framework', path: 'items/STANDING_FRAMEWORK.md', status: 'ratified' },
  { id: 'governance-framework', title: 'Governance Framework', path: 'items/GOVERNANCE_FRAMEWORK.md', status: 'ratified' },
  { id: 'ventureqube-spec', title: 'VentureQube Spec (WIP)', path: 'items/VENTUREQUBE_SPEC.md', status: 'proposed' },
  { id: 'amendment-records', title: 'Amendment Records', path: 'items/AMENDMENT_RECORDS.md', status: 'historical' },
  { id: 'machine-readable', title: 'Machine-Readable Source of Legitimacy', path: 'items/MACHINE_READABLE.md', status: 'explanatory' },
  // Constitutional commentary — explicitly "not ratified law" per the
  // series' own README (codexes/packs/polity-core/items/commentary/README.md).
  { id: 'commentary-experience-sovereignty-07', title: 'Commentary: Agent Runbook', path: 'items/commentary/experience-sovereignty/07-agent-runbook.md', status: 'explanatory', series: 'Experience Sovereignty' },
  { id: 'commentary-coyn-thesis-01', title: 'Commentary: The Fallacy of Free Information', path: 'items/commentary/coyn-thesis/01-the-fallacy-of-free-information.md', status: 'explanatory', series: 'COYN Thesis' },
  { id: 'commentary-coyn-thesis-02', title: 'Commentary: Time Sovereignty', path: 'items/commentary/coyn-thesis/02-time-sovereignty.md', status: 'explanatory', series: 'COYN Thesis' },
  { id: 'commentary-coyn-thesis-03', title: 'Commentary: Proof of Time Saved', path: 'items/commentary/coyn-thesis/03-proof-of-time-saved.md', status: 'explanatory', series: 'COYN Thesis' },
  { id: 'commentary-coyn-thesis-04', title: 'Commentary: Money, Time and COYN', path: 'items/commentary/coyn-thesis/04-money-time-and-coyn.md', status: 'explanatory', series: 'COYN Thesis' },
  { id: 'commentary-coyn-thesis-05', title: 'Commentary: The Sovereign Cybernetic Economy', path: 'items/commentary/coyn-thesis/05-the-sovereign-cybernetic-economy.md', status: 'explanatory', series: 'COYN Thesis' },
  { id: 'commentary-polity-01', title: 'Commentary: Beyond the Binary', path: 'items/commentary/polity/01-beyond-the-binary.md', status: 'explanatory', series: 'The Polity' },
  { id: 'commentary-polity-02', title: 'Commentary: From Perimeter to Polity', path: 'items/commentary/polity/02-from-perimeter-to-polity.md', status: 'explanatory', series: 'The Polity' },
  { id: 'commentary-polity-03', title: 'Commentary: Citizenship in the Agentic Internet', path: 'items/commentary/polity/03-citizenship-in-the-agentic-internet.md', status: 'explanatory', series: 'The Polity' },
  { id: 'commentary-polity-04', title: 'Commentary: The Constitution of the Agentic Polity', path: 'items/commentary/polity/04-the-constitution-of-the-agentic-polity.md', status: 'explanatory', series: 'The Polity' },
];

// ── Qriptopian: reuse the live public REST routes, never a parallel query ──

interface QriptoPaperRow {
  id: string;
  title: string;
  scope?: string;
  scopeLabel?: string;
}

interface QriptoEssaySummary {
  id: string;
  title: string;
  slug: string;
  series?: string;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function slicePage(text: string, offset: number, limit: number) {
  const totalLength = text.length;
  const start = Math.max(0, Math.min(offset, totalLength));
  const end = Math.max(start, Math.min(start + limit, totalLength));
  return { text: text.slice(start, end), offset: start, limit, totalLength, hasMore: end < totalLength };
}

export function makePublicKnowledgeAdapter(opts: { origin: string; irl?: IrlAdapter }): PublicKnowledgeAdapter {
  const { origin, irl } = opts;
  const get = (path: string) => resilientFetch(`${origin}${path}`);

  // ── Qriptopian branch ──
  async function listQriptopian(): Promise<{ ok: boolean; documents?: PublicDocumentSummary[]; error?: string }> {
    const [papersRes, magazinesRes, essaysRes] = await Promise.all([
      get('/api/codex/qripto/papers?group=papers'),
      get('/api/codex/qripto/papers?group=magazines'),
      get('/api/codex/qripto/essays'),
    ]);
    const documents: PublicDocumentSummary[] = [];
    for (const [res, kind] of [
      [papersRes, 'paper'],
      [magazinesRes, 'magazine'],
    ] as const) {
      if (!res.ok) continue;
      const body = res.body as { papers?: QriptoPaperRow[] } | null;
      const rows: QriptoPaperRow[] = body?.papers ?? [];
      for (const row of rows) {
        if (!row?.id || !row?.title) continue;
        documents.push({
          id: row.id,
          cartridge: 'qriptopian',
          title: row.title,
          series: row.scopeLabel ?? (kind === 'magazine' ? 'Magazines' : undefined),
          status: 'published',
          canonicalLink: `/api/codex/qripto/papers?group=${kind === 'magazine' ? 'magazines' : 'papers'}`,
          sourceKind: 'db-media-asset',
        });
      }
    }
    if (essaysRes.ok) {
      const body = essaysRes.body as { essays?: QriptoEssaySummary[] } | null;
      const rows: QriptoEssaySummary[] = body?.essays ?? [];
      for (const row of rows) {
        if (!row?.id || !row?.title || !row?.slug) continue;
        documents.push({
          id: row.slug,
          cartridge: 'qriptopian',
          title: row.title,
          series: row.series ?? 'Thresholds',
          status: 'published',
          canonicalLink: `/api/codex/qripto/essays/${row.slug}/machine`,
          sourceKind: 'db-content',
        });
      }
    }
    if (!documents.length && !papersRes.ok && !magazinesRes.ok && !essaysRes.ok) {
      return { ok: false, error: 'Qriptopian publication routes are unavailable.' };
    }
    return { ok: true, documents };
  }

  async function readQriptopian(
    id: string,
    edition: string | undefined,
    offset: number,
    limit: number,
  ): Promise<{ ok: boolean; page?: PublicDocumentPage; error?: string }> {
    // Essays/Thresholds are addressed by slug; try the machine-readable route first
    // (it already returns full canonical text + edition list — the exact
    // "actual manuscript/document text, not merely a summary" the directive requires).
    const essayRes = await get(`/api/codex/qripto/essays/${encodeURIComponent(id)}/machine`);
    if (essayRes.ok) {
      const body = essayRes.body as {
        title?: string;
        series?: string;
        seriesNumber?: string | number;
        canonicalText?: { text?: string };
        readingEditions?: Array<{ id: string; label: string; text?: string }>;
      } | null;
      if (body && typeof body === 'object') {
        const editions = Array.isArray(body.readingEditions) ? body.readingEditions : [];
        const selected = edition ? editions.find((e) => e.id === edition) : undefined;
        const fullText = selected?.text ?? body.canonicalText?.text ?? '';
        if (fullText) {
          const sliced = slicePage(fullText, offset, limit);
          return {
            ok: true,
            page: {
              id,
              cartridge: 'qriptopian',
              title: body.title ?? id,
              series: body.series,
              edition: selected?.id,
              status: 'published',
              canonicalLink: `/api/codex/qripto/essays/${id}/machine`,
              text: sliced.text,
              offset: sliced.offset,
              limit: sliced.limit,
              totalLength: sliced.totalLength,
              hasMore: sliced.hasMore,
              sha256OfFullText: sha256(fullText),
              availableEditions: editions.map((e) => e.id),
            },
          };
        }
      }
    }
    return { ok: false, error: `Qriptopian document "${id}" was not found or has no readable text (edition "${edition ?? 'default'}").` };
  }

  // ── IRL OS branch — delegates entirely to the existing, audited IrlAdapter ──
  async function listIrlOs(): Promise<{ ok: boolean; documents?: PublicDocumentSummary[]; error?: string }> {
    if (!irl) return { ok: false, error: 'The IRL public reader is unavailable on this gateway.' };
    const result = (await irl.listDocuments()) as { ok?: boolean; overview?: unknown; error?: string };
    if (!result?.ok) return { ok: false, error: result?.error ?? 'IRL OS overview unavailable.' };
    // The overview is a T2-safe research-programme summary, not a flat document
    // list — surface the one allowlisted document plus the overview itself as
    // a readable id, rather than inventing a listing the underlying route does
    // not provide.
    return {
      ok: true,
      documents: [
        {
          id: 'research-overview',
          cartridge: 'irl-os',
          title: 'IRL Research Overview',
          status: 'published',
          canonicalLink: '/api/public/irl/research-overview',
          sourceKind: 'db-content',
        },
        {
          id: 'foundation/PARTICIPATION_overview.md',
          cartridge: 'irl-os',
          title: 'Participation Overview',
          status: 'published',
          canonicalLink: '/api/public/irl/doc?path=foundation/PARTICIPATION_overview.md',
          sourceKind: 'pack-markdown',
        },
      ],
    };
  }

  async function readIrlOs(id: string, offset: number, limit: number): Promise<{ ok: boolean; page?: PublicDocumentPage; error?: string }> {
    if (!irl) return { ok: false, error: 'The IRL public reader is unavailable on this gateway.' };
    if (id === 'research-overview') {
      const result = (await irl.listDocuments()) as { ok?: boolean; overview?: unknown; error?: string };
      if (!result?.ok) return { ok: false, error: result?.error ?? 'IRL OS overview unavailable.' };
      const fullText = JSON.stringify(result.overview, null, 2);
      const sliced = slicePage(fullText, offset, limit);
      return {
        ok: true,
        page: {
          id,
          cartridge: 'irl-os',
          title: 'IRL Research Overview',
          status: 'published',
          canonicalLink: '/api/public/irl/research-overview',
          text: sliced.text,
          offset: sliced.offset,
          limit: sliced.limit,
          totalLength: sliced.totalLength,
          hasMore: sliced.hasMore,
          sha256OfFullText: sha256(fullText),
        },
      };
    }
    const result = (await irl.readDocument(id)) as { ok?: boolean; content?: unknown; error?: string };
    if (!result?.ok) return { ok: false, error: result?.error ?? `IRL OS document "${id}" was not found.` };
    const fullText = typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2);
    const sliced = slicePage(fullText, offset, limit);
    return {
      ok: true,
      page: {
        id,
        cartridge: 'irl-os',
        title: id,
        status: 'published',
        canonicalLink: `/api/public/irl/doc?path=${encodeURIComponent(id)}`,
        text: sliced.text,
        offset: sliced.offset,
        limit: sliced.limit,
        totalLength: sliced.totalLength,
        hasMore: sliced.hasMore,
        sha256OfFullText: sha256(fullText),
      },
    };
  }

  // ── AgentiQ OS / Polity Core branches — shared pack-corpus reader ──
  function listPackAllowlist(
    cartridge: 'agentiq-os' | 'polity-core',
    entries: Array<{ id: string; title: string; path: string; status?: RatificationStatus; series?: string }>,
    linkPrefix: string,
  ): PublicDocumentSummary[] {
    return entries.map((e) => ({
      id: e.id,
      cartridge,
      title: e.title,
      series: e.series,
      status: e.status ?? 'explanatory',
      canonicalLink: `${linkPrefix}?path=${encodeURIComponent(e.path)}`,
      sourceKind: 'pack-markdown',
    }));
  }

  async function readPackDoc(
    packId: string,
    entry: { id: string; title: string; path: string; status?: RatificationStatus; series?: string } | undefined,
    cartridge: PublicCartridgeId,
    linkPrefix: string,
    offset: number,
    limit: number,
  ): Promise<{ ok: boolean; page?: PublicDocumentPage; error?: string }> {
    if (!entry) return { ok: false, error: `Unknown or non-public document id for ${cartridge}.` };
    const raw = await corpusReadPackFile(packId, entry.path).catch(() => null);
    if (raw === null) return { ok: false, error: `Document "${entry.id}" could not be read from the pack corpus.` };
    const sliced = slicePage(raw, offset, limit);
    return {
      ok: true,
      page: {
        id: entry.id,
        cartridge,
        title: entry.title,
        series: entry.series,
        status: entry.status ?? 'explanatory',
        canonicalLink: `${linkPrefix}?path=${encodeURIComponent(entry.path)}`,
        text: sliced.text,
        offset: sliced.offset,
        limit: sliced.limit,
        totalLength: sliced.totalLength,
        hasMore: sliced.hasMore,
        sha256OfFullText: sha256(raw),
      },
    };
  }

  return {
    listCartridges() {
      return PUBLIC_CARTRIDGES;
    },

    async listDocuments(cartridge) {
      if (cartridge === 'qriptopian') return listQriptopian();
      if (cartridge === 'irl-os') return listIrlOs();
      if (cartridge === 'agentiq-os') {
        return {
          ok: true,
          documents: [
            ...listPackAllowlist('agentiq-os', AGENTIQ_OS_GUIDE_PATHS, '/api/codex/packs/agentiq-os/file'),
            ...listPackAllowlist('agentiq-os', AGENTIQ_OS_CAPABILITY_BRIEF_PATHS.map((e) => ({ ...e, series: 'Constitutional Capability Briefs' })), '/api/codex/packs/agentiq/file'),
          ],
        };
      }
      if (cartridge === 'polity-core') {
        return { ok: true, documents: listPackAllowlist('polity-core', POLITY_CORE_PATHS, '/api/codex/packs/polity-core/file') };
      }
      return { ok: false, error: `Unknown public cartridge: ${cartridge}` };
    },

    async readDocument(cartridge, id, opts = {}) {
      const offset = Math.max(0, opts.offset ?? 0);
      const limit = Math.max(1, Math.min(opts.limit ?? 8000, 50000));
      if (cartridge === 'qriptopian') return readQriptopian(id, opts.edition, offset, limit);
      if (cartridge === 'irl-os') return readIrlOs(id, offset, limit);
      if (cartridge === 'agentiq-os') {
        const guide = AGENTIQ_OS_GUIDE_PATHS.find((e) => e.id === id);
        if (guide) return readPackDoc('agentiq-os', guide, 'agentiq-os', '/api/codex/packs/agentiq-os/file', offset, limit);
        const brief = AGENTIQ_OS_CAPABILITY_BRIEF_PATHS.find((e) => e.id === id);
        if (brief) return readPackDoc('agentiq', { ...brief, series: 'Constitutional Capability Briefs' }, 'agentiq-os', '/api/codex/packs/agentiq/file', offset, limit);
        return { ok: false, error: `Unknown or non-public AgentiQ OS document id: ${id}` };
      }
      if (cartridge === 'polity-core') {
        const entry = POLITY_CORE_PATHS.find((e) => e.id === id);
        return readPackDoc('polity-core', entry, 'polity-core', '/api/codex/packs/polity-core/file', offset, limit);
      }
      return { ok: false, error: `Unknown public cartridge: ${cartridge}` };
    },

    async search(query, cartridge) {
      const q = query.trim().toLowerCase();
      if (!q) return { ok: false, searchMode: 'keyword', error: 'A search query is required.' };
      const cartridges = cartridge ? [cartridge] : (['qriptopian', 'irl-os', 'agentiq-os', 'polity-core'] as PublicCartridgeId[]);
      const results: Array<{ cartridge: PublicCartridgeId; id: string; title: string; excerpt: string }> = [];
      for (const c of cartridges) {
        const listing = await this.listDocuments(c);
        if (!listing.ok || !listing.documents) continue;
        for (const doc of listing.documents) {
          const titleMatch = doc.title.toLowerCase().includes(q);
          if (titleMatch) {
            results.push({ cartridge: c, id: doc.id, title: doc.title, excerpt: doc.title });
            continue;
          }
          // Only fetch full text for a bounded number of candidates per cartridge
          // to keep this in-process search cheap — title matches above are free.
          if (results.filter((r) => r.cartridge === c).length >= 5) continue;
          const page = await this.readDocument(c, doc.id, { limit: 20000 });
          if (!page.ok || !page.page) continue;
          const lower = page.page.text.toLowerCase();
          const idx = lower.indexOf(q);
          if (idx >= 0) {
            const start = Math.max(0, idx - 80);
            const excerpt = page.page.text.slice(start, idx + q.length + 80);
            results.push({ cartridge: c, id: doc.id, title: doc.title, excerpt: (start > 0 ? '…' : '') + excerpt + '…' });
          }
        }
      }
      return { ok: true, searchMode: 'keyword', results };
    },

    listCapabilities(cartridge) {
      const all: Array<{ cartridge: PublicCartridgeId; capabilities: PublicCapability[] }> = [
        {
          cartridge: 'qriptopian',
          capabilities: [
            {
              name: 'Papers/Magazines projection',
              purpose: 'Serve published Qriptopian PDF papers and magazine issues.',
              owningCartridge: 'qriptopian',
              status: 'live',
              mutating: false,
              authorizationRequired: null,
              invocation: 'GET /api/codex/qripto/papers?group=papers|magazines',
            },
            {
              name: 'Threshold essay machine projection',
              purpose: 'Serve a single Thresholds essay as full canonical text, with distinct reading/research editions where they exist.',
              owningCartridge: 'qriptopian',
              status: 'live',
              mutating: false,
              authorizationRequired: null,
              invocation: 'GET /api/codex/qripto/essays/:slug/machine',
            },
          ],
        },
        {
          cartridge: 'irl-os',
          capabilities: [
            {
              name: 'IRL research overview',
              purpose: 'Public, persona-free summary of IRL research programme state.',
              owningCartridge: 'irl-os',
              status: 'live',
              mutating: false,
              authorizationRequired: null,
              invocation: 'read_public_document(cartridge:"irl-os", id:"research-overview")',
            },
            {
              name: 'Published experiment results',
              purpose: 'Hash-committed, DVN-anchored published results, independently verifiable.',
              owningCartridge: 'irl-os',
              status: 'live',
              mutating: false,
              authorizationRequired: null,
              invocation: 'read_experiment_results (existing Threshold tool)',
            },
            {
              name: 'IRL experiment submission',
              purpose: 'Submit a review/result under an authorized IRL delegation.',
              owningCartridge: 'irl-os',
              status: 'live',
              mutating: true,
              authorizationRequired: 'research.submit capability + IRL submission agreement (crossing required)',
              invocation: 'submit_review (existing Threshold tool, authenticated)',
            },
          ],
        },
        {
          cartridge: 'agentiq-os',
          capabilities: [
            {
              name: 'Registry asset browse/submit',
              purpose: 'Browse published SkillQubes/WorkflowQubes/ConnectorQubes/AigentQubes; submit new ones for review.',
              owningCartridge: 'agentiq-os',
              status: 'live',
              mutating: true,
              authorizationRequired: 'Registered developer session (native cartridge surface, not exposed via this bridge)',
              invocation: 'GET /api/registry/assets, POST /api/registry/intake (native app routes; not a Threshold MCP tool)',
            },
            {
              name: 'Dev/KNYT mission guidance',
              purpose: 'Static step-by-step guidance for registering an AigentQube/SkillQube/WorkflowQube/ConnectorQube.',
              owningCartridge: 'agentiq-os',
              status: 'described-only',
              mutating: false,
              authorizationRequired: null,
              invocation: 'Not wired as an MCP tool — native UI component (DevMissionBoardTab) only.',
            },
          ],
        },
        {
          cartridge: 'polity-core',
          capabilities: [
            {
              name: 'Machine-readable constitution accessor',
              purpose: 'The typed accessor + endpoint for the ratified Constitution and its binding documents.',
              owningCartridge: 'polity-core',
              status: 'live',
              mutating: false,
              authorizationRequired: null,
              invocation: 'GET /api/polity-core/constitution',
            },
            {
              name: 'explain_primitive',
              purpose: 'Define a constitutional primitive constitutional-first from the ratified invariant canon.',
              owningCartridge: 'polity-core',
              status: 'live',
              mutating: false,
              authorizationRequired: null,
              invocation: 'explain_primitive (existing Threshold tool)',
            },
          ],
        },
      ];
      return cartridge ? all.filter((x) => x.cartridge === cartridge) : all;
    },
  };
}
