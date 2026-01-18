-- Check current thumbnail URLs in the sequence items
SELECT 
    day_number,
    title,
    asset_ref,
    thumbnail_url,
    cta_url,
    status
FROM marketa.marketa_sequence_items 
WHERE campaign_id = 'campaign_1768709183190_qq6f0x0sj' 
ORDER BY day_number;

-- Also check if thumbnail_url column exists and its data
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'marketa_sequence_items' 
AND table_schema = 'marketa'
AND column_name LIKE '%thumbnail%';
