/**
 * SigningRequest — the shared substrate for the wallet signing topology
 * (operator ruling 2026-08-01, GJR-VFY-001/GJR-MKT-001 follow-on).
 *
 * Governing interaction (verbatim): "stage prepares the act → correct wallet
 * signs → authoritative system confirms → resulting credential, binding or
 * receipt opens in the wallet." A SigningRequest IS the prepared act. Journey
 * stage buttons create one; the appropriate wallet (principal or agent)
 * renders it as a Pending Action; approving it is the only way its evidence
 * gets written — never a direct stage-completion API call.
 *
 * Governing distinction (verbatim): "The principal signature authorizes the
 * consequence. The agent signature controls or executes the agent-side act.
 * The wallet ceremony makes each invocation explicit; custody may remain
 * bounded behind the wallet." An agent-role request's "signature" is
 * therefore an explicit approval to invoke a BOUNDED custody service
 * (AgentKeyService, via services/signing/partnerAuthorizationSigner.ts's
 * key-never-leaves-the-stack-frame pattern) — never a raw key exported to
 * the browser.
 *
 * Deliberately a NEW table (services/signing/signingRequestStore.ts), not an
 * extension of partner_authorization_requests
 * (supabase/migrations/20260930000500_partner_authorization_requests.sql):
 * that table is explicitly "service-role only, no client route reads it
 * directly" and agent-role-only (key_ref, no principal signer concept at
 * all) — a genuinely different trust boundary from a request a citizen's own
 * wallet UI must read and act on. Phase 3 (Verify/Claim) should evaluate
 * migrating authorizationClient.ts onto this substrate rather than running
 * two systems indefinitely — not done in Phase 2 per the operator's explicit
 * "do not yet rewire every journey stage" instruction.
 *
 * Never exposes arbitrary raw-message signing (operator ruling): only the
 * 9 named SigningRequestActionKind values may exist. Adding a 10th means
 * extending this union deliberately, never a generic "sign anything" action.
 */

export type SigningRequestSignerRole = 'principal' | 'agent' | 'issuer';

/** The 9 purpose-bound actions named in the ruling. No 10th without deliberate extension. */
export type SigningRequestActionKind =
  | 'authorize_registration'
  | 'sign_registry_transaction'
  | 'authorize_pulse_disclosure'
  | 'prove_wallet_control'
  | 'sign_passport_application'
  | 'claim_citizen_passport'
  | 'grant_bounded_delegation'
  | 'accept_delegation'
  | 'sign_activation';

/**
 * pending    — prepared, awaiting the designated wallet's action.
 * approved   — the designated signer has signed/approved; evidence recorded.
 *              For an agent-role request this ALSO means the custody act
 *              (e.g. signing a transaction) has been performed, since
 *              approval IS the trigger for the bounded custody service.
 * executed   — the downstream consequence (e.g. broadcast) has completed.
 * refused    — the signer explicitly declined.
 * expired    — expiresAt passed before approval.
 */
export type SigningRequestStatus = 'pending' | 'approved' | 'executed' | 'refused' | 'expired';

export interface SigningRequest {
  id: string;
  actionKind: SigningRequestActionKind;
  signerRole: SigningRequestSignerRole;

  /**
   * The operator/citizen this request is for. T1-safe ONLY under the owner
   * self-view exception (CLAUDE.md): a route may return this to the SAME
   * persona it belongs to, verified server-side via getActivePersona — never
   * to any other caller, never into a receipt, DVN payload, or chain-bound
   * record.
   */
  principalPersonaId: string;

  /** The agent this request concerns, e.g. 'aigent-nakamoto' (runtimeAgentId). Null for principal-only actions with no specific subject agent. */
  subjectAgentRef: string | null;
  /** Human-facing AigentQube id for display, e.g. 'aigentqube-nakamoto'. */
  subjectAigentQubeId: string | null;

  /** e.g. a Citizen Passport ref. Null when not yet applicable to this action (the Citizen Passport supplies authority CONTEXT, not itself a signing key — it is never the signer). */
  authorityCredential: string | null;

  /** Which wallet UI this renders in: 'principal', or an agent's runtimeAgentId. */
  walletRef: string;
  network: string;

  /** The exact, already-canonicalized text the signer is asked to sign/approve. */
  payload: string;
  payloadHash: string;
  /** Human-readable exact consequence, shown verbatim in the wallet UI. */
  consequence: string;

  nonce: string;
  expiresAt: string;
  /** Where the resulting credential/binding/receipt surfaces once this act completes, e.g. 'journey:horizen-moneypenny-admission:register'. */
  receiptDestination: string;

  status: SigningRequestStatus;
  createdAt: string;
  resolvedAt: string | null;

  /** Present only for a principal message-signed request, once approved. */
  signature: string | null;
  signerAddress: string | null;

  refusalCode: string | null;
  refusalDetail: string | null;

  /** The activity_receipt written when this approved signing request's downstream custody act completes. Null until approval. SmartWallet durable correlation (Phase A, 2026-08-12). */
  relatedActivityReceiptId: string | null;
}

export interface CreateSigningRequestInput {
  actionKind: SigningRequestActionKind;
  signerRole: SigningRequestSignerRole;
  principalPersonaId: string;
  subjectAgentRef: string | null;
  subjectAigentQubeId: string | null;
  authorityCredential: string | null;
  walletRef: string;
  network: string;
  payload: string;
  consequence: string;
  expiresInSeconds: number;
  receiptDestination: string;
  /**
   * Optional — supply this when the payload text must itself embed the nonce
   * (standard signature-binding practice: the signer's signature must cover
   * the nonce, not just describe it out-of-band). Generate one first via
   * `generateSigningNonce()`, interpolate it into the payload text, then pass
   * the SAME value here so the stored row matches what was actually signed.
   * When omitted, one is generated internally (fine for agent-role requests
   * whose "signature" is an approval click, not a signed payload).
   */
  nonce?: string;
}
