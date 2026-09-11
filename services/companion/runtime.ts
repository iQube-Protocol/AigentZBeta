/**
 * metaMe Companion — runtime resolver (PRD-MMC-001, RATIFIED 2026-07-22).
 *
 * Composes EXISTING spine surfaces into one `resolveCompanionContext()` for
 * any presentation surface. COMPOSITION ONLY (PRD §0, §5; CLAUDE.md "Don't
 * rebuild these"):
 *   - identity      → GET /api/wallet/active-persona (the spine's T1 surface)
 *                     via `personaFetch` — never a parallel resolver, never
 *                     raw fetch, never authedFetchHeaders.
 *   - deep links    → `buildCodexUrl()` (`utils/codex-nav.ts`) — the
 *                     canonical helper, never a second link builder.
 *   - feed/timeline → GET /api/assistant/receipts (existing read; the
 *                     receipt writer + DVN pipeline are untouched), PLUS
 *                     (PRD-MMC-IMPL-002 §3 Increment 3, "Universal
 *                     Notifications") GET /api/companion/notifications —
 *                     delegation status transitions and a "standing
 *                     increased" comparison, folded into the SAME feed as
 *                     tagged (`isNotification`) items. See
 *                     `mapNotificationsToFeed` below; the route itself is
 *                     the server hop this client-side module needs to reach
 *                     the service-role-only `delegationGrantStore` /
 *                     `computeStandingScore` reads.
 *
 * Client-side module: presentation surfaces are client-mounted; every spine
 * call goes through `personaFetch` per CLAUDE.md "Client-side spine fetches"
 * (PARAMOUNT), with the surface's `personaIdHint` threaded so all reads
 * resolve the SAME persona.
 *
 * NO BROWSER OBSERVATION (PRD §6 Phase 1 / §4): nothing here reads tabs,
 * pages, selections, history, or clipboard. The Observer / Context Engine
 * is Phase 2+, gated on §4 ratification, and is not stubbed here.
 */

import { personaFetch } from '@/utils/personaSpine';
import { buildCodexUrl } from '@/utils/codex-nav';
import type {
  CompanionDeepLink,
  CompanionFeedItem,
  CompanionRuntimeContext,
  CompanionSurfaceKind,
} from '@/types/companion';

// ─── Deep links (pure — PRD component 11 EXTENDS buildCodexUrl) ─────────────

/**
 * Resolve a CompanionDeepLink to a URL via the canonical helper.
 * Identity propagates as the T1 `personaSessionToken` (`?pst=`) ONLY —
 * this dispatcher never places a raw persona UUID on a Companion link.
 */
export function buildCompanionDeepLinkUrl(
  link: CompanionDeepLink,
  identity?: { personaSessionToken?: string },
): string {
  return buildCodexUrl(link.slug, {
    personaSessionToken: identity?.personaSessionToken,
    tab: link.tab,
    shell: link.shell,
    from: link.from,
    fromTab: link.fromTab,
  });
}

// ─── Feed mapping (pure — Timeline as a READ over existing receipts) ────────

/**
 * Receipt `actionType` values that are notification-class rather than
 * generic receipted activity (PRD-MMC-IMPL-002 §3 Increment 3). Re-tags an
 * item `mapReceiptsToFeed` was already going to emit — never a second read
 * of the receipts endpoint, and never a new receipt type.
 */
const NOTIFICATION_ACTION_TYPES: ReadonlySet<string> = new Set(['passport_status_changed']);

/**
 * Project already-browser-serialised receipt rows (the exact payload
 * `GET /api/assistant/receipts` returns) into CompanionFeedItems. Defensive
 * and lossy BY DESIGN: only the whitelisted T1 fields survive — anything
 * else on the receipt row is dropped, so a future receipt-shape change can
 * never widen what a Companion surface carries.
 */
export function mapReceiptsToFeed(receipts: unknown): CompanionFeedItem[] {
  if (!Array.isArray(receipts)) return [];
  const items: CompanionFeedItem[] = [];
  for (const raw of receipts) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : undefined;
    const occurredAt = typeof r.createdAt === 'string' ? r.createdAt : undefined;
    if (!id || !occurredAt) continue;
    const kind = typeof r.actionType === 'string' ? r.actionType : 'activity';
    items.push({
      id,
      kind,
      title: typeof r.summary === 'string' ? r.summary : '(no summary)',
      occurredAt,
      ...(typeof r.activeCartridge === 'string' && r.activeCartridge
        ? { cartridge: r.activeCartridge }
        : {}),
      ...(NOTIFICATION_ACTION_TYPES.has(kind) ? { isNotification: true } : {}),
    });
  }
  return items;
}

/** Human-readable label for a delegation status transition. */
function delegationStatusTitle(status: string): string {
  switch (status) {
    case 'active':
      return 'Delegation active';
    case 'revoked':
      return 'Delegation revoked';
    case 'expired':
      return 'Delegation expired';
    default:
      return `Delegation ${status}`;
  }
}

/**
 * Project `GET /api/companion/notifications`'s response into
 * CompanionFeedItems — delegation status transitions and a "standing
 * increased" item, both tagged `isNotification: true` (PRD-MMC-IMPL-002 §3
 * Increment 3). Defensive and lossy by the same discipline as
 * `mapReceiptsToFeed`: only whitelisted T1 fields survive.
 *
 * `resolvedAt` backstops `occurredAt` for the `standing_increased` item,
 * which has no single underlying event timestamp — a score increase is
 * DETECTED at resolution time, not dated to a specific moment ("observed,
 * never asserted").
 */
export function mapNotificationsToFeed(data: unknown, resolvedAt: string): CompanionFeedItem[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  const items: CompanionFeedItem[] = [];

  const delegation = d.delegation as Record<string, unknown> | null | undefined;
  if (
    delegation &&
    typeof delegation.grantId === 'string' &&
    typeof delegation.status === 'string'
  ) {
    const occurredAt =
      (typeof delegation.updatedAt === 'string' && delegation.updatedAt) ||
      (typeof delegation.createdAt === 'string' && delegation.createdAt) ||
      resolvedAt;
    items.push({
      id: `delegation-status:${delegation.grantId}:${delegation.status}`,
      kind: 'delegation_status',
      title: delegationStatusTitle(delegation.status),
      occurredAt,
      isNotification: true,
    });
  }

  const standing = d.standing as Record<string, unknown> | null | undefined;
  if (standing && standing.increased === true && typeof standing.currentScore === 'number') {
    const previousScore =
      typeof standing.previousScore === 'number' ? standing.previousScore : null;
    items.push({
      id: `standing-increased:${resolvedAt}`,
      kind: 'standing_increased',
      title:
        previousScore !== null
          ? `Standing increased (${previousScore} → ${standing.currentScore})`
          : `Standing increased to ${standing.currentScore}`,
      occurredAt: resolvedAt,
      isNotification: true,
    });
  }

  return items;
}

// ─── The resolver ───────────────────────────────────────────────────────────

export interface ResolveCompanionContextOptions {
  surface: CompanionSurfaceKind;
  /**
   * The surface's active persona hint (embed prop / bridge), threaded to
   * every spine read per CLAUDE.md so all reads resolve the SAME persona.
   */
  personaIdHint?: string;
  /** Fetch the Phase 1 read-over-receipts feed (default true). */
  includeFeed?: boolean;
  /** Feed size cap passed to the receipts read. */
  feedLimit?: number;
}

/**
 * Resolve the Companion runtime context for a presentation surface.
 * Fails CLOSED: any identity-resolution failure yields `identity: null`
 * and an empty feed — a surface without identity renders signed-out state,
 * never a fallback persona.
 */
export async function resolveCompanionContext(
  opts: ResolveCompanionContextOptions,
): Promise<CompanionRuntimeContext> {
  const { surface, personaIdHint, includeFeed = true, feedLimit = 20 } = opts;
  const resolvedAt = new Date().toISOString();

  // Identity — the spine's T1 surface, via personaFetch (PARAMOUNT rule).
  let identity: CompanionRuntimeContext['identity'] = null;
  try {
    const res = await personaFetch('/api/wallet/active-persona', {
      cache: 'no-store',
      personaIdHint,
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      if (typeof data?.personaSessionToken === 'string') {
        identity = data as unknown as NonNullable<CompanionRuntimeContext['identity']>;
      }
    }
  } catch {
    // fail closed — identity stays null
  }

  // Session ref — composes the T1 expiry the identity surface already
  // carries. sessionQubeRef stays absent until the PAG-001 build issues
  // SessionQubes (PRD-PAG-001 §4 — integration TODO in types/companion.ts).
  const session: CompanionRuntimeContext['session'] = identity?.sessionExpiresAt
    ? { expiresAt: identity.sessionExpiresAt }
    : {};

  // Feed — Phase 1 Timeline: a read over existing receipts. Only attempted
  // with resolved identity (fail closed); failures degrade to an empty feed.
  let feed: CompanionFeedItem[] = [];
  if (identity && includeFeed) {
    try {
      const res = await personaFetch(
        `/api/assistant/receipts?limit=${encodeURIComponent(String(feedLimit))}`,
        { cache: 'no-store', personaIdHint },
      );
      if (res.ok) {
        const data = (await res.json()) as { receipts?: unknown };
        feed = mapReceiptsToFeed(data?.receipts);
      }
    } catch {
      // non-fatal — empty feed
    }

    // Universal Notifications (PRD-MMC-IMPL-002 §3 Increment 3) — delegation
    // status transitions + "standing increased", folded into the SAME feed
    // as tagged (isNotification) items rather than a parallel feed. Best-
    // effort: a failure here still leaves the receipts-based feed intact.
    try {
      const notifRes = await personaFetch('/api/companion/notifications', {
        cache: 'no-store',
        personaIdHint,
      });
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const notifItems = mapNotificationsToFeed(notifData, resolvedAt);
        if (notifItems.length > 0) {
          feed = [...feed, ...notifItems].sort(
            (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
          );
        }
      }
    } catch {
      // non-fatal — feed just lacks the notification items
    }
  }

  return { surface, identity, session, feed, resolvedAt };
}
