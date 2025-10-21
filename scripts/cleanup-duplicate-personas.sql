-- Cleanup duplicate FIO handles in persona table
-- Keep only the most recent persona for each FIO handle

-- First, let's see what duplicates we have
SELECT fio_handle, COUNT(*) as count, array_agg(id ORDER BY created_at DESC) as persona_ids
FROM persona 
WHERE fio_handle IS NOT NULL 
GROUP BY fio_handle 
HAVING COUNT(*) > 1;

-- Delete duplicate personas, keeping only the most recent one for each handle
WITH duplicates AS (
  SELECT 
    id,
    fio_handle,
    ROW_NUMBER() OVER (PARTITION BY fio_handle ORDER BY created_at DESC) as rn
  FROM persona 
  WHERE fio_handle IS NOT NULL
),
to_delete AS (
  SELECT id 
  FROM duplicates 
  WHERE rn > 1
)
DELETE FROM persona 
WHERE id IN (SELECT id FROM to_delete);

-- Verify cleanup
SELECT fio_handle, COUNT(*) as count
FROM persona 
WHERE fio_handle IS NOT NULL 
GROUP BY fio_handle 
ORDER BY fio_handle;
