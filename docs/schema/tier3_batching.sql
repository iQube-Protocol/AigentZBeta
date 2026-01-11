-- Tier 3 Server-Side Batching System Schema
-- Implements append-only transaction logs and Merkle batch management

-- Transaction Log Table (Append-only)
CREATE TABLE IF NOT EXISTS transaction_log (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('evm', 'btc', 'solana', 'dvn')),
    chain_id TEXT,
    tx_hash TEXT NOT NULL,
    data JSONB,
    batch_id TEXT REFERENCES merkle_batches(id),
    processed BOOLEAN DEFAULT FALSE,
    batched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT transaction_log_tx_hash_unique UNIQUE (tx_hash, chain_id)
);

-- Indexes for transaction_log
CREATE INDEX IF NOT EXISTS idx_transaction_log_processed ON transaction_log(processed);
CREATE INDEX IF NOT EXISTS idx_transaction_log_created_at ON transaction_log(created_at);
CREATE INDEX IF NOT EXISTS idx_transaction_log_batch_id ON transaction_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_transaction_log_type ON transaction_log(type);

-- Merkle Batches Table
CREATE TABLE IF NOT EXISTS merkle_batches (
    id TEXT PRIMARY KEY,
    root TEXT NOT NULL,
    transaction_ids TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    committed BOOLEAN DEFAULT FALSE,
    committed_at TIMESTAMP WITH TIME ZONE,
    dvn_message_id TEXT,
    pos_receipt_id TEXT,
    receipt_issued_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT merkle_batches_root_unique UNIQUE (root),
    CONSTRAINT merkle_batches_transaction_ids_not_empty CHECK (array_length(transaction_ids, 1) > 0)
);

-- Indexes for merkle_batches
CREATE INDEX IF NOT EXISTS idx_merkle_batches_committed ON merkle_batches(committed);
CREATE INDEX IF NOT EXISTS idx_merkle_batches_created_at ON merkle_batches(created_at);
CREATE INDEX IF NOT EXISTS idx_merkle_batches_pos_receipt_id ON merkle_batches(pos_receipt_id);

-- Batch Processing Audit Trail
CREATE TABLE IF NOT EXISTS batch_processing_log (
    id SERIAL PRIMARY KEY,
    batch_id TEXT REFERENCES merkle_batches(id),
    step TEXT NOT NULL CHECK (step IN ('created', 'committed', 'receipt_issued', 'anchored', 'purged')),
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
    message TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for batch_processing_log
CREATE INDEX IF NOT EXISTS idx_batch_processing_log_batch_id ON batch_processing_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_processing_log_step ON batch_processing_log(step);
CREATE INDEX IF NOT EXISTS idx_batch_processing_log_created_at ON batch_processing_log(created_at);

-- Row Level Security (RLS) Policies
ALTER TABLE transaction_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE merkle_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_processing_log ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can modify transaction logs
CREATE POLICY "Service role full access to transaction_log" ON transaction_log
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Service role full access to merkle_batches
CREATE POLICY "Service role full access to merkle_batches" ON merkle_batches
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Service role full access to batch_processing_log
CREATE POLICY "Service role full access to batch_processing_log" ON batch_processing_log
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Functions for batch management

-- Function to get batch statistics
CREATE OR REPLACE FUNCTION get_batch_statistics()
RETURNS TABLE (
    total_transactions BIGINT,
    processed_transactions BIGINT,
    pending_transactions BIGINT,
    total_batches BIGINT,
    committed_batches BIGINT,
    pending_batches BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM transaction_log) as total_transactions,
        (SELECT COUNT(*) FROM transaction_log WHERE processed = TRUE) as processed_transactions,
        (SELECT COUNT(*) FROM transaction_log WHERE processed = FALSE) as pending_transactions,
        (SELECT COUNT(*) FROM merkle_batches) as total_batches,
        (SELECT COUNT(*) FROM merkle_batches WHERE committed = TRUE) as committed_batches,
        (SELECT COUNT(*) FROM merkle_batches WHERE committed = FALSE) as pending_batches;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data(
    transaction_retention_days INTEGER DEFAULT 30,
    batch_retention_days INTEGER DEFAULT 90
)
RETURNS TABLE (
    transactions_deleted BIGINT,
    batches_deleted BIGINT
) AS $$
DECLARE
    transaction_cutoff TIMESTAMP WITH TIME ZONE;
    batch_cutoff TIMESTAMP WITH TIME ZONE;
    tx_count BIGINT;
    batch_count BIGINT;
BEGIN
    transaction_cutoff := NOW() - (transaction_retention_days || ' days')::INTERVAL;
    batch_cutoff := NOW() - (batch_retention_days || ' days')::INTERVAL;
    
    -- Delete old processed transactions
    DELETE FROM transaction_log 
    WHERE processed = TRUE AND created_at < transaction_cutoff;
    GET DIAGNOSTICS tx_count = ROW_COUNT;
    
    -- Delete old committed batches with receipts
    DELETE FROM merkle_batches 
    WHERE committed = TRUE 
    AND pos_receipt_id IS NOT NULL 
    AND created_at < batch_cutoff;
    GET DIAGNOSTICS batch_count = ROW_COUNT;
    
    RETURN QUERY SELECT tx_count, batch_count;
END;
$$ LANGUAGE plpgsql;

-- Triggers for audit logging

CREATE OR REPLACE FUNCTION log_batch_processing()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO batch_processing_log (batch_id, step, status, message, created_at)
    VALUES (
        NEW.id,
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'created'
            WHEN NEW.committed = TRUE AND OLD.committed = FALSE THEN 'committed'
            WHEN NEW.pos_receipt_id IS NOT NULL AND OLD.pos_receipt_id IS NULL THEN 'receipt_issued'
            ELSE 'updated'
        END,
        'completed',
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'Batch created'
            WHEN NEW.committed = TRUE AND OLD.committed = FALSE THEN 'Batch committed to DVN'
            WHEN NEW.pos_receipt_id IS NOT NULL AND OLD.pos_receipt_id IS NULL THEN 'PoS receipt issued'
            ELSE 'Batch updated'
        END,
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for batch audit logging
DROP TRIGGER IF EXISTS batch_audit_trigger ON merkle_batches;
CREATE TRIGGER batch_audit_trigger
    AFTER INSERT OR UPDATE ON merkle_batches
    FOR EACH ROW
    EXECUTE FUNCTION log_batch_processing();

-- Grant permissions to service role
GRANT ALL ON transaction_log TO service_role;
GRANT ALL ON merkle_batches TO service_role;
GRANT ALL ON batch_processing_log TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
