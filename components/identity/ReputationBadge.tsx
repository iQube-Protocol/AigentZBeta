'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface ReputationBadgeProps {
  partitionId: string;
  refreshKey?: number;
}

export function ReputationBadge({ partitionId, refreshKey = 0 }: ReputationBadgeProps) {
  const [bucket, setBucket] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partitionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/identity/reputation/bucket?partitionId=${partitionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setBucket(data.data.bucket);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [partitionId, refreshKey]);

  if (loading) return <Badge variant="outline">Loading...</Badge>;
  if (bucket === null) return <Badge variant="secondary">New Persona</Badge>;

  const color = bucket >= 3 ? 'default' : bucket >= 1 ? 'secondary' : 'destructive';
  return <Badge variant={color}>Bucket {bucket}</Badge>;
}
