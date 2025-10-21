'use client';

import { useEffect, useState } from 'react';

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

  if (loading) return <div className="text-sm text-slate-400">Loading personas...</div>;
  if (personas.length === 0) return <div className="text-sm text-slate-400">No personas found. Create one via API.</div>;

  return (
    <select
      value={value}
      onChange={(e) => onSelect(e.target.value)}
      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      aria-label="Select persona"
    >
      <option value="">Select a persona...</option>
      {personas.map(p => (
        <option key={p.id} value={p.id}>
          {p.fio_handle || p.id.slice(0, 8)} — {p.default_identity_state}
        </option>
      ))}
    </select>
  );
}
