/**
 * The Constitutional Framework Registry — the ONE list of constitutional
 * documents the platform knows how to resolve, hash, and publish.
 *
 * OPERATOR RULING, 2026-07-27: *"The Development Constitution and Horizen
 * governance packet need to be added to a general constitutional framework
 * registry before the publication route can reach them. Do not special-case
 * CFS-009 or Horizen directly inside the route. … Then the publisher should
 * consume the registry rather than six imports hardwired into the route. This
 * resolves the present blocker and prevents the same failure for the next
 * constitutional document."*
 *
 * THE BLOCKER THIS REMOVES. `app/api/polity-core/publish/route.ts` held six
 * `import { getX } from '@/services/polity/constitution'` lines and an inline
 * `assets` array built from them. CFS-009 appeared ZERO times in that route, so
 * the Development Constitution was unreachable by the publisher — not because
 * anyone decided it should not be published, but because the publisher's set of
 * documents was a literal in a route body. Adding the seventh document meant
 * editing the route; that is the failure this registry closes for good.
 *
 * TWO SOURCE IDIOMS, ONE CONTRACT. The polity frameworks are bundled JSON
 * (`services/polity/frameworks/*.json`, imported so Lambda never touches the
 * filesystem). The Chrysalis constitutional documents are pack MARKDOWN
 * (`codexes/packs/**\/*.md`), which is NOT traced into the Lambda bundle —
 * `next.config` traces pack JSON only and routes .md bodies through the corpus
 * store. A `readFileSync` over a pack .md therefore works locally and returns
 * nothing in production. Every markdown resolver here goes through
 * `corpusReadPackFile`, the canonical pack-body read path, for that reason.
 *
 * THE CANONICAL BYTES. `document.body` is the exact serialisation that gets
 * hashed AND published — one value, so a ratification's `contentHash` and the
 * Autodrive CID commit to the same bytes by construction rather than by two
 * code paths agreeing. JSON uses `JSON.stringify(body, null, 2)`, byte-for-byte
 * what the publisher used before this registry existed, so the already-recorded
 * CIDs stay reproducible.
 *
 * PUBLICATION IS A POLICY, NOT AN ACCIDENT. A framework that must not be
 * published (a WIP primitive, a document whose home is the pack corpus) carries
 * `publish: false` WITH a reason, instead of being silently absent from a list.
 * "Absent from the publisher's array" is exactly how CFS-009 went missing.
 */

import { createHash } from 'crypto';

import { corpusReadPackFile } from '@/services/knowledge/packCorpusStore';
import {
  getConstitution,
  getAgentCharter,
  getDelegationFramework,
  getStandingCharter,
  getMetacommonsCharter,
  getFounderOfficeCharter,
  getVentureQubeSpec,
  getConstitutionOfAgenticPolity,
  CURRENT_CONSTITUTIONAL_VERSIONS,
} from '@/services/polity/constitution';

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export type ConstitutionalDocumentFormat = 'json' | 'markdown';

/** A resolved constitutional document — content, provenance, and its hash. */
export interface ConstitutionalDocument {
  id: string;
  title: string;
  version: string;
  format: ConstitutionalDocumentFormat;
  /** The canonical bytes. What the hash commits to and what gets published. */
  body: string;
  /** Repo-relative provenance of `body`. */
  sourcePath: string;
  /** sha256 hex of `body`. The immutable content hash the ruling makes mandatory. */
  contentHash: string;
  byteLength: number;
}

export interface PublicationPolicy {
  /** Whether this framework is published to Autodrive at all. */
  publish: boolean;
  network: 'mainnet' | null;
  /** Filename under which the document is uploaded. */
  filename: (version: string) => string;
  /** REQUIRED when `publish` is false — an unexplained omission is how CFS-009
   *  was lost. A reason makes the absence a decision instead of a gap. */
  reason?: string;
}

export interface ConstitutionalFrameworkDefinition {
  id: string;
  title: string;
  sourceResolver: () => Promise<ConstitutionalDocument | null>;
  publicationPolicy: PublicationPolicy;
  /** Whether a change to this framework requires an explicit ratification act
   *  (POST /api/governance/ratify) before it is treated as current canon. */
  ratificationRequired: boolean;
}

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

export function hashDocumentBody(body: string): string {
  return createHash('sha256').update(Buffer.from(body, 'utf8')).digest('hex');
}

function jsonDocument(
  id: string,
  title: string,
  version: string,
  sourcePath: string,
  value: unknown,
): ConstitutionalDocument {
  // The publisher's historic serialisation, preserved verbatim so previously
  // recorded CIDs remain reproducible from this registry.
  const body = JSON.stringify(value, null, 2);
  return {
    id,
    title,
    version,
    format: 'json',
    body,
    sourcePath,
    contentHash: hashDocumentBody(body),
    byteLength: Buffer.byteLength(body, 'utf8'),
  };
}

/**
 * Resolve a pack markdown document through the corpus store.
 *
 * NOT `readFileSync`: `next.config`'s `outputFileTracingIncludes` traces pack
 * JSON only ("The .md bodies are served by the corpus store"), so a direct read
 * of a `.md` under `codexes/packs/` succeeds in the sandbox and returns nothing
 * on Lambda. Returns null when the body cannot be resolved — a document whose
 * content cannot be read is never hashed, so nothing is ever anchored blind.
 */
async function packMarkdownDocument(
  id: string,
  title: string,
  version: string,
  packId: string,
  relPath: string,
): Promise<ConstitutionalDocument | null> {
  const body = await corpusReadPackFile(packId, relPath);
  if (!body) return null;
  return {
    id,
    title,
    version,
    format: 'markdown',
    body,
    sourcePath: `codexes/packs/${packId}/${relPath}`,
    contentHash: hashDocumentBody(body),
    byteLength: Buffer.byteLength(body, 'utf8'),
  };
}

const jsonPolicy = (label: string): PublicationPolicy => ({
  publish: true,
  network: 'mainnet',
  filename: (version) => `${label}.v${version}.json`,
});

const markdownPolicy = (label: string): PublicationPolicy => ({
  publish: true,
  network: 'mainnet',
  filename: (version) => `${label}.${version.replace(/[^A-Za-z0-9._-]+/g, '-')}.md`,
});

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/**
 * Every constitutional document the platform can resolve.
 *
 * The `version` strings for the two markdown documents are the values recorded
 * against them in `codexes/packs/polity-core/items/AMENDMENT_RECORDS.md` — the
 * constitutional register is the source of truth for what version of a document
 * is current, and `tests/governance-ratification.test.ts` carries the parity
 * canary that fails if this list and that register disagree.
 */
export const CONSTITUTIONAL_FRAMEWORKS: readonly ConstitutionalFrameworkDefinition[] = [
  {
    id: 'constitution',
    title: 'Polity Constitution',
    ratificationRequired: true,
    publicationPolicy: jsonPolicy('constitution'),
    sourceResolver: async () =>
      jsonDocument(
        'constitution',
        'Polity Constitution',
        CURRENT_CONSTITUTIONAL_VERSIONS.constitutionVersion,
        'services/polity/frameworks/constitution.v1.json',
        getConstitution(),
      ),
  },
  {
    id: 'agent-charter',
    title: 'Autonomous Agent Charter',
    ratificationRequired: true,
    publicationPolicy: jsonPolicy('agent-charter'),
    sourceResolver: async () =>
      jsonDocument(
        'agent-charter',
        'Autonomous Agent Charter',
        CURRENT_CONSTITUTIONAL_VERSIONS.agentCharterVersion,
        'services/polity/frameworks/agent-charter.v1.json',
        getAgentCharter(),
      ),
  },
  {
    id: 'delegation-framework',
    title: 'Delegation Framework',
    ratificationRequired: true,
    publicationPolicy: jsonPolicy('delegation-framework'),
    sourceResolver: async () =>
      jsonDocument(
        'delegation-framework',
        'Delegation Framework',
        CURRENT_CONSTITUTIONAL_VERSIONS.delegationFrameworkVersion,
        'services/polity/frameworks/delegation-framework.v1.json',
        getDelegationFramework(),
      ),
  },
  {
    id: 'standing-charter',
    title: 'Standing Charter',
    ratificationRequired: true,
    publicationPolicy: jsonPolicy('standing-charter'),
    sourceResolver: async () =>
      jsonDocument(
        'standing-charter',
        'Standing Charter',
        getStandingCharter().version,
        'services/polity/frameworks/standing-charter.v1.json',
        getStandingCharter(),
      ),
  },
  {
    id: 'metacommons-charter',
    title: 'metaCommons Charter',
    ratificationRequired: true,
    publicationPolicy: jsonPolicy('metacommons-charter'),
    sourceResolver: async () =>
      jsonDocument(
        'metacommons-charter',
        'metaCommons Charter',
        getMetacommonsCharter().version,
        'services/polity/frameworks/metacommons-charter.v1.json',
        getMetacommonsCharter(),
      ),
  },
  {
    id: 'founder-office-charter',
    title: 'Founder Office Charter',
    ratificationRequired: true,
    publicationPolicy: jsonPolicy('founder-office-charter'),
    sourceResolver: async () =>
      jsonDocument(
        'founder-office-charter',
        'Founder Office Charter',
        getFounderOfficeCharter().version,
        'services/polity/frameworks/founder-office-charter.v1.json',
        getFounderOfficeCharter(),
      ),
  },
  {
    id: 'constitution-agentic-polity',
    title: 'Constitution of the Agentic Polity',
    ratificationRequired: true,
    publicationPolicy: jsonPolicy('constitution-agentic-polity'),
    sourceResolver: async () =>
      jsonDocument(
        'constitution-agentic-polity',
        'Constitution of the Agentic Polity',
        getConstitutionOfAgenticPolity().version,
        'services/polity/frameworks/constitution-agentic-polity.v1.json',
        getConstitutionOfAgenticPolity(),
      ),
  },

  // ── The two documents the ruling names ──────────────────────────────────
  {
    id: 'development-constitution',
    title: 'Chrysalis Development Constitution (CFS-009)',
    ratificationRequired: true,
    publicationPolicy: markdownPolicy('development-constitution'),
    sourceResolver: () =>
      packMarkdownDocument(
        'development-constitution',
        'Chrysalis Development Constitution (CFS-009)',
        'Law XVI',
        'irl',
        'foundation/CFS-009_development-constitution.md',
      ),
  },
  {
    id: 'horizen-workspace-amendments',
    title: 'Horizen Workspace Architecture (audit Amendments A–E)',
    ratificationRequired: true,
    publicationPolicy: markdownPolicy('horizen-workspace-amendments'),
    sourceResolver: () =>
      packMarkdownDocument(
        'horizen-workspace-amendments',
        'Horizen Workspace Architecture (audit Amendments A–E)',
        'A–E',
        'agentiq',
        'updates/2026-07-27_horizen-workspace-phase0-audit.md',
      ),
  },

  // ── Present, resolvable, deliberately not published ─────────────────────
  {
    id: 'ventureqube-spec',
    title: 'VentureQube Specification',
    ratificationRequired: false,
    publicationPolicy: {
      publish: false,
      network: null,
      filename: (version) => `ventureqube-spec.v${version}.json`,
      reason:
        'draft_wip — AMENDMENT_RECORDS.md records it as NOT ratified and NOT to be published to ' +
        'Autodrive until canonized. Publishing a draft as immutable canon is the misrepresentation ' +
        'the retrospective-attestation rule exists to prevent.',
    },
    sourceResolver: async () =>
      jsonDocument(
        'ventureqube-spec',
        'VentureQube Specification',
        getVentureQubeSpec().version,
        'services/polity/frameworks/ventureqube-spec.v1.json',
        getVentureQubeSpec(),
      ),
  },
];

// ---------------------------------------------------------------------------
// Accessors — the publisher and the ratification act both read from HERE
// ---------------------------------------------------------------------------

export function getFrameworkDefinition(id: string): ConstitutionalFrameworkDefinition | undefined {
  return CONSTITUTIONAL_FRAMEWORKS.find((f) => f.id === id);
}

/** The frameworks the publisher may upload. Derived from policy, never a literal. */
export function publishableFrameworks(): ConstitutionalFrameworkDefinition[] {
  return CONSTITUTIONAL_FRAMEWORKS.filter((f) => f.publicationPolicy.publish);
}

/** Resolve a framework's current document (content + hash). Null when unreadable. */
export async function resolveFrameworkDocument(id: string): Promise<ConstitutionalDocument | null> {
  const def = getFrameworkDefinition(id);
  if (!def) return null;
  try {
    return await def.sourceResolver();
  } catch (e) {
    console.error(`[constitutional framework registry] resolve "${id}" failed:`, e);
    return null;
  }
}

/**
 * Resolve a constitutional document by its repo-relative source path. This is
 * how the ratification act binds "the operator named this file" to a REGISTERED
 * framework: a ratification of an unregistered path carries no framework id and
 * no declared version, which the act refuses.
 */
export async function resolveFrameworkByPath(
  sourcePath: string,
): Promise<{ definition: ConstitutionalFrameworkDefinition; document: ConstitutionalDocument } | null> {
  for (const definition of CONSTITUTIONAL_FRAMEWORKS) {
    const document = await resolveFrameworkDocument(definition.id);
    if (document && document.sourcePath === sourcePath) return { definition, document };
  }
  return null;
}
