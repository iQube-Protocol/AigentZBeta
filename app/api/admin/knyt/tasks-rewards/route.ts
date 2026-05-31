/**
 * GET  /api/admin/knyt/tasks-rewards
 * PATCH /api/admin/knyt/tasks-rewards     { taskTemplateId, patch: { reward_knyt?, is_active?, title?, description? } }
 *
 * Admin-only. Lists every KNYT task template with live aggregates
 * (granted-but-unredeemed reward count + amount; total redeemed; last
 * grant timestamp) and allows operator edits.
 *
 * Aggregate reads:
 *   - From crm_rewards joined to crm_task_templates by task_template_id.
 *   - Counts by status: approved | pending_redemption | redeemed | rejected.
 *   - Sums amounts by status (KNYT token only — other token_types ignored).
 *
 * Privacy: T0 stripped from all responses. We do NOT return persona_id
 * lists — only aggregates. Per-persona drill-down lives in a separate
 * route (not yet implemented) gated on a stricter admin flag.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCartridgeAdmin } from '@/services/access/requireCartridgeAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KNYT_TENANT_ID = 'knyt';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

interface TaskTemplateRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty_level: number;
  reward_qct: number;
  reward_qoyn: number;
  reward_knyt: number;
  cap_max_per_period: number | null;
  cap_period_days: number | null;
  cohort_id: string | null;
  is_active: boolean;
  schema_json: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface RewardAggregate {
  approved_count: number;
  approved_amount: number;
  redeemed_count: number;
  redeemed_amount: number;
  pending_count: number;
  pending_amount: number;
  rejected_count: number;
  last_grant_at: string | null;
}

interface TaskTemplateRowOut extends TaskTemplateRow {
  aggregates: RewardAggregate;
  reward_task_types: string[];
}

// Cartridge-scoped admin gate. Replaces the prior global-isAdmin
// check with requireCartridgeAdmin, which honours the spine's
// per-cartridge adminCartridges set. KNYT tenant-admins (not just
// uber-admins) can now manage their tasks/rewards table here.

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireCartridgeAdmin(request, 'knyt-codex');
  if (gate instanceof NextResponse) return gate;
  const db = sb();

  const { data: templates, error: tErr } = await db
    .from('crm_task_templates')
    .select(
      'id, slug, title, description, category, difficulty_level, reward_qct, reward_qoyn, reward_knyt, cap_max_per_period, cap_period_days, cohort_id, is_active, schema_json, metadata, created_at, updated_at',
    )
    .eq('tenant_id', KNYT_TENANT_ID)
    .order('slug', { ascending: true });
  if (tErr) {
    return NextResponse.json({ error: 'Failed to load templates', detail: tErr.message }, { status: 500 });
  }

  const ids = (templates ?? []).map((t) => t.id);
  const { data: rewards } = ids.length
    ? await db
        .from('crm_rewards')
        .select('task_template_id, status, amount, token_type, created_at')
        .in('task_template_id', ids)
    : { data: [] as Array<{ task_template_id: string; status: string; amount: number; token_type: string; created_at: string }> };

  const agg = new Map<string, RewardAggregate>();
  for (const r of rewards ?? []) {
    if (r.token_type !== 'KNYT') continue;
    const id = r.task_template_id;
    if (!agg.has(id)) {
      agg.set(id, {
        approved_count: 0,
        approved_amount: 0,
        redeemed_count: 0,
        redeemed_amount: 0,
        pending_count: 0,
        pending_amount: 0,
        rejected_count: 0,
        last_grant_at: null,
      });
    }
    const a = agg.get(id)!;
    const amount = Number(r.amount) || 0;
    switch (r.status) {
      case 'approved':
        a.approved_count += 1;
        a.approved_amount += amount;
        break;
      case 'redeemed':
        a.redeemed_count += 1;
        a.redeemed_amount += amount;
        break;
      case 'pending_redemption':
        a.pending_count += 1;
        a.pending_amount += amount;
        break;
      case 'rejected':
        a.rejected_count += 1;
        break;
    }
    if (!a.last_grant_at || r.created_at > a.last_grant_at) {
      a.last_grant_at = r.created_at;
    }
  }

  const out: TaskTemplateRowOut[] = (templates ?? []).map((t) => {
    const schema = (t.schema_json ?? {}) as Record<string, unknown>;
    const reward_task_types = ['reward_task_type', 'streak_reward_task_type', 'streak_bonus_reward_task_type', 'signup_reward_task_type', 'conversion_reward_task_type']
      .map((k) => schema[k])
      .filter((v): v is string => typeof v === 'string');
    return {
      ...(t as TaskTemplateRow),
      reward_task_types,
      aggregates:
        agg.get(t.id) ?? {
          approved_count: 0,
          approved_amount: 0,
          redeemed_count: 0,
          redeemed_amount: 0,
          pending_count: 0,
          pending_amount: 0,
          rejected_count: 0,
          last_grant_at: null,
        },
    };
  });

  return NextResponse.json({ templates: out }, { headers: { 'Cache-Control': 'no-store' } });
}

interface PatchPayload {
  taskTemplateId: string;
  patch: Partial<Pick<TaskTemplateRow, 'reward_knyt' | 'is_active' | 'title' | 'description' | 'reward_qct' | 'reward_qoyn' | 'cap_max_per_period' | 'cap_period_days'>>;
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const gate = await requireCartridgeAdmin(request, 'knyt-codex');
  if (gate instanceof NextResponse) return gate;

  const body = (await request.json().catch(() => ({}))) as PatchPayload;
  if (!body.taskTemplateId || !body.patch || typeof body.patch !== 'object') {
    return NextResponse.json({ error: 'taskTemplateId + patch required' }, { status: 400 });
  }

  const allowed: (keyof TaskTemplateRow)[] = [
    'reward_knyt', 'is_active', 'title', 'description',
    'reward_qct', 'reward_qoyn',
    'cap_max_per_period', 'cap_period_days',
  ];
  const safePatch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body.patch && body.patch[k] !== undefined) {
      const v = body.patch[k];
      if (k === 'reward_knyt' || k === 'reward_qct' || k === 'reward_qoyn') {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: `${k} must be a non-negative number` }, { status: 400 });
        }
        safePatch[k] = n;
      } else if (k === 'cap_max_per_period' || k === 'cap_period_days') {
        // null clears the cap (no limit). Otherwise must be a positive integer.
        if (v === null) {
          safePatch[k] = null;
        } else {
          const n = Number(v);
          if (!Number.isInteger(n) || n <= 0) {
            return NextResponse.json({ error: `${k} must be a positive integer or null` }, { status: 400 });
          }
          safePatch[k] = n;
        }
      } else if (k === 'is_active') {
        safePatch[k] = Boolean(v);
      } else if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed.length === 0 && (k === 'title')) {
          return NextResponse.json({ error: 'title cannot be blank' }, { status: 400 });
        }
        if (trimmed.length > 500) {
          return NextResponse.json({ error: `${k} too long (max 500 chars)` }, { status: 400 });
        }
        safePatch[k] = trimmed;
      }
    }
  }

  // Cross-field validation: caps must be set together (both null or both numeric).
  const capChanged = 'cap_max_per_period' in safePatch || 'cap_period_days' in safePatch;
  if (capChanged) {
    const max = 'cap_max_per_period' in safePatch
      ? safePatch.cap_max_per_period
      : undefined;
    const period = 'cap_period_days' in safePatch
      ? safePatch.cap_period_days
      : undefined;
    if (max === null && period !== null && period !== undefined) {
      return NextResponse.json({ error: 'cap_max_per_period=null requires cap_period_days=null' }, { status: 400 });
    }
    if (period === null && max !== null && max !== undefined) {
      return NextResponse.json({ error: 'cap_period_days=null requires cap_max_per_period=null' }, { status: 400 });
    }
  }

  if (Object.keys(safePatch).length === 0) {
    return NextResponse.json({ error: 'no editable fields in patch' }, { status: 400 });
  }

  safePatch.updated_at = new Date().toISOString();

  const db = sb();
  const { data, error } = await db
    .from('crm_task_templates')
    .update(safePatch)
    .eq('id', body.taskTemplateId)
    .eq('tenant_id', KNYT_TENANT_ID)
    .select('id, slug, title, description, reward_knyt, reward_qct, reward_qoyn, cap_max_per_period, cap_period_days, is_active, updated_at')
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'update failed', detail: error?.message }, { status: 500 });
  }

  // Audit log — best-effort orchestration_events emission so the
  // privacy review can see admin edits in the same audit trail.
  try {
    const { emitOrchestrationEvent } = await import('@/services/orchestration/orchestrationEvents');
    await emitOrchestrationEvent({
      event_id: `admin:task-edit:${body.taskTemplateId}:${Date.now()}`,
      event_type: 'admin.task-template-edit',
      from_role: 'admin',
      to_role: 'system',
      reason: 'admin-edit',
      journey_stage: 'admin',
      active_cartridge: 'knyt',
      active_codex: 'knyt-codex',
      receipt_eligible: false,
      timestamp: new Date().toISOString(),
      metadata: {
        task_template_id: body.taskTemplateId,
        slug: data.slug,
        patched_fields: Object.keys(safePatch).filter((k) => k !== 'updated_at'),
      },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ template: data }, { headers: { 'Cache-Control': 'no-store' } });
}
