// Static data for Venture Lab Growth Matrix — imported by tab component

export type IndustryOverlay = 'generic' | 'media' | 'legal';
export type MatrixSubTab    = 'matrix' | 'ladder' | 'model' | 'strategy';

export interface VenturePayload {
  description?: string;
  focus_area?: string;
  overlay?: string;
  team?: string[];
  key_milestones?: string[];
  next_steps?: string[];
  risks?: string[];
  tags?: string[];
  value_proposition?: string;
  customer_segments?: string[];
  revenue_streams?: string[];
  key_channels?: string[];
  key_partners?: string[];
  council_agenda_items?: string[];
}

export interface Venture {
  id: string;
  venture_name: string;
  venture_slug: string;
  y_maturity: number;
  x_commercialization: number;
  zone: string;
  status: string;
  payload: VenturePayload;
}

// ── Axes ──────────────────────────────────────────────────────────────────────

export const Y_LABELS = [
  { n: 7, label: 'Scale',         sub: 'Growth & expansion' },
  { n: 6, label: 'Market Fit',    sub: 'PMF confirmed' },
  { n: 5, label: 'Early Revenue', sub: 'First customers' },
  { n: 4, label: 'Build',         sub: 'MVP in market' },
  { n: 3, label: 'Prototype',     sub: 'Proof of concept' },
  { n: 2, label: 'Validate',      sub: 'Hypothesis testing' },
  { n: 1, label: 'Ideation',      sub: 'Concept formation' },
];

export const X_LABELS = [
  { n: 1, label: 'Pre-Market',   sub: 'No commercial activity' },
  { n: 2, label: 'Positioning',  sub: 'Market research' },
  { n: 3, label: 'Early Sales',  sub: 'First deals' },
  { n: 4, label: 'Growing',      sub: 'Repeatable sales' },
  { n: 5, label: 'Scaling',      sub: 'Expanding channels' },
  { n: 6, label: 'Dominant',     sub: 'Category leader' },
  { n: 7, label: 'Market Leader',sub: 'Platform position' },
];

// ── Zone ──────────────────────────────────────────────────────────────────────

export function computeZone(y: number, x: number): string {
  const s = y + x;
  if (s <= 4)  return 'formation';
  if (s <= 7)  return 'validation';
  if (s <= 10) return 'activation';
  if (s <= 12) return 'strategic';
  return 'scale';
}

export const ZONE_STYLE: Record<string, { bg: string; border: string; dot: string; label: string; ring: string }> = {
  formation:  { bg: 'bg-slate-800/40',    border: 'border-slate-600/30',    dot: 'bg-slate-400',    label: 'text-slate-400',    ring: 'ring-slate-500/40'  },
  validation: { bg: 'bg-blue-900/30',     border: 'border-blue-500/20',     dot: 'bg-blue-400',     label: 'text-blue-300',     ring: 'ring-blue-500/40'   },
  activation: { bg: 'bg-emerald-900/30',  border: 'border-emerald-500/20',  dot: 'bg-emerald-400',  label: 'text-emerald-300',  ring: 'ring-emerald-500/40'},
  strategic:  { bg: 'bg-amber-900/30',    border: 'border-amber-500/20',    dot: 'bg-amber-400',    label: 'text-amber-300',    ring: 'ring-amber-500/40'  },
  scale:      { bg: 'bg-violet-900/30',   border: 'border-violet-500/20',   dot: 'bg-violet-400',   label: 'text-violet-300',   ring: 'ring-violet-500/40' },
};

// Golden path: maturity slightly ahead of commercialization
export const GOLDEN_PATH = new Set([
  '1,1','2,1','2,2','3,2','3,3','4,3','4,4','5,4','5,5','6,5','6,6','7,6','7,7',
]);

// ── Overlay context (applies to whole grid) ───────────────────────────────────

interface ZoneCtx { title: string; milestone: string; kpi: string }
type OverlayCtx = Record<string, ZoneCtx>;

export const OVERLAY_ZONE: Record<IndustryOverlay, OverlayCtx> = {
  generic: {
    formation:  { title: 'Concept Stage',      milestone: 'Problem hypothesis + 10 discovery calls', kpi: 'Problem/ICP clarity'      },
    validation: { title: 'Validation Stage',   milestone: 'MVP to 10 users, feedback loops live',    kpi: 'Validated learning units'  },
    activation: { title: 'Activation Stage',   milestone: '3 paying customers, NPS > 40',            kpi: 'CAC & 30-day retention'    },
    strategic:  { title: 'Strategic Growth',   milestone: 'Repeatable playbook, team hired',          kpi: 'MoM revenue growth'        },
    scale:      { title: 'Scale Stage',        milestone: 'Market expansion, platform effects active',kpi: 'Market share & NRR'        },
  },
  media: {
    formation:  { title: 'IP Formation',        milestone: 'Narrative world defined, creator team assembled',kpi: 'World-building completeness'        },
    validation: { title: 'Audience Validation', milestone: 'Pilot episode released, early community signal', kpi: 'Engaged early audience size'         },
    activation: { title: 'IP Activation',       milestone: 'Collectibles launched, licensing deal signed',   kpi: 'Revenue per IP asset & collector LTV'},
    strategic:  { title: 'Platform Position',   milestone: 'Multi-channel distribution, brand licensing',    kpi: 'IP catalog value & syndication rev'  },
    scale:      { title: 'IP Empire',           milestone: 'Cross-platform universe, studio partnerships',   kpi: 'Franchise ARR & cultural reach'      },
  },
  legal: {
    formation:  { title: 'Legal Thesis',          milestone: 'Regulatory gap mapped, compliance scope defined',kpi: 'TAM clarity & regulatory map'   },
    validation: { title: 'Regulatory Pilot',      milestone: 'Tested with 2 law firms, workflow validated',    kpi: 'Regulatory milestone pass rate'  },
    activation: { title: 'Client Acquisition',    milestone: 'First enterprise contract, SaaS pilot live',     kpi: 'ARR & time-to-compliance'        },
    strategic:  { title: 'Market Authority',      milestone: 'Category definition, regulatory body partner',   kpi: 'NRR & compliance coverage'       },
    scale:      { title: 'Legal Infrastructure',  milestone: 'Cross-jurisdictional platform, policy influence',kpi: 'Cases automated & jurisdictions'  },
  },
};

export const Y_INSIGHT: Record<number, string> = {
  1: 'Concept is forming — validate the problem before investing in solution.',
  2: 'Testing hypotheses — run minimum experiments to invalidate bad assumptions early.',
  3: 'Prototype exists — get real user feedback, not opinions.',
  4: 'MVP is live — instrument everything, kill features ruthlessly.',
  5: 'First revenue signals — understand who pays, why, and at what frequency.',
  6: 'PMF confirmed — the engine runs; amplify what works without breaking it.',
  7: 'At scale — protect the core, expand the perimeter, defend with network effects.',
};

export const X_INSIGHT: Record<number, string> = {
  1: 'No commercial motion yet — validate first, monetize second.',
  2: 'Positioning underway — know your ICP before going outbound.',
  3: 'First deals closed — learn from every sale, pattern the playbook.',
  4: 'Sales is repeatable — invest in CS, reduce churn before adding channels.',
  5: 'Channels scaling — deepen what works, resist adding new ones.',
  6: 'Category leadership — defend with lock-in and network effects.',
  7: 'Market-defining — set the agenda, shape regulation, compound the moat.',
};

export const ZONE_NBA: Record<string, { action: string; target: string }> = {
  formation:  { action: 'Run 3 structured discovery interviews. Document problem hypothesis with evidence.', target: 'Validation zone (Y2+, X2+)'  },
  validation: { action: 'Ship an MVP to 10 target users. Capture 5 quantitative metrics.', target: 'Activation zone (Y4+, X3+)' },
  activation: { action: 'Close 3 paying customers. Measure 30-day retention. Define repeatable sales motion.', target: 'Strategic zone (Y5+, X5+)' },
  strategic:  { action: 'Build repeatable sales playbook. Hire first sales/CS. Define expansion.', target: 'Scale zone (Y7, X6+)'    },
  scale:      { action: 'Define platform expansion. Enter adjacent market. Compound network effects.', target: 'Market leader (Y7, X7)' },
};

// ── Sample seed data ──────────────────────────────────────────────────────────

export const SAMPLE_VENTURES: Array<Omit<Venture, 'id' | 'status'>> = [
  {
    venture_name: 'MetaKnyt',
    venture_slug: 'metaknyt',
    y_maturity: 4,
    x_commercialization: 3,
    zone: 'validation',
    payload: {
      description: 'IP-native narrative world — 13 KNYT characters, NFT episodes, Kickstarter active.',
      focus_area: 'Media & IP',
      overlay: 'media',
      team: ['Hal', 'Creative Lead', 'Tech Lead'],
      value_proposition: 'The first IP-native Web3 narrative world where collectors co-own the canon.',
      customer_segments: ['Web3 collectors', 'Narrative gaming fans', 'IP investors'],
      revenue_streams: ['NFT drops', 'Licensing', 'Collector subscriptions'],
      key_milestones: ['13 character NFTs launched','Kickstarter campaign live','KNYT Wheel in build','AVL partner wave activating'],
      next_steps: ['Close KS — target 200+ backers','Activate 16 Wave 1 AVL partners','Launch collector packs post-campaign'],
      risks: ['Campaign depends on partner amplification','NFT market sentiment volatility'],
      tags: ['media','nft','ip','kickstarter','web3'],
    },
  },
  {
    venture_name: 'MetaIye Media',
    venture_slug: 'metaiye-media',
    y_maturity: 3,
    x_commercialization: 2,
    zone: 'validation',
    payload: {
      description: 'Cultural media platform connecting African diaspora creators with global audiences.',
      focus_area: 'Media & Culture',
      overlay: 'media',
      team: ['Founder', 'Editorial'],
      value_proposition: 'The home for African diaspora creative culture and commerce.',
      customer_segments: ['African diaspora creators', 'Cultural brands', 'Global media buyers'],
      revenue_streams: ['Creator subscriptions', 'Brand partnerships', 'Content licensing'],
      key_milestones: ['Platform prototype live','First creator cohort onboarded','Distribution partnerships scoped'],
      next_steps: ['Launch audience validation campaign','Define monetisation model','Sign first distribution agreement'],
      risks: ['Creator acquisition CAC undefined','Monetisation model not validated'],
      tags: ['media','culture','creators','diaspora'],
    },
  },
];

// ── Cell prescriptions — 49 cells (y=1..7, x=1..7) ──────────────────────────
// key: `${y},${x}` — short action label for each matrix intersection

export const CELL_LABEL: Record<string, string> = {
  '1,1': 'Problem Discovery',  '1,2': 'Market Scan',        '1,3': 'Early Pitch',
  '1,4': 'Oversold',           '1,5': 'Premature Scale',    '1,6': 'Exposure Risk',    '1,7': 'Off-map',
  '2,1': 'Build Signal',       '2,2': 'ICP Definition',     '2,3': 'Sales Learning',
  '2,4': 'Channel Ahead',      '2,5': 'Overextended',       '2,6': 'Scale Debt',       '2,7': 'Reality Reset',
  '3,1': 'Build Mode',         '3,2': 'Market Test',        '3,3': 'First Deals',
  '3,4': 'PMF Hunt',           '3,5': 'Channel Risk',       '3,6': 'Scale Trap',       '3,7': 'Off-map',
  '4,1': 'Distribution Gap',   '4,2': 'Soft Launch',        '4,3': 'Beta Customers',
  '4,4': 'Traction Signal',    '4,5': 'Overreach',          '4,6': 'Scale Debt',       '4,7': 'Off-map',
  '5,1': 'Revenue Block',      '5,2': 'GTM Build',          '5,3': 'First Revenue',
  '5,4': 'Repeat Revenue',     '5,5': 'Channel Scale',      '5,6': 'Category Move',    '5,7': 'Platform Signal',
  '6,1': 'PMF Bottleneck',     '6,2': 'Distribution Gap',   '6,3': 'Funnel Refinement',
  '6,4': 'PMF + Growth',       '6,5': 'Scaling PMF',        '6,6': 'Category Leader',  '6,7': 'Platform Expansion',
  '7,1': 'Scale Block',        '7,2': 'Demand Gen',         '7,3': 'Sales Buildout',
  '7,4': 'Growth Engine',      '7,5': 'Platform Build',     '7,6': 'Market Scale',     '7,7': 'Market Leader',
};
