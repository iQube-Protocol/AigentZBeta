/**
 * PayPal Capture Recovery — operator tool
 * POST /api/wallet/knyt/paypal/recover
 *
 * Body: { orderIds: string[] } or { fioHandle: string }
 *
 * Purpose: when a PayPal capture race or Lambda-timeout means PayPal charged
 * the user but DVN KNYT was never credited, the operator can hit this route
 * with the orphaned PayPal order id(s) — for each one we read the order from
 * PayPal, derive the credit from custom_id, and credit the persona's DVN
 * KNYT balance. Idempotent: if a wallet_transactions row already exists for
 * the orderId, that order is reported as `alreadyCredited` and skipped.
 *
 * Auth: requires SERVICE_ROLE-equivalent admin credentials. We accept either:
 *   - A bearer token matching ADMIN_OPS_TOKEN env (operator copy-paste path)
 *   - A signed-in user whose persona has cartridgeFlags.isAdmin (browser path)
 *
 * The `fioHandle` shortcut isn't fully implemented yet — recovery requires
 * the orderId because PayPal doesn't expose a "list orders by buyer email"
 * API for our merchant tier. The handle is logged for audit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPayPalOrder } from '@/services/wallet/knyt/paypalService';
import { creditKnyt } from '@/services/wallet/knyt/knytLedgerService';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function supabaseSr() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const adminToken = process.env.ADMIN_OPS_TOKEN;
  if (adminToken) {
    const auth = request.headers.get('authorization') || '';
    if (auth === `Bearer ${adminToken}`) return true;
  }
  // Future: cartridgeFlags.isAdmin via spine getActivePersona. For now the
  // operator token is the only path so we don't have to wire spine identity
  // resolution into a tool that's only meant for backstop recovery.
  return false;
}

async function findExistingCredit(orderId: string) {
  const sb = supabaseSr();
  const { data } = await sb
    .from('wallet_transactions')
    .select('id, persona_id, amount, created_at')
    .eq('source', 'paypal_purchase')
    .filter('metadata->>paypalOrderId', 'eq', orderId)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

interface RecoverResult {
  orderId: string;
  status: 'credited' | 'alreadyCredited' | 'notCompleted' | 'missingMetadata' | 'error';
  personaId?: string;
  knytAmount?: number;
  transactionId?: string;
  message?: string;
}

export async function POST(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json() as { orderIds?: string[]; fioHandle?: string };
    const { orderIds, fioHandle } = body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: 'orderIds (array) required. fioHandle alone is not enough — PayPal requires the order id.' },
        { status: 400 },
      );
    }

    const results: RecoverResult[] = [];
    for (const orderId of orderIds) {
      try {
        const existing = await findExistingCredit(orderId);
        if (existing) {
          results.push({
            orderId,
            status: 'alreadyCredited',
            personaId: existing.persona_id,
            knytAmount: Number(existing.amount),
            transactionId: existing.id,
          });
          continue;
        }

        const order = await getPayPalOrder(orderId);
        if (!order.success) {
          results.push({ orderId, status: 'notCompleted', message: order.error });
          continue;
        }
        const personaId = (order as any).personaId as string | undefined;
        const knytAmount = Number((order as any).knytAmount || 0);
        const usdAmount = Number((order as any).usdAmount || 0);
        const packageId = (order as any).packageId as string | undefined;
        if (!personaId || knytAmount <= 0) {
          results.push({ orderId, status: 'missingMetadata' });
          continue;
        }

        const credit = await creditKnyt(personaId, knytAmount, 'paypal_purchase', {
          fiatAmount: usdAmount,
          fiatCurrency: 'USD',
          paypalOrderId: orderId,
          packageId,
          recovered: true,
          recoveredFromHandle: fioHandle ?? null,
        });

        if (!credit.success) {
          results.push({ orderId, status: 'error', message: credit.error });
          continue;
        }
        results.push({
          orderId,
          status: 'credited',
          personaId,
          knytAmount,
          transactionId: credit.transaction?.id,
        });
      } catch (err) {
        results.push({ orderId, status: 'error', message: (err as Error).message });
      }
    }

    return NextResponse.json({ results, fioHandle: fioHandle ?? null });
  } catch (error) {
    console.error('[PayPal Recover] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
