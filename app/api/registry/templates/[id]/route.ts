import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../_lib/supabaseServer';
import { getStore, setStore } from '../store';
import { IQubeTemplate } from '../../../../../types/registry';

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// Minimal Supabase REST client using fetch so we avoid adding a new dependency.
function buildUrl(base: string, path: string, params?: Record<string, string>) {
  const url = new URL(path, base.endsWith('/') ? base : base + '/');
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // --- Supabase config ---
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    // --- Validate ID ---
    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'Missing template id' }, { status: 400 });
    }

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(id)) {
      return NextResponse.json({ error: 'Invalid id format' }, { status: 400 });
    }

    // --- Build REST query ---
    const qp: Record<string, string> = {
      select: '*',
      id: `eq.${id}`,
      limit: '1',
    };

    const endpoint = buildUrl(url, 'rest/v1/iqube_templates', qp);

    const res = await fetch(endpoint, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Supabase error: ${res.status} ${text}` },
        { status: 500 }
      );
    }

    const rows = await res.json();
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const r = rows[0];

    // --- Map DB row to frontend-friendly object ---
    const mapped = {
      id: r.id,
      name: r.name,
      description: r.description || '',
      iQubeType: r.iqube_type || undefined,
      iQubeInstanceType: r.instance_type || undefined,
      businessModel: r.business_model || undefined,
      version: r.version || '1.0',
      provenance: typeof r.provenance === 'number' ? r.provenance : 0,
      sensitivityScore: r.sensitivity_score ?? r.sensitivityScore ?? 0,
      accuracyScore: r.accuracy_score ?? r.accuracyScore ?? 0,
      verifiabilityScore: r.verifiability_score ?? r.verifiabilityScore ?? 0,
      riskScore: r.risk_score ?? r.riskScore ?? 0,
      price: typeof r.price === 'number' ? r.price : (r.price_usd ?? null),
      blakqubeLabels: r.blakqube_labels || r.blakqubeLabels || [],
      metaExtras: r.metaqube_extras || null,
      visibility: r.visibility || 'public',
      userId: r.user_id || null,
      createdAt: r.created_at,
      parentTemplateId: r.parent_template_id ?? undefined,
    };

    return NextResponse.json(mapped, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const body = await req.json();
    const supabase = getSupabaseServer();
    if (supabase) {
      const payload: any = {};
      // Same allowed fields as PATCH — populate payload only for keys present in body
      if ('name' in body) payload.name = body.name;
      if ('description' in body) payload.description = body.description;
      if ('iQubeType' in body) payload.iqube_type = body.iQubeType;
      if ('iQubeInstanceType' in body) payload.instance_type = body.iQubeInstanceType;
      if ('businessModel' in body) payload.business_model = body.businessModel;
      if ('price' in body) {
        if (body.price === null) payload.price = null;
        else if (body.price !== undefined) payload.price = body.price;
      }
      if ('version' in body && body.version !== undefined) payload.version = body.version;
      if ('provenance' in body && body.provenance !== undefined) payload.provenance = body.provenance;
      if ('parentTemplateId' in body && body.parentTemplateId !== undefined) payload.parent_template_id = body.parentTemplateId;
      if ('blakqubeLabels' in body && body.blakqubeLabels !== undefined) payload.blakqube_labels = body.blakqubeLabels;
      if ('metaExtras' in body && body.metaExtras !== undefined) payload.metaqube_extras = body.metaExtras;
      if ('sensitivityScore' in body && body.sensitivityScore !== undefined) payload.sensitivity_score = body.sensitivityScore;
      if ('accuracyScore' in body && body.accuracyScore !== undefined) payload.accuracy_score = body.accuracyScore;
      if ('verifiabilityScore' in body && body.verifiabilityScore !== undefined) payload.verifiability_score = body.verifiabilityScore;
      if ('riskScore' in body && body.riskScore !== undefined) payload.risk_score = body.riskScore;

      // Optional columns: visibility, user_id (validate)
      if ('visibility' in body && (body.visibility === 'public' || body.visibility === 'private')) {
        payload.visibility = body.visibility;
      }
      if ('userId' in body && typeof body.userId === 'string') {
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRe.test(body.userId)) payload.user_id = body.userId;
      }

      // If no valid fields provided, return current item (no-op)
      if (Object.keys(payload).length === 0) {
        const { data, error, status } = await supabase
          .from('iqube_templates')
          .select(
            'id,name,description,iqube_type,instance_type,business_model,price,version,provenance,parent_template_id,blakqube_labels,metaqube_extras,sensitivity_score,accuracy_score,verifiability_score,risk_score,created_at'
          )
          .eq('id', id)
          .single();
        if (error) {
          if (status === 406) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          return NextResponse.json({ error: error.message }, { status: status || 500 });
        }
        const mapped: IQubeTemplate = {
          id: data.id,
          name: data.name,
          description: data.description,
          iQubeType: data.iqube_type || undefined,
          iQubeInstanceType: data.instance_type || undefined,
          businessModel: data.business_model || undefined,
          price: data.price ?? undefined,
          version: data.version ?? undefined,
          provenance: data.provenance ?? undefined,
          parentTemplateId: data.parent_template_id ?? undefined,
          blakqubeLabels: data.blakqube_labels ?? undefined,
          metaExtras: data.metaqube_extras ?? undefined,
          sensitivityScore: data.sensitivity_score ?? 0,
          accuracyScore: data.accuracy_score,
          verifiabilityScore: data.verifiability_score,
          riskScore: data.risk_score,
          createdAt: data.created_at,
        };
        return NextResponse.json(mapped, { status: 200 });
      }

      let { data, error, status } = await supabase
        .from('iqube_templates')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase UPDATE error for iqube_templates', { id, payloadKeys: Object.keys(payload), status, message: error.message });
        // Retry without optional columns if missing
        const msg = (error.message || '').toString();
        const missingColumn = /column\s+\"?(visibility|user_id)\"?\s+does not exist/i.test(msg);
        if (missingColumn) {
          const fallback = { ...payload } as any;
          delete fallback.visibility;
          delete fallback.user_id;
          const retry = await supabase
            .from('iqube_templates')
            .update(fallback)
            .eq('id', id)
            .select()
            .single();
          if (retry.error) {
            console.error('Retry UPDATE error after removing optional columns', { message: retry.error.message });
            if (status === 406) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            return NextResponse.json({ error: retry.error.message }, { status: retry.status || 500 });
          }
          data = retry.data as any;
        } else {
          if (status === 406) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          return NextResponse.json({ error: error.message }, { status: status || 500 });
        }

        if (process.env.NEXT_PUBLIC_REGISTRY_DEV_FALLBACK === 'true') {
          console.warn('Falling back to in-memory store for PUT due to Supabase error (dev fallback enabled)');
          const items = getStore();
          const idx = items.findIndex(t => t.id === id);
          if (idx !== -1) {
            const updated: IQubeTemplate = { ...items[idx], ...body } as any;
            const next = [...items];
            next[idx] = updated;
            setStore(next);
            return NextResponse.json({ ...updated, _devFallback: true }, { status: 200 });
          }
        }
      }

      const mapped: IQubeTemplate = {
        id: data.id,
        name: data.name,
        description: data.description,
        iQubeType: data.iqube_type || undefined,
        iQubeInstanceType: data.instance_type || undefined,
        businessModel: data.business_model || undefined,
        price: data.price ?? undefined,
        version: data.version ?? undefined,
        provenance: data.provenance ?? undefined,
        parentTemplateId: data.parent_template_id ?? undefined,
        blakqubeLabels: data.blakqube_labels ?? undefined,
        sensitivityScore: data.sensitivity_score ?? 0,
        accuracyScore: data.accuracy_score,
        verifiabilityScore: data.verifiability_score,
        riskScore: data.risk_score,
        createdAt: data.created_at,
      };
      return NextResponse.json(mapped, { status: 200 });
    }

    // Fallback memory store
    const items = getStore();
    const idx = items.findIndex(t => t.id === id);
    if (idx === -1) return notFound();
    const updated: IQubeTemplate = { ...items[idx], ...body };
    const next = [...items];
    next[idx] = updated;
    setStore(next);
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error('PUT /api/registry/templates/[id] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const supabase = getSupabaseServer();
    if (supabase) {
      const { error, status } = await supabase.from('iqube_templates').delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: status || 500 });
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    // Fallback memory
    const items = getStore();
    const next = items.filter(t => t.id !== id);
    if (next.length === items.length) return notFound();
    setStore(next);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('DELETE /api/registry/templates/[id] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
