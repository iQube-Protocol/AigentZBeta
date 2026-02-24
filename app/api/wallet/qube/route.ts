/**
 * SmartWalletQube API
 * 
 * GET /api/wallet/qube - Get wallet by query
 * POST /api/wallet/qube - Create/update wallet (with normalization)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  processSmartWalletQube,
  normalizeSmartWalletQube,
  validateSmartWalletQube,
} from '@/services/wallet/smartWalletQubeService';
import { walletFixtures } from '@/services/wallet/fixtures/walletQubeFixtures';
import type { SmartWalletQube, WalletValidationContext } from '@/types/smartWalletQube';

export const runtime = 'nodejs';

// Default validation context
const DEFAULT_VALIDATION_CONTEXT: WalletValidationContext = {
  appId: 'metaKnyts',
  tenantId: 'tenant-main',
  personaId: 'default',
  didQubePolicy: {
    allowedIdentityStates: ['anon', 'pseudo', 'semi', 'full'],
    defaultIdentityState: 'pseudo',
  },
  dvnConfig: {
    supportedChains: ['bitcoin', 'solana', 'ethereum', 'polygon', 'optimism', 'arbitrum', 'base', 'icp'],
    supportedAssets: ['Qc', 'QOYN', 'QCT', 'KNYT'],
  },
  x402Config: {
    canX402: true,
    supportsDeferredMint: true,
    supportsRemoteCustody: true,
    supportsCanonicalSales: true,
    defaultAsset: 'Qc',
  },
};

/**
 * GET /api/wallet/qube
 * 
 * Query params:
 * - id: Get by wallet ID
 * - appId, tenantId, personaId: Get by query
 * - fixture: Get fixture (metaKnyts, qriptopian, minimal)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const appId = searchParams.get('appId');
    const tenantId = searchParams.get('tenantId');
    const personaId = searchParams.get('personaId');
    const fixture = searchParams.get('fixture');

    // Get fixture
    if (fixture) {
      const fixtureKey = fixture as keyof typeof walletFixtures;
      const wallet = walletFixtures[fixtureKey];
      
      if (!wallet) {
        return NextResponse.json(
          { error: 'Fixture not found', fixture, available: Object.keys(walletFixtures) },
          { status: 404 }
        );
      }

      return NextResponse.json({ wallet });
    }

    // Get by ID or query - for now use fixtures
    if (appId === 'metaKnyts' || id?.includes('metaknyts')) {
      return NextResponse.json({ wallet: walletFixtures.metaKnyts });
    }
    
    if (appId === 'Qriptopian' || id?.includes('qriptopian')) {
      return NextResponse.json({ wallet: walletFixtures.qriptopian });
    }

    if (appId === 'StayBull' || personaId === 'MoneyPenny' || personaId === 'DeFiTrader' || id?.includes('staybull')) {
      return NextResponse.json({ wallet: walletFixtures.moneyPenny });
    }

    // TODO: Fetch from database
    return NextResponse.json(
      { error: 'Wallet not found', query: { id, appId, tenantId, personaId } },
      { status: 404 }
    );
  } catch (error) {
    console.error('[Wallet Qube API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wallet/qube
 * 
 * Body: Partial<SmartWalletQube>
 * 
 * Normalizes and validates the wallet, then saves it.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawWallet = body.wallet ?? body;
    const customContext = body.validationContext;

    // Build validation context
    const ctx: WalletValidationContext = {
      ...DEFAULT_VALIDATION_CONTEXT,
      appId: rawWallet.appId ?? DEFAULT_VALIDATION_CONTEXT.appId,
      tenantId: rawWallet.tenantId ?? DEFAULT_VALIDATION_CONTEXT.tenantId,
      ...customContext,
    };

    // Process (normalize + validate)
    const result = processSmartWalletQube(rawWallet, ctx);

    if (!result.validation.isValid) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          errors: result.validation.errors,
          warnings: result.validation.warnings,
          inferred: result.inferred,
          wallet: result.wallet, // Return normalized wallet even on error
        },
        { status: 400 }
      );
    }

    // TODO: Save to database

    return NextResponse.json({
      wallet: result.wallet,
      inferred: result.inferred,
      warnings: result.validation.warnings,
      message: 'Wallet processed successfully',
    });
  } catch (error) {
    console.error('[Wallet Qube API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
