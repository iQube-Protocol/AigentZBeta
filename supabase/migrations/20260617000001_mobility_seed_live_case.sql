-- HMS Seed: Live Repatriation Case — NJ → Dulwich, London
-- PSC-001 · Black Qube Classification
--
-- HOW TO RUN:
--   1. Find your persona_id:
--      SELECT id FROM personas WHERE auth_profile_id = (
--        SELECT id FROM auth.users WHERE email = 'dele@metame.com'
--      ) LIMIT 1;
--   2. Replace <<YOUR_PERSONA_ID>> below with that UUID.
--   3. Paste the full script into Supabase SQL editor and run.
--
-- This seeds the canonical live case for the PSC-001 programme.
-- All dates are relative to the session date of 2026-06-17.

DO $$
DECLARE
  v_persona_id  uuid := '<<YOUR_PERSONA_ID>>'::uuid;
  v_case_id     uuid := gen_random_uuid();
BEGIN

  -- ── Mobility Case ──────────────────────────────────────────────────────────
  INSERT INTO mobility_cases (
    id,
    owner_persona_id,
    case_type,
    case_status,
    priority_level,
    classification,
    household_profile,
    capability_profile,
    continuity_profile,
    housing_profile,
    education_profile,
    business_profile,
    financial_profile,
    mobility_profile,
    family_profile,
    confidentiality_profile,
    intake_sections_complete,
    capability_score,
    continuity_score,
    recovery_velocity_class,
    standing_risk_level,
    housing_risk_level,
    education_risk_level,
    business_continuity_risk
  ) VALUES (
    v_case_id,
    v_persona_id,
    'repatriation',
    'active',
    'critical',
    'black_cube',
    -- household_profile
    jsonb_build_object(
      'householdSize', 4,
      'adults', 2,
      'children', 2,
      'citizenships', 'UK (all family members)',
      'currentCountry', 'United States',
      'currentCity', 'Jersey City / Hudson County, NJ',
      'destinationCountry', 'United Kingdom',
      'destinationCity', 'Dulwich, London SE21/SE22',
      'specialConsiderations', 'UK citizen family returning home from extended US residency. No immigration intervention required.'
    ),
    -- capability_profile
    jsonb_build_object(
      'primaryOccupation', 'Founder / Entrepreneur',
      'immigrationStatus', 'O-1 Extraordinary Ability (US) — UK citizen, no UK visa required',
      'educationLevel', 'Post-graduate',
      'professionalCertifications', 'O-1 designation confirms extraordinary ability standing',
      'languageProficiency', 'Native English',
      'technicalSkills', 'Founder-level technology and product leadership',
      'isFounder', true,
      'isO1Holder', true,
      'extraordinaryAbilityDomain', 'Technology / AI / Protocol Infrastructure'
    ),
    -- continuity_profile
    jsonb_build_object(
      'hasPriorUKResidence', true,
      'priorUKCity', 'London',
      'ukBankingStatus', 'Prior UK banking history',
      'ukNationalInsuranceNumber', 'To be confirmed',
      'ukNHSRegistration', 'To be reactivated on return',
      'ukDriversLicense', 'To be reactivated',
      'continuityNotes', 'Family are returning UK citizens with prior UK life infrastructure. Reactivation pathway rather than new establishment.'
    ),
    -- housing_profile
    jsonb_build_object(
      'currentHousingStatus', 'Renting — Hudson County, NJ. Lease expiry creating hard departure deadline ~30 days.',
      'requiredDepartureDate', '2026-07-17',
      'housingBudget', '£3,500–£5,000/month',
      'preferredLocation', 'Dulwich (SE21/SE22) — school catchment priority',
      'acceptableLocations', 'Forest Hill, Sydenham, Herne Hill, Nunhead, Peckham Rye',
      'housingPriorities', 'School catchment (primary + secondary), min 4 bedrooms, garden preferred, parking useful',
      'guarantorsAvailable', 'Professional guarantor / company let options being explored',
      'temporaryHousingAvailable', 'Airbnb or serviced apartment for bridge period if needed'
    ),
    -- education_profile
    jsonb_build_object(
      'numberOfChildren', '2',
      'childrenAges', '13 (secondary), 5 (primary)',
      'currentSchoolSystem', 'US public school system — New Jersey',
      'targetSchoolType', 'UK state secondary + UK state primary preferred; independent as fallback',
      'preferredSchoolArea', 'Dulwich — SE21/SE22 catchment',
      'elder_currentYear', 'Grade 8 (US) → Year 9 UK equivalent',
      'elder_requirementsNotes', 'Age 13 — entering Year 9 in September 2026. In-year admissions process applies for state secondaries.',
      'younger_currentYear', 'Pre-K / Kindergarten (US) → Reception/Year 1 UK equivalent',
      'younger_requirementsNotes', 'Age 5 — September 2026 school start. Standard reception intake window.',
      'applicationDeadlineNotes', 'September 2026 intake is the hard target for both children. School applications require confirmed Dulwich address.'
    ),
    -- business_profile
    jsonb_build_object(
      'businessType', 'Technology / AI Protocol Startup',
      'businessStage', 'Active — iQube Protocol / AigentZ',
      'businessLocation', 'US-incorporated; UK operations to be established',
      'businessContinuityNotes', 'Remote-first business. UK entity formation required post-arrival for tax and operational efficiency. aigentMe confidentiality guardian role active.',
      'keyRisk', 'Investor/partner relationships require careful disclosure management during transition period'
    ),
    -- financial_profile
    jsonb_build_object(
      'currencyExposure', 'USD primary (US income), GBP destination',
      'forexStrategy', 'Staged GBP conversion to cover initial UK setup costs',
      'ukBankAccount', 'To be opened or reactivated on arrival',
      'financialNotes', 'Black Qube classification applies — financial specifics compartmentalized'
    ),
    -- mobility_profile
    jsonb_build_object(
      'departureCountry', 'United States',
      'destinationCountry', 'United Kingdom',
      'targetArrivalDate', '2026-07-20',
      'shippingApproach', 'Partial — ship core household, sell/donate remainder',
      'storageRequired', 'UK arrival storage may be needed for bridge period',
      'vehiclesIncluded', 'No (US vehicles not transferring)',
      'petsIncluded', 'TBC',
      'estimatedShippingVolume', '3–4 bedroom household partial',
      'specialItems', 'Electronics, documents, children''s belongings priority'
    ),
    -- family_profile
    jsonb_build_object(
      'familyUnit', 'Two adults, two children (ages 13 and 5)',
      'familyNationality', 'UK citizens (all members)',
      'elderChildNeeds', 'Secondary school transition support; social continuity',
      'youngerChildNeeds', 'Primary school start; settling support',
      'familyStabilizationNotes', 'Children''s wellbeing and school continuity are the family''s stated primary concern alongside housing security.',
      'supportNetwork', 'UK family and friends network available on arrival'
    ),
    -- confidentiality_profile
    jsonb_build_object(
      'classification', 'black_cube',
      'disclosureAuthority', 'aigentMe — family''s confidentiality guardian and disclosure broker',
      'compartmentalizationNotes', 'O-1 / extraordinary ability standing creates material risk from disclosure of relocation plans to US business contacts, investors, or media during transition window.',
      'protectedParties', 'Founder, spouse, children (ages 13 and 5)',
      'disclosureProtocol', 'No public disclosure of relocation. UK arrival to be treated as domestic until family is settled and business continuity is established.',
      'attestationRequired', true
    ),
    -- intake_sections_complete
    ARRAY[
      'household_profile', 'capability_profile', 'continuity_profile', 'housing_profile',
      'education_profile', 'business_profile', 'financial_profile', 'mobility_profile',
      'family_profile', 'confidentiality_profile'
    ],
    -- scores (computed from profile above)
    87,   -- capability_score: founder + O-1 + multi-skill
    72,   -- continuity_score: prior UK residence + banking history
    'RV-1',
    'medium',  -- standing_risk_level: transition period risk
    'high',    -- housing_risk_level: 30-day deadline
    'high',    -- education_risk_level: September hard deadline
    'medium'   -- business_continuity_risk: remote-first, manageable
  );

  -- ── Workstreams (seeded by the API on case creation, but explicit here for seed) ──
  INSERT INTO mobility_workstreams (case_id, workstream_key, label, priority, status, notes)
  VALUES
    (v_case_id, 'A', 'Strategic Repatriation Assessment', 'immediate', 'active',  'PSC-001 assessment complete. RV-1 classification. Black Qube. aigentMe is the confidentiality guardian.'),
    (v_case_id, 'B', 'Housing Acquisition',              'critical',  'active',  'Dulwich SE21/SE22 priority. ~30 day NJ departure deadline. School catchment is primary housing filter.'),
    (v_case_id, 'C', 'Educational Continuity',           'critical',  'pending', 'Age 13 (Year 9 secondary) and age 5 (Reception/Year 1 primary). September 2026 intake window.'),
    (v_case_id, 'D', 'Physical Relocation',              'critical',  'pending', 'Partial household ship NJ→UK. Target arrival ~20 July 2026.'),
    (v_case_id, 'E', 'Business Continuity',              'high',      'pending', 'UK entity formation. Investor relationship management under Black Qube protocol.'),
    (v_case_id, 'F', 'Economic Reactivation',            'high',      'pending', 'GBP banking, NI reactivation, UK tax residency.'),
    (v_case_id, 'G', 'Family Stabilization',             'medium',    'pending', 'Children settling plan. UK support network activation.')
  ON CONFLICT (case_id, workstream_key) DO NOTHING;

  -- ── Critical Dates ──────────────────────────────────────────────────────────
  INSERT INTO mobility_critical_dates (case_id, label, date_category, due_date, is_hard_deadline, status, workstream_key)
  VALUES
    (v_case_id, 'NJ Housing — Required Departure',               'housing',    '2026-07-17', true,  'pending', 'B'),
    (v_case_id, 'Target UK Arrival — London',                    'travel',     '2026-07-20', false, 'pending', 'D'),
    (v_case_id, 'September School Intake — Both Children',       'school',     '2026-09-01', true,  'pending', 'C'),
    (v_case_id, 'Secondary School Application Deadline (Age 13)','school',     '2026-07-15', true,  'pending', 'C'),
    (v_case_id, 'Primary School Application (Age 5)',            'school',     '2026-07-15', true,  'pending', 'C'),
    (v_case_id, 'Shipping Collection — NJ Apartment',            'travel',     '2026-07-12', false, 'pending', 'D'),
    (v_case_id, 'UK Bank Account Open / Reactivate',             'compliance', '2026-07-25', false, 'pending', 'F'),
    (v_case_id, 'UK Entity Formation — Companies House',         'business',   '2026-08-15', false, 'pending', 'E');

  RAISE NOTICE 'HMS live case seeded: %', v_case_id;

END $$;
