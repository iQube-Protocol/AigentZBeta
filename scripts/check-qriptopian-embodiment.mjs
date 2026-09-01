// Read-only live acceptance: classify first, then verify actual delivery bytes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const origin = process.argv[2] || 'https://dev-beta.aigentz.me';
const originalPolity = ['4030a684-1c42-44b8-bd23-8d31b4b33720', 'f737e898-bdaa-45b3-8cf5-8149ef9d3410', 'd598222f-bfd9-4ff3-87de-833411d7aa21', 'f7342afc-477d-447f-a68b-75df94b2a954'];
const embodiment = [
  ['52370b24-467e-4ee4-8f02-64b09fd00b04', '9370e7ce-28e0-4257-ba3f-4919e6293ffb', '9c36e1f79ba13aa037cd75397c052f9c01b9a4546beee51086b38db0769401bf'],
  ['2e964bcf-13ea-4300-9fd9-7923cee80355', '66d98179-9040-40aa-89aa-45328c2b58c7', 'f6e7140dc0844e99f9d77eec376ab5c696f6ce92db7786d73ae3873b79500e2c'],
  ['94738475-7072-4b7c-951c-bdfeb6e3e6aa', 'dbd21d56-1e34-405c-adef-7f88df9baa21', '56bc3380a00f72b037f009124ed0bd980e30d9d794fd519488f9b5230d6b3cc3'],
  ['ccd624cb-50c1-41bb-a486-18757ea82445', '552b4ad1-09d6-411d-9712-21af61350c57', 'f9047e0e937a384f0b19e6a5b84ca0a398cb9302825ce138e7f348c80b3abc43'],
  ['e5d48b5b-3af3-4078-b235-4831cd7c2ed3', '5f6120da-a92e-4fee-b3ca-2180048d1e28', '668e2a2907b48adffcd3a11562497d07ee4b1aa2cabb675096c0004d54028a57'],
];

async function get(path) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(30000), cache: 'no-store' });
  assert(response.ok, `${path}: HTTP ${response.status}`);
  return response;
}

const data = await (await get('/api/codex/qripto/papers')).json();
const polity = data.papers.filter(p => p.scope === 'papers/polity');
const embodied = data.papers.filter(p => p.scope === 'papers/embodiment');
assert.deepEqual(polity.map(p => p.id).sort(), originalPolity.sort());
assert.deepEqual(embodied.map(p => p.id).sort(), embodiment.map(p => p[0]).sort());
assert(embodied.every(p => p.scopeLabel === 'Embodiment'));
console.log(JSON.stringify({ check: 'taxonomy', polity: polity.length, embodiment: embodied.length, status: 'PASS' }));

let failures = 0;
for (const [id, coverId, expectedHash] of embodiment) {
  const card = embodied.find(p => p.id === id);
  assert.equal(card.pdfUrl, `/api/content/media/${id}`);
  assert.equal(card.coverUrl, `/api/qriptopian/essay-cover/${coverId}`);
  for (const [kind, path] of [['pdf', card.pdfUrl], ['cover', card.coverUrl]]) {
    try {
      const response = await get(path);
      const bytes = Buffer.from(await response.arrayBuffer());
      const mime = response.headers.get('content-type');
      if (kind === 'pdf') {
        assert(mime?.includes('application/pdf'), `wrong MIME ${mime}`);
        assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
        assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash);
      } else {
        assert(mime?.startsWith('image/'), `wrong MIME ${mime}`);
        const sharp = (await import('sharp')).default;
        const { width, height } = await sharp(bytes, { failOn: 'error' }).metadata();
        assert(width >= 100 && height >= 100, 'cover too small');
        await sharp(bytes, { failOn: 'error' }).raw().toBuffer();
      }
      console.log(JSON.stringify({ id, kind, status: 'PASS', bytes: bytes.length, mime }));
    } catch (error) {
      failures++;
      console.log(JSON.stringify({ id, kind, status: 'FAIL', error: String(error) }));
    }
  }
}
// A matching hash proves delivery of the previously uploaded edition, not editorial canonicity.
process.exitCode = failures ? 1 : 0;
