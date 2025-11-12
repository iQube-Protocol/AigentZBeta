import { Router } from 'express';
import { requireAuth } from './mw-auth.js';
import { supabase, STORAGE_BUCKET } from '../db.js';
import { registerMetaQube, createContentQube } from '../registry.js';

export const assetsRouter = Router();

assetsRouter.post('/upload/initiate', requireAuth, async (req, res) => {
  const { tenant_id } = (req as any).auth;
  const { media_kind, bytes, owner_did } = req.body || {};
  if (!media_kind || !bytes || !owner_did) return res.status(400).json({ error: 'media_kind, bytes, owner_did required' });

  const { data, error } = await supabase.from('content_assets').insert({
    tenant_id, owner_did, media_kind, bytes, storage_uri: 'pending'
  }).select('id').single();
  if (error) return res.status(500).json({ error: error.message });

  const assetId = data.id;
  const objectPath = `${tenant_id}/${assetId}`;
  res.json({ asset_id: assetId, upload_url: `/aa/v1/assets/upload/${assetId}`, storage_uri: `supabase://${STORAGE_BUCKET}/${objectPath}` });
});

assetsRouter.put('/upload/:assetId', requireAuth, async (req, res) => {
  const { tenant_id } = (req as any).auth;
  const { assetId } = req.params;
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const buf = Buffer.concat(chunks);
    const objectPath = `${tenant_id}/${assetId}`;
    const { error } = await (supabase as any).storage.from(STORAGE_BUCKET).upload(objectPath, buf, { upsert: true, contentType: req.headers['content-type'] || 'application/octet-stream' });
    if (error) return res.status(500).json({ error: error.message });
    await supabase.from('content_assets').update({ storage_uri: `supabase://${STORAGE_BUCKET}/${objectPath}` }).eq('id', assetId);
    res.json({ ok: true });
  });
});

assetsRouter.post('/register', requireAuth, async (req, res) => {
  const { asset_id, title, description, tags, sha256 } = req.body || {};
  if (!asset_id || !sha256) return res.status(400).json({ error: 'asset_id & sha256 required' });
  const { data: asset, error: e1 } = await supabase.from('content_assets').select('*').eq('id', asset_id).single();
  if (e1 || !asset) return res.status(404).json({ error: 'asset not found' });

  const meta = { title, description, tags, sha256, storage_uri: asset.storage_uri, bytes: asset.bytes, media_kind: asset.media_kind } as any;
  const { cid } = await registerMetaQube(meta);
  const { contentQubeId } = await createContentQube({ metaQubeCid: cid, blakQubeUri: asset.storage_uri });

  const { error: e2 } = await supabase.from('content_assets').update({ title, description, tags, sha256, registry_ref: cid, status: 'registered' }).eq('id', asset_id);
  if (e2) return res.status(500).json({ error: e2.message });

  res.json({ registry_ref: cid, content_qube_id: contentQubeId });
});

assetsRouter.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { data: asset, error } = await supabase.from('content_assets').select('*').eq('id', id).single();
  if (error || !asset) return res.status(404).json({ error: 'not found' });
  const { data: policy } = await supabase.from('asset_policies').select('*').eq('asset_id', id).maybeSingle();
  res.json({ ...asset, policy });
});

assetsRouter.get('/', requireAuth, async (req, res) => {
  const { tenant_id } = (req as any).auth;
  const { data, error } = await supabase.from('content_assets').select('*').eq('tenant_id', tenant_id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
