type BindingStatus = 'active' | 'rotated' | 'revoked';

export type PersonaBinding = {
  personaId: string; // e.g., name@domain (FIO handle)
  did: string;
  status: BindingStatus;
  createdAt: number;
  rotatedAt?: number;
};

const bindingsByDid = new Map<string, PersonaBinding>();
const bindingsByPersona = new Map<string, PersonaBinding>();

function allowedDomains(): Set<string> {
  const csv = process.env.FIO_ALLOWED_DOMAINS || 'knyt,qripto,metame';
  return new Set(csv.split(',').map((s) => s.trim()).filter(Boolean));
}

export function createPersonaHandle(did: string, name: string, domain: string): PersonaBinding {
  const domains = allowedDomains();
  if (!domains.has(domain)) {
    throw new Error('unsupported domain');
  }
  if (!/^[a-z0-9._-]{1,64}$/i.test(name)) {
    throw new Error('invalid handle');
  }
  const personaId = `${name}@${domain}`.toLowerCase();
  const existing = bindingsByPersona.get(personaId);
  if (existing) {
    if (existing.did !== did) throw new Error('handle already taken');
    return existing;
  }
  const binding: PersonaBinding = {
    personaId,
    did,
    status: 'active',
    createdAt: Date.now(),
  };
  bindingsByPersona.set(personaId, binding);
  bindingsByDid.set(did, binding);
  return binding;
}

export function getPersonaByDid(did: string): PersonaBinding | undefined {
  return bindingsByDid.get(did);
}

export function getBindingByPersonaId(personaId: string): PersonaBinding | undefined {
  return bindingsByPersona.get(personaId.toLowerCase());
}
