# Journey State Schema

> Canonical schema for user journey state. Consumed by Runtime, Studio, Codex, Registry, and builder-side agents.

---

## Core Objects

### JourneyState
```typescript
interface JourneyState {
  persona_id: string
  tenant_id: string
  experience_goals: ExperienceGoal[]
  journey_stage: JourneyStage
  persona_state: PersonaStateFlags
  trust_posture: TrustPosture
  cartridge_context: CartridgeContext | null
  codex_context: CodexContext | null
  investor_status: InvestorStatus
  collector_status: CollectorStatus
  creator_status: CreatorStatus
  next_likely_step: string | null
  blocked_reasons: string[]
  last_updated: string
  session_id: string
}
```

### JourneyStage (KNYT)
```typescript
type JourneyStage =
  | 'prospect'
  | 'acolyte'
  | 'keta'
  | 'keji'
  | 'first'
  | 'zero'
  | 'investor_reactivation_candidate'
  | 'collector_only'
  | 'creator_contributor'
```

### ExperienceStrategy
```typescript
interface ExperienceStrategy {
  strategy_id: string
  title: string
  objective: string
  target_personas: string[]
  target_cohorts: string[]
  desired_outcomes: string[]
  kpis: string[]
  constraints: string[]
  owning_franchise: string
  owning_cartridge: string | null
  created_at: string
  updated_at: string
}
```

### ExperienceModel
```typescript
interface ExperienceModel {
  model_id: string
  strategy_id: string
  stages: ExperienceModelStage[]
  transitions: StageTransition[]
  triggers: StageTrigger[]
  blockers: StageBlocker[]
  handoffs: HandoffRule[]
  roles: AgentRoleAssignment[]
  surface_mappings: SurfaceMapping[]
  created_at: string
  updated_at: string
}

interface ExperienceModelStage {
  stage: JourneyStage
  display_name: string
  description: string
  entry_conditions: string[]
  exit_conditions: string[]
  required_actions: string[]
  available_surfaces: string[]
  active_agent: AgentRoleId
}
```

### ExperienceMatrix
```typescript
interface ExperienceMatrix {
  matrix_id: string
  model_id: string
  cells: MatrixCell[]
  created_at: string
  updated_at: string
}

interface MatrixCell {
  stage: JourneyStage
  dimension: string          // e.g. 'investor', 'collector', 'creator'
  status: MatrixCellStatus
  goals: string[]
  enabled_actions: string[]
  recommended_nbe: string | null
  blockers: string[]
  notes: string | null
}

type MatrixCellStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'skipped'
```

### ExperienceGoal
```typescript
interface ExperienceGoal {
  goal_id: string
  persona_id: string
  cohort_id: string | null
  franchise_id: string | null
  goal_type: 'invest' | 'collect' | 'create' | 'contribute' | 'engage' | 'custom'
  priority: 'high' | 'medium' | 'low'
  title: string
  success_criteria: string
  success_status: 'not_started' | 'in_progress' | 'achieved' | 'abandoned'
  linked_stages: JourneyStage[]
  linked_matrix_cells: string[]    // matrix_cell identifiers
  created_at: string
  updated_at: string
}
```

### NBEPlan (Next-Best-Experience)
```typescript
interface NBEPlan {
  nbe_id: string
  scope: 'individual' | 'cohort' | 'franchise'
  scope_id: string               // persona_id, cohort_id, or franchise_id
  trigger: NBETrigger
  recommended_action: string
  recommended_agent: AgentRoleId
  recommended_surface: 'runtime' | 'codex' | 'studio' | 'registry'
  rationale: string
  disposition: 'ask' | 'act' | 'wait' | 'escalate' | 'deny'
  status: 'pending' | 'presented' | 'accepted' | 'declined' | 'expired'
  created_at: string
  expires_at: string | null
}

interface NBETrigger {
  trigger_type: 'stage_entry' | 'inactivity' | 'goal_blocked' | 'activation_failed' | 'manual' | 'scheduled'
  trigger_data: Record<string, unknown>
}
```

### AnalysisCard
```typescript
interface AnalysisCard {
  card_id: string
  scope: 'individual' | 'cohort' | 'franchise'
  scope_id: string
  linked_goals: string[]          // goal_ids
  linked_matrix_status: MatrixCellStatus
  linked_nbe: string | null       // nbe_id
  blockers: string[]
  recommendations: string[]
  health_state: 'healthy' | 'at_risk' | 'stalled' | 'critical'
  operator_action: string | null
  generated_at: string
}
```

---

## Database Tables (Supabase Migration)

```sql
-- experience_strategies
CREATE TABLE public.experience_strategies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  objective text,
  target_personas text[] DEFAULT '{}',
  target_cohorts text[] DEFAULT '{}',
  desired_outcomes text[] DEFAULT '{}',
  kpis text[] DEFAULT '{}',
  constraints text[] DEFAULT '{}',
  owning_franchise text,
  owning_cartridge text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- experience_models
CREATE TABLE public.experience_models (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  strategy_id uuid REFERENCES public.experience_strategies(id),
  stages jsonb NOT NULL DEFAULT '[]',
  transitions jsonb NOT NULL DEFAULT '[]',
  triggers jsonb NOT NULL DEFAULT '[]',
  blockers jsonb NOT NULL DEFAULT '[]',
  handoffs jsonb NOT NULL DEFAULT '[]',
  roles jsonb NOT NULL DEFAULT '[]',
  surface_mappings jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- experience_matrices
CREATE TABLE public.experience_matrices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id uuid REFERENCES public.experience_models(id),
  cells jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- experience_goals
CREATE TABLE public.experience_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id uuid,
  cohort_id text,
  franchise_id text,
  goal_type text NOT NULL CHECK (goal_type IN ('invest','collect','create','contribute','engage','custom')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  title text NOT NULL,
  success_criteria text,
  success_status text NOT NULL DEFAULT 'not_started'
    CHECK (success_status IN ('not_started','in_progress','achieved','abandoned')),
  linked_stages text[] DEFAULT '{}',
  linked_matrix_cells text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- journey_states
CREATE TABLE public.journey_states (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id uuid NOT NULL,
  tenant_id text NOT NULL,
  journey_stage text NOT NULL DEFAULT 'prospect',
  persona_state jsonb DEFAULT '{}',
  trust_posture jsonb DEFAULT '{}',
  cartridge_context jsonb,
  codex_context jsonb,
  investor_status jsonb DEFAULT '{}',
  collector_status jsonb DEFAULT '{}',
  creator_status jsonb DEFAULT '{}',
  next_likely_step text,
  blocked_reasons text[] DEFAULT '{}',
  session_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (persona_id, tenant_id)
);

-- nbe_plans
CREATE TABLE public.nbe_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('individual','cohort','franchise')),
  scope_id text NOT NULL,
  trigger_type text NOT NULL,
  trigger_data jsonb DEFAULT '{}',
  recommended_action text NOT NULL,
  recommended_agent text NOT NULL,
  recommended_surface text NOT NULL,
  rationale text,
  disposition text NOT NULL DEFAULT 'ask'
    CHECK (disposition IN ('ask','act','wait','escalate','deny')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','presented','accepted','declined','expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- analysis_cards
CREATE TABLE public.analysis_cards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('individual','cohort','franchise')),
  scope_id text NOT NULL,
  linked_goals text[] DEFAULT '{}',
  linked_matrix_status text,
  linked_nbe_id uuid REFERENCES public.nbe_plans(id),
  blockers text[] DEFAULT '{}',
  recommendations text[] DEFAULT '{}',
  health_state text NOT NULL DEFAULT 'healthy'
    CHECK (health_state IN ('healthy','at_risk','stalled','critical')),
  operator_action text,
  generated_at timestamptz DEFAULT now()
);
```

---

## KNYT Ladder-State Values

| Stage | Description | Entry Conditions |
|-------|-------------|-----------------|
| `prospect` | Pre-signup awareness | No account |
| `acolyte` | Signed up, not yet activated | Account created, no first purchase |
| `keta` | First activation completed | First KNYT purchase |
| `keji` | Active participant | 3+ contributions or 2+ purchases |
| `first` | Established member | Complete onboarding + first investment |
| `zero` | Core community | Steward-elevated |
| `investor_reactivation_candidate` | Lapsed investor | >90 days since last investment |
| `collector_only` | Collects but doesn't invest | KNYT purchases, no investment |
| `creator_contributor` | Active content contributor | Correspondent or steward role |
