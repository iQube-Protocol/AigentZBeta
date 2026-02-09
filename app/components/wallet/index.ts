"use client";

/**
 * Wallet Components
 * 
 * Components for the Smart Wallet persona system.
 */

export { PersonaSetupWizard } from './PersonaSetupWizard';
export { PersonaSelector } from './PersonaSelector';
export { PersonaQuickAddModal } from './PersonaQuickAddModal';
export { UnlockModal } from './UnlockModal';
export { TransactionModal } from './TransactionModal';
export { PaymentRequestsPanel } from './PaymentRequestsPanel';
export { BuyKnytModal } from './BuyKnytModal';
export { PersonaEditModal } from './PersonaEditModal';

// Also export default imports as named exports for compatibility
import PersonaSelectorDefault from './PersonaSelector';
import PersonaQuickAddModalDefault from './PersonaQuickAddModal';
import PersonaEditModalDefault from './PersonaEditModal';
import PersonaSetupWizardDefault from './PersonaSetupWizard';
import TransactionModalDefault from './TransactionModal';
import UnlockModalDefault from './UnlockModal';

export { 
  PersonaSelectorDefault, 
  PersonaQuickAddModalDefault, 
  PersonaEditModalDefault, 
  PersonaSetupWizardDefault, 
  TransactionModalDefault, 
  UnlockModalDefault 
};
