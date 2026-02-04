export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

/**
 * Wallet Notifications API
 * 
 * GET /api/wallet/notifications?agentId=xxx - Get unread notifications
 * PATCH /api/wallet/notifications - Mark notifications as read
 */

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// GET - Fetch unread notifications for an agent
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const includeRead = searchParams.get('includeRead') === 'true';

    if (!agentId) {
      return NextResponse.json({ ok: false, error: 'agentId required' }, { status: 400 });
    }

    const supabase = getSupabase();

    if (includeRead) {
      // Get all notifications (read and unread)
      const { data, error } = await supabase
        .from('wallet_notifications')
        .select('*')
        .or(`recipient_id.eq.${agentId},recipient_id.ilike.${agentId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      const unreadCount = data?.filter(n => !n.read).length || 0;

      return NextResponse.json({
        ok: true,
        notifications: data || [],
        unreadCount,
      });
    } else {
      // Get only unread notifications via RPC
      const { data, error } = await supabase
        .rpc('get_unread_notifications', { p_recipient_id: agentId });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        notifications: data || [],
        unreadCount: data?.length || 0,
      });
    }

  } catch (error) {
    console.error('[Notifications] GET Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// PATCH - Mark notifications as read
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentId, notificationIds } = body;

    if (!agentId) {
      return NextResponse.json({ ok: false, error: 'agentId required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Mark notifications as read
    const { data: count, error } = await supabase
      .rpc('mark_notifications_read', {
        p_recipient_id: agentId,
        p_notification_ids: notificationIds || null,
      });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      markedRead: count || 0,
    });

  } catch (error) {
    console.error('[Notifications] PATCH Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
