import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const pemEnv = process.env.DFX_IDENTITY_PEM;
    const pemPublicEnv = process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM;
    const pemPath = process.env.DFX_IDENTITY_PEM_PATH;
    
    let identityStatus = 'anonymous';
    let identitySource = 'none';
    
    // Check which identity source is available
    if (pemEnv) {
      identityStatus = 'authenticated';
      identitySource = 'DFX_IDENTITY_PEM';
    } else if (pemPublicEnv) {
      identityStatus = 'authenticated';
      identitySource = 'NEXT_PUBLIC_DFX_IDENTITY_PEM';
    } else if (pemPath) {
      identityStatus = 'authenticated';
      identitySource = 'DFX_IDENTITY_PEM_PATH';
    }
    
    // Check if identity module is available
    let identityModuleAvailable = false;
    try {
      await import('@dfinity/identity');
      identityModuleAvailable = true;
    } catch {
      identityModuleAvailable = false;
    }
    
    return NextResponse.json({
      ok: true,
      identityStatus,
      identitySource,
      identityModuleAvailable,
      hasEnvVars: {
        DFX_IDENTITY_PEM: !!pemEnv,
        NEXT_PUBLIC_DFX_IDENTITY_PEM: !!pemPublicEnv,
        DFX_IDENTITY_PEM_PATH: !!pemPath
      },
      pemPreview: pemEnv ? `${pemEnv.substring(0, 50)}...` : null,
      at: new Date().toISOString()
    });
    
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      identityStatus: 'error',
      at: new Date().toISOString()
    }, { status: 500 });
  }
}
