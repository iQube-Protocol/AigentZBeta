# VL-CT-001 — deployment gate, probe lockdown, and the balanced 16-replay demonstration

**Date:** 2026-07-29
**Branch:** `claude/constitutional-ground-review-7yg8nb`
**Scope:** five operator rulings applied to the VL-CT-001 venture substrate
**Status:** implemented, suite green, mutation-tested 28/28

---

## ⚠️ ACTION REQUIRED BEFORE THE NEXT DEPLOY

**The Amplify build now FAILS if the three venture receipt migrations are not applied.**
That is the ruling ("Deployment must FAIL on incompatibility"), and it is working as intended —
but it means **the next push to `dev` will not build until the SQL below has been run.**

Verified against the live dev Supabase on 2026-07-29: the gate reaches the database, finds no
probe function, and refuses. **Run [the SQL](#the-sql-run-this-first) now.**

---

## The five rulings, and what each became

| # | Ruling | Landed as |
|---|---|---|
| 1 | Wire the deployment check into the Amplify pipeline; deployment must FAIL on incompatibility. Keep the runtime guard as defence in depth, but do not probe on every request or cold start. | `scripts/check-venture-receipt-constraint.ts` + a build-phase step in `amplify.yml`; the emission guard memoised per process |
| 2 | Lock down the `SECURITY DEFINER` probe — revoke from `public` and `anon`, service-role only, pin `search_path`, no caller-controlled dynamic SQL, return only the minimum compatibility result | `supabase/migrations/20260929000200_venture_receipt_probe_lockdown.sql` + `AC-20` |
| 3 | Exactly two fixed opportunities, both across all eight cells = 16 replays; catalogue closed at two | `MONEYPENNY_OPPORTUNITIES` + `AC-22` |
| 4 | Inline, complete operator SQL verifying the constraint, the restricted function permissions, and a positive compatibility result | [below](#the-sql-run-this-first) |
| 5 | Preserve the weight-rescaling mutation as a **named control**, with the reason recorded, at the site | `AC-17` control + a marker in `standingAdmission.ts` |

---

## THE SQL — run this first

Paste into the **Supabase SQL editor** for the target project. Three migrations, then two
verification queries. All three verification rows must read `PASS`.

### Step 1 — the three migrations (one copyable block)

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 20260929000000 — the nine venture action types in the CHECK constraint.
-- The constraint is rebuilt IN FULL: the latest rebuild is always the complete
-- vocabulary, so the parity canary has exactly one file to read.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE public.activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
    'intent_queued',
    'specialist_consulted',
    'artifact_created',
    'artifact_published',
    'artifact_sent',
    'approval_granted',
    'approval_rejected',
    'experience_model_updated',
    'session_started',
    'session_completed',
    'passport_application_submitted',
    'passport_issued',
    'passport_status_changed',
    'passport_revoked',
    'passport_privilege_changed',
    'passport_infraction_recorded',
    'governance_decision_ratified',
    'governance_decision_amended',
    'governance_authority_exercised',
    'governance_escalation_triggered',
    'experience_task_completed',
    'agent_revocation_state_changed',
    'operator_action_logged',
    'standing_document_added',
    'partner_agent_evidence_recorded',
    'agent_delegated',
    'agent_delegation_revoked',
    'plan_purchased',
    'plan_renewed',
    'invariant_discovered',
    'invariant_validated',
    'invariant_canonized',
    'invariant_superseded',
    'invariant_qube_published',
    'knowledge_curated',
    'consequence_forecast_recorded',
    'knowledge_evolved',
    'experience_render_validated',
    'implementation_pack_generated',
    'implementation_dispatched',
    'deployment_proposed',
    'constitutional_validation_recorded',
    'remediation_recorded',
    'deployment_authorized',
    'validation_override_granted',
    'capability_registered',
    'capability_operationally_validated',
    'capability_deprecated',
    'research_lifecycle_transition',
    'experiment_result_published',
    'invariant_node_flipped',
    'agreement_formed',
    'agreement_authorized',
    'qubetalk_artifact_shared',
    'qubetalk_artifact_opened',
    'qubetalk_artifact_copied',
    'finance_authoritative_execution',
    'canonical_plate_composed',
    'plan_cancelled',
    'venture_blueprint_handoff',
    'standing_accrued',
    'standing_corrected',
    'workspace_report_published',
    -- VL-CT-001 venture substrate (2026-07-29).
    'venture_opportunity_opened',
    'venture_service_completed',
    'venture_completion_assessed',
    'venture_refusal_recorded',
    'venture_obligation_earned',
    'venture_obligation_approved',
    'venture_settlement_simulated',
    'venture_obligation_reversed',
    'venture_opportunity_closed'
));

-- ═══════════════════════════════════════════════════════════════════════════
-- 20260929000100 — the compatibility probe (superseded shape; run in order so
-- a database at any prior state converges).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.venture_receipt_action_type_constraint()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
   WHERE c.conname = 'activity_receipts_action_type_check'
     AND c.conrelid = 'public.activity_receipts'::regclass
   LIMIT 1;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 20260929000200 — RULING 2. Lock the probe down.
--
--  * SECURITY DEFINER runs as the OWNER: it bypasses table grants AND RLS, so
--    the previous `anon` grant was a hole the table lockdown did not constrain.
--  * Returns ONLY the venture_* subset — the superseded version returned the
--    platform's entire action vocabulary across every feature area.
--  * search_path pinned to pg_catalog, pg_temp (public deliberately ABSENT).
--  * No arguments, no EXECUTE, no format(), no string-built SQL.
--  * The REVOKE follows the CREATE, because a new function is EXECUTE-able by
--    PUBLIC by default.
-- ═══════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.venture_receipt_action_type_constraint();

CREATE FUNCTION public.venture_receipt_action_type_constraint()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT (
    SELECT coalesce(array_agg(DISTINCT m.captured[1] ORDER BY m.captured[1]), ARRAY[]::text[])
      FROM regexp_matches(
             pg_get_constraintdef(c.oid),
             '''(venture_[a-z_]+)''',
             'g'
           ) AS m(captured)
  )
    FROM pg_constraint c
   WHERE c.conname = 'activity_receipts_action_type_check'
     AND c.conrelid = 'public.activity_receipts'::regclass
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.venture_receipt_action_type_constraint() IS
  'VL-CT-001 deployment compatibility probe. Returns ONLY the venture_* action types the activity_receipts CHECK constraint accepts (NULL when the constraint is absent), so the deployment gate and the emission backstop can refuse live venture receipt emission when the action-type migration has not been applied. SECURITY DEFINER, service_role only, search_path pinned, no arguments and no dynamic SQL. See services/venture/trading/receiptCompatibility.ts and scripts/check-venture-receipt-constraint.ts.';

REVOKE EXECUTE ON FUNCTION public.venture_receipt_action_type_constraint() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.venture_receipt_action_type_constraint() FROM anon;
REVOKE EXECUTE ON FUNCTION public.venture_receipt_action_type_constraint() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.venture_receipt_action_type_constraint() TO service_role;
```

### Step 2 — verification query A (constraint + function permissions)

Never errors; always reports. Both rows must read `PASS`.

```sql
WITH required(action_type) AS (
  VALUES ('venture_opportunity_opened'), ('venture_service_completed'),
         ('venture_completion_assessed'), ('venture_refusal_recorded'),
         ('venture_obligation_earned'),   ('venture_obligation_approved'),
         ('venture_settlement_simulated'),('venture_obligation_reversed'),
         ('venture_opportunity_closed')
),
def AS (
  SELECT pg_get_constraintdef(c.oid) AS body
    FROM pg_constraint c
   WHERE c.conname = 'activity_receipts_action_type_check'
     AND c.conrelid = 'public.activity_receipts'::regclass
),
fn AS (
  SELECT p.oid, p.proacl, p.proconfig, p.prosecdef,
         pg_get_function_result(p.oid) AS result_type
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'venture_receipt_action_type_constraint'
)
SELECT '1. constraint accepts all nine venture action types' AS check_name,
       CASE WHEN NOT EXISTS (SELECT 1 FROM def)
              THEN 'FAIL - constraint absent; apply 20260929000000'
            WHEN (SELECT count(*) FROM required r, def d
                   WHERE d.body LIKE '%''' || r.action_type || '''%') = 9 THEN 'PASS'
            ELSE 'FAIL - rejects: ' || (SELECT string_agg(r.action_type, ', ')
                    FROM required r
                   WHERE NOT EXISTS (SELECT 1 FROM def d
                                      WHERE d.body LIKE '%''' || r.action_type || '''%'))
       END AS verdict
UNION ALL
SELECT '2. probe: SECURITY DEFINER, text[], search_path pinned, service_role ONLY',
       CASE WHEN NOT EXISTS (SELECT 1 FROM fn)
              THEN 'FAIL - probe absent; apply 20260929000100 then 20260929000200'
            WHEN (SELECT prosecdef FROM fn) IS NOT TRUE THEN 'FAIL - not SECURITY DEFINER'
            WHEN (SELECT result_type FROM fn) <> 'text[]'
              THEN 'FAIL - probe returns ' || (SELECT result_type FROM fn) || '; apply 20260929000200'
            WHEN NOT EXISTS (SELECT 1 FROM fn WHERE 'search_path=pg_catalog, pg_temp' = ANY(proconfig))
              THEN 'FAIL - search_path not pinned to pg_catalog, pg_temp'
            WHEN EXISTS (SELECT 1 FROM fn, unnest(coalesce(proacl, '{}'::aclitem[])) a
                          WHERE a::text LIKE '=%') THEN 'FAIL - PUBLIC can execute the probe'
            WHEN has_function_privilege('anon', (SELECT oid FROM fn), 'EXECUTE')
              THEN 'FAIL - anon can execute the probe'
            WHEN has_function_privilege('authenticated', (SELECT oid FROM fn), 'EXECUTE')
              THEN 'FAIL - authenticated can execute the probe'
            WHEN NOT has_function_privilege('service_role', (SELECT oid FROM fn), 'EXECUTE')
              THEN 'FAIL - service_role cannot execute the probe'
            ELSE 'PASS'
       END;
```

### Step 3 — verification query B (a positive compatibility result)

Calls the probe. Must read `PASS - all nine accepted`.

> If this errors with `function ... does not exist`, query A row 2 has already told you why —
> the probe migrations have not been applied. Two queries rather than one because a missing
> function is a **parse** error, so a single statement could not report it.

```sql
WITH required(action_type) AS (
  VALUES ('venture_opportunity_opened'), ('venture_service_completed'),
         ('venture_completion_assessed'), ('venture_refusal_recorded'),
         ('venture_obligation_earned'),   ('venture_obligation_approved'),
         ('venture_settlement_simulated'),('venture_obligation_reversed'),
         ('venture_opportunity_closed')
),
probe AS (
  -- to_jsonb so a superseded scalar-returning probe still REPORTS rather than
  -- failing to parse.
  SELECT to_jsonb(public.venture_receipt_action_type_constraint()) AS accepted
)
SELECT '3. probe returns a positive compatibility result' AS check_name,
       CASE WHEN jsonb_typeof((SELECT accepted FROM probe)) IS NULL
              OR jsonb_typeof((SELECT accepted FROM probe)) = 'null'
              THEN 'FAIL - probe reports the constraint absent'
            WHEN jsonb_typeof((SELECT accepted FROM probe)) <> 'array'
              THEN 'FAIL - probe returns a scalar; apply 20260929000200'
            WHEN (SELECT count(*) FROM required r
                   WHERE jsonb_exists((SELECT accepted FROM probe), r.action_type)) = 9
              THEN 'PASS - all nine accepted'
            ELSE 'FAIL - probe reports missing: ' || (SELECT string_agg(r.action_type, ', ')
                    FROM required r
                   WHERE NOT jsonb_exists((SELECT accepted FROM probe), r.action_type))
       END AS verdict;
```

### Expected output when the database is ready

```
1. constraint accepts all nine venture action types                      | PASS
2. probe: SECURITY DEFINER, text[], search_path pinned, service_role ONLY | PASS
3. probe returns a positive compatibility result                          | PASS - all nine accepted
```

**These queries were executed against a real PostgreSQL 16 instance in every state** — fully
migrated, constraint absent, constraint partially applied, probe absent, probe at the superseded
scalar shape, probe granted to `anon`, probe granted to `PUBLIC` — and each produced the
corresponding `FAIL` with the correct remedy. They are not a written-down intention.

---

## RULING 1 — the deployment gate

### The exact build-spec change

`amplify.yml`, `frontend.phases.build.commands`, inserted **after** `node scripts/create-env-production.js`
(and its PayPal credential check) and **before** `npm run build`:

```yaml
        - echo "=== VL-CT-001 venture receipt constraint gate ==="
        - npx tsx scripts/check-venture-receipt-constraint.ts
```

The step is preceded by a comment block explaining what it prevents and why it fails closed.

**Why there.** The gate needs `SUPABASE_SERVICE_ROLE_KEY`, which only exists after
`create-env-production.js` has run; and it belongs ahead of the Next compile so a refusal costs
seconds rather than a full build. It is the second constitutional gate in the phase — the
persona-spine gate runs first, before dependencies are even resolved.

### What it does

`scripts/check-venture-receipt-constraint.ts` loads `.env.production`, calls the shared
`ventureReceiptDeploymentCheck()` with its default service-role probe, and exits **1** on any
incompatibility. It decides nothing itself: the verdict comes from
`services/venture/trading/receiptCompatibility.ts`, so there is no parallel compatibility logic.

Four refusal paths, all `exit 1`:

| Condition | Message |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` absent | names the lockdown migration and the Amplify env var to set |
| probe missing / revoked / unreachable | `probe-unavailable` + the three migrations to apply |
| constraint absent | `constraint-absent` + the migration |
| vocabulary short | `action-types-missing` + exactly which types are rejected |

**No bypass flag.** A gate with an escape hatch is a gate that gets escaped, and what is on the
far side of this one is the integrity of the receipt trail. `AC-21` fails the build if a
`skip` / `bypass` / `override` / `force` construct appears in the script, and asserts the only
environment variable it reads is the credential it needs to ask the question.

### Two layers, different frequencies

| Layer | Where | Frequency | Behaviour |
|---|---|---|---|
| **Deploy gate** | `amplify.yml` build phase | once per build | exits non-zero; the artifact is never promoted |
| **Emission backstop** | `persistVentureReceipt` / `anchorVentureReceipt` | once per process, lazily | throws `VentureReceiptCompatibilityError` before the writer runs |

The backstop is **memoised on a `WeakMap` keyed by probe identity**, holding the in-flight
promise so concurrent first emissions share one round trip. Explicitly, per the ruling:

- **not a per-request probe** — a compatible answer is probed once and reused for the life of the
  process (`AC-18`: "probes ONCE per process for a compatible schema, not once per emission");
- **not a cold-start probe** — nothing runs at module load, and the first probe happens on the
  first *live* emission attempt, which in Phase 1 never occurs at all (`AC-18`: "nothing probes
  the database at module load");
- **negatives are never cached** — an incompatible answer is evicted, so applying the migration
  recovers a running deployment without a redeploy. Caching the negative would turn a five-minute
  SQL fix into a deploy cycle, and would have the gate reporting a state that is no longer true.

The deployment check itself is deliberately **not** memoised — the deploy gate wants a fresh
answer every time it is asked.

---

## RULING 2 — the probe's final state

| Property | Before (`20260929000100`) | After (`20260929000200`) |
|---|---|---|
| `EXECUTE` grants | `anon, authenticated, service_role` | **`service_role` only** |
| `PUBLIC` | implicitly granted (default on CREATE) | **revoked** |
| `search_path` | `pg_catalog, public` | **`pg_catalog, pg_temp`** — `public` deliberately absent |
| `SECURITY DEFINER` | yes | yes (unchanged) |
| Arguments | none | none |
| Dynamic SQL | none | none |
| Returns | `text` — the WHOLE constraint definition | **`text[]`** — only the `venture_*` values accepted |

Verified on PostgreSQL 16 after applying the migration:

```
proacl     = {postgres=X/postgres,service_role=X/postgres}
proconfig  = {"search_path=pg_catalog, pg_temp"}
prosecdef  = t
result     = text[]
SET ROLE anon;         → ERROR: permission denied for function venture_receipt_action_type_constraint
SET ROLE service_role; → returns the venture_* array
```

### The two points the ruling asked me to verify and fix if violated

**No caller-controlled dynamic SQL — verified clean, and kept clean.** The function takes no
arguments at all, contains no `EXECUTE`, no `format()`, no `quote_ident()`, no string
concatenation, and names its one constraint and its one table as literals. There is nothing a
caller can steer. `AC-20` asserts this over the dollar-quoted **body** (the surrounding migration
necessarily says "execute" in its GRANT/REVOKE lines; what must be clean is the code that runs
with the definer's rights).

**Minimum compatibility result — VIOLATED, and fixed.** The superseded probe returned
`pg_get_constraintdef` verbatim: the platform's entire action vocabulary — passport, governance,
finance, QubeTalk, invariants, research, every feature area's internal event names — to answer a
question about nine venture types. It now returns only the `venture_*` values the constraint
accepts.

Consequences of the narrowing, both improvements:

- **The nine names are not restated in SQL.** The probe filters by the `venture_` prefix, so the
  migration does not become a third declaration of a vocabulary that already lives in two
  (`inv.engineering.036/037`). `AC-20` fails if any of the nine appears in the function body.
- **The application's check got stronger.** It was a substring test over definition text; it is
  now exact set membership. The quoted-literal discipline moved into the probe's regex
  (`'(venture_[a-z_]+)'` — a *quoted* literal, so a comment mentioning an action type is not the
  database accepting it), and `AC-18` proves the application layer rejects a near-miss name like
  `x_venture_obligation_earned_v2`.

### The anon-regrant canary

Copied from the QubeTalk pattern in `tests/qubetalk-confidentiality.test.ts`: `AC-20` walks every
migration filename sorted **after** `20260929000200` and fails the build if any of them grants
`EXECUTE` on the probe to `anon`, `public`, or `authenticated`. That is how the hole comes back —
a later migration re-runs a `CREATE OR REPLACE` with the original grant line copied along, and
nothing notices.

---

## RULING 3 — the 16-run matrix

Two fixed opportunities, eight cells each. The catalogue is a **closed, hand-written pair** in
`MONEYPENNY_OPPORTUNITIES` — not derived from `VENTURE_SCENARIOS` (which holds three), with no
registration function, and an unknown key is **refused** rather than defaulted.

| Catalogue entry | Public key | Fixture | Exercises |
|---|---|---|---|
| `correct-refusal` (default) | `mp-sim-001-suitability-refusal` | S2 | a completed constitutional service that declines to execute |
| `approved-execution` | `mp-sim-002-eligible-execution` | S1 | an obligation that actually settles |

### `correct-refusal` — 5 preparation events, 355 000 ms elapsed, verdict `refused-complete` (7/7 links)

| Cell | Obligations | Settled | Settled (minor units) | Budget remaining | Receipts | Standing |
|---|---|---|---|---|---|---|
| `USDC-BUNDLED-EXEC` | 0 | 0 | 0 | 5 000 000 | 9 | `correct-refusal` @ 2.75 |
| `USDC-BUNDLED-COMPLETE` | 1 | 1 | 7 500 | 4 992 500 | 12 | `correct-refusal` @ 2.75 |
| `USDC-SERVICE-EXEC` | 0 | 0 | 0 | 5 000 000 | 9 | `correct-refusal` @ 2.75 |
| `USDC-SERVICE-COMPLETE` | 5 | 5 | 9 500 | 4 990 500 | 24 | `correct-refusal` @ 2.75 |
| `BASEQC-BUNDLED-EXEC` | 0 | 0 | 0 | 5 000 000 | 9 | `correct-refusal` @ 2.75 |
| `BASEQC-BUNDLED-COMPLETE` | 1 | 1 | 7 500 | 4 992 500 | 12 | `correct-refusal` @ 2.75 |
| `BASEQC-SERVICE-EXEC` | 0 | 0 | 0 | 5 000 000 | 9 | `correct-refusal` @ 2.75 |
| `BASEQC-SERVICE-COMPLETE` | 5 | 5 | 9 500 | 4 990 500 | 24 | `correct-refusal` @ 2.75 |

### `approved-execution` — 5 preparation events, 350 000 ms elapsed, verdict `executed-complete` (7/7 links)

| Cell | Obligations | Settled | Settled (minor units) | Budget remaining | Receipts | Standing |
|---|---|---|---|---|---|---|
| `USDC-BUNDLED-EXEC` | 1 | 1 | 9 000 | 4 991 000 | 12 | `constitutional-completeness` @ 2.25 |
| `USDC-BUNDLED-COMPLETE` | 1 | 1 | 9 000 | 4 991 000 | 12 | `constitutional-completeness` @ 2.25 |
| `USDC-SERVICE-EXEC` | 5 | 5 | 9 000 | 4 991 000 | 24 | `constitutional-completeness` @ 2.25 |
| `USDC-SERVICE-COMPLETE` | 5 | 5 | 9 000 | 4 991 000 | 24 | `constitutional-completeness` @ 2.25 |
| `BASEQC-BUNDLED-EXEC` | 1 | 1 | 9 000 | 4 991 000 | 12 | `constitutional-completeness` @ 2.25 |
| `BASEQC-BUNDLED-COMPLETE` | 1 | 1 | 9 000 | 4 991 000 | 12 | `constitutional-completeness` @ 2.25 |
| `BASEQC-SERVICE-EXEC` | 5 | 5 | 9 000 | 4 991 000 | 24 | `constitutional-completeness` @ 2.25 |
| `BASEQC-SERVICE-COMPLETE` | 5 | 5 | 9 000 | 4 991 000 | 24 | `constitutional-completeness` @ 2.25 |

Every one of the 16 reconciles with **zero violations**, generates hashed receipt artifacts,
reaches a Standing **admission** decision (never an accrual — that waits on Slice C), and replays
byte-identically on a second pass.

### The asymmetry, which is the result

**Obligations arise in 8 of 8 cells for the execution and 4 of 8 for the refusal**, and the four
are exactly `*-COMPLETE` — so the effect is the compensation regime, not the denomination and not
the pricing structure.

This is precisely why one opportunity was not enough. A refusal-only catalogue cannot distinguish
"the regime withholds compensation" from "the substrate never creates any" — under
execution-contingency both look like zero. An execution-only catalogue never exercises the
withholding at all. The pair is the minimum that can show either.

The execution half also exercises links the refusal cannot: obligations reach the `settled` state,
the funder's budget moves (`4 991 000` from `5 000 000`), and no terminal basis is
`correct-refusal`.

### Still Phase 1

Fixture mode is unchanged and enforced at runtime, not by convention. All 16 report
`generated: true, hashed: true, persisted: false, dvnAnchored: false, mode: 'fixture'`, and
`AC-22` additionally drives `assertVentureJournalCanLeaveMemory` over both scenarios × eight cells
and asserts **both** egress paths throw `VentureFixtureModeViolation`. **Nothing in the 16 replays
can reach `activity_receipts`.**

`MONEYPENNY_ADAPTER_VERSION` moved to `moneypenny-simulation/2` — a wider adapter is a new
version, not a silent change.

---

## RULING 5 — the named control mutation

### ███ NAMED CONTROL — "all weights ×10" — SURVIVES BY DESIGN. DO NOT "FIX" IT. ███

Multiply every value in `PERMITTED_STANDING_BASES` by ten and the whole suite stays green. That
survivor is intended:

> **The constitutional property is positive refusal weight versus zero incomplete-execution
> weight — not the provisional maximum value.**

A canary that *died* on this mutation would be pinning the magnitude. The magnitude is provisional
and experiment-scoped — VL-CT-001 exists partly to revise it, and `MAX_STANDING_SIGNAL_WEIGHT`
explicitly does not amend the canonical Standing formula. Pinning it would make every future
re-scaling a test edit, which is exactly how a provisional experimental constant becomes a
ratified platform one by accident.

What must **never** survive is an **inversion** — a rescaling that lets an incomplete execution
outrank a correct refusal. `M28` below confirms that dies.

### Where it is recorded, so a future reader cannot miss it

1. **`tests/venture-trading-substrate.test.ts`, `AC-17`** — a banner comment, then an
   **executable** control that applies the ×10 mutation itself, asserts the ordering survives, and
   restores the table in a `finally`. The survival is demonstrated, not claimed in prose.
2. **`services/venture/trading/standingAdmission.ts`**, immediately above
   `PERMITTED_STANDING_BASES` — "YOU ARE ABOUT TO EDIT THE NUMBERS BELOW. READ THIS FIRST." A
   canary (`the control is named at the constants themselves, where a "fixer" would land`) fails
   the build if that marker is removed, because the person re-scaling the weights is reading
   *that* file, not the test.

### One subtlety, recorded at the assertion

The control's "did the mutation actually apply" proof reads the **table**, not a derived weight.
`MAX_STANDING_SIGNAL_WEIGHT` (3) absorbs the rescale, so an admitted refusal reports the *same*
clamped number before and after. The magnitude is not observable through the ceiling — which is
itself the reason it is not the property being guarded.

---

## Mutation table — 28/28 as expected

Each mutation was applied to the working tree, the suite re-run, and the tree restored. The
harness **fails the mutation itself** if its find-string is absent or the edit is a no-op, so a
"survivor" cannot be a mutation that never applied. (Two false survivors have appeared on this
substrate before: an interface-only edit that was a no-op, and a module-collection throw that
emitted no per-test marker. The harness now records whether the failure produced per-test markers
or was collection-only.)

| # | Mutation | Result | Killed by |
|---|---|---|---|
| M1 | probe granted to `anon` | DIED | AC-20 grants execute to service_role and to NOTHING else |
| M2 | `REVOKE ... FROM PUBLIC` dropped | DIED | AC-20 REVOKES execute from PUBLIC, anon and authenticated |
| M3 | `search_path` unpinned | DIED | AC-20 pins search_path, and pins it WITHOUT public |
| M4 | `search_path` repinned to include `public` | DIED | AC-20 pins search_path, and pins it WITHOUT public |
| M5 | `REVOKE` moved above `CREATE` | DIED | AC-20 REVOKES after CREATE |
| M6 | probe returns the whole constraint definition again | DIED | AC-20 returns the MINIMUM compatibility result |
| M7 | dynamic SQL (`||`) in the probe body | DIED | AC-20 accepts NO argument and contains NO dynamic SQL |
| M8 | probe body hard-codes an action type | DIED | AC-20 does not restate the nine action types |
| M9 | a LATER migration re-grants the probe to `anon` | DIED | AC-20 no LATER migration re-grants the probe to anon or public |
| M10 | deployment check removed from the build spec | DIED | AC-21 the build spec RUNS the gate |
| M11 | deployment check moved after the build | DIED | AC-21 runs BEFORE the application is built and promoted |
| M12 | gate exits 0 on incompatibility | DIED | AC-21 EXITS NON-ZERO on incompatibility |
| M13 | gate gains a `SKIP_VENTURE_GATE` escape hatch | DIED | AC-21 has no escape hatch |
| M14 | gate reimplements the decision | DIED | AC-21 the gate script calls the shared check |
| M15 | emission backstop removed from `persistVentureReceipt` | DIED | AC-18 a LIVE emission is refused before the writer runs; AC-21 the emission backstop is still wired |
| M16 | backstop memo removed (probes every emission) | DIED | AC-18 probes ONCE per process |
| M17 | backstop caches a refusal | DIED | AC-18 does NOT cache a refusal |
| M18 | deployment check memoised | DIED | AC-18 the deployment check is NEVER memoised |
| M19 | probe invoked at module load | DIED | AC-18 nothing probes the database at module load |
| M20 | compatibility check becomes a substring test | DIED | AC-18 membership is EXACT |
| M21 | adapter catalogue widened to three | DIED | AC-22 is EXACTLY two |
| M22 | adapter catalogue reaches for `VENTURE_SCENARIOS` | DIED | AC-22 has no registration surface |
| M23 | unknown opportunity defaults instead of refusing | DIED | AC-22 REFUSES an opportunity not in the catalogue |
| M24 | a replay journal becomes live-mode | DIED | AC-22 no replay can reach activity_receipts; AC-15; AC-19 |
| M25 | execution obligations suppressed (asymmetry destroyed) | DIED | AC-22 the execution matrix matches; AC-22 THE ASYMMETRY; AC-4 |
| M26 | named-control marker removed from `standingAdmission.ts` | DIED | AC-17 the control is named at the constants themselves |
| **M27** | **CONTROL: all weights ×10** | **SURVIVED (expected)** | — by design; see RULING 5 |
| M28 | ordering inverted (refusal weight zeroed) | DIED | AC-3; AC-5; AC-19 |

---

## Verification

| Check | Result |
|---|---|
| Full unit suite | **181 files / 3 106 tests passed** (baseline 180 / 2 978; +36 from this work, +1 file / +92 tests from the concurrent QriptoCent settlement session) |
| `npx tsc --noEmit` | two pre-existing config errors only (`TS2688` implicit `iqube` type library, `TS5103` `--ignoreDeprecations`); **no new errors** |
| Mutation testing | 28/28 as expected, every mutation confirmed applied |
| Probe SQL | executed against PostgreSQL 16 in seven states; grants, `search_path`, `SECURITY DEFINER`, return type and every FAIL path confirmed |
| Deployment gate | executed against the live dev Supabase; reached the database and refused (migrations not yet applied) |
| Determinism | no `Date.now()`, no `Math.random()`; all 16 replays byte-identical on a second pass |
| T0/T2 | no raw UUID in any of the 16 outcomes or in any summary line |
| DVN pipeline | untouched — no change to payload shape, hashing, state machine or principal resolution |

---

## Flagged, not decided

1. **The next deploy will fail until the SQL above is run.** This is the ruling working as
   specified, not a defect — but it is a live consequence, and it is why this document leads with
   it. There is no bypass flag by design; the remedy is the SQL, not a config toggle.

2. **The gate needs `SUPABASE_SERVICE_ROLE_KEY` in every branch environment that builds.** The
   probe is service-role-only after RULING 2, so a branch environment without that variable now
   fails the build with a message naming the variable. If any Amplify branch (`staging`, a preview
   branch) builds without it, it needs the variable set — I could not enumerate the branch
   environments from inside the repo and have not guessed.

3. **`20260929000100` cannot be re-run after `20260929000200`.** The return type changes, and
   PostgreSQL refuses `CREATE OR REPLACE` across a return-type change. Applying the three in order
   from any prior state works (the lockdown `DROP`s first); re-running only the middle one against
   a locked-down database errors. Harmless, but worth knowing before someone re-pastes a fragment.

4. **`services/venture/standingForVenture.ts` and `services/standing/standingScore.ts` remain
   untouched.** The admission gate still sits *in front of* Standing; nothing accrues until Slice C
   defines the mapping. Unchanged by these rulings, restated so it is not assumed to have moved.

5. **Concurrent session.** The QriptoCent `CrossDenominationSettlement` work landed on this branch
   mid-session (`c3e3fc962`), adding `supabase/migrations/20260929000300_...`. That migration sorts
   after the lockdown and is covered by the anon-regrant canary; it does not re-grant the probe.
   During this session an `--amend` briefly absorbed that commit; it was restored intact from the
   reflog and re-verified (`git diff c3e3fc962` is empty against the restored commit) before this
   work was committed on top.

---

## Files

| File | Change |
|---|---|
| `supabase/migrations/20260929000200_venture_receipt_probe_lockdown.sql` | **new** — RULING 2 |
| `scripts/check-venture-receipt-constraint.ts` | **new** — RULING 1, the deploy gate |
| `amplify.yml` | gate step in the build phase |
| `services/venture/trading/receiptCompatibility.ts` | `text[]` probe contract, exact membership, memoised backstop |
| `services/venture/trading/receipts.ts` | `probeAcceptedActionTypes` (renamed from `loadConstraintDefinition`) |
| `services/venture/trading/moneyPennyAdapter.ts` | closed two-entry catalogue, `moneypenny-simulation/2` |
| `services/venture/trading/standingAdmission.ts` | named-control marker at the constants |
| `tests/venture-trading-substrate.test.ts` | AC-18 extended; AC-20, AC-21, AC-22 new; AC-17 control |
