/**
 * POST /api/vsp/profiles/[profileId]/evidence/upload
 *
 * Accepts multipart/form-data with:
 *   file        — the uploaded binary (required)
 *   source_type — vsp_evidence source_type (required)
 *   label       — human-readable label (optional, defaults to filename)
 *   classification — WHITE | GREY | BLACK | BLAKQUBE (default GREY)
 *   source_provenance — URL or institution (optional)
 *
 * Extracts text content from the file:
 *   PDF              → pdf-parse (server-side, no worker needed)
 *   .txt .md .csv .json → UTF-8 decode
 *   .docx            → mammoth (if available) or raw XML strip
 *   image / audio / video → stores filename + MIME as content_text stub;
 *                           marks extraction_status='pending' for future processing
 *
 * Returns the created evidence row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash, createCipheriv, randomBytes } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { publishLockerItem } from '@/services/passport/lockerStorage';

export const dynamic = 'force-dynamic';

async function canAccess(
  personaId: string,
  profileId: string,
  isAdmin: boolean,
  supabase: ReturnType<typeof getSupabaseServer>,
): Promise<boolean> {
  if (isAdmin) return true;
  const { data } = await supabase
    .from('vsp_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('owner_persona_id', personaId)
    .maybeSingle();
  return !!data;
}

const TEXT_MIME_PREFIXES = ['text/'];
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.csv', '.json', '.jsonl', '.xml', '.html', '.htm', '.rtf']);
const IMAGE_MIME_PREFIXES = ['image/'];
const VIDEO_MIME_PREFIXES = ['video/'];
const AUDIO_MIME_PREFIXES = ['audio/'];

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<{ text: string; extractionStatus: 'extracted' | 'pending' }> {
  const ext = getExtension(filename);
  const mime = mimeType.toLowerCase();

  // Plain text variants
  if (TEXT_MIME_PREFIXES.some(p => mime.startsWith(p)) || TEXT_EXTENSIONS.has(ext)) {
    return { text: buffer.toString('utf-8').slice(0, 200_000), extractionStatus: 'extracted' };
  }

  // PDF
  if (mime === 'application/pdf' || ext === '.pdf') {
    try {
      // pdf-parse works without a worker in Node — no pdfjs worker path issues
      const pdfParse = (await import('pdf-parse')).default;
      const result = await pdfParse(buffer);
      return { text: (result.text ?? '').slice(0, 200_000), extractionStatus: 'extracted' };
    } catch (err) {
      console.warn('[vsp/upload] pdf-parse failed:', err instanceof Error ? err.message : err);
      return { text: `[PDF — text extraction failed. File: ${filename}]`, extractionStatus: 'pending' };
    }
  }

  // DOCX (Word)
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    try {
      const mammoth = await import('mammoth').catch(() => null);
      if (mammoth) {
        const result = await mammoth.extractRawText({ buffer });
        return { text: (result.value ?? '').slice(0, 200_000), extractionStatus: 'extracted' };
      }
    } catch {
      // fall through to stub
    }
    return { text: `[DOCX — ${filename}. Paste the document text manually for fact extraction.]`, extractionStatus: 'pending' };
  }

  // DOC (legacy Word)
  if (mime === 'application/msword' || ext === '.doc') {
    return { text: `[DOC — ${filename}. Convert to DOCX or PDF and re-upload, or paste text manually.]`, extractionStatus: 'pending' };
  }

  // Images — store as stub; future: OCR via sharp / tesseract
  if (IMAGE_MIME_PREFIXES.some(p => mime.startsWith(p)) || ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.tiff','.heic'].includes(ext)) {
    return {
      text: `[Image — ${filename} (${mime}). Add a manual description or transcript for fact extraction.]`,
      extractionStatus: 'pending',
    };
  }

  // Audio — store as stub; future: Whisper transcription
  if (AUDIO_MIME_PREFIXES.some(p => mime.startsWith(p)) || ['.mp3','.m4a','.wav','.ogg','.flac','.aac'].includes(ext)) {
    return {
      text: `[Audio — ${filename} (${mime}). Transcription pending. Add a manual transcript for fact extraction.]`,
      extractionStatus: 'pending',
    };
  }

  // Video — store as stub; future: Whisper on audio track
  if (VIDEO_MIME_PREFIXES.some(p => mime.startsWith(p)) || ['.mp4','.mov','.avi','.mkv','.webm'].includes(ext)) {
    return {
      text: `[Video — ${filename} (${mime}). Transcription pending. Add a manual transcript for fact extraction.]`,
      extractionStatus: 'pending',
    };
  }

  // Fallback — unknown binary
  return {
    text: `[File — ${filename} (${mime}). Text extraction not supported for this format. Paste content manually.]`,
    extractionStatus: 'pending',
  };
}

const VALID_CLASSIFICATIONS = ['WHITE', 'GREY', 'BLACK', 'BLAKQUBE'];
const VALID_POLICIES = ['public', 'principal_only', 'service_only', 'restricted'];

export async function POST(req: NextRequest, props: { params: Promise<{ profileId: string }> }) {
  const params = await props.params;
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    const isAdmin = !!persona.cartridgeFlags?.isAdmin;

    if (!(await canAccess(persona.personaId, params.profileId, isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    const sourceType = (formData.get('source_type') as string | null) ?? 'other';
    const labelInput = (formData.get('label') as string | null) ?? file.name;
    const classification = (formData.get('classification') as string | null) ?? 'GREY';
    const provenance = (formData.get('source_provenance') as string | null) ?? null;

    if (!sourceType) {
      return NextResponse.json({ ok: false, error: 'source_type is required' }, { status: 400 });
    }

    // 20 MB limit
    const MAX_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'File exceeds 20 MB limit' }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || 'application/octet-stream';

    const { text, extractionStatus } = await extractText(buffer, mimeType, file.name);

    const { data, error } = await supabase
      .from('vsp_evidence')
      .insert({
        profile_id: params.profileId,
        source_type: sourceType,
        label: labelInput || file.name,
        content_text: text,
        extraction_status: extractionStatus === 'extracted' ? 'pending' : 'pending',
        // Always start as pending — the /extract route does the LLM fact extraction step
        classification: VALID_CLASSIFICATIONS.includes(classification) ? classification : 'GREY',
        disclosure_policy: VALID_POLICIES.includes(
          (formData.get('disclosure_policy') as string | null) ?? ''
        ) ? formData.get('disclosure_policy') as string : 'principal_only',
        source_provenance: provenance,
      })
      .select('id, source_type, label, content_text, extraction_status, extracted_fact_count, extracted_at, classification, disclosure_policy, verification_status, source_provenance, storage_backend, storage_ref, created_at')
      .single();

    if (error) throw error;

    // Automatically vault the raw file bytes to the Standing Locker (Walrus/Sui).
    // The evidence text content stays in Postgres; the binary file is encrypted
    // and anchored on-chain. T0 discipline: holderPublicRef is a sha256
    // commitment — personaId never reaches Walrus or Sui.
    let vaultRef: string | null = null;
    let vaultBackend: string | null = null;
    try {
      const keyHex = process.env.PERSONA_IQUBE_ENCRYPTION_KEY;
      const key = keyHex && keyHex.length === 64
        ? Buffer.from(keyHex, 'hex')
        : Buffer.alloc(32, 0);
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
      const authTag = cipher.getAuthTag();

      const holderPublicRef = createHash('sha256')
        .update(persona.personaId)
        .digest('hex')
        .slice(0, 16);

      const displayName = `[Standing Vault] ${labelInput || file.name}`;

      const publishResult = await publishLockerItem({
        holderPublicRef,
        ciphertext,
        iv,
        authTag,
        contentType: mimeType,
        displayName,
      });

      vaultRef = publishResult.walrusBlobId ?? null;
      vaultBackend = 'sui_locker';

      // Update the evidence row with vault refs
      await supabase
        .from('vsp_evidence')
        .update({ storage_backend: 'sui_locker', storage_ref: vaultRef })
        .eq('id', (data as { id: string }).id);

      (data as Record<string, unknown>).storage_backend = 'sui_locker';
      (data as Record<string, unknown>).storage_ref = vaultRef;
    } catch (vaultErr) {
      // Non-fatal — evidence row is created; vault can be retried manually
      console.warn('[vsp/upload] vault failed (non-fatal):', vaultErr instanceof Error ? vaultErr.message : vaultErr);
    }

    return NextResponse.json({
      ok: true,
      evidence: data,
      parsed: extractionStatus === 'extracted',
      charCount: text.length,
      vaulted: !!vaultRef,
      vaultBackend,
    }, { status: 201 });
  } catch (err) {
    console.error('[vsp/evidence/upload POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
