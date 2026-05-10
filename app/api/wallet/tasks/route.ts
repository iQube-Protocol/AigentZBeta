/**
 * Unified user-facing tasks API — spine-conformant.
 *
 * GET /api/wallet/tasks
 *
 * Single source for the wallet Tasks tab + the Order tab right-HUD QuestRail
 * + copilot "show tasks" prompts. Assembles per-persona task state from:
 *
 *   crm_task_templates       — Task definitions (slug, title, reward preview, metadata)
 *   crm_contributions        — Persona's claims/submissions against templates
 *   crm_rewards              — Granted/claimable token rewards
 *   crm_persona_reputation   — Multi-dimensional reputation vector (5-min TTL cache)
 *   knyt_persona_progression — Order rank progression (used for ascensionRank)
 *
 * Persona resolution comes from the spine via `getActivePersona(request)` —
 * the route NEVER reads `personaId` from a query string (that was a T0 leak
 * per the privacy contract; see the rep/rewards/tasks decisions doc §1).
 * The internal `personas.id` and `crm_personas.id` are T0 and stay
 * server-side; the JSON response surfaces only T1 fields.
 *
 * Visibility: open to ANY signed-in persona — tasks/rewards/reputation are
 * universal user features, not investor-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActivePersona } from '@/services/identity/getActivePersona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TENANT = 'knyt';

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ── Order rank derivation (mirrors KnytRewardView's progression model) ──────
// pricingEp / KNYT-earned thresholds → rank label. Kept simple here because
// the KnytRewardView component already owns the canonical rendering; this
// derivation just feeds the QuestRail's ascensionRank prop with a coarse
// next-rank target so the right-HUD progress bar has something to draw.
const RANKS = [
  { label: 'Initiate', minKnyt: 0 },
  { label: 'Seeker',   minKnyt: 1 },
  { label: 'Acolyte',  minKnyt: 5 },
  { label: 'Keta',     minKnyt: 25 },
  { label: 'Keji',     minKnyt: 100 },
  { label: 'First',    minKnyt: 500 },
  { label: 'Zero',     minKnyt: 2500 },
  { label: 'Sat',      minKnyt: 10000 },
];

function deriveAscensionRank(totalKnytEarned: number): { current: string; next: string; progress: number } {
  let i = 0;
  for (i = RANKS.length - 1; i >= 0; i--) {
    if (totalKnytEarned >= RANKS[i].minKnyt) break;
  }
  const current = RANKS[i] ?? RANKS[0];
  const next    = RANKS[i + 1] ?? RANKS[i] ?? RANKS[0];
  if (current === next) return { current: current.label, next: 'Apex', progress: 100 };
  const span = next.minKnyt - current.minKnyt;
  const into = Math.max(0, totalKnytEarned - current.minKnyt);
  const progress = Math.min(100, Math.round((into / Math.max(1, span)) * 100));
  return { current: current.label, next: next.label, progress };
}

interface TaskCardSummary {
  id: string;             // template slug
  templateId: string;     // template uuid
  title: string;
  description: string;
  family: 'general' | 'living_canon' | string;
  status: 'available' | 'in_progress' | 'completed';
  progress: number;       // 0-100
  rewardPreview: string;  // human-readable
  rewardKnyt: number;
  cardLabel?: string;
  iconHint?: string;
  accentHint?: string;
  primaryAction?: string;
  deepLink?: string;
  nextStep?: string;
}

interface RewardSummary {
  id: string;
  amount: number;
  source: string;       // task template title
  tokenType: string;
  status: string;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  // Spine-mediated identity resolution. Replaces the previous
  // `?personaId=<uuid>` query-param read which leaked T0 ids onto the wire.
  // getActivePersona returns null when the caller is unauthenticated.
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const personaId = persona.personaId;

  const supabase = supa();

  // Resolve the CRM persona row from the Identity persona id. If no CRM row
  // exists yet, the user just has no task/reward/reputation history — return
  // available templates with zero progress.
  const { data: crmPersona } = await supabase
    .from('crm_personas')
    .select('id')
    .eq('identity_persona_id', personaId)
    .maybeSingle();

  const crmPersonaId = crmPersona?.id ?? null;

  // 1. Active templates (universal — knyt tenant)
  const { data: templates } = await supabase
    .from('crm_task_templates')
    .select('id, slug, title, description, category, reward_knyt, schema_json, metadata, is_active')
    .eq('tenant_id', TENANT)
    .eq('is_active', true)
    .order('reward_knyt', { ascending: false });

  // 2. Persona's contributions (what they've claimed/submitted)
  const contributions = crmPersonaId
    ? (await supabase
        .from('crm_contributions')
        .select('id, task_template_id, status, final_score, created_at, reviewed_at')
        .eq('persona_id', crmPersonaId)
        .order('created_at', { ascending: false })
        .limit(100)
      ).data ?? []
    : [];

  // 3. Persona's rewards (claimable + history)
  const rewards = crmPersonaId
    ? (await supabase
        .from('crm_rewards')
        .select('id, task_template_id, token_type, amount, status, created_at')
        .eq('persona_id', crmPersonaId)
        .order('created_at', { ascending: false })
        .limit(50)
      ).data ?? []
    : [];

  // 4. Persona's reputation vector
  const { data: reputation } = crmPersonaId
    ? await supabase
        .from('crm_persona_reputation')
        .select('rep_overall, rep_technical, rep_creative, rep_entrepreneurial, rep_data_arch, rep_community, lifetime_cvs, total_tasks_completed')
        .eq('persona_id', crmPersonaId)
        .maybeSingle()
    : { data: null };

  // ── Assemble task cards ────────────────────────────────────────────────
  // For each template: derive status (available / in_progress / completed)
  // from the persona's contributions, and build a render-friendly card.
  const contributionsByTemplate = new Map<string, typeof contributions>();
  for (const c of contributions) {
    if (!c.task_template_id) continue;
    const arr = contributionsByTemplate.get(c.task_template_id) ?? [];
    arr.push(c);
    contributionsByTemplate.set(c.task_template_id, arr);
  }

  function readMeta(m: unknown, key: string): unknown {
    if (m && typeof m === 'object' && !Array.isArray(m)) return (m as Record<string, unknown>)[key];
    return undefined;
  }

  const taskCards: TaskCardSummary[] = (templates ?? []).map((t) => {
    const tmplContribs = contributionsByTemplate.get(t.id) ?? [];
    const acceptedCount = tmplContribs.filter((c) => c.status === 'accepted').length;
    const inFlight = tmplContribs.find((c) => ['claimed', 'submitted', 'under_review', 'draft'].includes(c.status as string));
    const status: TaskCardSummary['status'] = inFlight
      ? 'in_progress'
      : acceptedCount > 0
        ? 'completed'
        : 'available';

    // For repeating tasks (referrals, episodes, shares) status stays 'available'
    // as long as the user can still earn — the API can't always know "completion".
    // We surface acceptedCount via progress for repeating tasks.
    const family = readMeta(t.schema_json, 'family') as string | undefined;

    const meta = (t.metadata ?? {}) as Record<string, unknown>;
    const rewardKnyt = Number(t.reward_knyt) || 0;
    const rewardPreview = (meta.reward_preview as string) ||
      (rewardKnyt > 0 ? `+${rewardKnyt} KNYT` : 'No reward set');

    return {
      id: t.slug,
      templateId: t.id,
      title: t.title,
      description: t.description ?? '',
      family: (family ?? t.category ?? 'general') as string,
      status,
      progress: status === 'completed' ? 100 : (status === 'in_progress' ? 50 : 0),
      rewardPreview,
      rewardKnyt,
      cardLabel: meta.card_label as string | undefined,
      iconHint:  meta.icon as string | undefined,
      accentHint: meta.accent as string | undefined,
      primaryAction: readMeta(t.schema_json, 'primary_action') as string | undefined,
      deepLink:      readMeta(t.schema_json, 'deep_link') as string | undefined,
      nextStep: status === 'in_progress' ? 'Submission under review' : undefined,
    };
  });

  // ── Lifetime KNYT earned for ascension rank ────────────────────────────
  const lifetimeKnytEarned = rewards
    .filter((r) => r.token_type === 'KNYT' && (r.status === 'paid' || r.status === 'approved'))
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const claimableKnyt = rewards
    .filter((r) => r.token_type === 'KNYT' && (r.status === 'draft' || r.status === 'approved'))
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const ascensionRank = deriveAscensionRank(lifetimeKnytEarned);

  // ── Build the QuestRail "activeTask" (most recently in-progress card) ──
  const inFlightCard = taskCards.find((t) => t.status === 'in_progress') ||
                       taskCards.find((t) => t.status === 'available' && t.rewardKnyt > 0);
  const activeTask = inFlightCard
    ? {
        id: inFlightCard.id,
        title: inFlightCard.title,
        progress: inFlightCard.progress,
        nextStep: inFlightCard.nextStep ?? `Earn ${inFlightCard.rewardPreview}`,
      }
    : null;

  // ── QuestRail "rewards" feed (top 3 claimable) ─────────────────────────
  const claimableRewards: RewardSummary[] = rewards
    .filter((r) => r.token_type === 'KNYT' && (r.status === 'draft' || r.status === 'approved'))
    .slice(0, 3)
    .map((r) => {
      const tmpl = (templates ?? []).find((t) => t.id === r.task_template_id);
      return {
        id: r.id,
        amount: Number(r.amount),
        source: tmpl?.title ?? 'Task reward',
        tokenType: r.token_type,
        status: r.status,
        createdAt: r.created_at,
      };
    });

  // T1-only response. Per the privacy contract, the JSON the browser sees
  // must not carry personaId / crmPersonaId / authProfileId / rootDid /
  // cross-persona fioHandle. The wallet UI binds reads to "the active
  // persona" — server resolves that on every request via getActivePersona,
  // so the client never needs an explicit identifier handle here.
  return NextResponse.json({
    cards: {
      active:    taskCards.filter((t) => t.status === 'in_progress'),
      available: taskCards.filter((t) => t.status === 'available'),
      completed: taskCards.filter((t) => t.status === 'completed'),
    },
    questRail: {
      activeTask,
      rewards: claimableRewards.map((r) => ({ id: r.id, amount: r.amount, source: r.source })),
      ascensionRank,
    },
    summary: {
      activeCount: taskCards.filter((t) => t.status === 'in_progress').length,
      availableCount: taskCards.filter((t) => t.status === 'available').length,
      completedCount: taskCards.filter((t) => t.status === 'completed').length,
      claimableKnyt,
      lifetimeKnytEarned,
    },
    reputation: reputation ? {
      overall: Number(reputation.rep_overall) || 0,
      technical: Number(reputation.rep_technical) || 0,
      creative: Number(reputation.rep_creative) || 0,
      entrepreneurial: Number(reputation.rep_entrepreneurial) || 0,
      dataArch: Number(reputation.rep_data_arch) || 0,
      community: Number(reputation.rep_community) || 0,
      lifetimeCvs: Number(reputation.lifetime_cvs) || 0,
      totalTasksCompleted: Number(reputation.total_tasks_completed) || 0,
    } : null,
  });
}
