"use client";

/**
 * Wallet Components
 * 
 * Components for the Smart Wallet persona system.
 */

export { PersonaSetupWizard } from './PersonaSetupWizard';
export { PersonaQuickAddModal } from './PersonaQuickAddModal';
export { UnlockModal } from './UnlockModal';
export { TransactionModal } from './TransactionModal';
export { PaymentRequestsPanel } from './PaymentRequestsPanel';
export { BuyKnytModal } from './BuyKnytModal';
export { PersonaEditModal } from './PersonaEditModal';
// ExternalWalletConnect is SSR-unsafe (wagmi/walletconnect use window at module level).
// Import it only via next/dynamic({ ssr: false }) — see SmartWalletDrawer.tsx.

