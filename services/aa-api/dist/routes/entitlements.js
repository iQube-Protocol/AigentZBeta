import { Router } from 'express';
import { requireAuth } from './mw-auth.js';
import { supabase, STORAGE_BUCKET } from '../db.js';
export const entitlementsRouter = Router();
// GET /aa/v1/entitlements/:assetId
// Checks if requester DID has entitlement; returns entitlement and optional signed URL
entitlementsRouter.get('/:assetId', requireAuth, async (req, res) => {
    try {
        const { did } = req.auth;
        const { assetId } = req.params;
        if (!assetId)
            return res.status(400).json({ error: 'assetId required' });
        const { data: ent, error: e1 } = await supabase
            .from('entitlements')
            .select('*')
            .eq('asset_id', assetId)
            .eq('holder_did', did)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (e1?.code === 'PGRST116') {
            return res.json({ ok: true, entitled: false });
        }
        if (e1)
            return res.status(500).json({ error: e1.message });
        if (!ent)
            return res.json({ ok: true, entitled: false });
        // Optionally sign a URL if we have a storage path
        let signed_url;
        const { data: asset, error: e2 } = await supabase
            .from('content_assets')
            .select('*')
            .eq('id', assetId)
            .single();
        if (!e2 && asset?.storage_uri) {
            try {
                // Assume storage_uri is a path within the configured bucket
                const { data, error } = await supabase.storage
                    .from(STORAGE_BUCKET)
                    .createSignedUrl(asset.storage_uri, 60 * 10); // 10 minutes
                if (!error)
                    signed_url = data?.signedUrl;
            }
            catch {
                // ignore signing issues and still return entitlement
            }
        }
        return res.json({ ok: true, entitled: true, entitlement: ent, signed_url });
    }
    catch (e) {
        return res.status(500).json({ error: e?.message || 'entitlement check failed' });
    }
});
