/**
 * KNYT Purchase Webhook for Lovable Integration
 * 
 * Handles purchase completion events and notifies Lovable thin client
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { event, personaId, data } = await request.json();

    if (event === 'knyt_purchase_complete') {
      const { assetId, transactionId, timestamp } = data;

      // Log the purchase completion
      console.log(`KNYT Purchase Completed: ${transactionId} for persona ${personaId}`);

      // Update purchase status in database
      const { error } = await supabase
        .from('knyt_purchases')
        .update({ 
          status: 'completed',
          completed_at: timestamp,
          transaction_id: transactionId
        })
        .eq('persona_id', personaId)
        .eq('asset_id', assetId);

      if (error) {
        console.error('Failed to update purchase status:', error);
        return NextResponse.json({ error: 'Failed to update purchase' }, { status: 500 });
      }

      // Send success response back to Lovable
      return NextResponse.json({
        success: true,
        event: 'purchase_confirmed',
        data: {
          assetId,
          transactionId,
          personaId,
          timestamp,
        }
      });
    }

    return NextResponse.json({ error: 'Unknown event' }, { status: 400 });

  } catch (error) {
    console.error('KNYT Purchase Webhook Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
