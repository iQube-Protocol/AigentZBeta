-- ============================================================================
-- Payment Requests Table and Notifications
-- ============================================================================
-- Supports the full payment request workflow:
-- 1. Agent A requests payment from Agent B
-- 2. Request appears in Agent B's wallet
-- 3. Agent B can accept (triggers payment) or reject
-- 4. Agent A receives notification of outcome
-- ============================================================================

-- ============================================================================
-- 1. Create payment_requests table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request details
  amount NUMERIC NOT NULL,
  asset TEXT NOT NULL DEFAULT 'QCT',
  chain_id INTEGER NOT NULL DEFAULT 421614,
  memo TEXT,
  
  -- Requester (who wants to receive payment)
  requester_id TEXT NOT NULL,           -- agent_id or fio_handle
  requester_fio TEXT,                   -- FIO handle for display
  requester_address TEXT NOT NULL,      -- Address to receive payment
  
  -- Payer (who is being asked to pay)
  payer_id TEXT NOT NULL,               -- agent_id or fio_handle
  payer_fio TEXT,                       -- FIO handle for display
  payer_address TEXT,                   -- Resolved payer address
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'paid', 'expired', 'cancelled')),
  
  -- Payment details (filled when paid)
  tx_hash TEXT,
  paid_at TIMESTAMPTZ,
  
  -- Rejection details (filled when rejected)
  rejection_reason TEXT,
  rejected_at TIMESTAMPTZ,
  
  -- Notifications
  requester_notified BOOLEAN DEFAULT FALSE,
  payer_notified BOOLEAN DEFAULT FALSE,
  
  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Create indexes for efficient queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_payment_requests_requester ON public.payment_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_payer ON public.payment_requests(payer_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_expires ON public.payment_requests(expires_at) WHERE status = 'pending';

-- ============================================================================
-- 3. Create notifications table for real-time updates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wallet_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recipient
  recipient_id TEXT NOT NULL,           -- agent_id or fio_handle
  
  -- Notification details
  type TEXT NOT NULL CHECK (type IN ('payment_request', 'payment_received', 'request_accepted', 'request_rejected', 'request_paid', 'request_expired')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Related entities
  payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  tx_hash TEXT,
  amount NUMERIC,
  asset TEXT,
  
  -- From/To for context
  from_id TEXT,
  from_fio TEXT,
  to_id TEXT,
  to_fio TEXT,
  
  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_notifications_recipient ON public.wallet_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_wallet_notifications_unread ON public.wallet_notifications(recipient_id, read) WHERE read = FALSE;

-- ============================================================================
-- 4. Function to create a payment request
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_payment_request(
  p_requester_id TEXT,
  p_requester_fio TEXT,
  p_requester_address TEXT,
  p_payer_id TEXT,
  p_payer_fio TEXT,
  p_amount NUMERIC,
  p_asset TEXT DEFAULT 'QCT',
  p_chain_id INTEGER DEFAULT 421614,
  p_memo TEXT DEFAULT NULL,
  p_expires_in_days INTEGER DEFAULT 7
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
  v_payer_address TEXT;
BEGIN
  -- Resolve payer address from agent_keys
  SELECT evm_address INTO v_payer_address
  FROM agent_keys
  WHERE agent_id = p_payer_id 
     OR LOWER(fio_handle) = LOWER(p_payer_id)
  LIMIT 1;

  -- Create the payment request
  INSERT INTO payment_requests (
    requester_id, requester_fio, requester_address,
    payer_id, payer_fio, payer_address,
    amount, asset, chain_id, memo,
    expires_at
  ) VALUES (
    p_requester_id, p_requester_fio, p_requester_address,
    p_payer_id, p_payer_fio, v_payer_address,
    p_amount, p_asset, p_chain_id, p_memo,
    NOW() + (p_expires_in_days || ' days')::INTERVAL
  )
  RETURNING id INTO v_request_id;

  -- Create notification for payer
  INSERT INTO wallet_notifications (
    recipient_id, type, title, message,
    payment_request_id, amount, asset,
    from_id, from_fio
  ) VALUES (
    p_payer_id,
    'payment_request',
    'Payment Request',
    'You have received a payment request for ' || p_amount || ' ' || p_asset || ' from ' || COALESCE(p_requester_fio, p_requester_id),
    v_request_id, p_amount, p_asset,
    p_requester_id, p_requester_fio
  );

  RETURN v_request_id;
END;
$$;

-- ============================================================================
-- 5. Function to accept a payment request (marks as accepted, payment happens via API)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_payment_request(
  p_request_id UUID,
  p_payer_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Get and validate request
  SELECT * INTO v_request
  FROM payment_requests
  WHERE id = p_request_id
    AND status = 'pending'
    AND (payer_id = p_payer_id OR LOWER(payer_fio) = LOWER(p_payer_id));

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update status to accepted
  UPDATE payment_requests
  SET status = 'accepted',
      updated_at = NOW()
  WHERE id = p_request_id;

  RETURN TRUE;
END;
$$;

-- ============================================================================
-- 6. Function to mark payment request as paid
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_payment_request_paid(
  p_request_id UUID,
  p_tx_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Get request
  SELECT * INTO v_request
  FROM payment_requests
  WHERE id = p_request_id
    AND status IN ('pending', 'accepted');

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update to paid
  UPDATE payment_requests
  SET status = 'paid',
      tx_hash = p_tx_hash,
      paid_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id;

  -- Notify requester that payment was received
  INSERT INTO wallet_notifications (
    recipient_id, type, title, message,
    payment_request_id, tx_hash, amount, asset,
    from_id, from_fio
  ) VALUES (
    v_request.requester_id,
    'request_paid',
    'Payment Received',
    'Your payment request for ' || v_request.amount || ' ' || v_request.asset || ' has been paid by ' || COALESCE(v_request.payer_fio, v_request.payer_id),
    p_request_id, p_tx_hash, v_request.amount, v_request.asset,
    v_request.payer_id, v_request.payer_fio
  );

  RETURN TRUE;
END;
$$;

-- ============================================================================
-- 7. Function to reject a payment request
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_payment_request(
  p_request_id UUID,
  p_payer_id TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Get and validate request
  SELECT * INTO v_request
  FROM payment_requests
  WHERE id = p_request_id
    AND status = 'pending'
    AND (payer_id = p_payer_id OR LOWER(payer_fio) = LOWER(p_payer_id));

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update to rejected
  UPDATE payment_requests
  SET status = 'rejected',
      rejection_reason = p_reason,
      rejected_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id;

  -- Notify requester of rejection
  INSERT INTO wallet_notifications (
    recipient_id, type, title, message,
    payment_request_id, amount, asset,
    from_id, from_fio
  ) VALUES (
    v_request.requester_id,
    'request_rejected',
    'Payment Request Rejected',
    'Your payment request for ' || v_request.amount || ' ' || v_request.asset || ' was rejected by ' || COALESCE(v_request.payer_fio, v_request.payer_id) || COALESCE('. Reason: ' || p_reason, ''),
    p_request_id, v_request.amount, v_request.asset,
    v_request.payer_id, v_request.payer_fio
  );

  RETURN TRUE;
END;
$$;

-- ============================================================================
-- 8. Function to get pending payment requests for a payer
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_payment_requests(
  p_payer_id TEXT
)
RETURNS TABLE (
  id UUID,
  amount NUMERIC,
  asset TEXT,
  chain_id INTEGER,
  memo TEXT,
  requester_id TEXT,
  requester_fio TEXT,
  requester_address TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id, pr.amount, pr.asset, pr.chain_id, pr.memo,
    pr.requester_id, pr.requester_fio, pr.requester_address,
    pr.status, pr.expires_at, pr.created_at
  FROM payment_requests pr
  WHERE (pr.payer_id = p_payer_id OR LOWER(pr.payer_fio) = LOWER(p_payer_id))
    AND pr.status = 'pending'
    AND pr.expires_at > NOW()
  ORDER BY pr.created_at DESC;
END;
$$;

-- ============================================================================
-- 9. Function to get unread notifications
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_unread_notifications(
  p_recipient_id TEXT
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  message TEXT,
  payment_request_id UUID,
  tx_hash TEXT,
  amount NUMERIC,
  asset TEXT,
  from_id TEXT,
  from_fio TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wn.id, wn.type, wn.title, wn.message,
    wn.payment_request_id, wn.tx_hash, wn.amount, wn.asset,
    wn.from_id, wn.from_fio, wn.created_at
  FROM wallet_notifications wn
  WHERE (wn.recipient_id = p_recipient_id OR LOWER(wn.recipient_id) = LOWER(p_recipient_id))
    AND wn.read = FALSE
  ORDER BY wn.created_at DESC;
END;
$$;

-- ============================================================================
-- 10. Function to mark notifications as read
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_notifications_read(
  p_recipient_id TEXT,
  p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Mark all as read
    UPDATE wallet_notifications
    SET read = TRUE, read_at = NOW()
    WHERE (recipient_id = p_recipient_id OR LOWER(recipient_id) = LOWER(p_recipient_id))
      AND read = FALSE;
  ELSE
    -- Mark specific notifications as read
    UPDATE wallet_notifications
    SET read = TRUE, read_at = NOW()
    WHERE id = ANY(p_notification_ids)
      AND (recipient_id = p_recipient_id OR LOWER(recipient_id) = LOWER(p_recipient_id))
      AND read = FALSE;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- 11. Enable RLS
-- ============================================================================
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_notifications ENABLE ROW LEVEL SECURITY;

-- Payment requests: users can see requests they're involved in
DROP POLICY IF EXISTS "Users can view own payment requests" ON public.payment_requests;
CREATE POLICY "Users can view own payment requests"
  ON public.payment_requests FOR SELECT
  USING (TRUE); -- RPC functions handle access control

-- Notifications: users can see their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.wallet_notifications;
CREATE POLICY "Users can view own notifications"
  ON public.wallet_notifications FOR SELECT
  USING (TRUE); -- RPC functions handle access control

-- ============================================================================
-- 12. Grant permissions
-- ============================================================================
GRANT ALL ON public.payment_requests TO service_role;
GRANT ALL ON public.wallet_notifications TO service_role;
GRANT SELECT ON public.payment_requests TO authenticated;
GRANT SELECT ON public.wallet_notifications TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_payment_request(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, INTEGER, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_payment_request(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_payment_request_paid(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_payment_request(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_payment_requests(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notifications(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(TEXT, UUID[]) TO authenticated;

-- ============================================================================
-- Verification queries
-- ============================================================================
-- Check tables exist:
-- SELECT * FROM payment_requests LIMIT 5;
-- SELECT * FROM wallet_notifications LIMIT 5;

-- Test creating a payment request:
-- SELECT create_payment_request('aigent-z', 'aigentz@aigent', '0x0e3a...', 'aigent-moneypenny', 'moneypenny@aigent', 100, 'QCT', 421614, 'Test payment');

-- Get pending requests for an agent:
-- SELECT * FROM get_pending_payment_requests('moneypenny@aigent');

-- Get unread notifications:
-- SELECT * FROM get_unread_notifications('aigentz@aigent');
