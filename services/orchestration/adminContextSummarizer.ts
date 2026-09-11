/**
 * adminContextSummarizer — admin-tier context strings for the
 * aigentMe recommender pipeline.
 *
 * When a persona is admin of a cartridge, the brief / move-forward /
 * specialist recommender should consider admin-tier signals (pending
 * approvals, open work, partnership pipeline state) in addition to
 * the persona's own surface-tier data. Without this, aigentMe gives
 * the same recommendations to a Marketa-admin and a Marketa-partner
 * — missing the chief-of-staff payoff the spine extension unlocked.
 *
 * This module owns the admin-tier signal aggregation. It returns a
 * single string that gets folded into the existing `liveContext` seam
 * the Capability Gateway preflight already wired (so we don't fork
 * yet another LLM prompt channel).
 *
 * Today (v1) returns lightweight summaries derived from existing
 * read-side helpers — intent queue counts, recent receipts, etc. As
 * each admin surface ships richer state (KNYT KPIs, Marketa pipeline,
 * Qripto promotion queue), point the cartridge-specific summarizer
 * at the real data source. Single hook point per cartridge.
 *
 * Privacy posture
 * ---------------
 *   - Input is the persona's resolved adminCartridges set (T1 slugs)
 *     plus personaId (T0 server-internal). No client claim trusted.
 *   - Output is a free-form string fed into the LLM prompt. NEVER
 *     include T0 ids (personaId, authProfileId, kybeDid, tenant ids)
 *     in the summary text — the LLM call may log, the receipt may
 *     surface this on the wire.
 *   - When an underlying data source returns no rows OR throws, the
 *     summarizer omits that cartridge's line silently. Recommender
 *     keeps working — the admin slice is best-effort enrichment.
 */
import { listRecentIntentsForPersona } from '@/services/iqube/intentQube';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';

/**
 * Build a multi-line string summarising the persona's admin scope.
 * Returns null when the persona admins no cartridges OR every
 * cartridge summarizer no-ops. Recommender treats null as "no
 * admin-tier signal" and stays on the deterministic baseline.
 */
export async function summarizeCartridgeAdminContext(
  personaId: string,
  adminCartridges: string[],
  isGlobalAdmin: boolean,
): Promise<string | null> {
  if (!personaId) return null;
  if (!isGlobalAdmin && adminCartridges.length === 0) return null;

  // Global admins get a brief acknowledgement of scope. Otherwise we
  // walk the explicit cartridge grants. v1 doesn't enumerate every
  // cartridge for global admins because the LLM prompt budget is
  // finite and "global admin" itself is the most important signal
  // for ranking — knowing WHICH cartridges they admin doesn't change
  // the ranking calculus until the cartridge-specific summarizers
  // grow real content.
  const lines: string[] = [];
  if (isGlobalAdmin) {
    lines.push(
      'AdminScope: persona is a global (uber/platform-tier) admin. Treat operational signals across every cartridge as elevated context. Bias recommendations toward orchestration / oversight moves when ties exist.',
    );
  } else {
    lines.push(
      `AdminScope: persona admins cartridges: ${adminCartridges.join(', ')}. Bias recommendations toward chief-of-staff moves (review queues, partner ops, content-pipeline state) on these surfaces when ties exist.`,
    );
  }

  // Per-cartridge lightweight summaries. Each summarizer is independent
  // — one failure doesn't cascade. Wrap each in Promise.allSettled so
  // a slow/erroring source doesn't block the recommender.
  const summarizableSlugs = isGlobalAdmin
    ? []  // Skip per-cartridge fanout for global admins to keep prompts compact
    : adminCartridges;

  if (summarizableSlugs.length > 0) {
    const results = await Promise.allSettled(
      summarizableSlugs.map((slug) => summarizeCartridge(personaId, slug)),
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) lines.push(r.value);
    }
  }

  if (lines.length === 0) return null;
  return lines.join('\n');
}

async function summarizeCartridge(
  personaId: string,
  cartridgeSlug: string,
): Promise<string | null> {
  // Per-cartridge dispatch. v1 returns a generic "queue depth" sketch
  // from the persona's own intent log; the persona-scoped query is a
  // weak proxy for cartridge-wide queue depth but it's the best we
  // can do until cartridge-scoped admin reads (e.g. listPendingApprovalsForCartridge)
  // ship as named endpoints. Replace the body of each branch with a
  // cartridge-specific reader as it lands. Single hook point per cartridge.
  switch (cartridgeSlug) {
    case 'knyt-codex':
      return summarizeKnyt(personaId);
    case 'marketa':
      return summarizeMarketa(personaId);
    case 'qripto':
      return summarizeQripto(personaId);
    default:
      return null;
  }
}

async function summarizeKnyt(personaId: string): Promise<string | null> {
  try {
    const intents = await listRecentIntentsForPersona(personaId, {
      limit: 20,
      cartridge: 'knyt',
    });
    if (!intents || intents.length === 0) return null;
    const pendingApproval = intents.filter((i) =>
      typeof i.status === 'string' && /pending|awaiting/i.test(i.status),
    ).length;
    const inProgress = intents.filter((i) =>
      typeof i.status === 'string' && /in[_\s-]?progress|running/i.test(i.status),
    ).length;
    return `KNYT admin signal: ${intents.length} recent intents (${pendingApproval} awaiting approval, ${inProgress} in progress).`;
  } catch {
    return null;
  }
}

async function summarizeMarketa(personaId: string): Promise<string | null> {
  try {
    const intents = await listRecentIntentsForPersona(personaId, {
      limit: 20,
      cartridge: 'marketa',
    });
    if (!intents || intents.length === 0) return null;
    // Marketa intents lean toward campaign / outreach motions; the
    // count is the simplest signal for "how much is in flight".
    const inFlight = intents.filter((i) =>
      typeof i.status === 'string' && !/done|complete|fail/i.test(i.status),
    ).length;
    return `Marketa admin signal: ${inFlight} active campaign / outreach intents on the wire.`;
  } catch {
    return null;
  }
}

async function summarizeQripto(personaId: string): Promise<string | null> {
  try {
    // Qripto admin focuses on editorial pipeline. Until a dedicated
    // queue reader lands, we surface the persona's recent
    // specialist_consulted receipts in this cartridge — proxy for
    // "active editorial engagement".
    const receipts = await listActivityReceiptsForPersona(personaId, {
      limit: 10,
      cartridge: 'qriptopian',
      actionTypes: ['specialist_consulted', 'artifact_created'],
    });
    if (!receipts || receipts.length === 0) return null;
    return `Qripto admin signal: ${receipts.length} recent editorial / specialist activity events on this cartridge.`;
  } catch {
    return null;
  }
}
