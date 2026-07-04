/**
 * Namestone client — L2 ENS subname minting (gasless).
 *
 * Per the 2026-06-13 hackathon plan §Sprint 7. Namestone is the
 * confirmed vendor for gasless L2 ENS subnames.
 *
 * Stub mode (no NAMESTONE_API_KEY): returns a deterministic
 * Namestone-shape response so the flow is testable end-to-end without
 * the external dependency. Real mode hits the Namestone REST API.
 *
 * T0 discipline: this client accepts only T1-safe inputs (the ENS
 * label + an address to point at). The address is intentionally an
 * opaque public commitment (eg a hash) rather than the persona's
 * actual wallet — the resolver returns this opaque ref, NEVER the
 * persona_id. ENS lookup cannot link citizen ↔ agent.
 */

const NAMESTONE_API_KEY = process.env.NAMESTONE_API_KEY ?? '';
const NAMESTONE_API_BASE = process.env.NAMESTONE_API_BASE ?? 'https://namestone.com/api/public_v1';
const ENS_PARENT = process.env.ENS_PARENT_NAME ?? 'polity.eth';

export type NamestoneMode = 'stub' | 'live';

export interface NamestoneMintInput {
  label: string;
  /** Address ENS resolves to — typically a public commitment ref hash, not a real wallet. */
  resolveAddress: string;
  /** Parent domain (defaults to ENS_PARENT). */
  parent?: string;
  /** Optional metadata (text records). T1-safe only. */
  textRecords?: Record<string, string>;
}

export interface NamestoneMintResult {
  mode: NamestoneMode;
  ensFull: string;
  ensLabel: string;
  ensParent: string;
  rawResponse: Record<string, unknown>;
  note?: string;
}

function chooseMode(): NamestoneMode {
  return NAMESTONE_API_KEY ? 'live' : 'stub';
}

/**
 * Mint an ENS subname. Stub mode returns a Namestone-shape payload with
 * no network call. Real mode POSTs to the Namestone set-name endpoint.
 */
export async function mintEnsSubname(input: NamestoneMintInput): Promise<NamestoneMintResult> {
  const parent = input.parent ?? ENS_PARENT;
  const ensFull = `${input.label}.${parent}`;

  if (chooseMode() === 'stub') {
    return {
      mode: 'stub',
      ensFull,
      ensLabel: input.label,
      ensParent: parent,
      rawResponse: {
        success: true,
        name: input.label,
        domain: parent,
        address: input.resolveAddress,
        text_records: input.textRecords ?? {},
        stub: true,
      },
      note: 'Stub mode — set NAMESTONE_API_KEY to mint real L2 subnames via Namestone.',
    };
  }

  const res = await fetch(`${NAMESTONE_API_BASE}/set-name`, {
    method: 'POST',
    headers: {
      Authorization: NAMESTONE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      domain: parent,
      name: input.label,
      address: input.resolveAddress,
      text_records: input.textRecords ?? {},
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Namestone mint failed (${res.status}): ${text}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    mode: 'live',
    ensFull,
    ensLabel: input.label,
    ensParent: parent,
    rawResponse: raw,
  };
}

/**
 * Resolve a subname to its address (or stub fallback to whatever the
 * row carries). The platform stores the canonical mapping in
 * persona_ens_names / locker_ens_names — this client is used only when
 * we need to verify Namestone has the same record.
 */
export async function resolveEnsSubname(ensFull: string): Promise<string | null> {
  if (chooseMode() === 'stub') return null;
  const res = await fetch(`${NAMESTONE_API_BASE}/get-names?domain=${encodeURIComponent(ENS_PARENT)}`, {
    headers: { Authorization: NAMESTONE_API_KEY },
  });
  if (!res.ok) return null;
  const list = (await res.json()) as Array<{ name: string; domain: string; address: string }>;
  const target = list.find((r) => `${r.name}.${r.domain}` === ensFull);
  return target?.address ?? null;
}
