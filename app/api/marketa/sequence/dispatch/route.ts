/**
 * Sequence Campaign Dispatch Scheduler
 * Handles daily automated dispatch of sequence campaign content
 * Supports Make.com webhooks, manual publishing, and community posting
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { getPipelineOrchestrator } from '@/services/pipeline/orchestrator';
import { channelRegistry } from '@/services/campaign/channelRegistry';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── KNYT Wheel ad-hoc dispatch types ─────────────────────────────────────────

interface KnytWheelDispatchBody {
  sequenceId: string;
  recipientIds: string[];
  channel: string;
  context?: Record<string, unknown>;
}

interface KnytRecipient {
  id: string;
  name: string;
  email: string;
  cohort: string | null;
  investment_band: string | null;
  is_activated: boolean;
  ks_tracking_url: string;
}

// ── Scheduled sequence dispatch types ────────────────────────────────────────

interface SequenceItem {
  id: string;
  campaign_id: string;
  day_number: number;
  title: string;
  asset_ref: string;
  copy_variants: Record<string, string>;
  cta_url: string;
  explainer: boolean;
}

interface TenantConfig {
  id: string;
  campaign_id: string;
  tenant_id: string;
  current_day: number;
  start_date: string;
  time_of_day: string;
  channels: string[];
  publishing_mode: 'make' | 'manual' | 'community';
  make_webhook_url?: string;
  make_webhook_secret?: string;
  status: string;
  next_dispatch_at?: string;
}

interface DispatchPayload {
  campaign_id: string;
  sequence_item: SequenceItem;
  tenant_config: TenantConfig;
  correlation_id: string;
  dispatch_timestamp: string;
}

// Helper functions
function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function generateCorrelationId(): string {
  return `dispatch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function buildUTMParameters(tenantId: string, campaignId: string, dayNumber: number): string {
  const params = new URLSearchParams({
    utm_source: 'partner',
    utm_medium: 'social',
    utm_campaign: 'sequence_campaign',
    utm_content: `day_${dayNumber}`,
    utm_term: tenantId
  });
  return params.toString();
}

async function sendToMakeWebhook(payload: DispatchPayload, webhookUrl: string, secret?: string): Promise<{
  success: boolean;
  responseCode?: number;
  responseTime?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const payloadString = JSON.stringify(payload);
    const signature = secret ? generateWebhookSignature(payloadString, secret) : null;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AgentiQ-Marketa/1.0',
        ...(signature && { 'X-Webhook-Signature': signature }),
        'X-Correlation-ID': payload.correlation_id
      },
      body: payloadString
    });

    const responseTime = Date.now() - startTime;
    const responseCode = response.status;

    return {
      success: responseCode >= 200 && responseCode < 300,
      responseCode,
      responseTime
    };

  } catch (error: any) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

async function logDeliveryAttempt(
  tenantId: string,
  campaignId: string,
  sequenceDay: number,
  platform: string,
  status: string,
  payload: any,
  response?: any
) {
  const logEntry = {
    tenant_id: tenantId,
    campaign_id: campaignId,
    campaign_type: 'sequence',
    sequence_day: sequenceDay,
    platform,
    status,
    webhook_payload: payload,
    webhook_response: response,
    correlation_id: payload.correlation_id || generateCorrelationId(),
    published_at: status === 'delivered' ? new Date().toISOString() : null
  };

  await supabase.from('marketa_delivery_logs').insert(logEntry);
}

async function getNextSequenceItems(): Promise<{
  items: Array<{
    sequence_item: SequenceItem;
    tenant_config: TenantConfig;
  }>;
}> {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // Find active tenant configs where next dispatch is due
  const { data: configs, error } = await supabase
    .from('marketa_tenant_campaign_config')
    .select(`
      *,
      marketa_campaigns!inner(
        campaign_type,
        status,
        sequence_length
      )
    `)
    .eq('status', 'active')
    .eq('marketa_campaigns.campaign_type', 'sequence')
    .eq('marketa_campaigns.status', 'active')
    .lte('next_dispatch_at', now.toISOString())
    .order('next_dispatch_at', { ascending: true });

  if (error) {
    console.error('Error fetching tenant configs:', error);
    return { items: [] };
  }

  const items: Array<{
    sequence_item: SequenceItem;
    tenant_config: TenantConfig;
  }> = [];

  for (const config of configs) {
    // Get the next sequence item for this tenant
    const nextDay = config.current_day + 1;
    
    if (nextDay > config.marketa_campaigns.sequence_length) {
      // Campaign completed for this tenant
      await supabase
        .from('marketa_tenant_campaign_config')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', config.id);
      continue;
    }

    // Get the sequence item
    const { data: sequenceItem, error: itemError } = await supabase
      .from('marketa_sequence_items')
      .select('*')
      .eq('campaign_id', config.campaign_id)
      .eq('day_number', nextDay)
      .eq('status', 'ready')
      .single();

    if (itemError || !sequenceItem) {
      console.warn(`Sequence item not found for day ${nextDay} in campaign ${config.campaign_id}`);
      continue;
    }

    items.push({
      sequence_item: sequenceItem as SequenceItem,
      tenant_config: config as TenantConfig
    });
  }

  return { items };
}

async function updateTenantProgress(tenantConfigId: string, nextDay: number): Promise<void> {
  const nextDispatchDate = new Date();
  nextDispatchDate.setDate(nextDispatchDate.getDate() + 1);
  
  await supabase
    .from('marketa_tenant_campaign_config')
    .update({
      current_day: nextDay,
      last_dispatch_at: new Date().toISOString(),
      next_dispatch_at: nextDispatchDate.toISOString()
    })
    .eq('id', tenantConfigId);
}

// ── KNYT Wheel ad-hoc dispatch handler ───────────────────────────────────────

async function handleKnytWheelDispatch(body: KnytWheelDispatchBody): Promise<NextResponse> {
  const { sequenceId, recipientIds, channel, context } = body;

  if (!sequenceId || !Array.isArray(recipientIds) || recipientIds.length === 0) {
    return NextResponse.json({ error: 'sequenceId and recipientIds are required' }, { status: 400 });
  }

  // Fetch investor details from nakamoto_knyt_personas
  // platform_activated_at is set by /api/wallet/identity/consolidate on real logins
  const { data: investors, error: fetchError } = await supabase
    .from('nakamoto_knyt_personas')
    .select('id, "First-Name", "Last-Name", "Email", campaign_cohort, investment_amount_band, platform_activated_at')
    .in('id', recipientIds);

  if (fetchError) {
    console.error('[marketa/dispatch] KNYT investor fetch failed:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch investor details' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.aigentzbeta.com';

  const recipients: KnytRecipient[] = (investors ?? []).map((inv) => {
    const row = inv as Record<string, unknown>;
    const cohort  = row['campaign_cohort'] as string | null;
    const firstName = (row['First-Name'] as string | null) ?? '';
    const lastName  = (row['Last-Name']  as string | null) ?? '';
    const ksUrl = `${appUrl}/api/crm/track/ks?uid=${row['id']}&utm_source=knyt_wheel&utm_medium=${encodeURIComponent(channel)}&utm_content=${encodeURIComponent(cohort ?? 'general')}`;

    const email = (row['Email'] as string | null) ?? '';
    return {
      id:               row['id'] as string,
      name:             `${firstName} ${lastName}`.trim(),
      email,
      cohort,
      investment_band:  (row['investment_amount_band'] as string | null) ?? null,
      is_activated:     !!(row['platform_activated_at']),
      ks_tracking_url:  ksUrl,
    };
  });

  const correlationId = generateCorrelationId();

  // ── Channel registry path (email_mailjet, email_sendgrid, etc.) ─────────────
  const adapter = channelRegistry[channel];
  if (adapter) {
    if (adapter.phase !== 'active') {
      return NextResponse.json(
        { error: `Channel '${channel}' is not yet active (phase: ${adapter.phase})` },
        { status: 400 }
      );
    }

    const adapterResult = await adapter.send({ sequenceId, recipientIds, channel, context: context ?? {} });

    if (!adapterResult.success) {
      console.error(`[marketa/dispatch] ${channel} adapter error:`, adapterResult.error);
      return NextResponse.json({ error: adapterResult.error ?? 'Adapter send failed' }, { status: 502 });
    }

    // Stamp dispatched investors
    await supabase
      .from('nakamoto_knyt_personas')
      .update({ last_campaign_sent_at: new Date().toISOString(), last_campaign_sequence: sequenceId })
      .in('id', recipientIds);

    console.info(`[marketa/dispatch] ${channel} sent ${recipientIds.length} messages via adapter — seq=${sequenceId}`);
    return NextResponse.json({ success: true, dispatched: recipients.length, sequence_id: sequenceId, correlation_id: correlationId });
  }

  // ── Make.com webhook fallback (legacy / make_com channel) ───────────────────
  const webhookPayload = {
    type:              'knyt_wheel_dispatch',
    sequence_id:       sequenceId,
    channel,
    context:           context ?? {},
    recipients,
    total_recipients:  recipients.length,
    dispatched_at:     new Date().toISOString(),
    correlation_id:    correlationId,
  };

  // Support both env var names
  const webhookUrl = process.env.KNYT_WHEEL_WEBHOOK_URL ?? process.env.MAKE_KNYT_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[marketa/dispatch] No channel adapter found and no webhook URL configured');
    return NextResponse.json({
      success: false,
      error: `No adapter for channel '${channel}' and MAKE_KNYT_WEBHOOK_URL is not configured`,
    }, { status: 400 });
  }

  const result = await sendToMakeWebhook(webhookPayload as unknown as DispatchPayload, webhookUrl);
  await logDeliveryAttempt('knyt_wheel', sequenceId, 0, channel, result.success ? 'delivered' : 'failed', webhookPayload, result);

  if (!result.success) {
    return NextResponse.json({ error: 'Make.com webhook call failed', details: result.error }, { status: 502 });
  }

  // Stamp dispatched investors
  await supabase
    .from('nakamoto_knyt_personas')
    .update({ last_campaign_sent_at: new Date().toISOString(), last_campaign_sequence: sequenceId })
    .in('id', recipientIds);

  return NextResponse.json({
    success: true,
    dispatched: recipients.length,
    sequence_id: sequenceId,
    correlation_id: correlationId,
  });
}

// ── Scheduled sequence dispatch handler ──────────────────────────────────────

// Main dispatch handler
async function processSequenceDispatch(): Promise<{
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}> {
  const { items } = await getNextSequenceItems();
  
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };

  const orchestrator = getPipelineOrchestrator();
  const systemAgentId = process.env.MARKETA_SYSTEM_AGENT_ID ?? 'aigent-z';

  for (const { sequence_item, tenant_config } of items) {
    results.processed++;

    const correlationId = generateCorrelationId();
    const utmParams = buildUTMParameters(
      tenant_config.tenant_id,
      tenant_config.campaign_id,
      sequence_item.day_number
    );

    // Initiate pipeline run for this dispatch
    let pipelineRunId: string | undefined;
    try {
      const pipelineRun = await orchestrator.initiate({
        tenantId: tenant_config.tenant_id,
        personaId: systemAgentId,
        agentId: systemAgentId,
        initiatedVia: 'marketa',
        templateRef: `${tenant_config.campaign_id}:day${sequence_item.day_number}`,
        sourceOfTruth: 'explicit',
        resolutionStatus: 'resolved',
      });
      pipelineRunId = pipelineRun.pipelineRunId;
      await orchestrator.transition(pipelineRunId, 'deploy.distribution.started', {
        campaign_id: tenant_config.campaign_id,
        day_number: sequence_item.day_number,
        publishing_mode: tenant_config.publishing_mode,
        correlation_id: correlationId,
      });
    } catch (pipelineErr: any) {
      console.warn('[marketa/dispatch] Pipeline initiation failed (non-blocking):', pipelineErr?.message ?? pipelineErr);
    }

    // Build dispatch payload
    const dispatchPayload: DispatchPayload = {
      campaign_id: tenant_config.campaign_id,
      sequence_item: {
        ...sequence_item,
        cta_url: sequence_item.cta_url 
          ? `${sequence_item.cta_url}?${utmParams}`
          : `https://qriptopian.app/engage?${utmParams}`
      },
      tenant_config: {
        ...tenant_config,
        channels: tenant_config.channels
      },
      correlation_id: correlationId,
      dispatch_timestamp: new Date().toISOString()
    };

    try {
      switch (tenant_config.publishing_mode) {
        case 'make':
          if (!tenant_config.make_webhook_url) {
            throw new Error('Make webhook URL not configured');
          }

          const makeResult = await sendToMakeWebhook(
            dispatchPayload,
            tenant_config.make_webhook_url,
            tenant_config.make_webhook_secret
          );

          await logDeliveryAttempt(
            tenant_config.tenant_id,
            tenant_config.campaign_id,
            sequence_item.day_number,
            'make',
            makeResult.success ? 'delivered' : 'failed',
            dispatchPayload,
            makeResult
          );

          if (makeResult.success) {
            results.successful++;
            await updateTenantProgress(tenant_config.id, sequence_item.day_number);
          } else {
            results.failed++;
            results.errors.push(
              `Make webhook failed for tenant ${tenant_config.tenant_id}: ${makeResult.error}`
            );
          }
          break;

        case 'manual':
          // Log as ready for manual publishing
          await logDeliveryAttempt(
            tenant_config.tenant_id,
            tenant_config.campaign_id,
            sequence_item.day_number,
            'manual',
            'ready',
            dispatchPayload
          );

          results.successful++;
          await updateTenantProgress(tenant_config.id, sequence_item.day_number);
          break;

        case 'community':
          // For community mode, we'd implement community-specific logic
          // For now, treat as manual
          await logDeliveryAttempt(
            tenant_config.tenant_id,
            tenant_config.campaign_id,
            sequence_item.day_number,
            'community',
            'ready',
            dispatchPayload
          );

          results.successful++;
          await updateTenantProgress(tenant_config.id, sequence_item.day_number);
          break;

        default:
          throw new Error(`Unknown publishing mode: ${tenant_config.publishing_mode}`);
      }

      // Pipeline: mark distribution complete
      if (pipelineRunId) {
        try {
          await orchestrator.transition(pipelineRunId, 'deploy.distribution.completed', {
            campaign_id: tenant_config.campaign_id,
            day_number: sequence_item.day_number,
            publishing_mode: tenant_config.publishing_mode,
          });
          await orchestrator.complete(pipelineRunId);
        } catch (pipelineErr: any) {
          console.warn('[marketa/dispatch] Pipeline completion failed (non-blocking):', pipelineErr?.message ?? pipelineErr);
        }
      }

    } catch (error: any) {
      results.failed++;
      results.errors.push(
        `Dispatch failed for tenant ${tenant_config.tenant_id}: ${error.message}`
      );

      await logDeliveryAttempt(
        tenant_config.tenant_id,
        tenant_config.campaign_id,
        sequence_item.day_number,
        tenant_config.publishing_mode,
        'failed',
        dispatchPayload,
        { error: error.message }
      );

      // Pipeline: mark failed
      if (pipelineRunId) {
        try {
          await orchestrator.fail(pipelineRunId, error.message);
        } catch (pipelineErr: any) {
          console.warn('[marketa/dispatch] Pipeline fail record failed (non-blocking):', pipelineErr?.message ?? pipelineErr);
        }
      }
    }
  }

  return results;
}

// API Routes
export async function POST(request: NextRequest) {
  try {
    // Parse body once — used for KNYT Wheel detection and discarded for scheduler path
    let body: Record<string, unknown> | null = null;
    try {
      body = await request.json();
    } catch {
      // body stays null; scheduler path doesn't need it
    }

    // ── KNYT Wheel ad-hoc dispatch (sequenceId + recipientIds format) ──────
    if (body && typeof body.sequenceId === 'string' && Array.isArray(body.recipientIds)) {
      return handleKnytWheelDispatch(body as unknown as KnytWheelDispatchBody);
    }

    // ── Scheduled tenant dispatch (cron / external scheduler) ─────────────
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.SEQUENCE_DISPATCH_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const results = await processSequenceDispatch();

    // Log the dispatch run
    await supabase.from('marketa_lvb_sync_tracking').insert({
      tenant_id: 'system',
      sync_type: 'sequence_dispatch',
      source_id: 'scheduler',
      sync_direction: 'system_to_system',
      sync_status: results.failed === 0 ? 'success' : 'partial_failure',
      data_payload: {
        processed: results.processed,
        successful: results.successful,
        failed: results.failed,
        errors: results.errors
      }
    });

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Sequence dispatch error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        // Get current dispatch status
        const { data: recentRuns } = await supabase
          .from('marketa_lvb_sync_tracking')
          .select('*')
          .eq('sync_type', 'sequence_dispatch')
          .order('created_at', { ascending: false })
          .limit(10);

        return NextResponse.json({
          success: true,
          recent_runs: recentRuns || [],
          scheduler_active: true
        });

      case 'pending':
        // Get pending dispatches
        const { items } = await getNextSequenceItems();
        
        return NextResponse.json({
          success: true,
          pending_count: items.length,
          pending_items: items.map(item => ({
            tenant_id: item.tenant_config.tenant_id,
            campaign_id: item.tenant_config.campaign_id,
            day_number: item.sequence_item.day_number,
            title: item.sequence_item.title,
            publishing_mode: item.tenant_config.publishing_mode,
            next_dispatch_at: item.tenant_config.next_dispatch_at
          }))
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('Sequence dispatch status error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
