/**
 * companion_observation_latest — persistence mapping layer.
 *
 * PRD-MMC-IMPL-002 Increment 2 (RATIFIED 2026-07-23).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-002-companion-phase3-implementation-plan.md §3.
 *
 * Mirrors `app/api/companion/observer/_lib/store.ts`'s own shape: this
 * module ONLY translates between DB rows and `BrowserContextObservation`
 * (`types/companionObserver.ts`). It contains NO consent-validation logic —
 * that stays in `services/companion/observerContext.ts`'s
 * `assertObservationRespectsGrants`, called by the route BEFORE this module
 * is ever reached. This file is the thin DB shell underneath that check.
 *
 * ONE row per persona (upsert on conflict) — this is live browsing context,
 * not an audit trail. `persona_id` is T0 (server-internal only — used ONLY
 * to scope the query, never echoed into a response body).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { BrowserContextObservation, ObserverCapability } from '@/types/companionObserver';
import { PAGE_DOCUMENT_EXCERPT_MAX_CHARS } from '@/types/companionObserver';

export const COMPANION_OBSERVATION_LATEST_TABLE = 'companion_observation_latest';

interface ObservationRow {
  granted_capabilities: string[] | null;
  current_tab_domain: string | null;
  current_tab_title: string | null;
  selection_text: string | null;
  page_document_excerpt: string | null;
  observed_at: string;
}

/**
 * Upsert the persona's latest observation. `actualGrantedCapabilities` is the
 * SERVER-COMPUTED list of currently-active capabilities (never the client's
 * own claimed `grantedCapabilities` field) — the honest record of what was
 * actually authorized at write time. Caller MUST have already run
 * `assertObservationRespectsGrants` against the server's own grant state
 * before calling this — this module trusts its caller completely and
 * performs no consent check of its own.
 */
export async function upsertLatestObservation(
  admin: SupabaseClient,
  personaId: string,
  observation: BrowserContextObservation,
  actualGrantedCapabilities: ObserverCapability[],
): Promise<{ error: string | null }> {
  const pageDocumentExcerpt =
    typeof observation.pageDocumentExcerpt === 'string'
      ? observation.pageDocumentExcerpt.slice(0, PAGE_DOCUMENT_EXCERPT_MAX_CHARS)
      : null;

  const { error } = await admin.from(COMPANION_OBSERVATION_LATEST_TABLE).upsert(
    {
      persona_id: personaId,
      granted_capabilities: actualGrantedCapabilities,
      current_tab_domain: observation.currentTabDomain ?? null,
      current_tab_title: observation.currentTabTitle ?? null,
      selection_text: observation.selectionText ?? null,
      page_document_excerpt: pageDocumentExcerpt,
      observed_at: observation.observedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'persona_id' },
  );
  return { error: error?.message ?? null };
}

/**
 * Load the persona's latest observation, mapped back to a
 * `BrowserContextObservation` shape. Returns `null` when no observation has
 * ever been posted for this persona (never mistaken for an empty-but-real
 * observation). A DB error is also treated as "no observation" rather than
 * thrown — fail-closed to "nothing to overlay", mirroring
 * `loadGrantState`'s own fail-closed-to-empty precedent.
 */
export async function loadLatestObservation(
  admin: SupabaseClient,
  personaId: string,
): Promise<BrowserContextObservation | null> {
  const { data, error } = await admin
    .from(COMPANION_OBSERVATION_LATEST_TABLE)
    .select('granted_capabilities, current_tab_domain, current_tab_title, selection_text, page_document_excerpt, observed_at')
    .eq('persona_id', personaId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as ObservationRow;

  return {
    grantedCapabilities: Array.isArray(row.granted_capabilities)
      ? (row.granted_capabilities as ObserverCapability[])
      : [],
    ...(row.current_tab_domain ? { currentTabDomain: row.current_tab_domain } : {}),
    ...(row.current_tab_title ? { currentTabTitle: row.current_tab_title } : {}),
    ...(row.selection_text ? { selectionText: row.selection_text } : {}),
    ...(row.page_document_excerpt ? { pageDocumentExcerpt: row.page_document_excerpt } : {}),
    observedAt: row.observed_at,
  };
}
