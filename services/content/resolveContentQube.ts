/**
 * resolveContentQube — thin wrapper over evaluateAccess that resolves a
 * ContentQube to a browser-safe DisplayManifest with persona_owns set.
 *
 * Phase 4 of the ContentQube integration.
 *
 * Resolution strategy:
 *   1. Read the v_content_qube_registry VIEW row.
 *   2. If no persona context is provided → persona_owns = false, return manifest.
 *   3. If the row is bridged (master_qube_id or media_asset_id set):
 *      → call getContentDescriptor(assetId) to get the full descriptor
 *      → call evaluateAccess(persona, descriptor, 'read')
 *   4. If the row is un-bridged (Phase 6 pilot not yet run):
 *      → synthesize a minimal ContentAccessDescriptor from the access policy row
 *      → call evaluateAccess with the synthesized descriptor
 *   5. Build and return the DisplayManifest with persona_owns from the decision.
 *
 * Privacy contract:
 *   - ActivePersonaContext (T0) never leaves this function.
 *   - The returned ResolvedContentQube carries no T0 fields.
 *   - Storage URLs are not included in the manifest — delivery goes
 *     through the existing content proxy routes (Phase 2.3+).
 *
 * See: services/access/evaluateAccess.ts, services/content/getContentDescriptor.ts
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getContentDescriptor } from '@/services/content/getContentDescriptor';
import { evaluateAccess } from '@/services/access/evaluateAccess';
import { emitContentQubeReceipt } from '@/services/access/contentQubeReceiptEmitter';
import {
  buildDisplayManifest,
  buildEditionSummary,
  synthesizeContentState,
  synthesizeGatingDescriptor,
  toContentClass,
  type RegistryViewRow,
} from '@/services/content/buildDisplayManifest';
import type { ActivePersonaContext, AccessDecision, ContentAccessDescriptor } from '@/types/access';
import type { ContentQubeDisplayManifest, ContentQubeEditionSummary } from '@/types/contentQube';

// ─────────────────────────────────────────────────────────────────────────
// Return shape
// ─────────────────────────────────────────────────────────────────────────

export interface ResolvedContentQube {
  manifest: ContentQubeDisplayManifest;
  editionSummary: ContentQubeEditionSummary;
  codexSlugs: string[];
  /** The access decision — null when no persona context was supplied. */
  decision: AccessDecision | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Descriptor resolution
// ─────────────────────────────────────────────────────────────────────────

async function resolveDescriptor(row: RegistryViewRow): Promise<ContentAccessDescriptor> {
  // Bridged row — prefer the canonical descriptor from the existing tables.
  const bridgeId = row.master_qube_id ?? row.media_asset_id;
  if (bridgeId) {
    const descriptor = await getContentDescriptor(bridgeId);
    if (descriptor) return descriptor;
  }

  // Un-bridged (Phase 6 pilot not yet run) or getContentDescriptor returned
  // null (e.g. row deleted from master table). Synthesize from the policy.
  return {
    assetId: row.id,
    contentClass: toContentClass(row),
    state: synthesizeContentState(row),
    gating: synthesizeGatingDescriptor(row),
    receiptEligible: (row.gating_kind ?? 'free') !== 'free',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

/**
 * Resolve a ContentQube to a DisplayManifest.
 *
 * @param contentQubeId  UUID of the content_qubes row.
 * @param persona        Active persona context (T0). Pass null for unauthenticated reads.
 * @returns Resolved qube, or null if the id is not found.
 */
export async function resolveContentQube(
  contentQubeId: string,
  persona: ActivePersonaContext | null,
): Promise<ResolvedContentQube | null> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    console.error('[resolveContentQube] Supabase unavailable');
    return null;
  }

  const { data, error } = await supabase
    .from('v_content_qube_registry')
    .select('*')
    .eq('id', contentQubeId)
    .maybeSingle<RegistryViewRow>();

  if (error) {
    console.warn(
      `[resolveContentQube] view error id=${contentQubeId} ` +
      `code=${error.code ?? '?'} msg=${error.message ?? '?'}`,
    );
    return null;
  }
  if (!data) return null;

  // No persona — return a manifest with persona_owns conservatively false.
  if (!persona) {
    return {
      manifest: buildDisplayManifest(data, false),
      editionSummary: buildEditionSummary(data),
      codexSlugs: data.codex_slugs ?? [],
      decision: null,
    };
  }

  // Persona present — evaluate access to set persona_owns.
  const descriptor = await resolveDescriptor(data);
  const decision = await evaluateAccess(persona, descriptor, 'read');

  // Phase 5 — emit a ContentQube-scoped DVN receipt alongside the platform-
  // wide orchestration_events row written by evaluateAccess. Skipped for
  // free reads (receipt.mode === 'none') inside the emitter.
  await emitContentQubeReceipt({
    contentQubeId: contentQubeId,
    descriptor,
    action: 'read',
    decision,
  });

  return {
    manifest: buildDisplayManifest(data, decision.allow),
    editionSummary: buildEditionSummary(data),
    codexSlugs: data.codex_slugs ?? [],
    decision,
  };
}

/**
 * Resolve multiple ContentQubes in a single batch (e.g. for a tab that
 * renders a grid of episodes or characters). Uses Promise.all — all reads
 * run in parallel. Returns null slots for ids that were not found.
 */
export async function resolveContentQubes(
  contentQubeIds: string[],
  persona: ActivePersonaContext | null,
): Promise<(ResolvedContentQube | null)[]> {
  return Promise.all(contentQubeIds.map((id) => resolveContentQube(id, persona)));
}

/**
 * Resolve all ContentQubes for a given series (e.g. 'metaKnyts'), ordered
 * by display_number. Useful for rendering a full episode list with per-item
 * persona_owns flags resolved server-side.
 */
export async function resolveContentQubesBySeries(
  series: string,
  persona: ActivePersonaContext | null,
  opts: { contentKind?: string; lifecycleState?: string } = {},
): Promise<ResolvedContentQube[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  let query = supabase
    .from('v_content_qube_registry')
    .select('*')
    .eq('series', series)
    .order('display_number', { ascending: true, nullsFirst: false });

  if (opts.contentKind) {
    query = query.eq('content_kind', opts.contentKind);
  }
  if (opts.lifecycleState) {
    query = query.eq('lifecycle_state', opts.lifecycleState);
  }

  const { data, error } = await query.returns<RegistryViewRow[]>();
  if (error || !data) {
    console.warn(`[resolveContentQubesBySeries] error series=${series}`, error?.message);
    return [];
  }

  // Resolve access for all rows in parallel.
  const resolved = await Promise.all(
    data.map(async (row) => {
      if (!persona) {
        return {
          manifest: buildDisplayManifest(row, false),
          editionSummary: buildEditionSummary(row),
          codexSlugs: row.codex_slugs ?? [],
          decision: null,
        } satisfies ResolvedContentQube;
      }
      const descriptor = await resolveDescriptor(row);
      const decision = await evaluateAccess(persona, descriptor, 'read');
      await emitContentQubeReceipt({
        contentQubeId: row.id,
        descriptor,
        action: 'read',
        decision,
      });
      return {
        manifest: buildDisplayManifest(row, decision.allow),
        editionSummary: buildEditionSummary(row),
        codexSlugs: row.codex_slugs ?? [],
        decision,
      } satisfies ResolvedContentQube;
    }),
  );

  return resolved;
}
