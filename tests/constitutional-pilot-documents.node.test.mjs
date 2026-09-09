import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const root = 'docs/vela/accelerator/constitutional-financial-services';
const catalogSource = await fs.readFile('services/knowledge/constitutionalPilotDocuments.ts', 'utf8');
const catalog = JSON.parse(catalogSource.slice(catalogSource.indexOf('['), catalogSource.lastIndexOf(']') + 1));
const source = await fs.readFile('app/api/admin/registry/docs/route.ts', 'utf8');
async function reader(persona) {
  let reads = 0;
  const code = stripTypeScriptTypes(source.replace(/^import .*;\n/gm, '').replace('export async function GET', 'async function GET'));
  const context = vm.createContext({ URL, process, path, CONSTITUTIONAL_PILOT_DOCUMENTS: catalog,
    getActivePersona: async () => persona,
    NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) },
    readFile: async (...args) => { reads++; return fs.readFile(...args); },
    ensureCorpusHydrated: async () => {}, corpusReadFile: () => null });
  vm.runInContext(code, context);
  return { get: query => context.GET({ url: 'https://test/api/admin/registry/docs?' + query }), reads: () => reads };
}
test('anonymous and non-admin cannot read pilot content even with admin query flags', async () => {
  for (const [persona, status] of [[null,401], [{cartridgeFlags:{isAdmin:false}},403]]) {
    const r = await reader(persona);
    assert.equal((await r.get('isAdmin=true&path=' + encodeURIComponent(catalog[0].path))).status, status);
    assert.equal(r.reads(),0);
  }
});
test('admin reads all 13 canonical documents; traversal is rejected before disk read', async () => {
  const r = await reader({cartridgeFlags:{isAdmin:true}});
  assert.equal((await r.get('bundle=constitutional-pilot')).body.total,13);
  for (const entry of catalog) {
    const result = await r.get('path=' + encodeURIComponent(entry.path));
    assert.equal(result.status,200);
    assert.equal(result.body.content,await fs.readFile(entry.path,'utf8'));
  }
  assert.equal((await r.get('path=' + encodeURIComponent(root+'/../../../../.env'))).status,404);
  assert.equal(r.reads(),13);
});
test('both admin projections and deploy tracing cover the canonical source', async () => {
  const config = await fs.readFile('data/codex-configs.ts','utf8');
  for (const id of ['constitutional-pilot','constitutional-pilot-development']) {
    assert.match(config,new RegExp("id: '"+id+"'.*adminOnly: true.*ConstitutionalPilotDocumentsTab"));
  }
  const next = await fs.readFile('next.config.js','utf8');
  assert.ok(next.includes('./'+root+'/*.{md,json}'));
  assert.ok(catalog.filter(d=>d.development).some(d=>d.path.includes('09_CLAUDE')));
  assert.equal(catalog.length,13);
});
