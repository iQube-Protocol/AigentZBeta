/**
 * Secure Content Streaming API
 * 
 * GET /api/content/issue/[issueId]/stream
 * 
 * Streams decrypted content for owned issues.
 * - Verifies ownership
 * - Fetches encrypted content from Autonomys
 * - Decrypts on-the-fly
 * - Streams to client
 * 
 * Phase 1: Custodial only - keys never leave server
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAutoDriveApi, downloadFile } from '@autonomys/auto-drive';
import { getSupabaseServer } from '../../../../_lib/supabaseServer';
import { getTokenQube } from '../../../../../../server/services/iqRegistryService';

// Helper to get Supabase client with null check
function getSupabase() {
  const client = getSupabaseServer();
  if (!client) {
    throw new Error('Supabase client not available');
  }
  return client;
}
import {
  unwrapKeyWithMasterKey,
  createDecryptionStream,
} from '../../../../../../server/services/encryptionService';

export const runtime = 'nodejs';

interface RouteParams {
  params: {
    issueId: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { issueId } = params;

    // Get user from auth
    const authHeader = req.headers.get('authorization');
    let userId: string;

    if (authHeader?.startsWith('Bearer ')) {
      userId = req.headers.get('x-user-id') || '';
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    const supabase = getSupabase();

    // 1. Verify ownership
    const { data: issue, error: issueError } = await supabase
      .from('user_issue_qubes')
      .select(`
        *,
        master_content:master_content_qubes(*)
      `)
      .eq('id', issueId)
      .eq('owner_id', userId)
      .eq('status', 'active')
      .single();

    if (issueError || !issue) {
      return NextResponse.json({
        error: 'Issue not found or access denied',
      }, { status: 403 });
    }

    // 2. Verify custody mode (Phase 1: only custodial streaming)
    if (issue.custody_mode !== 'custodial') {
      // Phase 2 will handle canonical differently
      return NextResponse.json({
        error: 'Streaming not available for this custody mode',
      }, { status: 400 });
    }

    const master = issue.master_content;
    if (!master) {
      return NextResponse.json({
        error: 'Master content not found',
      }, { status: 404 });
    }

    // 3. Get the encryption key from tokenQube
    const tokenQube = await getTokenQube(master.token_qube_id);
    if (!tokenQube) {
      return NextResponse.json({
        error: 'Encryption key not found',
      }, { status: 500 });
    }

    // 4. Unwrap the content key
    const contentKey = unwrapKeyWithMasterKey({
      keyCiphertext: tokenQube.key_ciphertext,
      wrappingAlgorithm: tokenQube.key_wrapping_alg,
    });

    // 5. Initialize Autonomys API
    const apiKey = process.env.AUTONOMYS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'Storage service not configured',
      }, { status: 500 });
    }

    const autoDrive = createAutoDriveApi({
      apiKey,
    });

    // 6. Download encrypted content from Autonomys
    console.log(`[Stream] Fetching CID: ${master.auto_drive_cid}`);
    
    const encryptedStream = await downloadFile(autoDrive, master.auto_drive_cid);

    // 7. Create decryption stream
    const decryptionStream = createDecryptionStream(
      master.encryption_iv,
      master.encryption_auth_tag,
      contentKey
    );

    // 8. Collect encrypted chunks and decrypt
    // Note: For large files, this should be a proper streaming implementation
    // This is a simplified version that buffers the content
    const chunks: Buffer[] = [];
    for await (const chunk of encryptedStream) {
      chunks.push(Buffer.from(chunk));
    }
    const encryptedBuffer = Buffer.concat(chunks);

    // Decrypt the content
    const decryptedBuffer = Buffer.concat([
      decryptionStream.update(encryptedBuffer),
      decryptionStream.final(),
    ]);

    // 9. Return decrypted content with appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', master.mime_type);
    headers.set('Content-Length', decryptedBuffer.length.toString());
    
    // Set filename for download
    const filename = `metaKnyts_Ep${String(issue.episode_number).padStart(2, '0')}`;
    const ext = master.mime_type === 'application/pdf' ? '.pdf' 
      : master.mime_type === 'video/mp4' ? '.mp4'
      : master.mime_type === 'application/x-cbz' ? '.cbz'
      : '';
    
    headers.set('Content-Disposition', `inline; filename="${filename}${ext}"`);
    
    // Cache control - don't cache decrypted content
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    headers.set('Pragma', 'no-cache');

    // For video, support range requests (basic implementation)
    if (master.mime_type.startsWith('video/')) {
      headers.set('Accept-Ranges', 'bytes');
    }

    console.log(`[Stream] Serving ${decryptedBuffer.length} bytes of ${master.mime_type}`);

    return new NextResponse(decryptedBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('[Stream] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Stream failed',
    }, { status: 500 });
  }
}
