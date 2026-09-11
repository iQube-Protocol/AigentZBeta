/**
 * Companion install artifact canary — SPEC-MMC-003 §3.2 (install orchestration,
 * pre-Chrome-Web-Store path) + the `get_companion_install` Threshold tool.
 *
 * What each block defends, and the defect it would catch:
 *
 *  - **Artifact ≡ source.** The bundle is read from `extension/companion-observer/`
 *    at request time. If anyone reintroduces a hand-kept file list or a committed
 *    zip, the drift test fails (`inv.engineering.036`/`037`).
 *  - **The extension ID is derived, and matches the CSP allowlist.** A partner
 *    verifies their load-unpacked install by reading the ID off
 *    chrome://extensions. If the derived ID and the `chrome-extension://` origin
 *    in `configs/embed/policy.v1.json` ever disagree, pairing breaks in a way
 *    that is near-undiagnosable from the partner's side.
 *  - **No credential ships in a publicly downloadable artifact.** The download
 *    route is deliberately ungated (see its header); that is only safe while the
 *    bundle carries nothing secret. This test is what makes it stay true.
 *  - **The zip is a real zip.** It is hand-rolled (no zip dep in this repo), so
 *    it is verified by extracting it with a real extractor and re-hashing every
 *    member — not by trusting the writer.
 *  - **The build is deterministic, and the clock is quarantined.** A per-request
 *    timestamp anywhere on a digest path would change the artifact SHA on every
 *    download and reduce the integrity claim to noise. Two builds that RE-READ
 *    the tree, under system clocks 31 years apart, must be byte-identical.
 *  - **Exclusions are pinned, not implicit.** The artifact is served ungated, so
 *    "everything in the directory" would ship whatever a stray `.pem` or `.env`
 *    left behind — and silently move the artifact hash.
 *  - **The artifact stays attributable.** Source commit, archive sha256,
 *    version, extension ID, build time, target origin. A missing commit signal
 *    is reported as null with the fix named — never as a fabricated SHA.
 *  - **The tool is handshake-gated and honest.** It must never appear on the
 *    unauthenticated surface, must never claim it can install, and must never
 *    fabricate a store URL.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import path from 'path';

import {
  COMPANION_EXTENSION_DIR,
  COMPANION_EXTENSION_ARCHIVE_ROOT,
  COMPANION_BUNDLE_EXTENSIONS,
  isBundledExtensionFile,
  readExtensionDir,
  readExtensionFiles,
  deriveExtensionId,
  resolveSourceCommit,
  buildExtensionArtifactManifest,
  buildCompanionInstallBrief,
  writeStoreZip,
} from '../services/companion/extensionArtifact';
import { listTools, callTool, HANDSHAKE_TOOLS, type GatewayContext } from '../services/threshold/gateway';
import type { ScopedSession } from '../services/threshold/gatewaySession';

/**
 * `readdir` order is not guaranteed by POSIX, but on this ext4 checkout it
 * happens to come back already sorted — so calling `readExtensionDir()` twice
 * cannot distinguish a reader that sorts from one that does not. (Verified:
 * deleting the `.sort()` left every assertion green.) The only way to make
 * order-stability a real canary is to hand the reader a hostile listing, and
 * `fs` is ESM here so its namespace cannot be spied — hence a hoisted module
 * mock that passes everything through and reverses `readdirSync` only while the
 * order test asks it to.
 */
const readdirOrder = vi.hoisted(() => ({ reversed: false }));

vi.mock('fs', async (importOriginal) => {
  const real = await importOriginal<typeof import('fs')>();
  const readdirSyncPassThrough = (...args: unknown[]) => {
    const entries = (real.readdirSync as (...a: unknown[]) => unknown)(...args);
    return readdirOrder.reversed && Array.isArray(entries) ? [...entries].reverse() : entries;
  };
  return { ...real, default: real, readdirSync: readdirSyncPassThrough };
});

const ORIGIN = 'https://example.test';

const session: ScopedSession = {
  id: 'sess-1',
  principalPublicRef: 'ppr:0123456789abcdef',
  agentAlias: 'companion-alpha',
  agreementId: 'agr-1',
  scope: ['passport.status.read', 'crossing.status.read'],
  initiatingService: 'polity-passport',
  expiresAt: null,
  serviceAgreements: {},
};

function ctx(overrides: Partial<GatewayContext> = {}): GatewayContext {
  return {
    origin: ORIGIN,
    gatewayUrl: `${ORIGIN}/api/threshold/mcp`,
    companionInstall: () => buildCompanionInstallBrief(ORIGIN),
    ...overrides,
  };
}

function toolText(result: Awaited<ReturnType<typeof callTool>>): string {
  return (result.content as Array<{ text: string }>).map((c) => c.text).join('\n');
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/**
 * Walk a zip's central directory. The determinism claim is about BYTES, so the
 * normalisation checks read the archive's own header fields rather than trusting
 * the writer's constants — a writer that stopped applying DOS_TIME would still
 * satisfy an assertion made against DOS_TIME itself.
 */
function centralDirectory(zip: Buffer) {
  const eocd = zip.length - 22; // no archive comment, so EOCD is the final 22 bytes
  expect(zip.readUInt32LE(eocd)).toBe(0x06054b50);
  const count = zip.readUInt16LE(eocd + 10);
  let off = zip.readUInt32LE(eocd + 16);

  return Array.from({ length: count }, () => {
    expect(zip.readUInt32LE(off)).toBe(0x02014b50);
    const nameLen = zip.readUInt16LE(off + 28);
    const extraLen = zip.readUInt16LE(off + 30);
    const commentLen = zip.readUInt16LE(off + 32);
    const localHeader = zip.readUInt32LE(off + 42);
    expect(zip.readUInt32LE(localHeader)).toBe(0x04034b50);

    const entry = {
      name: zip.subarray(off + 46, off + 46 + nameLen).toString('utf8'),
      method: zip.readUInt16LE(off + 10),
      dosTime: zip.readUInt16LE(off + 12),
      dosDate: zip.readUInt16LE(off + 14),
      externalAttrs: zip.readUInt32LE(off + 38),
      localDosTime: zip.readUInt16LE(localHeader + 10),
      localDosDate: zip.readUInt16LE(localHeader + 12),
    };
    off += 46 + nameLen + extraLen + commentLen;
    return entry;
  });
}

describe('Companion extension artifact — the bundle IS the source', () => {
  it('bundles every shippable file in the extension directory, with no hand-kept list', () => {
    const onDisk = readdirSync(path.join(process.cwd(), COMPANION_EXTENSION_DIR), { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();
    const { files, excluded } = readExtensionDir();

    expect(files.map((f) => f.path)).toEqual(onDisk.filter(isBundledExtensionFile));
    expect(excluded).toEqual(onDisk.filter((n) => !isBundledExtensionFile(n)));
    // The allowlist must be a safety net, not a filter that is quietly dropping
    // real extension source today. Every checked-in file ships.
    expect(excluded).toEqual([]);
    // Sanity: the extension really is there (an empty dir must not pass silently).
    expect(files.map((f) => f.path)).toContain('manifest.json');
    expect(files.map((f) => f.path)).toContain('background.js');
  });

  it('hashes each file to its real content, and the bundle hash covers every file', () => {
    const manifest = buildExtensionArtifactManifest();
    for (const entry of manifest.files) {
      const bytes = readFileSync(path.join(process.cwd(), COMPANION_EXTENSION_DIR, entry.path));
      expect(entry.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
      expect(entry.bytes).toBe(bytes.length);
    }
  });

  it('moves the bundle hash when any file\'s content or name changes', () => {
    // Exercised through the production builder, not by recomputing the formula
    // here — a self-referential assertion would pass even if bundleSha256 stopped
    // covering file content, leaving a tampered member able to verify clean.
    const files = readExtensionFiles();
    const baseline = buildExtensionArtifactManifest(files).bundleSha256;

    const target = files.findIndex((f) => f.path === 'background.js');
    const contentChanged = files.map((f, i) =>
      i === target ? { ...f, bytes: Buffer.concat([f.bytes, Buffer.from('//tamper')]) } : f,
    );
    expect(buildExtensionArtifactManifest(contentChanged).bundleSha256).not.toBe(baseline);

    const renamed = files.map((f, i) => (i === target ? { ...f, path: 'background-evil.js' } : f));
    expect(buildExtensionArtifactManifest(renamed).bundleSha256).not.toBe(baseline);
  });

  it('reports the version Chrome will display, from manifest.json itself', () => {
    const declared = JSON.parse(
      readFileSync(path.join(process.cwd(), COMPANION_EXTENSION_DIR, 'manifest.json'), 'utf8'),
    ) as { version: string };
    expect(buildExtensionArtifactManifest().version).toBe(declared.version);
  });
});

describe('Extension ID — derived, and the same ID the CSP allowlist trusts', () => {
  it('derives the pinned ID the way Chromium does, and it matches the frame-ancestors allowlist', () => {
    const { extensionId } = buildExtensionArtifactManifest();
    const policy = readFileSync(path.join(process.cwd(), 'configs/embed/policy.v1.json'), 'utf8');

    expect(extensionId).toMatch(/^[a-p]{32}$/);
    // The partner reads this ID off chrome://extensions to prove what they
    // loaded; the platform trusts the same origin to frame its surfaces.
    expect(policy).toContain(`chrome-extension://${extensionId}`);
  });

  it('is a function of the key — a different key yields a different ID', () => {
    const { key } = JSON.parse(
      readFileSync(path.join(process.cwd(), COMPANION_EXTENSION_DIR, 'manifest.json'), 'utf8'),
    ) as { key: string };
    const other = Buffer.from(key, 'base64');
    other[0] ^= 0xff;
    expect(deriveExtensionId(other.toString('base64'))).not.toBe(deriveExtensionId(key));
  });
});

describe('The publicly downloadable bundle carries no credential', () => {
  // The download route is ungated by design (a Chrome extension is a public
  // artifact, and PRD-MMC-001 §4.1: the install "grants nothing beyond
  // identity-only"). That is only safe while this holds.
  it('contains no secret-shaped literal', () => {
    const offenders: string[] = [];
    for (const file of readExtensionFiles()) {
      const text = file.bytes.toString('utf8');
      const hits = [
        /eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/, // a JWT
        /\bsb_secret_[A-Za-z0-9_-]{10,}/, // supabase secret key
        /service[_-]?role[_-]?key\s*[:=]\s*['"][^'"]{10,}/i,
        /(api[_-]?key|secret|password|private[_-]?key)\s*[:=]\s*['"][A-Za-z0-9_\-/+]{16,}['"]/i,
      ].filter((re) => re.test(text));
      if (hits.length) offenders.push(`${file.path}: ${hits.map(String).join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('pins only the operator-confirmed app origin — no fabricated host', () => {
    const constants = readExtensionFiles().find((f) => f.path === 'constants.js');
    expect(constants).toBeDefined();
    const origins = [...constants!.bytes.toString('utf8').matchAll(/https?:\/\/[a-z0-9.-]+/gi)].map((m) => m[0]);
    expect(new Set(origins)).toEqual(new Set(['https://dev-beta.aigentz.me']));
  });
});

describe('The zip is a real zip — verified by extraction, not by trusting the writer', () => {
  it('round-trips through a real extractor with every member byte-identical', () => {
    const files = readExtensionFiles();
    const dir = mkdtempSync(path.join(tmpdir(), 'companion-zip-'));
    const zipPath = path.join(dir, 'bundle.zip');
    writeFileSync(zipPath, writeStoreZip(files));

    // `unzip -qq` fails loudly (non-zero exit) on a malformed archive, so a
    // structurally broken zip cannot pass this test silently.
    execFileSync('unzip', ['-qq', zipPath, '-d', dir]);

    const root = path.join(dir, COMPANION_EXTENSION_ARCHIVE_ROOT);
    const extracted = readdirSync(root).sort();
    expect(extracted).toEqual(files.map((f) => f.path));
    for (const file of files) {
      expect(readFileSync(path.join(root, file.path))).toEqual(file.bytes);
    }
  });

  it('is deterministic — identical input yields byte-identical output', () => {
    const files = readExtensionFiles();
    expect(writeStoreZip(files).equals(writeStoreZip(files))).toBe(true);
  });
});

/**
 * The operator's ruling: "If runtime ZIP creation includes current timestamps,
 * then the SHA changes on every request even though the source is unchanged.
 * That would weaken the integrity claim." Each of the five named sub-properties
 * gets its own assertion, because they fail independently — a writer can be
 * order-stable and still leak the server's umask through file permissions.
 */
describe('Deterministic build — two builds from the same tree are byte-identical', () => {
  afterEach(() => vi.useRealTimers());

  it('re-reads the tree between builds and still produces identical bytes and hashes', () => {
    // Deliberately NOT one `files` array reused twice: that only proves the
    // writer is a function of its argument. Re-reading exercises readExtensionDir
    // too, so filesystem-order instability would surface here.
    const first = writeStoreZip(readExtensionFiles());
    const second = writeStoreZip(readExtensionFiles());

    expect(first.equals(second)).toBe(true);
    expect(sha256(first)).toBe(sha256(second));
    expect(buildExtensionArtifactManifest(readExtensionDir()).archiveSha256).toBe(
      buildExtensionArtifactManifest(readExtensionDir()).archiveSha256,
    );
    // Same-tree-same-hash across the whole manifest, not just the archive.
    expect(buildExtensionArtifactManifest(readExtensionDir()).bundleSha256).toBe(
      buildExtensionArtifactManifest(readExtensionDir()).bundleSha256,
    );
  });

  it('advertises the hash of the bytes it actually serves', () => {
    // If archiveSha256 and the served zip ever diverge, every partner's
    // `shasum` check fails and the artifact looks tampered with.
    const tree = readExtensionDir();
    expect(buildExtensionArtifactManifest(tree).archiveSha256).toBe(sha256(writeStoreZip(tree.files)));
    // ...and it is genuinely a different value from the source-tree commitment,
    // so publishing both is not publishing the same number twice.
    expect(buildExtensionArtifactManifest(tree).archiveSha256).not.toBe(
      buildExtensionArtifactManifest(tree).bundleSha256,
    );
  });

  it('(1) file order is stable even when the filesystem hands back a different order', () => {
    const files = readExtensionFiles();

    // Prove order is load-bearing first: a permuted input yields a different
    // archive, so an order-unstable reader WOULD move the artifact hash.
    const permuted = [files[files.length - 1], ...files.slice(0, -1)];
    expect(writeStoreZip(permuted).equals(writeStoreZip(files))).toBe(false);

    // Now hand the reader a hostile (reversed) directory listing. Only a reader
    // that sorts survives — see the `readdirOrder` note at the top of this file.
    readdirOrder.reversed = true;
    try {
      const hostile = readExtensionDir();
      expect(hostile.files.map((f) => f.path)).toEqual(files.map((f) => f.path));
      expect(hostile.files.map((f) => f.path)).toEqual([...files.map((f) => f.path)].sort());
      // The hash is therefore a property of the tree, not of the filesystem.
      expect(writeStoreZip(hostile.files).equals(writeStoreZip(files))).toBe(true);
      expect(hostile.excluded).toEqual([...hostile.excluded].sort());
    } finally {
      readdirOrder.reversed = false;
    }
  });

  it('(2) in-archive timestamps are normalized — every entry reads 1980-01-01', () => {
    const entries = centralDirectory(writeStoreZip(readExtensionFiles()));
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.dosTime).toBe(0);
      expect(e.dosDate).toBe(0x0021); // 1980-01-01
      // The local header carries its own copy; both must be normalized or an
      // extractor will restore a wall-clock mtime.
      expect(e.localDosTime).toBe(0);
      expect(e.localDosDate).toBe(0x0021);
    }
  });

  it('(3) permissions are normalized — external attributes are zero for every entry', () => {
    // Otherwise the build server's umask and checked-out file modes leak into
    // the archive bytes, and the hash differs between build hosts.
    for (const e of centralDirectory(writeStoreZip(readExtensionFiles()))) {
      expect(e.externalAttrs).toBe(0);
      expect(e.method).toBe(0); // stored — no compressor version can shift bytes
    }
  });

  it('(4) exclusions are pinned to an explicit allowlist, not left implicit', () => {
    // Implicit "everything in the directory" would ship a stray credential file
    // over an ungated public route and silently move the artifact hash.
    for (const stray of [
      '.DS_Store',
      '.env',
      '.env.local',
      '.npmrc',
      // A dotfile whose EXTENSION is on the allowlist. `path.extname('.env')`
      // is '' so the extension check alone already rejects most dotfiles — this
      // is the one that slips through without an explicit leading-dot guard.
      '.eslintrc.json',
      '.babelrc.json',
      'notes.md',
      'key.pem',
      'bundle.zip',
      'background.js.bak',
      'popup.html~',
      'README',
    ]) {
      expect(isBundledExtensionFile(stray)).toBe(false);
    }
    for (const shipped of ['manifest.json', 'background.js', 'popup.html', 'icon.png', 'styles.css']) {
      expect(isBundledExtensionFile(shipped)).toBe(true);
    }
    // The allowlist is closed — no executable/archive/secret-bearing types.
    expect([...COMPANION_BUNDLE_EXTENSIONS].sort()).toEqual(
      ['.css', '.html', '.js', '.json', '.png', '.svg', '.webp', '.woff2'].sort(),
    );

    // A stray file must not move either digest, and must be REPORTED rather
    // than silently dropped.
    const tree = readExtensionDir();
    const withStray = { files: tree.files, excluded: [...tree.excluded, 'key.pem'] };
    expect(buildExtensionArtifactManifest(withStray).bundleSha256).toBe(
      buildExtensionArtifactManifest(tree).bundleSha256,
    );
    expect(buildExtensionArtifactManifest(withStray).archiveSha256).toBe(
      buildExtensionArtifactManifest(tree).archiveSha256,
    );
    expect(buildExtensionArtifactManifest(withStray).excluded).toContain('key.pem');
  });

  it('(5) the clock cannot reach any digest — builtAt is response metadata only', () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date('1999-12-31T23:59:59.000Z'));
    const early = buildCompanionInstallBrief(ORIGIN, buildExtensionArtifactManifest(readExtensionDir()));
    const earlyZip = writeStoreZip(readExtensionFiles());

    vi.setSystemTime(new Date('2031-06-01T12:34:56.000Z'));
    const late = buildCompanionInstallBrief(ORIGIN, buildExtensionArtifactManifest(readExtensionDir()));
    const lateZip = writeStoreZip(readExtensionFiles());

    // The clock moved 31 years...
    expect(late.provenance.builtAt).not.toBe(early.provenance.builtAt);
    expect(early.provenance.builtAt).toBe('1999-12-31T23:59:59.000Z');
    // ...and nothing on a digest path noticed.
    expect(earlyZip.equals(lateZip)).toBe(true);
    expect(late.artifact.archiveSha256).toBe(early.artifact.archiveSha256);
    expect(late.artifact.bundleSha256).toBe(early.artifact.bundleSha256);

    // Structural guard: the manifest has no timestamp field for a later edit to
    // fold into a hash. Any ISO-8601-shaped string in it is a regression.
    expect(JSON.stringify(late.artifact)).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(Object.keys(late.artifact)).not.toContain('builtAt');
  });
});

/**
 * Provenance — the operator's ruling: the artifact must remain ATTRIBUTABLE.
 * A fabricated SHA would be worse than no SHA, so the null path is tested as
 * carefully as the happy one.
 */
describe('Provenance — attributable, and honest when it cannot be', () => {
  it('prefers COMMIT_SHA, the name this repo already uses for the value', () => {
    const sha = 'a'.repeat(40);
    expect(resolveSourceCommit({ COMMIT_SHA: sha, BACKEND_VERSION: 'dev-' + 'b'.repeat(40) })).toEqual({
      sourceCommit: sha,
      sourceCommitSource: 'COMMIT_SHA',
      sourceCommitNote: null,
    });
  });

  it('falls back to the commit inside BACKEND_VERSION, which Amplify does thread to runtime', () => {
    // amplify.yml: BACKEND_VERSION="${AWS_BRANCH:-unknown}-${AWS_COMMIT_ID:-$(git rev-parse --short HEAD)}"
    const sha = '231e4c762ab34cd56ef78901234567890abcdef1';
    const resolved = resolveSourceCommit({ COMMIT_SHA: undefined, BACKEND_VERSION: `dev-${sha}` });
    expect(resolved).toEqual({ sourceCommit: sha, sourceCommitSource: 'BACKEND_VERSION', sourceCommitNote: null });

    // Branch names contain '-' and '/', so the parse must anchor on the trailing
    // hex run rather than splitting on the first separator.
    expect(resolveSourceCommit({ BACKEND_VERSION: 'claude/some-feature-branch-9f8e7d6' }).sourceCommit).toBe('9f8e7d6');
    // ...and a branch whose OWN name contains a hex-looking segment must not
    // shadow the real commit. Only the trailing run is the SHA.
    expect(resolveSourceCommit({ BACKEND_VERSION: 'release-deadbeef-9f8e7d6' }).sourceCommit).toBe('9f8e7d6');
  });

  it('reports null — never a guessed or "unknown" SHA — when no signal exists', () => {
    for (const env of [
      {},
      { BACKEND_VERSION: 'dev-unknown' },
      { BACKEND_VERSION: 'dev-' },
      { BACKEND_VERSION: 'unknown' },
      { COMMIT_SHA: 'unknown', BACKEND_VERSION: 'main' },
      // AWS_COMMIT_ID unset, so amplify.yml's fallback produced no trailing
      // SHA. A hex-looking BRANCH segment must not be harvested as a commit —
      // that would be a fabricated attribution, which is worse than none.
      { BACKEND_VERSION: 'release-abcdef1234-unknown' },
    ]) {
      const r = resolveSourceCommit(env);
      expect(r.sourceCommit).toBeNull();
      expect(r.sourceCommitSource).toBe('unset');
      // The null must explain itself and name the fix, per the No-Guessing rule.
      expect(r.sourceCommitNote).toMatch(/COMMIT_SHA/);
      expect(r.sourceCommitNote).toMatch(/no SHA has been guessed/i);
    }
  });

  it('emits every attribution field the artifact needs to stay traceable', () => {
    const brief = buildCompanionInstallBrief(ORIGIN);
    // Operator's list: source commit, artifact sha256, manifest version,
    // derived extension ID, build timestamp, target origin.
    expect(brief.provenance).toHaveProperty('sourceCommit');
    expect(brief.provenance.sourceCommitSource).toMatch(/^(COMMIT_SHA|BACKEND_VERSION|unset)$/);
    expect(brief.provenance.builtAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(brief.provenance.targetOrigin).toBe(ORIGIN);
    expect(brief.artifact.archiveSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(brief.artifact.version).toMatch(/^\d+(\.\d+)*$/);
    expect(brief.artifact.extensionId).toMatch(/^[a-p]{32}$/);
  });

  it('tells a partner which digest to hash — the .zip, not the tree commitment', () => {
    // The earlier copy offered only the tree commitment beside a download link,
    // so the obvious `shasum` on the .zip mismatched a value that was never its
    // hash. Both are now named, and the archive hash is the one tied to the file.
    const brief = buildCompanionInstallBrief(ORIGIN);
    const verify = brief.verify.join('\n');
    expect(verify).toContain(brief.artifact.archiveSha256);
    expect(verify).toContain(brief.artifact.bundleSha256);
    expect(verify).toMatch(new RegExp(`${brief.artifact.archiveSha256}[\\s\\S]{0,200}shasum -a 256 metame-companion-`));
    expect(verify).toMatch(/not over the \.zip bytes/);
  });
});

describe('get_companion_install — handshake-gated, and honest about what it cannot do', () => {
  it('is advertised and is a handshake tool, so it is never on the unauthenticated surface', () => {
    const tool = listTools().find((t) => t.name === 'get_companion_install');
    expect(tool).toBeDefined();
    expect(HANDSHAKE_TOOLS.has('get_companion_install')).toBe(true);
    // An agent must not read the description and conclude it can install.
    expect(tool!.description).toMatch(/cannot install/i);
  });

  it('refuses without a session', async () => {
    const result = await callTool('get_companion_install', {}, ctx());
    expect(result.isError).toBe(true);
    expect(toolText(result)).toMatch(/Constitutional Handshake/i);
  });

  it('with a session, hands over the artifact, the integrity values, and the human steps', async () => {
    const result = await callTool('get_companion_install', {}, ctx({ session }));
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(toolText(result)) as Record<string, unknown>;
    const artifact = payload.artifact as { extensionId: string; bundleSha256: string; version: string };

    expect(payload.downloadUrl).toBe(`${ORIGIN}/api/companion/extension?format=zip`);
    expect(artifact.extensionId).toBe(buildExtensionArtifactManifest().extensionId);
    expect(artifact.bundleSha256).toBe(buildExtensionArtifactManifest().bundleSha256);
    // The steps must name the browser-controlled surfaces, and the ID to check.
    const steps = (payload.steps as string[]).join('\n');
    expect(steps).toContain('chrome://extensions');
    expect(steps).toMatch(/Developer mode/i);
    expect(steps).toMatch(/Load unpacked/i);
    expect(steps).toContain(artifact.extensionId);
    // Pairing is a separate, human act using the principal's own session.
    expect((payload.pairing as string[]).join('\n')).toContain('/passport-connect');
  });

  it('never fabricates a Chrome Web Store URL', async () => {
    const result = await callTool('get_companion_install', {}, ctx({ session }));
    const payload = JSON.parse(toolText(result)) as Record<string, unknown>;
    expect(payload.storeListingUrl).toBeNull();
    expect(toolText(result)).not.toMatch(/chrome\.google\.com\/webstore|chromewebstore\.google\.com/);
  });

  it('states the agent boundary — no implied install, no session through the agent', async () => {
    const text = toolText(await callTool('get_companion_install', {}, ctx({ session })));
    expect(text).toMatch(/cannot install/i);
    expect(text).toMatch(/HUMAN acts/);
    expect(text).toMatch(/never passes through you/);
  });

  it('emits no T0 identifier', async () => {
    const text = toolText(await callTool('get_companion_install', {}, ctx({ session })));
    expect(text).not.toMatch(/personaId|authProfileId|rootDid|kybe/i);
  });

  it('degrades honestly when the artifact is unavailable on this gateway', async () => {
    const result = await callTool('get_companion_install', {}, ctx({ session, companionInstall: undefined }));
    expect(result.isError).toBe(true);
    expect(toolText(result)).toMatch(/unavailable/i);
  });
});
