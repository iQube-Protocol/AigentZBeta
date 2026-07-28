/**
 * extensionArtifact.ts — the metaMe Companion extension as a *verifiable
 * distribution artifact* (SPEC-MMC-003 §3.2, install orchestration).
 *
 * SPEC-MMC-003 §0.2 records the ground truth this module is built around: the
 * Companion is a Manifest V3 extension that is **not published to any store**,
 * and §2.1 records the constraint no design can route around — **no silent
 * install**. Nothing here installs anything. It produces the two things a
 * technically-literate human needs to install it *themselves*, safely:
 *
 *   1. a **bundle** of the checked-in extension source, and
 *   2. an **integrity manifest** — per-file sha256, a bundle sha256, and the
 *      **derived** Chrome extension ID — so the human can verify that what
 *      landed in their browser is what this server served.
 *
 * ── Two anti-drift properties, both deliberate ────────────────────────────
 *
 * **The bundle IS the source.** The file list is read from
 * `extension/companion-observer/` at request time; it is never a hand-kept
 * copy. There is no committed zip to go stale (CLAUDE.md "Extend, Don't
 * Duplicate" / `inv.engineering.036`-`037`). Add a file to the extension and it
 * is in the next download automatically.
 *
 * **The extension ID is derived, not asserted.** `manifest.json` pins a `key`,
 * which pins the extension's ID across load-unpacked *and* a future Chrome Web
 * Store listing. `deriveExtensionId` recomputes that ID the way Chromium does
 * (sha256 of the DER SPKI, first 16 bytes, hex digits mapped 0-f → a-p), so the
 * ID handed to a partner can never drift from the `key` that produces it — and
 * the canary cross-checks it against the `chrome-extension://` origin already
 * in `configs/embed/policy.v1.json`'s frame-ancestors allowlist. If those two
 * ever disagree, pairing would break in a way that is very hard to diagnose
 * from the partner's side; the test fails the build instead.
 *
 * ── Why a hand-rolled STORE zip ────────────────────────────────────────────
 *
 * Chrome's "Load unpacked" takes a *directory*, so the partner needs an archive
 * they unzip first — and a `.crx` is a dead end (Chromium has refused
 * off-store CRX installs since Chrome 75). The repo carries no zip library, and
 * pulling one in for ~95 KB of plain JS would be the wrong trade against the
 * Amplify output-size cap this build already sits near. A no-compression
 * (method 0) zip is a short, fully-specified format; `writeStoreZip` emits one
 * deterministically (fixed DOS timestamp), and the canary verifies it by
 * extracting it with a real extractor and re-hashing every member.
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

/** Repo-relative home of the extension source — the single source of truth. */
export const COMPANION_EXTENSION_DIR = 'extension/companion-observer';

/** Folder name inside the archive, so unzipping yields a load-unpacked-ready dir. */
export const COMPANION_EXTENSION_ARCHIVE_ROOT = 'companion-observer';

export interface ExtensionFile {
  /** Path relative to COMPANION_EXTENSION_DIR (the extension is flat today). */
  path: string;
  bytes: Buffer;
}

export interface ExtensionFileDigest {
  path: string;
  bytes: number;
  sha256: string;
}

export interface ExtensionArtifactManifest {
  /** `manifest.json`'s own version field — what Chrome will display. */
  version: string;
  /** Derived from the pinned `key`; what chrome://extensions will show. */
  extensionId: string;
  /** Chromium-family only — MV3 is not Firefox's or Safari's model. */
  browserSupport: 'chromium-mv3';
  files: ExtensionFileDigest[];
  /** sha256 over the concatenated `path\0sha256\n` lines, in `files` order. */
  bundleSha256: string;
}

function extensionRoot(): string {
  return path.join(process.cwd(), COMPANION_EXTENSION_DIR);
}

/**
 * Read every file of the extension source, sorted by path so the bundle hash is
 * stable across filesystems (readdir order is not guaranteed).
 */
export function readExtensionFiles(): ExtensionFile[] {
  const root = extensionRoot();
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort()
    .map((name) => ({ path: name, bytes: readFileSync(path.join(root, name)) }));
}

/**
 * Recompute a Chromium extension ID from a manifest `key` exactly as the
 * browser does: sha256 over the base64-decoded DER SubjectPublicKeyInfo, take
 * the first 16 bytes, and map each hex digit onto 'a'..'p'.
 */
export function deriveExtensionId(base64Key: string): string {
  const digest = createHash('sha256').update(Buffer.from(base64Key, 'base64')).digest('hex');
  return [...digest.slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

function sha256Hex(b: Buffer): string {
  return createHash('sha256').update(b).digest('hex');
}

export function buildExtensionArtifactManifest(files = readExtensionFiles()): ExtensionArtifactManifest {
  const manifestFile = files.find((f) => f.path === 'manifest.json');
  if (!manifestFile) throw new Error('companion extension manifest.json not found');
  const parsed = JSON.parse(manifestFile.bytes.toString('utf8')) as { version?: unknown; key?: unknown };
  if (typeof parsed.version !== 'string') throw new Error('companion extension manifest.json has no version');
  if (typeof parsed.key !== 'string') throw new Error('companion extension manifest.json pins no key');

  const digests: ExtensionFileDigest[] = files.map((f) => ({
    path: f.path,
    bytes: f.bytes.length,
    sha256: sha256Hex(f.bytes),
  }));

  return {
    version: parsed.version,
    extensionId: deriveExtensionId(parsed.key),
    browserSupport: 'chromium-mv3',
    files: digests,
    bundleSha256: sha256Hex(Buffer.from(digests.map((d) => `${d.path}\0${d.sha256}\n`).join(''), 'utf8')),
  };
}

// ── Minimal deterministic ZIP writer (method 0 — stored, no compression) ─────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Fixed DOS timestamp (1980-01-01 00:00) keeps the archive byte-identical for
// identical inputs — a partner can re-download and diff.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

/**
 * Emit a stored (uncompressed) zip. Every entry is placed under
 * `COMPANION_EXTENSION_ARCHIVE_ROOT/` so unzipping produces exactly the
 * directory Chrome's "Load unpacked" expects.
 */
export function writeStoreZip(files: ExtensionFile[], root = COMPANION_EXTENSION_ARCHIVE_ROOT): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(`${root}/${file.path}`, 'utf8');
    const crc = crc32(file.bytes);
    const size = file.bytes.length;

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // local file header signature
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0, 6); // flags
    lfh.writeUInt16LE(0, 8); // method: stored
    lfh.writeUInt16LE(DOS_TIME, 10);
    lfh.writeUInt16LE(DOS_DATE, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18); // compressed size == uncompressed for stored
    lfh.writeUInt32LE(size, 22);
    lfh.writeUInt16LE(name.length, 26);
    lfh.writeUInt16LE(0, 28); // extra length
    local.push(lfh, name, file.bytes);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); // central directory header signature
    cdh.writeUInt16LE(20, 4); // version made by
    cdh.writeUInt16LE(20, 6); // version needed
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(0, 10);
    cdh.writeUInt16LE(DOS_TIME, 12);
    cdh.writeUInt16LE(DOS_DATE, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(size, 20);
    cdh.writeUInt32LE(size, 24);
    cdh.writeUInt16LE(name.length, 28);
    cdh.writeUInt16LE(0, 30); // extra
    cdh.writeUInt16LE(0, 32); // comment
    cdh.writeUInt16LE(0, 34); // disk number start
    cdh.writeUInt16LE(0, 36); // internal attrs
    cdh.writeUInt32LE(0, 38); // external attrs
    cdh.writeUInt32LE(offset, 42); // relative offset of local header
    central.push(cdh, name);

    offset += 30 + name.length + size;
  }

  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  eocd.writeUInt16LE(0, 4); // this disk
  eocd.writeUInt16LE(0, 6); // disk with cd
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...local, cd, eocd]);
}

// ── The install brief the Threshold Gateway hands a crossed Companion ────────

export interface CompanionInstallBrief {
  artifact: ExtensionArtifactManifest;
  downloadUrl: string;
  manifestUrl: string;
  /** Not registered with the Chrome Web Store yet — deliberately null, never guessed. */
  storeListingUrl: null;
  agentBoundary: string;
  steps: string[];
  verify: string[];
  pairing: string[];
  limitations: string[];
}

/**
 * Build the install brief. Pure over `origin` + the checked-in source, so the
 * gateway module stays I/O-light and this is unit-testable offline.
 *
 * Every string here is written for an agent to read ALOUD to its principal.
 * The first thing it says is what the agent cannot do — SPEC-MMC-003 §2.1's
 * no-silent-install constraint is a property of the browser, and an agent that
 * implies otherwise will strand its principal.
 */
export function buildCompanionInstallBrief(origin: string, artifact = buildExtensionArtifactManifest()): CompanionInstallBrief {
  return {
    artifact,
    downloadUrl: `${origin}/api/companion/extension?format=zip`,
    manifestUrl: `${origin}/api/companion/extension`,
    storeListingUrl: null,
    agentBoundary:
      'You cannot install this — no MCP tool, web page, or script can add an extension to a browser (SPEC-MMC-003 §2.1). ' +
      'Your principal performs the install themselves, on surfaces the browser itself renders. Your job is to hand them the ' +
      'artifact, the verification values, and the steps — then confirm afterwards. Say this plainly rather than implying you will do it.',
    steps: [
      `1. Download the Companion bundle: ${origin}/api/companion/extension?format=zip`,
      '2. Unzip it. You will get a folder named "companion-observer".',
      '3. Open chrome://extensions in a Chromium-family browser (Chrome, Edge, Brave, Arc, Opera).',
      '4. Turn on "Developer mode" (top-right toggle).',
      '5. Click "Load unpacked" and select the unzipped "companion-observer" folder.',
      `6. Confirm the card that appears reads ID ${artifact.extensionId} and version ${artifact.version}.`,
    ],
    verify: [
      `The extension ID is pinned by the "key" in manifest.json, so it is the same for this unpacked load as for any future Chrome Web Store listing. It MUST read ${artifact.extensionId}. A different ID means a different, unverified build — remove it.`,
      `Bundle sha256: ${artifact.bundleSha256}. Per-file sha256 values are at ${origin}/api/companion/extension.`,
      'Recompute with: shasum -a 256 companion-observer/* — each value must match the per-file manifest.',
    ],
    pairing: [
      `Installing grants nothing. The Companion holds no session until your principal pairs it, and pairing uses THEIR own signed-in session — never yours.`,
      `Have them open ${origin}/passport-connect and connect (Passport-native; no password).`,
      'Then, with that metaMe tab active, open the Companion popup and click "Connect to metaMe". It reads that tab\'s own session in the tab\'s own context — nothing is transmitted through you.',
      'Have them confirm the active persona in the popup before connecting; pairing without a persona pin silently resolves a fallback persona.',
    ],
    limitations: [
      'Chromium-family only. Manifest V3 is not Firefox\'s or Safari\'s extension model, and no build has been made or tested for either.',
      'Developer-mode unpacked extensions are disabled by some managed/enterprise Chrome policies. If "Load unpacked" is greyed out, the browser is policy-managed and the operator must be told — there is no workaround from this side.',
      'Chrome shows a "Disable developer mode extensions" prompt on each browser restart. That is expected for an unpublished build and goes away when the store listing exists.',
      'Not yet registered with the Chrome Web Store, so there is no auto-update. A new version means downloading and re-loading the folder again.',
    ],
  };
}
