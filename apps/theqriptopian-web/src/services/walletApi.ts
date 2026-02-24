import { supabase } from '@/integrations/supabase/client';

export type WalletPersona = {
  id: string;
  tenantId: string;
  displayName: string;
  avatarUri: string | null;
  fioHandle: string | null;
  fioDomain: string | null;
  discoverableWithinTenant: boolean;
  reputationScore: number;
  reputationBucket: number;
  badges: string[];
  defaultIdentityState: string | null;
  worldIdStatus: string | null;
  appOrigin: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

function getTenantId(): string {
  if (typeof window === 'undefined') return 'default';
  return (
    window.localStorage.getItem('currentTenantId') ||
    window.sessionStorage.getItem('currentTenantId') ||
    import.meta.env.VITE_LVB_BRIDGE_TENANT_ID ||
    'default'
  );
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}

export async function getMyWalletPersonas(opts?: { tenantId?: string }) {
  const tenantId = opts?.tenantId || getTenantId();
  const url = tenantId ? `/api/wallet/persona?tenantId=${encodeURIComponent(tenantId)}` : '/api/wallet/persona';
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Failed to fetch personas');
  const json = await res.json();
  const personas: WalletPersona[] = Array.isArray(json?.personas)
    ? json.personas
    : Array.isArray(json)
      ? json
      : [];
  return { tenantId, personas };
}

export async function getWalletPersonaById(personaId: string, opts?: { tenantId?: string }) {
  const tenantId = opts?.tenantId || getTenantId();
  const url = tenantId
    ? `/api/wallet/persona/${encodeURIComponent(personaId)}?tenantId=${encodeURIComponent(tenantId)}`
    : `/api/wallet/persona/${encodeURIComponent(personaId)}`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Failed to fetch persona');
  const json = await res.json();
  return (json?.persona || json) as WalletPersona;
}

export async function checkHandleAvailable(fioHandle: string) {
  const tenantId = getTenantId();
  const url = `/api/wallet/persona/check-handle?tenantId=${encodeURIComponent(tenantId)}&fioHandle=${encodeURIComponent(
    fioHandle
  )}`;
  const res = await apiFetch(url);
  if (!res.ok) return { available: true };
  const json = await res.json();
  return { available: !!json?.available };
}

function randomEvmAddress(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export async function createWalletPersona(input: {
  fioHandle: string;
  fioDomain: string;
  displayName: string;
  tenantId?: string;
  worldIdStatus?: 'verified_human' | 'agent_declared';
  defaultIdentityState?: 'semi_anonymous' | 'semi_identifiable' | 'identifiable' | 'anonymous';
  appOrigin?: string;
}) {
  const now = new Date().toISOString();
  const tenantId = input.tenantId || getTenantId();
  const payload = {
    id: crypto.randomUUID(),
    type: 'PersonaQube',
    fioHandle: input.fioHandle,
    fioDomain: input.fioDomain,
    rootDid: `did:fio:${input.fioHandle}`,
    displayName: input.displayName,
    avatarUri: null,
    evmKey: { address: randomEvmAddress() },
    chainAddresses: {},
    reputationScore: 0,
    reputationBucket: 0,
    badges: [],
    status: 'active',
    tenantId,
    createdAt: now,
    updatedAt: now,
    defaultIdentityState: input.defaultIdentityState ?? 'semi_anonymous',
    worldIdStatus: input.worldIdStatus ?? 'verified_human',
    appOrigin: input.appOrigin ?? 'theqriptopian',
  };

  const res = await apiFetch('/api/wallet/persona', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || json?.details || 'Failed to create persona');
  return (json?.persona || json) as WalletPersona;
}

