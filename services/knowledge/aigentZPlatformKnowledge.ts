/**
 * aigentZ Platform Knowledge — assembles platform-level breadth + depth for
 * the aigent-z Dev Command Center copilot (app/api/codex/chat/route.ts).
 *
 * Sources, layered cheapest-first:
 *   1. Static platform map — repo layout, architecture layers, the three
 *      core iQube Registries, ingestion factory pipeline, network ops
 *      surface. Always included (compact).
 *   2. AgentiQ pack retrieval — keyword search over the aigency + agentiq
 *      codex packs (memory / knowledge / operations content) via the shared
 *      agentiqPackSearch module. Always included when the query matches.
 *   3. Repo file access — when the query names a repo path, the file is
 *      inlined from disk (clamped); when not on disk (Lambda tracing), the
 *      GitHub blob link is provided instead.
 *   4. Registry snapshot — live Supabase counts from the ingestion factory
 *      (registry_intakes / registry_assets) + the iQube trinity registries
 *      (iq_meta_qubes / iq_blak_qubes / iq_token_qubes). Keyword-gated.
 *   5. Network ops snapshot — live DVN + cross-chain status fetched from
 *      the same /api/ops routes that back the Network Ops page. Keyword-
 *      gated, best-effort with a short timeout.
 *
 * Every fetch is best-effort: a failed source degrades to a one-line note,
 * never an exception — the chat turn must not fail because telemetry did.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { corpusReadFile } from './packCorpusStore';
import {
  searchCodex,
  getRecentCommits,
  buildCodexExcerptsBlock,
  ensureCorpusHydrated,
  buildRecentCommitsBlock,
  GITHUB_BLOB_BASE,
} from './agentiqPackSearch';

// ============================================================================
// 1. Static platform map (always injected — keep compact)
// ============================================================================

const PLATFORM_MAP = `## Platform Map — repo, registries, network (canonical reference)

### Repo layout (GitHub: ${GITHUB_BLOB_BASE})
- \`app/api/\` — Next.js API routes (server-side only; ~400+ routes)
- \`app/triad/components/codex/tabs/\` — cartridge tab components
- \`components/ui|composer|registry|ops/\` — shared UI primitives
- \`services/\` — backend services (identity spine, access, dvn, registry, knowledge)
- \`data/codex-configs.ts\` — hand-curated cartridge definitions; \`data/activation-catalog.ts\` — activation cards
- \`codexes/packs/\` — markdown knowledge packs (agentiq = cartridge KB incl. memory/decisions/updates; aigency = engineering KB incl. architecture/knowledge/operators manual)
- \`types/\` — canonical type contracts (access.ts, orchestration.ts, devCommandCenter.ts, registryIngestion.ts)
- Architecture layers: Context (RAG/iQube content) · Service (API routes, Supabase, wallet) · State (ICP canisters, EVM, Supabase)

### The three core iQube Registries
1. **Template registry (MetaQubes)** — \`iq_meta_qubes\`: public metadata for iQube templates (name, series, tags, preview). Read via \`GET /api/registry/assets\` and the iQube Registry UI (\`components/registry/\`).
2. **Instance registry (BlakQubes + TokenQubes)** — \`iq_blak_qubes\` (encrypted payload pointers: Autonomys auto-drive CID, encryption alg/IV) + \`iq_token_qubes\` (wrapped AES keys + access policy). Trinity created by \`server/services/iqRegistryService.ts\`; content encrypted/uploaded by \`server/services/autonomysContentService.ts\`.
3. **Capability registry (Ingestion Factory supply)** — \`registry_assets\`: published AigentQube / ToolQube / SkillQube / WorkflowQube / ConnectorQube assets with trust bands L1_EXPERIMENTAL → L5_CORE_SOVEREIGN. Read via \`GET /api/registry/assets\`; UI = RegistrySupplyTab ("Registry" tab, registry group of the AgentiQ cartridge).

### Ingestion Factory (intake → publish pipeline)
- Tables: \`registry_intakes\` (queue) → \`registry_sources\` → \`registry_validations\` → \`registry_trust_scores\` → \`registry_publications\` → \`registry_assets\`; receipts in \`registry_receipts\`.
- Stages: intake.created → source.fetched → classified → packaged → validation.running → trust.scored → review.pending → asset.published (or ingestion.failed).
- Source types: github_repo, package_ref, mcp_endpoint, archive, manual_bundle, workflow_def.
- Service: \`services/registry/intakeService.ts\` + \`services/registry/persistence.ts\`; routes \`POST/GET /api/registry/intake\`; UI = FactoryIntakeTab ("Factory" tab).

### AgentiQ Cartridge as repo map
Tab groups: agentz (Dev Command Center) · development (Architecture, Codebase, Changelog, PR Briefs, Recent Commits) · memory (Knowledge, Decisions, Updates, Retrieval Index) · registry (Factory, Registry) · governance (Constitution, Roles, Decision Log, Authority Matrix, Receipts) · operations (Operators Manual) · ecosystem. Content loads from \`codexes/packs/\` via \`GET /api/codex/packs/{packId}/file?path={itemPath}\`.

### Network Ops surface (you have admin visibility here)
- Page: \`/ops\` (\`app/(shell)/ops/page.tsx\`) — DVN, ICP canister health/cycles, BTC + EVM testnets (Sepolia, Amoy, Optimism, Arbitrum, Base), Solana, QCT trading/treasury, A2A, DiDQube identity cards.
- Routes: \`GET /api/ops/dvn/status\` (pending cross-chain messages, lock state, latest EVM tx + ICP receipt) · \`/api/ops/icp/health/[canister]\` · \`/api/ops/crosschain/status\` · \`/api/ops/btc/status\` · per-chain routes under \`/api/ops/\`.
- DVN pipeline (\`services/dvn/activityReceiptDvnPipeline.ts\`) anchors activity receipts on-chain: local → dvn_pending → dvn_recorded / dvn_failed. dvn_failed receipts are provenance gaps — escalate, never dismiss.

When referencing any repo file, format it as a markdown link: [path](${GITHUB_BLOB_BASE}/<path>).`;

// ============================================================================
// 3. Repo file access — inline files the query names
// ============================================================================

/** Path-like tokens: at least one slash + a known source/doc extension. */
const FILE_PATH_RE = /[\w@.\-]+(?:\/[\w@.\-]+)+\.(?:ts|tsx|js|jsx|mjs|json|md|sql|sh|py|css|yml|yaml)\b/g;

const FORBIDDEN_PATH_RE = /(^|\/)\.env|(^|\/)\.git\/|secret|credential|\.pem\b/i;

const FILE_CONTENT_CLAMP = 6_000;
const MAX_INLINE_FILES = 2;

function buildRepoFileBlock(query: string): string {
  const matches = Array.from(new Set(query.match(FILE_PATH_RE) ?? []));
  if (matches.length === 0) return '';

  const sections: string[] = [];
  let inlined = 0;

  for (const rel of matches) {
    if (FORBIDDEN_PATH_RE.test(rel)) continue;
    const abs = path.join(process.cwd(), rel);
    // Guard traversal: resolved path must stay inside the repo root
    if (!abs.startsWith(process.cwd() + path.sep)) continue;

    const githubUrl = `${GITHUB_BLOB_BASE}/${rel}`;
    let content: string | null = null;
    if (inlined < MAX_INLINE_FILES) {
      if (rel.startsWith('codexes/packs/')) {
        // Pack .md bodies live in the corpus store (remote in the Lambda). The
        // caller (buildAigentZPlatformKnowledge) has already hydrated it.
        content = corpusReadFile(abs);
      } else {
        try {
          const stat = fs.statSync(abs);
          if (stat.isFile()) content = fs.readFileSync(abs, 'utf8');
        } catch {
          content = null; // not on disk (e.g. untraced in Lambda) — link only
        }
      }
    }

    if (content !== null) {
      inlined += 1;
      const clamped =
        content.length > FILE_CONTENT_CLAMP
          ? content.slice(0, FILE_CONTENT_CLAMP) + '\n...[truncated]'
          : content;
      sections.push(`### [${rel}](${githubUrl})\n\`\`\`\n${clamped}\n\`\`\``);
    } else {
      sections.push(`### [${rel}](${githubUrl})\nFile not available on this server — read it via the GitHub link above.`);
    }
  }

  if (sections.length === 0) return '';
  return `## Repo Files Referenced in the Query\n\n${sections.join('\n\n')}`;
}

// ============================================================================
// 4. Registry snapshot (keyword-gated, live Supabase)
// ============================================================================

const REGISTRY_KEYWORDS = /registry|registries|intake|ingestion|factory|iqube|metaqube|blakqube|tokenqube|trust band|asset class|toolqube|skillqube|workflowqube|aigentqube|connectorqube|supply/i;

async function buildRegistrySnapshot(): Promise<string> {
  const supabase = getSupabaseServer();
  if (!supabase) return '## Registry Snapshot\n\nUnavailable — Supabase server client not configured.';

  const lines: string[] = ['## Registry Snapshot (live)'];

  try {
    const [intakes, assets, meta, blak, token] = await Promise.all([
      supabase.from('registry_intakes').select('status').limit(500),
      supabase
        .from('registry_assets')
        .select('name,asset_class,trust_band,publication_status,updated_at')
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase.from('iq_meta_qubes').select('id', { count: 'exact', head: true }),
      supabase.from('iq_blak_qubes').select('id', { count: 'exact', head: true }),
      supabase.from('iq_token_qubes').select('id', { count: 'exact', head: true }),
    ]);

    if (!intakes.error && intakes.data) {
      const byStatus = new Map<string, number>();
      for (const r of intakes.data as Array<{ status: string }>) {
        byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
      }
      const summary = Array.from(byStatus.entries())
        .map(([s, n]) => `${s}: ${n}`)
        .join(', ');
      lines.push(`- Ingestion factory intakes (${intakes.data.length} total): ${summary || 'none'}`);
    }

    if (!assets.error && assets.data) {
      const byBand = new Map<string, number>();
      for (const r of assets.data as Array<{ trust_band: string }>) {
        byBand.set(r.trust_band, (byBand.get(r.trust_band) ?? 0) + 1);
      }
      const bandSummary = Array.from(byBand.entries())
        .map(([b, n]) => `${b}: ${n}`)
        .join(', ');
      lines.push(`- Published registry assets (${assets.data.length} most recent): ${bandSummary || 'none'}`);
      const recent = (assets.data as Array<{ name: string; asset_class: string; trust_band: string; publication_status: string }>).slice(0, 5);
      for (const a of recent) {
        lines.push(`  - ${a.name} [${a.asset_class}] ${a.trust_band} (${a.publication_status})`);
      }
    }

    const counts: string[] = [];
    if (!meta.error && typeof meta.count === 'number') counts.push(`MetaQubes: ${meta.count}`);
    if (!blak.error && typeof blak.count === 'number') counts.push(`BlakQubes: ${blak.count}`);
    if (!token.error && typeof token.count === 'number') counts.push(`TokenQubes: ${token.count}`);
    if (counts.length > 0) lines.push(`- iQube trinity registries: ${counts.join(', ')}`);
  } catch (err) {
    lines.push(`- Snapshot failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return lines.join('\n');
}

// ============================================================================
// 4b. Autodrive / media holdings snapshot (keyword-gated, live Supabase)
// ============================================================================

const AUTODRIVE_KEYWORDS = /autodrive|auto.?drive|autonomys|cid\b|media asset|stored content|content storage|master content/i;

async function buildAutodriveSnapshot(): Promise<string> {
  const supabase = getSupabaseServer();
  if (!supabase) return '';

  const lines: string[] = ['## Autodrive / Media Holdings Snapshot (live)'];

  try {
    const [assets, masters] = await Promise.all([
      supabase
        .from('codex_media_assets')
        .select('title,asset_kind,mime_type,auto_drive_cid,created_at')
        .order('created_at', { ascending: false })
        .limit(15),
      supabase.from('master_content_qubes').select('*', { count: 'exact', head: true }),
    ]);

    if (!assets.error && assets.data) {
      lines.push(`- ${assets.data.length} most recent codex_media_assets rows:`);
      for (const a of assets.data as Array<{ title: string; asset_kind: string; mime_type: string; auto_drive_cid: string | null }>) {
        lines.push(`  - ${a.title} [${a.asset_kind}, ${a.mime_type}]${a.auto_drive_cid ? ` cid=${a.auto_drive_cid}` : ''}`);
      }
    }
    if (!masters.error && typeof masters.count === 'number') {
      lines.push(`- master_content_qubes total: ${masters.count}`);
    }
    lines.push(
      '- Gated content rules: Autonomys-hosted bytes are encrypted and must only reach operators through the in-app viewers (PDFPageViewer via /api/content/pdf-page/[cid], VideoPlayer). Never surface raw storage URLs or suggest opening gated files in new tabs.',
    );
  } catch (err) {
    lines.push(`- Snapshot failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return lines.join('\n');
}

// ============================================================================
// 5. Network ops snapshot (keyword-gated, live /api/ops fetch)
// ============================================================================

const OPS_KEYWORDS = /network|dvn|canister|chain|anchor|ops\b|icp\b|bitcoin|btc\b|ethereum|sepolia|solana|polygon|amoy|cross.?chain|cycles|receipt|provenance|testnet|mainnet|layerzero/i;

const OPS_FETCH_TIMEOUT_MS = 6_000;

async function fetchOpsJson(origin: string, route: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${origin}${route}`, {
      signal: AbortSignal.timeout(OPS_FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function buildNetworkOpsSnapshot(origin: string): Promise<string> {
  const lines: string[] = ['## Network Ops Snapshot (live, from /api/ops)'];

  const [dvn, crosschain] = await Promise.all([
    fetchOpsJson(origin, '/api/ops/dvn/status'),
    fetchOpsJson(origin, '/api/ops/crosschain/status'),
  ]);

  if (dvn) {
    lines.push(
      `- DVN: ${dvn.ok ? 'OK' : 'DEGRADED'}${dvn.mockMode ? ' (mock mode)' : ''} — lock: ${dvn.lockStatus ?? 'unknown'}, pending messages: ${dvn.pendingMessages ?? 'unknown'}, canister: ${dvn.canisterId ?? 'unknown'}`,
    );
    if (dvn.evmTx) lines.push(`  - Latest EVM tx: ${dvn.evmTx}; ICP receipt: ${dvn.icpReceipt ?? 'n/a'}`);
  } else {
    lines.push('- DVN status: unreachable from this server right now.');
  }

  if (crosschain) {
    lines.push(`- Cross-chain: ${crosschain.ok ? 'OK' : 'DEGRADED'} ${JSON.stringify(crosschain.data ?? crosschain.status ?? '').slice(0, 300)}`);
  } else {
    lines.push('- Cross-chain status: unreachable from this server right now.');
  }

  lines.push('- Full live dashboard: the /ops Network Ops page (DVN, ICP health/cycles, BTC + EVM testnets, Solana, QCT, A2A, DiDQube).');
  return lines.join('\n');
}

// ============================================================================
// Orchestrator
// ============================================================================

/**
 * Build the full platform-knowledge block for an aigent-z chat turn.
 * `origin` is the request origin (for internal /api/ops fetches).
 */
export async function buildAigentZPlatformKnowledge(query: string, origin: string): Promise<string> {
  const blocks: string[] = [PLATFORM_MAP];

  // Pack retrieval — keyword search over the corpus (local FS in dev; remote
  // in-memory corpus hydrated once per container in the SSR Lambda).
  try {
    await ensureCorpusHydrated();
    const results = searchCodex(query, 5);
    const excerpts = buildCodexExcerptsBlock(results);
    if (excerpts) blocks.push(excerpts);
    const commits = buildRecentCommitsBlock(getRecentCommits(10));
    if (commits) blocks.push(commits);
  } catch {
    // pack dirs unavailable — platform map still stands
  }

  // Repo files named in the query
  try {
    const fileBlock = buildRepoFileBlock(query);
    if (fileBlock) blocks.push(fileBlock);
  } catch {
    // fs unavailable — skip
  }

  // Live snapshots, keyword-gated and fetched in parallel
  const wantsRegistry = REGISTRY_KEYWORDS.test(query);
  const wantsAutodrive = AUTODRIVE_KEYWORDS.test(query);
  const wantsOps = OPS_KEYWORDS.test(query);
  if (wantsRegistry || wantsAutodrive || wantsOps) {
    const [registry, autodrive, ops] = await Promise.all([
      wantsRegistry ? buildRegistrySnapshot() : Promise.resolve(''),
      wantsAutodrive ? buildAutodriveSnapshot() : Promise.resolve(''),
      wantsOps ? buildNetworkOpsSnapshot(origin) : Promise.resolve(''),
    ]);
    if (registry) blocks.push(registry);
    if (autodrive) blocks.push(autodrive);
    if (ops) blocks.push(ops);
  }

  return `\n\n# Platform Knowledge — aigentZ ground truth (repo + registries + network)\n\n${blocks.join('\n\n')}`;
}
