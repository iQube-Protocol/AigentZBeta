/**
 * SmartWalletQube Service
 * 
 * Handles normalization, validation, and CRUD operations for SmartWalletQube.
 * Follows the same pattern as SmartContentQube:
 * - No "missing field" hard errors where we can reasonably infer
 * - Validation runs after normalization
 * - True errors only for contradictions or obviously invalid data
 */

import type {
  SmartWalletQube,
  WalletBalance,
  WalletEntitlement,
  WalletRewardState,
  WalletTask,
  WalletQuest,
  WalletPaymentCapabilities,
  WalletLayoutHints,
  WalletValidationContext,
  NormalizedWalletResult,
  WalletValidationResult,
  InferredField,
  WalletIdentityState,
} from '@/types/smartWalletQube';

// =============================================================================
// NORMALIZATION
// =============================================================================

/**
 * Normalize a raw SmartWalletQube, inferring missing fields
 */
export function normalizeSmartWalletQube(
  raw: any,
  ctx: WalletValidationContext
): NormalizedWalletResult {
  const w: any = structuredClone(raw ?? {});
  const inferred: InferredField[] = [];

  const setIfMissing = (path: string, value: any, reason: string) => {
    const segments = path.split('.');
    let obj = w;
    for (let i = 0; i < segments.length - 1; i++) {
      const key = segments[i];
      if (obj[key] === undefined) obj[key] = {};
      obj = obj[key];
    }
    const last = segments[segments.length - 1];
    if (obj[last] === undefined) {
      obj[last] = value;
      inferred.push({ path, from: undefined, to: value, reason });
    }
  };

  // -------------------------------------------------------------------------
  // IDENTITY / PERSONA
  // -------------------------------------------------------------------------
  
  if (!w.identityState) {
    const inferredState = inferIdentityState(w.personaId, ctx);
    setIfMissing('identityState', inferredState, `Defaulted from DIDQube policy for persona ${w.personaId}.`);
  }

  if (!w.did && w.personaId) {
    const inferredDid = `did:iq:${ctx.appId}:${w.personaId}`;
    setIfMissing('did', inferredDid, 'Inferred DID from personaId.');
  }

  // Type discriminator
  if (!w.type) {
    setIfMissing('type', 'SmartWalletQube', 'Set type discriminator.');
  }

  // -------------------------------------------------------------------------
  // BALANCES
  // -------------------------------------------------------------------------
  
  if (!Array.isArray(w.balances)) {
    w.balances = [];
    inferred.push({ path: 'balances', from: undefined, to: [], reason: 'Initialized empty balances array.' });
  }

  w.balances = w.balances.map((b: any, idx: number) => normalizeBalance(b, idx, w, ctx, inferred));

  // -------------------------------------------------------------------------
  // ENTITLEMENTS
  // -------------------------------------------------------------------------
  
  if (!Array.isArray(w.entitlements)) {
    w.entitlements = [];
    inferred.push({ path: 'entitlements', from: undefined, to: [], reason: 'Initialized empty entitlements array.' });
  }

  w.entitlements = w.entitlements.map((e: any, idx: number) => normalizeEntitlement(e, idx, inferred));

  // -------------------------------------------------------------------------
  // REWARDS
  // -------------------------------------------------------------------------
  
  if (!Array.isArray(w.rewards)) {
    w.rewards = [];
    inferred.push({ path: 'rewards', from: undefined, to: [], reason: 'Initialized empty rewards array.' });
  }

  w.rewards = w.rewards.map((r: any, idx: number) => normalizeReward(r, idx, inferred));

  // -------------------------------------------------------------------------
  // TASKS & QUESTS
  // -------------------------------------------------------------------------
  
  if (!Array.isArray(w.tasks)) {
    w.tasks = [];
    inferred.push({ path: 'tasks', from: undefined, to: [], reason: 'Initialized empty tasks array.' });
  }

  w.tasks = w.tasks.map((t: any, idx: number) => normalizeTask(t, idx, inferred));

  if (!Array.isArray(w.quests)) {
    w.quests = [];
    inferred.push({ path: 'quests', from: undefined, to: [], reason: 'Initialized empty quests array.' });
  }

  w.quests = w.quests.map((q: any, idx: number) => normalizeQuest(q, idx, inferred));

  // -------------------------------------------------------------------------
  // PAYMENT CAPABILITIES
  // -------------------------------------------------------------------------
  
  if (!w.paymentCapabilities) {
    const defaultCap = inferPaymentCapabilities(w, ctx);
    w.paymentCapabilities = defaultCap;
    inferred.push({
      path: 'paymentCapabilities',
      from: undefined,
      to: defaultCap,
      reason: 'Inferred from DVN and x402 config.',
    });
  } else {
    // Fill missing fields in existing capabilities
    w.paymentCapabilities = normalizePaymentCapabilities(w.paymentCapabilities, ctx, inferred);
  }

  // -------------------------------------------------------------------------
  // LAYOUT HINTS
  // -------------------------------------------------------------------------
  
  if (!w.layoutHints) {
    const hints = inferWalletLayoutHints(w.appId);
    w.layoutHints = hints;
    inferred.push({
      path: 'layoutHints',
      from: undefined,
      to: hints,
      reason: `Default layout hints for app ${w.appId}.`,
    });
  }

  // -------------------------------------------------------------------------
  // TIMESTAMPS
  // -------------------------------------------------------------------------
  
  const now = new Date().toISOString();
  if (!w.createdAt) {
    setIfMissing('createdAt', now, 'Set creation timestamp.');
  }
  if (!w.updatedAt) {
    setIfMissing('updatedAt', now, 'Set update timestamp.');
  }

  // -------------------------------------------------------------------------
  // METADATA
  // -------------------------------------------------------------------------
  
  if (!w._meta) w._meta = {};
  w._meta.inferred = (w._meta.inferred || []).concat(inferred);

  return { normalized: w as SmartWalletQube, inferred };
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a normalized SmartWalletQube
 */
export function validateSmartWalletQube(
  w: SmartWalletQube,
  ctx: WalletValidationContext
): WalletValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // -------------------------------------------------------------------------
  // IDENTITY STATE
  // -------------------------------------------------------------------------
  
  if (!ctx.didQubePolicy.allowedIdentityStates.includes(w.identityState)) {
    errors.push(
      `identityState '${w.identityState}' is not allowed for this persona. ` +
      `Allowed: ${ctx.didQubePolicy.allowedIdentityStates.join(', ')}.`
    );
  }

  // -------------------------------------------------------------------------
  // BALANCES
  // -------------------------------------------------------------------------
  
  for (const b of w.balances) {
    const amount = parseFloat(b.amount);
    if (isNaN(amount)) {
      errors.push(`Balance for asset ${b.asset} has invalid amount: ${b.amount}`);
    } else if (amount < 0) {
      errors.push(`Negative balance for asset ${b.asset} is not allowed.`);
    }
  }

  // -------------------------------------------------------------------------
  // REWARDS
  // -------------------------------------------------------------------------
  
  for (const r of w.rewards) {
    if (r.progress < 0 || r.progress > 1) {
      errors.push(`Reward progress for program ${r.programId} must be between 0 and 1. Got: ${r.progress}`);
    }
    if (r.pendingReward && r.claimedReward) {
      warnings.push(`Reward ${r.programId} has both pendingReward and claimedReward set.`);
    }
  }

  // -------------------------------------------------------------------------
  // TASKS
  // -------------------------------------------------------------------------
  
  const validTaskStatuses = ['todo', 'in-progress', 'done', 'expired'];
  for (const t of w.tasks) {
    if (!validTaskStatuses.includes(t.status)) {
      errors.push(`Task ${t.taskId} has invalid status: ${t.status}`);
    }
  }

  // -------------------------------------------------------------------------
  // QUESTS
  // -------------------------------------------------------------------------
  
  const validQuestStatuses = ['ongoing', 'complete', 'failed'];
  for (const q of w.quests || []) {
    if (!validQuestStatuses.includes(q.status)) {
      errors.push(`Quest ${q.questId} has invalid status: ${q.status}`);
    }
    
    // Check quest/task consistency
    const allDone = q.steps.every((s) => s.status === 'done');
    if (q.status === 'complete' && !allDone) {
      warnings.push(`Quest ${q.questId} is marked complete but not all steps are done.`);
    }
    if (q.status === 'ongoing' && allDone) {
      warnings.push(`Quest ${q.questId} has all steps done but is still marked ongoing.`);
    }
  }

  // -------------------------------------------------------------------------
  // ENTITLEMENTS
  // -------------------------------------------------------------------------
  
  const validEntitlementStatuses = ['active', 'expired', 'pending', 'locked'];
  for (const e of w.entitlements) {
    if (!validEntitlementStatuses.includes(e.status)) {
      errors.push(`Entitlement ${e.entitlementId} has invalid status: ${e.status}`);
    }
    
    // Check expiry consistency
    if (e.status === 'active' && e.expiry) {
      const expiryDate = new Date(e.expiry);
      if (expiryDate < new Date()) {
        warnings.push(`Entitlement ${e.entitlementId} is marked active but expiry is in the past.`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // PAYMENT CAPABILITIES
  // -------------------------------------------------------------------------
  
  if (w.paymentCapabilities.defaultAsset) {
    if (!w.paymentCapabilities.supportedAssets.includes(w.paymentCapabilities.defaultAsset)) {
      errors.push(
        `Default asset ${w.paymentCapabilities.defaultAsset} is not in supportedAssets: ` +
        `${w.paymentCapabilities.supportedAssets.join(', ')}`
      );
    }
  }

  // Cross-check with DVN config
  for (const asset of w.paymentCapabilities.supportedAssets) {
    if (!ctx.dvnConfig.supportedAssets.includes(asset)) {
      warnings.push(`Asset ${asset} not explicitly declared in DVN config; check integration.`);
    }
  }

  for (const chain of w.paymentCapabilities.supportedChains) {
    if (!ctx.dvnConfig.supportedChains.includes(chain)) {
      warnings.push(`Chain ${chain} not explicitly declared in DVN config; check integration.`);
    }
  }

  // -------------------------------------------------------------------------
  // TIMESTAMPS
  // -------------------------------------------------------------------------
  
  if (w.createdAt && isNaN(Date.parse(w.createdAt))) {
    errors.push(`createdAt is not a valid ISO timestamp: ${w.createdAt}`);
  }
  if (w.updatedAt && isNaN(Date.parse(w.updatedAt))) {
    errors.push(`updatedAt is not a valid ISO timestamp: ${w.updatedAt}`);
  }

  return {
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function inferIdentityState(personaId: string, ctx: WalletValidationContext): WalletIdentityState {
  // Persona-based heuristics
  const lowerPersona = personaId?.toLowerCase() || '';
  
  if (lowerPersona.includes('investor') || lowerPersona.includes('kyc')) {
    return 'full';
  }
  if (lowerPersona.includes('metaknyts') || lowerPersona.includes('qripto')) {
    return 'semi';
  }
  
  return ctx.didQubePolicy.defaultIdentityState;
}

function normalizeBalance(
  b: any,
  idx: number,
  wallet: any,
  ctx: WalletValidationContext,
  inferred: InferredField[]
): WalletBalance {
  const balance = { ...b };

  // Normalize amount to string
  if (typeof balance.amount === 'number') {
    balance.amount = balance.amount.toString();
    inferred.push({
      path: `balances[${idx}].amount`,
      from: b.amount,
      to: balance.amount,
      reason: 'Converted number to string.',
    });
  }

  // Infer symbol from asset
  if (!balance.symbol && balance.asset) {
    balance.symbol = balance.asset;
    inferred.push({
      path: `balances[${idx}].symbol`,
      from: undefined,
      to: balance.symbol,
      reason: 'Default symbol from asset.',
    });
  }

  // Infer label based on asset role
  if (!balance.label && balance.asset) {
    balance.label = inferBalanceLabel(balance.asset, wallet.paymentCapabilities?.defaultAsset);
    inferred.push({
      path: `balances[${idx}].label`,
      from: undefined,
      to: balance.label,
      reason: 'Default label based on asset role.',
    });
  }

  return balance;
}

function inferBalanceLabel(asset: string, defaultAsset?: string): string {
  if (asset === defaultAsset) return 'Spending';
  
  switch (asset) {
    case 'QOYN': return 'Reserve';
    case 'QCT': return 'Micro-stable';
    case 'Qc': return 'Credits';
    case 'KNYT': return 'Collector';
    default: return asset;
  }
}

function normalizeEntitlement(e: any, idx: number, inferred: InferredField[]): WalletEntitlement {
  const entitlement = { ...e };

  // Infer category from entitlementId pattern
  if (!entitlement.category && entitlement.entitlementId) {
    entitlement.category = inferEntitlementCategory(entitlement.entitlementId);
    inferred.push({
      path: `entitlements[${idx}].category`,
      from: undefined,
      to: entitlement.category,
      reason: 'Inferred from entitlementId pattern.',
    });
  }

  // Infer status
  if (!entitlement.status) {
    entitlement.status = 'active';
    inferred.push({
      path: `entitlements[${idx}].status`,
      from: undefined,
      to: 'active',
      reason: 'Default status for new entitlement.',
    });
  }

  // Infer acquiredVia from txRef
  if (!entitlement.acquiredVia && entitlement.txRef) {
    entitlement.acquiredVia = inferAcquisitionMethod(entitlement.txRef);
    inferred.push({
      path: `entitlements[${idx}].acquiredVia`,
      from: undefined,
      to: entitlement.acquiredVia,
      reason: 'Inferred from txRef pattern.',
    });
  } else if (!entitlement.acquiredVia) {
    entitlement.acquiredVia = 'admin';
    inferred.push({
      path: `entitlements[${idx}].acquiredVia`,
      from: undefined,
      to: 'admin',
      reason: 'Default acquisition method.',
    });
  }

  return entitlement;
}

function inferEntitlementCategory(entitlementId: string): string {
  const lower = entitlementId.toLowerCase();
  if (lower.includes('episode')) return 'episode';
  if (lower.includes('issue')) return 'issue';
  if (lower.includes('article')) return 'article';
  if (lower.includes('bundle') || lower.includes('codex') || lower.includes('volume')) return 'bundle';
  return 'questItem';
}

function inferAcquisitionMethod(txRef: string): string {
  if (txRef.startsWith('x402:')) return 'purchase';
  if (txRef.startsWith('rqh:reward:')) return 'questReward';
  if (txRef.startsWith('sub:')) return 'subscription';
  if (txRef.startsWith('airdrop:')) return 'airdrop';
  return 'admin';
}

function normalizeReward(r: any, idx: number, inferred: InferredField[]): WalletRewardState {
  const reward = { ...r };

  // Clamp progress
  if (reward.progress < 0) {
    inferred.push({
      path: `rewards[${idx}].progress`,
      from: reward.progress,
      to: 0,
      reason: 'Clamped negative progress to 0.',
    });
    reward.progress = 0;
  }
  if (reward.progress > 1) {
    inferred.push({
      path: `rewards[${idx}].progress`,
      from: reward.progress,
      to: 1,
      reason: 'Clamped progress > 1 to 1.',
    });
    reward.progress = 1;
  }

  return reward;
}

function normalizeTask(t: any, idx: number, inferred: InferredField[]): WalletTask {
  const task = { ...t };

  // Infer status
  if (!task.status) {
    task.status = 'todo';
    inferred.push({
      path: `tasks[${idx}].status`,
      from: undefined,
      to: 'todo',
      reason: 'Default status for new task.',
    });
  }

  // Infer label if missing but has relatedContentId
  if (!task.label && task.relatedContentId) {
    task.label = `Engage with ${task.relatedContentId}`;
    inferred.push({
      path: `tasks[${idx}].label`,
      from: undefined,
      to: task.label,
      reason: 'Generated label from relatedContentId.',
    });
  }

  return task;
}

function normalizeQuest(q: any, idx: number, inferred: InferredField[]): WalletQuest {
  const quest = { ...q };

  // Normalize steps
  if (!Array.isArray(quest.steps)) {
    quest.steps = [];
  }

  // Infer status from steps
  if (!quest.status) {
    const allDone = quest.steps.every((s: any) => s.status === 'done');
    const anyFailed = quest.steps.some((s: any) => s.status === 'expired');
    
    if (anyFailed) {
      quest.status = 'failed';
    } else if (allDone) {
      quest.status = 'complete';
    } else {
      quest.status = 'ongoing';
    }
    
    inferred.push({
      path: `quests[${idx}].status`,
      from: undefined,
      to: quest.status,
      reason: 'Inferred from step statuses.',
    });
  }

  return quest;
}

function inferPaymentCapabilities(wallet: any, ctx: WalletValidationContext): WalletPaymentCapabilities {
  // Infer default asset from balances
  let defaultAsset = ctx.x402Config.defaultAsset;
  if (!defaultAsset && wallet.balances?.length > 0) {
    // Prefer QCT, then Qc, then first available
    const assets = wallet.balances.map((b: any) => b.asset);
    if (assets.includes('QCT')) defaultAsset = 'QCT';
    else if (assets.includes('Qc')) defaultAsset = 'Qc';
    else defaultAsset = assets[0];
  }

  return {
    canX402: ctx.x402Config.canX402,
    supportedChains: ctx.dvnConfig.supportedChains,
    supportedAssets: ctx.dvnConfig.supportedAssets,
    supportsDeferredMint: ctx.x402Config.supportsDeferredMint,
    supportsRemoteCustody: ctx.x402Config.supportsRemoteCustody,
    supportsCanonicalSales: ctx.x402Config.supportsCanonicalSales,
    defaultAsset,
  };
}

function normalizePaymentCapabilities(
  cap: any,
  ctx: WalletValidationContext,
  inferred: InferredField[]
): WalletPaymentCapabilities {
  const capabilities = { ...cap };

  if (capabilities.canX402 === undefined) {
    capabilities.canX402 = ctx.x402Config.canX402;
    inferred.push({
      path: 'paymentCapabilities.canX402',
      from: undefined,
      to: capabilities.canX402,
      reason: 'Default from x402 config.',
    });
  }

  if (!capabilities.supportedChains?.length) {
    capabilities.supportedChains = ctx.dvnConfig.supportedChains;
    inferred.push({
      path: 'paymentCapabilities.supportedChains',
      from: undefined,
      to: capabilities.supportedChains,
      reason: 'Default from DVN config.',
    });
  }

  if (!capabilities.supportedAssets?.length) {
    capabilities.supportedAssets = ctx.dvnConfig.supportedAssets;
    inferred.push({
      path: 'paymentCapabilities.supportedAssets',
      from: undefined,
      to: capabilities.supportedAssets,
      reason: 'Default from DVN config.',
    });
  }

  return capabilities;
}

function inferWalletLayoutHints(appId: string): WalletLayoutHints {
  switch (appId?.toLowerCase()) {
    case 'metaknyts':
      return {
        preferredOverviewModal: 'walletOverview',
        preferredTasksModal: 'walletTasksList',
        preferredEntitlementsModal: 'thumbnailRect',
        showPerPersonaTabs: true,
      };
    case 'qriptopian':
      return {
        preferredOverviewModal: 'walletOverview',
        preferredTasksModal: 'walletTasksList',
        preferredEntitlementsModal: 'thumbnailRect',
        showPerPersonaTabs: false,
      };
    default:
      return {
        preferredOverviewModal: 'walletOverview',
        preferredTasksModal: 'walletTasksList',
        preferredEntitlementsModal: 'standard',
        showPerPersonaTabs: true,
      };
  }
}

// =============================================================================
// COMBINED NORMALIZE + VALIDATE
// =============================================================================

export interface ProcessWalletQubeResult {
  wallet: SmartWalletQube;
  inferred: InferredField[];
  validation: WalletValidationResult;
}

/**
 * Normalize and validate a SmartWalletQube in one step
 */
export function processSmartWalletQube(
  raw: any,
  ctx: WalletValidationContext
): ProcessWalletQubeResult {
  const { normalized, inferred } = normalizeSmartWalletQube(raw, ctx);
  const validation = validateSmartWalletQube(normalized, ctx);

  return {
    wallet: normalized,
    inferred,
    validation,
  };
}
