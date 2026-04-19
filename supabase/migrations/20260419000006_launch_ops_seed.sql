-- Launch Ops: Canonical seed for metaKnyt Launch Reset program
-- Idempotent — pure SQL, no PL/pgSQL variables (Supabase editor compatible)

insert into launch_programs (slug, name, status, status_color, priority, owner, decision_rule, metadata)
values (
  'metaknyt-launch-reset', 'metaKnyt Launch Reset',
  'active', 'blue', 'critical', 'Marketa', 'relaunch_on_evidence',
  '{"phase":"investor_first","kickstarter_target":5000,"currency":"GBP","sprint_duration_days":30}'::jsonb
)
on conflict (slug) do nothing;

insert into launch_objectives (program_id, code, objective_type, metric_type, target_type, sort_order, metadata)
select p.id, v.code, v.otype::lo_objective_type, v.mtype::lo_metric_type, v.ttype::lo_target_type, v.sord, v.meta::jsonb
from launch_programs p
cross join (values
  ('OBJ-01','direct_sales',    'orders',             'reach_threshold',1,'{"label":"Generate 10+ direct pre-orders from top-50 investors","target_value":10}'),
  ('OBJ-02','message_fit',     'conversion_rate',    'optimize',       2,'{"label":"Identify best-performing message frame","target_value":0.40}'),
  ('OBJ-03','proof_build',     'proof_assets',       'reach_threshold',3,'{"label":"Capture 5+ usable testimonials / buyer reactions","target_value":5}'),
  ('OBJ-04','halo_growth',     'engaged_followers',  'increase',       4,'{"label":"Grow engaged social followers by 200+ during sprint","target_value":200}'),
  ('OBJ-05','launch_readiness','kickstarter_follows','reach_threshold',5,'{"label":"Reach 200+ Kickstarter pre-launch follows","target_value":200}')
) as v(code, otype, mtype, ttype, sord, meta)
where p.slug = 'metaknyt-launch-reset'
on conflict (program_id, code) do nothing;

insert into launch_audience_segments (program_id, code, audience_type, name, size_estimate)
select p.id, v.code, v.atype::lo_audience_type, v.name, v.sz
from launch_programs p
cross join (values
  ('SEG-TOP-50',  'investor_top',    'Top 50 Investors',   50),
  ('SEG-WARM-200','investor_warm',   'Warm Investor Pool', 200),
  ('SEG-DORM',    'investor_dormant','Dormant Investors',  400),
  ('SEG-COMM',    'community_warm',  'Warm Community',     1200)
) as v(code, atype, name, sz)
where p.slug = 'metaknyt-launch-reset'
on conflict (program_id, code) do nothing;

insert into launch_offers (program_id, code, name, offer_type, tier, goal, price_cents, is_active)
select p.id, v.code, v.name, v.otype::lo_offer_type, v.tier::lo_offer_tier, v.goal::lo_offer_goal, v.price, true
from launch_programs p
cross join (values
  ('OFFER-DIGITAL-29',  'KNYT Digital Access',    'digital', 'entry',   'fast_conversion',       2900),
  ('OFFER-BUNDLE-97',   'KNYT Collector Bundle',  'bundle',  'premium', 'high_value_conversion', 9700),
  ('OFFER-FOUNDING-197','KNYT Founding Supporter','exclusive','founding','investor_activation',   19700)
) as v(code, name, otype, tier, goal, price)
where p.slug = 'metaknyt-launch-reset'
on conflict (program_id, code) do nothing;

insert into launch_channels (program_id, channel_name, channel_role, is_active)
select p.id, v.ch::lo_channel_name, v.role::lo_channel_role, true
from launch_programs p
cross join (values
  ('email',               'convert'),
  ('sms',                 'nudge'),
  ('x',                   'signal'),
  ('instagram',           'visual_halo'),
  ('linkedin',            'legitimacy'),
  ('kickstarter_prelaunch','follow_capture')
) as v(ch, role)
where p.slug = 'metaknyt-launch-reset'
on conflict (program_id, channel_name) do nothing;

insert into launch_sprint_weeks (program_id, week_number, label, status, status_color, goal)
select p.id, v.wn, v.label, v.st::lo_task_status, v.sc::lo_status_color, v.goal
from launch_programs p
cross join (values
  (1,'Reset & Package',          'doing','blue',  'Lock offer stack, segment list, and reset messaging. Land 3+ proof assets from existing buyers.'),
  (2,'Activate Investors Wave 1','todo', 'yellow','Deploy personal outreach to top-50. Target 8+ replies, 3+ purchases, 1+ testimonial.'),
  (3,'Optimise & Expand Halo',   'todo', 'yellow','Refine best-performing message frame. Expand to warm pool + community halo. 100+ KS follows.'),
  (4,'Concentrate & Score',      'todo', 'yellow','Final push on highest-signal prospects. Score all 5 readiness buckets. Make relaunch call.')
) as v(wn, label, st, sc, goal)
where p.slug = 'metaknyt-launch-reset'
on conflict (program_id, week_number) do nothing;

-- Week 1
insert into launch_sprint_tasks (program_id, week_id, code, title, task_type, owner, priority, status, status_color, sort_order)
select p.id, w.id, v.code, v.title, v.tt::lo_task_type, v.own::lo_owner_role, v.pri::lo_priority, v.st::lo_task_status, v.sc::lo_status_color, v.sord
from launch_programs p
join launch_sprint_weeks w on w.program_id = p.id and w.week_number = 1
cross join (values
  ('T-W1-01','Audit top-50 investor list - verify emails, tag by tier', 'research',       'Marketa','critical','doing', 'blue',  1),
  ('T-W1-02','Write 3 subject-line variants for investor reset email',   'copy',           'Marketa','critical','todo',  'yellow',2),
  ('T-W1-03','Write body copy for investor reset email (personal tone)', 'copy',           'Marketa','critical','todo',  'yellow',3),
  ('T-W1-04','Lock offer stack - confirm 3 tiers and prices',           'decision',       'Founder','critical','todo',  'yellow',4),
  ('T-W1-05','Reach out to 5 existing buyers for testimonials',         'direct_outreach','Founder','high',    'todo',  'yellow',5),
  ('T-W1-06','Create Kickstarter pre-launch page draft',                'ops_copy',       'Ops',    'high',    'todo',  'yellow',6),
  ('T-W1-07','Set up email sequence in Mailjet - test send',            'ops_copy',       'Ops',    'high',    'todo',  'yellow',7),
  ('T-W1-08','Write Week 1 report + score all 5 readiness buckets',     'memo',           'Marketa','medium',  'todo',  'yellow',8)
) as v(code, title, tt, own, pri, st, sc, sord)
where p.slug = 'metaknyt-launch-reset'
on conflict (program_id, code) do nothing;

-- Week 2
insert into launch_sprint_tasks (program_id, week_id, code, title, task_type, owner, priority, status, status_color, sort_order)
select p.id, w.id, v.code, v.title, v.tt::lo_task_type, v.own::lo_owner_role, v.pri::lo_priority, v.st::lo_task_status, v.sc::lo_status_color, v.sord
from launch_programs p
join launch_sprint_weeks w on w.program_id = p.id and w.week_number = 2
cross join (values
  ('T-W2-01','Send investor reset email to top-50 (Wave 1)',          'email',          'Marketa','critical','todo','yellow',1),
  ('T-W2-02','Personal DMs to top-10 investors (LinkedIn + email)',    'direct_outreach','Founder','critical','todo','yellow',2),
  ('T-W2-03','Send follow-up 1 to non-openers (48h after Wave 1)',     'email',          'Marketa','high',    'todo','yellow',3),
  ('T-W2-04','Capture and tag all replies - update CRM signals',       'crm',            'Marketa','high',    'todo','yellow',4),
  ('T-W2-05','Post 3x proof / conviction content on X + LinkedIn',     'social',         'Marketa','medium',  'todo','yellow',5),
  ('T-W2-06','Send SMS nudge to top-50 openers who did not purchase',  'sms',            'Marketa','high',    'todo','yellow',6),
  ('T-W2-07','Collect 2+ more testimonials from Wave 1 buyers',        'proof_build',    'Founder','high',    'todo','yellow',7),
  ('T-W2-08','Write Week 2 report + update readiness scores',          'memo',           'Marketa','medium',  'todo','yellow',8)
) as v(code, title, tt, own, pri, st, sc, sord)
where p.slug = 'metaknyt-launch-reset'
on conflict (program_id, code) do nothing;

-- Week 3
insert into launch_sprint_tasks (program_id, week_id, code, title, task_type, owner, priority, status, status_color, sort_order)
select p.id, w.id, v.code, v.title, v.tt::lo_task_type, v.own::lo_owner_role, v.pri::lo_priority, v.st::lo_task_status, v.sc::lo_status_color, v.sord
from launch_programs p
join launch_sprint_weeks w on w.program_id = p.id and w.week_number = 3
cross join (values
  ('T-W3-01','Send best-performing subject to warm investor pool (Wave 2)','email',      'Marketa','critical','todo','yellow',1),
  ('T-W3-02','Launch reactivation sequence for dormant investors',         'email',      'Marketa','high',    'todo','yellow',2),
  ('T-W3-03','Post 5x halo content (buyer reactions, proof, KNYT lore)',   'content_ops','Design', 'medium',  'todo','yellow',3),
  ('T-W3-04','Drive 100+ KS pre-launch follows via email CTA + socials',   'growth',     'Marketa','high',    'todo','yellow',4),
  ('T-W3-05','Partner wave: brief AVL partners, send activation pack',     'community',  'Marketa','medium',  'todo','yellow',5),
  ('T-W3-06','Update FAQ doc based on top investor objections',            'faq',        'Founder','medium',  'todo','yellow',6),
  ('T-W3-07','Write Week 3 report + update readiness scores',              'memo',       'Marketa','medium',  'todo','yellow',7)
) as v(code, title, tt, own, pri, st, sc, sord)
where p.slug = 'metaknyt-launch-reset'
on conflict (program_id, code) do nothing;

-- Week 4
insert into launch_sprint_tasks (program_id, week_id, code, title, task_type, owner, priority, status, status_color, sort_order)
select p.id, w.id, v.code, v.title, v.tt::lo_task_type, v.own::lo_owner_role, v.pri::lo_priority, v.st::lo_task_status, v.sc::lo_status_color, v.sord
from launch_programs p
join launch_sprint_weeks w on w.program_id = p.id and w.week_number = 4
cross join (values
  ('T-W4-01','Final push email to all non-buyers (top-50 + warm pool)',            'email',          'Marketa','critical','todo','yellow',1),
  ('T-W4-02','Personal final call to every opener who did not purchase',           'direct_outreach','Founder','critical','todo','yellow',2),
  ('T-W4-03','Score all 5 readiness buckets (offer, audience, proof, ops, story)', 'analytics',      'Marketa','critical','todo','yellow',3),
  ('T-W4-04','Make relaunch go/no-go decision + write decision memo',              'decision',       'Founder','critical','todo','yellow',4),
  ('T-W4-05','Collect final testimonials - aim for 8+ total across sprint',        'proof_build',    'Founder','high',    'todo','yellow',5),
  ('T-W4-06','Write final sprint report with recommendation',                      'memo',           'Marketa','high',    'todo','yellow',6)
) as v(code, title, tt, own, pri, st, sc, sord)
where p.slug = 'metaknyt-launch-reset'
on conflict (program_id, code) do nothing;
