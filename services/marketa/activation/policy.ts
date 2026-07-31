import type { CandidateAgentInput } from './types';
import { includesAny, textBlob } from './text';

const HIGH_RISK_TERMS: Array<[string, string[]]> = [
  ['legal_advice_claim', ['legal advice', 'attorney advice', 'lawyer advice', 'practice of law']],
  ['immigration_advice_claim', ['immigration advice', 'visa advice', 'asylum advice']],
  ['financial_advice_claim', ['financial advice', 'investment advice', 'trading advice']],
  ['medical_advice_claim', ['medical advice', 'diagnosis', 'clinical advice']],
  ['vulnerable_person_interaction', ['stateless', 'refugee', 'asylum', 'vulnerable', 'housing-insecure']],
  ['physical_world_action', ['robotic', 'physical-world', 'delivery', 'transport', 'in-person']],
  ['autonomous_outbound_action', ['auto-send', 'autonomous outreach', 'unsupervised outbound', 'bulk dm']],
  ['private_data_access', ['private data', 'blackqube', 'blakqube', 'sensitive personal data']],
  ['opaque_data_practices', ['scrape private', 'no consent', 'undisclosed training', 'shadow profile']],
];

const POLICY_TERMS: Array<[string, string[]]> = [
  ['needs_human_approval', ['send email', 'outreach', 'publish', 'contract', 'agreement', 'legal', 'immigration']],
  ['needs_opt_out_check', ['email sequence', 'newsletter', 'bulk', 'campaign', 'outreach']],
  ['needs_terms_review', ['scrape', 'directory', 'github', 'hugging face', 'social']],
  ['needs_licensed_partner_escalation', ['legal aid', 'immigration', 'asylum', 'lawful presence', 'rights navigation']],
  ['needs_no_train_confirmation', ['training data', 'fine-tune', 'model training', 'user data']],
];

export function riskFlagger(input: CandidateAgentInput): string[] {
  const text = textBlob(input);
  return HIGH_RISK_TERMS
    .filter(([, terms]) => includesAny(text, terms))
    .map(([flag]) => flag);
}

export function policyFlagger(input: CandidateAgentInput): string[] {
  const text = textBlob(input);
  return POLICY_TERMS
    .filter(([, terms]) => includesAny(text, terms))
    .map(([flag]) => flag);
}

export function cleanRevenueScreen(input: CandidateAgentInput): {
  status: 'likely_clean' | 'needs_review' | 'rejected';
  riskFlags: string[];
  policyFlags: string[];
} {
  const riskFlags = riskFlagger(input);
  const policyFlags = policyFlagger(input);
  const critical = riskFlags.some((flag) =>
    ['private_data_access', 'opaque_data_practices', 'autonomous_outbound_action'].includes(flag),
  );
  return {
    status: critical ? 'rejected' : riskFlags.length > 0 || policyFlags.length > 0 ? 'needs_review' : 'likely_clean',
    riskFlags,
    policyFlags,
  };
}
