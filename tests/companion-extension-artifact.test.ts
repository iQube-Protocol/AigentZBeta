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
 *  - **The tool is handshake-gated and honest.** It must never appear on the
 *    unauthenticated surface, must never claim it can install, and must never
 *    fabricate a store URL.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import path from 'path';

import {
  COMPANION_EXTENSION_DIR,
  COMPANION_EXTENSION_ARCHIVE_ROOT,
  readExtensionFiles,
  deriveExtensionId,
  buildExtensionArtifactManifest,
  buildCompanionInstallBrief,
  writeStoreZip,
} from '../services/companion/extensionArtifact';
import { listTools, callTool, HANDSHAKE_TOOLS, type GatewayContext } from '../services/threshold/gateway';
import type { ScopedSession } from '../services/threshold/gatewaySession';

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

describe('Companion extension artifact — the bundle IS the source', () => {
  it('bundles every file in the extension directory, with no hand-kept list', () => {
    const onDisk = readdirSync(path.join(process.cwd(), COMPANION_EXTENSION_DIR), { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();
    const bundled = readExtensionFiles().map((f) => f.path);

    expect(bundled).toEqual(onDisk);
    // Sanity: the extension really is there (an empty dir must not pass silently).
    expect(bundled).toContain('manifest.json');
    expect(bundled).toContain('background.js');
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
