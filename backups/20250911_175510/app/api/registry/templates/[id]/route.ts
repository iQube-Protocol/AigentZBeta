import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../_lib/supabaseServer';
import { getStore, setStore } from '../store';
import { IQubeTemplate } from '../../../../../types/registry';

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const supabase = getSupabaseServer();
    if (supabase) {
      const { data, error, status } = await supabase
        .from('iqube_templates')
        .select(
          'id,name,description,iqube_type,instance_type,business_model,price,version,provenance,parent_template_id,blakqube_labels,metaqube_extras,sensitivity_score,accuracy_score,verifiability_score,risk_score,created_at'
        )
        .eq('id', id)
        .single();
      if (error) {
        // Supabase returns 406 when .single() finds no rows
        if (status === 406) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ error: error.message }, { status: status || 500 });
      }
      if (!data) return notFound();
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
    // Fallback memory
    const items = getStore();
    const found = items.find(t => t.id === id);
    if (!found) return notFound();
    return NextResponse.json(found, { status: 200 });
  } catch (e) {
    console.error('GET /api/registry/templates/[id] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const body = await req.json();
    const supabase = getSupabaseServer();
    if (supabase) {
      const payload: any = {};
      if ('name' in body) payload.name = body.name;
      if ('description' in body) payload.description = body.description;
      if ('iQubeType' in body) payload.iqube_type = body.iQubeType;
      if ('iQubeInstanceType' in body) payload.instance_type = body.iQubeInstanceType;
      if ('businessModel' in body) payload.business_model = body.businessModel;
      if ('price' in body) {
        if (body.price === null) payload.price = null; // explicit clear
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

      // If no valid fields provided, return current item (no-op) rather than erroring
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

      const { data, error, status } = await supabase
        .from('iqube_templates')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        console.error('Supabase UPDATE error for iqube_templates', { id, payloadKeys: Object.keys(payload), status, message: error.message });
        if (process.env.NEXT_PUBLIC_REGISTRY_DEV_FALLBACK === 'true') {
          console.warn('Falling back to in-memory store for PATCH due to Supabase error (dev fallback enabled)');
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
        sensitivityScore: data.sensitivity_score ?? 0,
        accuracyScore: data.accuracy_score,
        verifiabilityScore: data.verifiability_score,
        riskScore: data.risk_score,
        createdAt: data.created_at,
      };
      return NextResponse.json(mapped, { status: 200 });
    }
    // Fallback memory
    const items = getStore();
    const idx = items.findIndex(t => t.id === id);
    if (idx === -1) return notFound();
    const updated: IQubeTemplate = { ...items[idx], ...body };
    const next = [...items];
    next[idx] = updated;
    setStore(next);
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error('PATCH /api/registry/templates/[id] error:', e);
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
