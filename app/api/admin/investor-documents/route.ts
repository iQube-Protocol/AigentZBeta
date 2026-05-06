/**
 * Admin Investor Documents API — list + insert.
 *
 * POST /api/admin/investor-documents
 *   body: { personaId, docType, title, storageMasterId?, effectiveDate?, uploadedBy? }
 *   → creates a new investor_documents row with visible_to_investor = FALSE.
 *     Admin must explicitly publish via PATCH /[id] to flip the flag.
 *
 *   Document content (PDF) is uploaded to master_content_qubes through the
 *   existing admin/codex/storage flow first; the resulting masterId is then
 *   passed here as storageMasterId. The investor tab renders via the gated
 *   PDFPageViewer which streams pages through /api/content/pdf-page-by-master/[masterId].
 *
 * Plan: codexes/packs/agentiq/updates/2026-05-04_tasks-rewards-reputation-integration-plan.md § 4.5
 *
 * Auth: requireAdmin (header-based stub — IAM will replace).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { requireAdmin } from '@/app/api/_lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_DOC_TYPES = new Set([
  'subscription_agreement',
  'side_letter',
  'k1',
  '1099_b',
  'quarterly_letter',
  'annual_report',
  'capitalization_table',
  'other',
]);

interface PostBody {
  personaId?: string;
  docType?: string;
  title?: string;
  storageMasterId?: string;
  effectiveDate?: string;
  uploadedBy?: string;
}

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const { personaId, docType, title, storageMasterId, effectiveDate, uploadedBy } = body;

  if (!personaId || !docType || !title) {
    return NextResponse.json({ error: 'personaId, docType, and title are required' }, { status: 400 });
  }
  if (!VALID_DOC_TYPES.has(docType)) {
    return NextResponse.json({ error: `Invalid docType. Must be one of: ${Array.from(VALID_DOC_TYPES).join(', ')}` }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('investor_documents')
    .insert({
      persona_id: personaId,
      doc_type: docType,
      title,
      storage_master_id: storageMasterId ?? null,
      effective_date: effectiveDate ?? null,
      uploaded_by: uploadedBy ?? null,
      // visible_to_investor defaults to FALSE — admin must explicitly publish
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ document: data });
}
