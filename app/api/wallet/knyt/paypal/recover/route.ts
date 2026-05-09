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
import { getPayPalOrder, getPayPalCapture } from '@/services/wallet/knyt/paypalService';
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

/**
 * Idempotency lookup. The operator may paste either an order id or a capture
 * (transaction) id, so we check both metadata keys.
 */
async function findExistingCredit(id: string) {
  const sb = supabaseSr();
  const { data: byOrder } = await sb
    .from('wallet_transactions')
    .select('id, persona_id, amount, created_at')
    .eq('source', 'paypal_purchase')
    .filter('metadata->>paypalOrderId', 'eq', id)
    .limit(1)
    .maybeSingle();
  if (byOrder) return byOrder;
  const { data: byCapture } = await sb
    .from('wallet_transactions')
    .select('id, persona_id, amount, created_at')
    .eq('source', 'paypal_purchase')
    .filter('metadata->>paypalCaptureId', 'eq', id)
    .limit(1)
    .maybeSingle();
  return byCapture ?? null;
}

interface RecoverResult {
  /** Whatever id the operator pasted — could be an order id or a capture id. */
  id: string;
  /** PayPal order id, populated once resolved (may equal `id`). */
  orderId?: string;
  /** PayPal capture / transaction id, populated when resolved via capture lookup. */
  captureId?: string;
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
    // Accept either field name. `ids` is preferred since values may be order
    // ids OR capture/transaction ids; `orderIds` is kept for backwards compat
    // with operators who already have a curl invocation.
    const body = await request.json() as {
      ids?: string[];
      orderIds?: string[];
      fioHandle?: string;
    };
    const inputIds = body.ids ?? body.orderIds ?? [];
    const { fioHandle } = body;
    if (!Array.isArray(inputIds) || inputIds.length === 0) {
      return NextResponse.json(
        { error: 'ids (array) required. Each entry can be a PayPal order id OR a capture / transaction id.' },
        { status: 400 },
      );
    }

    const results: RecoverResult[] = [];
    for (const id of inputIds) {
      try {
        const existing = await findExistingCredit(id);
        if (existing) {
          results.push({
            id,
            status: 'alreadyCredited',
            personaId: existing.persona_id,
            knytAmount: Number(existing.amount),
            transactionId: existing.id,
          });
          continue;
        }

        // Try as an order id first; fall back to capture id if the order
        // lookup 404s (PayPal merchant dashboard surfaces capture ids
        // prominently, so operators frequently paste those).
        let resolved: any = await getPayPalOrder(id);
        let resolvedOrderId: string | undefined = id;
        let resolvedCaptureId: string | undefined;

        if (!resolved.success) {
          if (resolved.status === 404) {
            const cap = await getPayPalCapture(id);
            if (!cap.success) {
              results.push({ id, status: 'notCompleted', message: `${resolved.error}; capture lookup: ${cap.error}` });
              continue;
            }
            resolved = cap;
            resolvedCaptureId = (cap as any).captureId ?? id;
            resolvedOrderId = (cap as any).orderId ?? undefined;
          } else {
            results.push({ id, status: 'notCompleted', message: resolved.error });
            continue;
          }
        }

        const personaId = (resolved as any).personaId as string | undefined;
        const knytAmount = Number((resolved as any).knytAmount || 0);
        const usdAmount = Number((resolved as any).usdAmount || 0);
        const packageId = (resolved as any).packageId as string | undefined;
        if (!personaId || knytAmount <= 0) {
          results.push({ id, orderId: resolvedOrderId, captureId: resolvedCaptureId, status: 'missingMetadata' });
          continue;
        }

        // Re-check idempotency now that we know both ids — covers the case
        // where the operator pasted the order id but a previous credit was
        // recorded under captureId, or vice versa.
        if (resolvedOrderId && resolvedOrderId !== id) {
          const dupe = await findExistingCredit(resolvedOrderId);
          if (dupe) {
            results.push({
              id,
              orderId: resolvedOrderId,
              captureId: resolvedCaptureId,
              status: 'alreadyCredited',
              personaId: dupe.persona_id,
              knytAmount: Number(dupe.amount),
              transactionId: dupe.id,
            });
            continue;
          }
        }

        const credit = await creditKnyt(personaId, knytAmount, 'paypal_purchase', {
          fiatAmount: usdAmount,
          fiatCurrency: 'USD',
          paypalOrderId: resolvedOrderId ?? null,
          paypalCaptureId: resolvedCaptureId ?? null,
          packageId,
          recovered: true,
          recoveredFromHandle: fioHandle ?? null,
        });

        if (!credit.success) {
          results.push({ id, orderId: resolvedOrderId, captureId: resolvedCaptureId, status: 'error', message: credit.error });
          continue;
        }
        results.push({
          id,
          orderId: resolvedOrderId,
          captureId: resolvedCaptureId,
          status: 'credited',
          personaId,
          knytAmount,
          transactionId: credit.transaction?.id,
        });
      } catch (err) {
        results.push({ id, status: 'error', message: (err as Error).message });
      }
    }

    return NextResponse.json({ results, fioHandle: fioHandle ?? null });
  } catch (error) {
    console.error('[PayPal Recover] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
