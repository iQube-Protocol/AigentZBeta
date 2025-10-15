'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type IdentityState = 'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable';

interface IdentityStateToggleProps {
  value: IdentityState;
  onChange: (state: IdentityState) => void;
}

export function IdentityStateToggle({ value, onChange }: IdentityStateToggleProps) {
  const states: IdentityState[] = ['anonymous', 'semi_anonymous', 'semi_identifiable', 'identifiable'];

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as IdentityState)}>
      <TabsList className="grid w-full grid-cols-4">
        {states.map(state => (
          <TabsTrigger key={state} value={state} className="text-xs">
            {state.replace(/_/g, ' ')}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
