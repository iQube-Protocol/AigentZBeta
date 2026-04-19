-- Launch Ops: Canonical seed for metaKnyt Launch Reset program
-- Idempotent — safe to re-run; skips on conflict.

do $$
declare
  v_program_id   uuid;
  v_w1_id        uuid;
  v_w2_id        uuid;
  v_w3_id        uuid;
  v_w4_id        uuid;
  v_seg_top_id   uuid;
  v_seg_warm_id  uuid;
  v_seg_dorm_id  uuid;
  v_seg_comm_id  uuid;
  v_offer_e_id   uuid;
  v_offer_p_id   uuid;
  v_offer_f_id   uuid;
begin

-- ── Program ────────────────────────────────────────────────────────────────────
insert into launch_programs (
  id, slug, name, status, status_color, priority, owner, decision_rule, metadata
) values (
  gen_random_uuid(),
  'metaknyt-launch-reset',
  'metaKnyt Launch Reset',
  'active',
  'blue',
  'critical',
  'Marketa',
  'relaunch_on_evidence',
  '{
    "phase": "investor_first",
    "campaign_goal": "Validate product-market fit with top 50 investors before Kickstarter relaunch",
    "kickstarter_target": 5000,
    "currency": "GBP",
    "sprint_duration_days": 30,
    "launch_rule": "mostly_green_no_critical_reds"
  }'::jsonb
)
on conflict (slug) do nothing
returning id into v_program_id;

-- If already exists, fetch the id
if v_program_id is null then
  select id into v_program_id from launch_programs where slug = 'metaknyt-launch-reset';
end if;

-- ── Objectives ─────────────────────────────────────────────────────────────────
insert into launch_objectives (program_id, code, objective_type, metric_type, target_type, sort_order, metadata)
values
  (v_program_id, 'OBJ-01', 'direct_sales',      'orders',              'reach_threshold', 1,
   '{"label":"Generate 10+ direct pre-orders from top-50 investors","target_value":10}'::jsonb),
  (v_program_id, 'OBJ-02', 'message_fit',        'conversion_rate',     'optimize',        2,
   '{"label":"Identify best-performing message frame (target 40%+ open rate)","target_value":0.40}'::jsonb),
  (v_program_id, 'OBJ-03', 'proof_build',        'proof_assets',        'reach_threshold', 3,
   '{"label":"Capture 5+ usable testimonials / buyer reactions","target_value":5}'::jsonb),
  (v_program_id, 'OBJ-04', 'halo_growth',        'engaged_followers',   'increase',        4,
   '{"label":"Grow engaged social followers by 200+ during sprint","target_value":200}'::jsonb),
  (v_program_id, 'OBJ-05', 'launch_readiness',   'kickstarter_follows', 'reach_threshold', 5,
   '{"label":"Reach 200+ Kickstarter pre-launch follows","target_value":200}'::jsonb)
on conflict (program_id, code) do nothing;

-- ── Audience Segments ──────────────────────────────────────────────────────────
insert into launch_audience_segments (id, program_id, code, audience_type, name, size_estimate, metadata)
values
  (gen_random_uuid(), v_program_id, 'SEG-TOP-50',   'investor_top',     'Top 50 Investors',        50,
   '{"description":"Highest-conviction investors; direct email + personal DM","channel_priority":["email","sms"]}'::jsonb),
  (gen_random_uuid(), v_program_id, 'SEG-WARM-200', 'investor_warm',    'Warm Investor Pool',     200,
   '{"description":"Previously engaged; responded or clicked in last 90 days","channel_priority":["email"]}'::jsonb),
  (gen_random_uuid(), v_program_id, 'SEG-DORM',     'investor_dormant', 'Dormant Investors',      400,
   '{"description":"On list but no engagement in 90+ days; reactivation sequence","channel_priority":["email"]}'::jsonb),
  (gen_random_uuid(), v_program_id, 'SEG-COMM',     'community_warm',   'Warm Community',        1200,
   '{"description":"Social followers + newsletter subscribers; halo content","channel_priority":["instagram","x","email"]}'::jsonb)
on conflict (program_id, code) do nothing;

select id into v_seg_top_id  from launch_audience_segments where program_id = v_program_id and code = 'SEG-TOP-50';
select id into v_seg_warm_id from launch_audience_segments where program_id = v_program_id and code = 'SEG-WARM-200';
select id into v_seg_dorm_id from launch_audience_segments where program_id = v_program_id and code = 'SEG-DORM';
select id into v_seg_comm_id from launch_audience_segments where program_id = v_program_id and code = 'SEG-COMM';

-- ── Offers ─────────────────────────────────────────────────────────────────────
insert into launch_offers (id, program_id, code, name, offer_type, tier, goal, price_cents, is_active, metadata)
values
  (gen_random_uuid(), v_program_id, 'OFFER-DIGITAL-29',   'KNYT Digital Access',       'digital',  'entry',    'fast_conversion',        2900,  true,
   '{"description":"Instant digital access to the full KNYT experience","deliverable":"digital_download"}'::jsonb),
  (gen_random_uuid(), v_program_id, 'OFFER-BUNDLE-97',    'KNYT Collector Bundle',     'bundle',   'premium',  'high_value_conversion',  9700,  true,
   '{"description":"Physical + digital bundle with collector card set","deliverable":"physical_plus_digital"}'::jsonb),
  (gen_random_uuid(), v_program_id, 'OFFER-FOUNDING-197', 'KNYT Founding Supporter',   'exclusive','founding', 'investor_activation',    19700, true,
   '{"description":"Limited edition Founding Supporter pack with signed artefact","deliverable":"exclusive_physical"}'::jsonb)
on conflict (program_id, code) do nothing;

select id into v_offer_e_id from launch_offers where program_id = v_program_id and code = 'OFFER-DIGITAL-29';
select id into v_offer_p_id from launch_offers where program_id = v_program_id and code = 'OFFER-BUNDLE-97';
select id into v_offer_f_id from launch_offers where program_id = v_program_id and code = 'OFFER-FOUNDING-197';

-- ── Channels ───────────────────────────────────────────────────────────────────
insert into launch_channels (program_id, channel_name, channel_role, is_active, metadata)
values
  (v_program_id, 'email',                'convert',        true, '{"note":"Primary conversion engine; all cohorts"}'::jsonb),
  (v_program_id, 'sms',                 'nudge',          true, '{"note":"Top-50 only; purchase nudge 72h before close"}'::jsonb),
  (v_program_id, 'x',                   'signal',         true, '{"note":"Organic signal; product conviction + KNYT lore"}'::jsonb),
  (v_program_id, 'instagram',           'visual_halo',    true, '{"note":"Visual halo; buyer reactions + proof posts"}'::jsonb),
  (v_program_id, 'linkedin',            'legitimacy',     true, '{"note":"Investor credibility; traction signals"}'::jsonb),
  (v_program_id, 'kickstarter_prelaunch','follow_capture',true, '{"note":"KS pre-launch page; follow count KPI"}'::jsonb)
on conflict (program_id, channel_name) do nothing;

-- ── Sprint Weeks ───────────────────────────────────────────────────────────────
insert into launch_sprint_weeks (id, program_id, week_number, label, status, status_color, goal)
values
  (gen_random_uuid(), v_program_id, 1, 'Reset & Package', 'doing', 'blue',
   'Lock offer stack, segment list, and reset messaging. Land 3+ proof assets from existing buyers.'),
  (gen_random_uuid(), v_program_id, 2, 'Activate Investors Wave 1', 'todo', 'yellow',
   'Deploy personal outreach to top-50. Target 8+ replies, 3+ purchases, 1+ testimonial.'),
  (gen_random_uuid(), v_program_id, 3, 'Optimise & Expand Halo', 'todo', 'yellow',
   'Refine best-performing message frame. Expand to warm pool + community halo. 100+ KS follows.'),
  (gen_random_uuid(), v_program_id, 4, 'Concentrate & Score', 'todo', 'yellow',
   'Final push on highest-signal prospects. Score all 5 readiness buckets. Make relaunch call.')
on conflict (program_id, week_number) do nothing;

select id into v_w1_id from launch_sprint_weeks where program_id = v_program_id and week_number = 1;
select id into v_w2_id from launch_sprint_weeks where program_id = v_program_id and week_number = 2;
select id into v_w3_id from launch_sprint_weeks where program_id = v_program_id and week_number = 3;
select id into v_w4_id from launch_sprint_weeks where program_id = v_program_id and week_number = 4;

-- ── Sprint Tasks — Week 1: Reset & Package ─────────────────────────────────────
insert into launch_sprint_tasks (program_id, week_id, code, title, task_type, owner, priority, status, status_color, sort_order, metadata)
values
  (v_program_id, v_w1_id, 'T-W1-01', 'Audit top-50 investor list — verify emails, tag by tier',
   'research',         'Marketa',  'critical', 'doing', 'blue', 1,
   '{"context":"Foundation task — all outreach depends on a clean list"}'::jsonb),

  (v_program_id, v_w1_id, 'T-W1-02', 'Write 3 subject-line variants for investor reset email',
   'copy',             'Marketa',  'critical', 'todo',  'yellow', 2,
   '{"variants":["curiosity","proof","founder_note"]}'::jsonb),

  (v_program_id, v_w1_id, 'T-W1-03', 'Write body copy for investor reset email (personal tone)',
   'copy',             'Marketa',  'critical', 'todo',  'yellow', 3,
   '{"format":"personal_letter","cta":"pre-order link or reply"}'::jsonb),

  (v_program_id, v_w1_id, 'T-W1-04', 'Lock offer stack — confirm 3 tiers and prices',
   'decision',         'Founder',  'critical', 'todo',  'yellow', 4,
   '{"offers":["OFFER-DIGITAL-29","OFFER-BUNDLE-97","OFFER-FOUNDING-197"]}'::jsonb),

  (v_program_id, v_w1_id, 'T-W1-05', 'Reach out to 5 existing buyers for testimonials',
   'direct_outreach',  'Founder',  'high',     'todo',  'yellow', 5,
   '{"target_count":5,"channel":"personal_email_or_dm"}'::jsonb),

  (v_program_id, v_w1_id, 'T-W1-06', 'Create Kickstarter pre-launch page draft',
   'ops_copy',         'Ops',      'high',     'todo',  'yellow', 6,
   '{"deliverable":"ks_prelaunch_page_draft"}'::jsonb),

  (v_program_id, v_w1_id, 'T-W1-07', 'Set up email sequence in Mailjet — test send',
   'ops_copy',         'Ops',      'high',     'todo',  'yellow', 7,
   '{"platform":"mailjet","sequence_type":"investor_reset"}'::jsonb),

  (v_program_id, v_w1_id, 'T-W1-08', 'Write Week 1 report + score all 5 readiness buckets',
   'memo',             'Marketa',  'medium',   'todo',  'yellow', 8,
   '{"due":"end_of_week_1"}'::jsonb)

on conflict (program_id, code) do nothing;

-- ── Sprint Tasks — Week 2: Activate Investors Wave 1 ──────────────────────────
insert into launch_sprint_tasks (program_id, week_id, code, title, task_type, owner, priority, status, status_color, sort_order, metadata)
values
  (v_program_id, v_w2_id, 'T-W2-01', 'Send investor reset email to top-50 (Wave 1)',
   'email',            'Marketa',  'critical', 'todo',  'yellow', 1,
   '{"segment":"SEG-TOP-50","sequence_step":1}'::jsonb),

  (v_program_id, v_w2_id, 'T-W2-02', 'Personal DMs to top-10 investors (LinkedIn + email)',
   'direct_outreach',  'Founder',  'critical', 'todo',  'yellow', 2,
   '{"target_count":10,"tone":"founder_to_founder"}'::jsonb),

  (v_program_id, v_w2_id, 'T-W2-03', 'Send follow-up 1 to non-openers (48h after Wave 1)',
   'email',            'Marketa',  'high',     'todo',  'yellow', 3,
   '{"segment":"SEG-TOP-50","sequence_step":2,"trigger":"non_opener_48h"}'::jsonb),

  (v_program_id, v_w2_id, 'T-W2-04', 'Capture and tag all replies — update CRM signals',
   'crm',              'Marketa',  'high',     'todo',  'yellow', 4,
   '{"crm_fields":["reply_tone","objections","intent"]}'::jsonb),

  (v_program_id, v_w2_id, 'T-W2-05', 'Post 3× proof / conviction content on X + LinkedIn',
   'social',           'Marketa',  'medium',   'todo',  'yellow', 5,
   '{"platforms":["x","linkedin"],"content_type":"proof_signal"}'::jsonb),

  (v_program_id, v_w2_id, 'T-W2-06', 'Send SMS nudge to top-50 openers who did not purchase',
   'sms',              'Marketa',  'high',     'todo',  'yellow', 6,
   '{"segment":"SEG-TOP-50","trigger":"opened_no_purchase","channel":"sms"}'::jsonb),

  (v_program_id, v_w2_id, 'T-W2-07', 'Collect 2+ more testimonials from Wave 1 buyers',
   'proof_build',      'Founder',  'high',     'todo',  'yellow', 7,
   '{"target_count":2}'::jsonb),

  (v_program_id, v_w2_id, 'T-W2-08', 'Write Week 2 report + update readiness scores',
   'memo',             'Marketa',  'medium',   'todo',  'yellow', 8,
   '{"due":"end_of_week_2"}'::jsonb)

on conflict (program_id, code) do nothing;

-- ── Sprint Tasks — Week 3: Optimise & Expand Halo ─────────────────────────────
insert into launch_sprint_tasks (program_id, week_id, code, title, task_type, owner, priority, status, status_color, sort_order, metadata)
values
  (v_program_id, v_w3_id, 'T-W3-01', 'Send best-performing subject to warm investor pool (Wave 2)',
   'email',            'Marketa',  'critical', 'todo',  'yellow', 1,
   '{"segment":"SEG-WARM-200","message_variant":"best_from_w2"}'::jsonb),

  (v_program_id, v_w3_id, 'T-W3-02', 'Launch reactivation sequence for dormant investors',
   'email',            'Marketa',  'high',     'todo',  'yellow', 2,
   '{"segment":"SEG-DORM","sequence_type":"reactivation_3_step"}'::jsonb),

  (v_program_id, v_w3_id, 'T-W3-03', 'Post 5× halo content (buyer reactions, proof, KNYT lore)',
   'content_ops',      'Design',   'medium',   'todo',  'yellow', 3,
   '{"platforms":["instagram","x"],"content_mix":["buyer_reaction","proof","lore"]}'::jsonb),

  (v_program_id, v_w3_id, 'T-W3-04', 'Drive 100+ KS pre-launch follows via email CTA + socials',
   'growth',           'Marketa',  'high',     'todo',  'yellow', 4,
   '{"target_follows":100,"channels":["email","x","instagram"]}'::jsonb),

  (v_program_id, v_w3_id, 'T-W3-05', 'Partner wave: brief AVL partners, send activation pack',
   'community',        'Marketa',  'medium',   'todo',  'yellow', 5,
   '{"partner_count_target":3,"pack":"avl_wave_1_activation"}'::jsonb),

  (v_program_id, v_w3_id, 'T-W3-06', 'Update FAQ doc based on top investor objections',
   'faq',              'Founder',  'medium',   'todo',  'yellow', 6,
   '{"source":"crm_reply_tags","output":"faq_v2"}'::jsonb),

  (v_program_id, v_w3_id, 'T-W3-07', 'Write Week 3 report + update readiness scores',
   'memo',             'Marketa',  'medium',   'todo',  'yellow', 7,
   '{"due":"end_of_week_3"}'::jsonb)

on conflict (program_id, code) do nothing;

-- ── Sprint Tasks — Week 4: Concentrate & Score ────────────────────────────────
insert into launch_sprint_tasks (program_id, week_id, code, title, task_type, owner, priority, status, status_color, sort_order, metadata)
values
  (v_program_id, v_w4_id, 'T-W4-01', 'Final push email to all non-buyers (top-50 + warm pool)',
   'email',            'Marketa',  'critical', 'todo',  'yellow', 1,
   '{"subject_angle":"last_chance_founding","cta":"pre-order"}'::jsonb),

  (v_program_id, v_w4_id, 'T-W4-02', 'Personal final call to every opener who did not purchase',
   'direct_outreach',  'Founder',  'critical', 'todo',  'yellow', 2,
   '{"channel":"personal_email","tone":"direct_close"}'::jsonb),

  (v_program_id, v_w4_id, 'T-W4-03', 'Score all 5 readiness buckets (offer, audience, proof, ops, story)',
   'analytics',        'Marketa',  'critical', 'todo',  'yellow', 3,
   '{"buckets":["offer","audience","proof","ops","story"],"decision_rule":"mostly_green_no_critical_reds"}'::jsonb),

  (v_program_id, v_w4_id, 'T-W4-04', 'Make relaunch go/no-go decision + write decision memo',
   'decision',         'Founder',  'critical', 'todo',  'yellow', 4,
   '{"options":["proceed_to_ks_relaunch","extend_validation","pivot"]}'::jsonb),

  (v_program_id, v_w4_id, 'T-W4-05', 'Collect final testimonials — aim for 8+ total across sprint',
   'proof_build',      'Founder',  'high',     'todo',  'yellow', 5,
   '{"sprint_target":8}'::jsonb),

  (v_program_id, v_w4_id, 'T-W4-06', 'Write final sprint report with recommendation',
   'memo',             'Marketa',  'high',     'todo',  'yellow', 6,
   '{"recommendation_options":["continue_validation","move_to_prelaunch_concentration","prepare_relaunch"]}'::jsonb)

on conflict (program_id, code) do nothing;

end $$;
