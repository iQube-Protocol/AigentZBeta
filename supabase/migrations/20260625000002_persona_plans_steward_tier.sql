-- Add 'steward' to the plan_tier CHECK constraint on persona_plans.
-- 'steward' is the Tier 2 ($99/month) Stewardship citizen tier.
-- Legacy values 'citizen_plus' / 'first_citizen' are retained for future use.
--
-- A CHECK constraint on a NOT NULL column cannot be modified in place;
-- we drop the existing constraint and recreate it with the new value set.

ALTER TABLE public.persona_plans
  DROP CONSTRAINT IF EXISTS persona_plans_plan_tier_check;

ALTER TABLE public.persona_plans
  ADD CONSTRAINT persona_plans_plan_tier_check
  CHECK (plan_tier IN (
    'citizen',
    'citizen_plus',
    'sovereign_citizen',
    'steward',
    'first_citizen'
  ));
