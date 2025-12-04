/**
 * Wallet Services
 * 
 * Core services for the persona wallet system.
 */

// Key Management
export {
  generateEvmKeyPair,
  importEvmKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
  verifyPassword,
  deriveChainAddresses,
  signMessage,
  signTransaction,
  isValidPrivateKey,
  isValidEvmAddress,
  validatePassword,
} from './keyService';

// Session Management
export {
  createSession,
  getSession,
  isWalletUnlocked,
  extendSession,
  clearSession,
  lockWallet,
  cacheDecryptedKey,
  getCachedKey,
  hasKeyInCache,
  clearCachedKey,
  unlockWallet,
  getKeyForSigning,
  startSessionMonitor,
  stopSessionMonitor,
  setupAutoLockOnBlur,
  getSessionTimeRemaining,
  getSessionInfo,
} from './sessionService';

// Persona Management
export {
  createPersona,
  getPersonaById,
  getPersonasByAuthProfile,
  getPersonaByHandle,
  updatePersona,
  setActivePersona,
  getActivePersonaId,
  getActivePersona,
  deactivatePersona,
  reactivatePersona,
  updatePersonaReputation,
  addPersonaBadge,
} from './personaService';

// FIO Integration
export {
  FIO_TESTNET_CONFIG,
  FIO_MAINNET_CONFIG,
  SUPPORTED_DOMAINS,
  parseFioHandle,
  buildFioHandle,
  isValidFioHandle,
  isValidUsername,
  generateDidFromHandle,
  PersonaFioService,
  getPersonaFioService,
} from './personaFioService';

// Payment Integration
export {
  executePayment,
  signPaymentAuthorization,
  getTokenBalance,
  getTransactionReceipt,
  waitForTransaction,
} from './personaPaymentService';

export type {
  PaymentRequest,
  PaymentResult,
  BalanceRequest,
  BalanceResult,
} from './personaPaymentService';
