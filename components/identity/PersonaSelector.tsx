'use client';

import { useEffect, useState } from 'react';
import { Select } from '@/components/ui/Select';

interface Persona {
  id: string;
  fio_handle: string | null;
  default_identity_state: string;
}

interface PersonaSelectorProps {
  onSelect: (personaId: string) => void;
  value?: string;
}

export function PersonaSelector({ onSelect, value }: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/identity/persona')
      .then(r => r.json())
      .then(data => {
        if (data.ok) setPersonas(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-gray-400">Loading personas...</div>;
  if (personas.length === 0) return <div className="text-sm text-gray-400">No personas found. Create one via API.</div>;

  return (
    <Select 
      value={value} 
      onValueChange={onSelect}
      options={personas.map(p => p.id)}
      className="w-full"
    >
      {personas.map(p => (
        <option key={p.id} value={p.id}>
          {p.fio_handle || p.id.slice(0, 8)} — {p.default_identity_state}
        </option>
      ))}
    </Select>
  );
}
