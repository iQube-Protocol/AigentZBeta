-- Grant retroactive 50 Q¢ signup bonus to existing personas
-- Only grant to personas that don't already have a signup bonus

INSERT INTO qc_balances (persona_id, balance, currency, source, created_at, updated_at)
SELECT 
  p.id as persona_id,
  50.0 as balance,
  'base_qc' as currency,
  'retroactive_signup_bonus' as source,
  NOW() as created_at,
  NOW() as updated_at
FROM persona p
WHERE NOT EXISTS (
  SELECT 1 FROM qc_balances qc 
  WHERE qc.persona_id = p.id 
  AND qc.source IN ('signup_bonus', 'retroactive_signup_bonus')
);

-- Show results
SELECT 
  p.fio_handle,
  p.id,
  SUM(qc.balance) as total_base_qc
FROM persona p
LEFT JOIN qc_balances qc ON qc.persona_id = p.id AND qc.currency = 'base_qc'
GROUP BY p.id, p.fio_handle
ORDER BY p.created_at DESC
LIMIT 20;
