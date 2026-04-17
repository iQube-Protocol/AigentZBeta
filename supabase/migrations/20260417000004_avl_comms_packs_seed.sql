-- ============================================================================
-- AVL Relationship Builder α — Comms Packs Seed
--
-- Seeds the initial partner outreach comms packs used by the Composer panel.
-- Packs are rendered server-side with simple {{variable}} substitution using
-- these template variables:
--   {{partner.name}}      — Organisation name
--   {{partner.contact}}   — Contact person name (or "Team" fallback)
--   {{partner.org}}       — Organisation name (alias)
--   {{assigned_agent}}    — Agent handle (e.g. marketa)
-- ============================================================================

INSERT INTO public.avl_comms_packs
  (slug, title, audience_type, comms_type, template_markdown, subject_lines, cta_options, send_rules, active)
VALUES

-- ── Wave 1 first contact ──────────────────────────────────────────────────────
(
  'partner-first-contact-w1',
  'Wave 1 Partner — First Contact',
  'partner',
  'first_contact',
  E'Hi {{partner.contact}},\n\nI''m reaching out from the KNYT team — we''re a Web3 creative franchise launching our Alpha phase and we''ve identified {{partner.name}} as a natural partner.\n\nKNYT is a transmedia IP universe built on iQube protocol rails. We''re opening a small cohort of strategic Wave 1 integrations for organisations whose audience overlaps with ours — collectors, creators, Web3 builders, and sovereignty-minded communities.\n\nWe think there''s a genuine fit between what {{partner.name}} is doing and where KNYT is going. Happy to share more detail — would a 20-minute intro call make sense?\n\nBest,\nMarketa\nFor the KNYT Team',
  '["Is there a KNYT × {{partner.name}} partnership here?", "Quick intro — KNYT Alpha Wave 1 partner cohort", "{{partner.name}} + KNYT — would love to connect"]',
  '[{"label": "Book a call", "url": "https://cal.com/knyt/intro"}, {"label": "Learn about KNYT", "url": "https://knyt.world"}]',
  '{"min_days_since_last_contact": null, "target_outreach_status": "uncontacted"}',
  true
),

-- ── Re-engagement / follow-up ────────────────────────────────────────────────
(
  'partner-reengagement',
  'Partner Re-engagement',
  'partner',
  'reengagement',
  E'Hi {{partner.contact}},\n\nFollowing up on my earlier note about a potential KNYT × {{partner.name}} partnership.\n\nWe''re now a few weeks into our Wave 1 activation and the signal from our first cohort of partner conversations has been strong. A few slots remain — wanted to check if this is worth a quick conversation on your end.\n\nNo commitment — just a 20-minute intro to see if there''s a fit worth exploring.\n\nBest,\nMarketa\nFor the KNYT Team',
  '["Following up — KNYT × {{partner.name}}", "Still interested? KNYT Wave 1 — a few spots left", "Quick follow-up on KNYT partnership"]',
  '[{"label": "Book a call", "url": "https://cal.com/knyt/intro"}]',
  '{"min_days_since_last_contact": 7, "target_outreach_status": "contacted"}',
  true
)

ON CONFLICT (slug) DO UPDATE SET
  title             = EXCLUDED.title,
  template_markdown = EXCLUDED.template_markdown,
  subject_lines     = EXCLUDED.subject_lines,
  cta_options       = EXCLUDED.cta_options,
  send_rules        = EXCLUDED.send_rules,
  active            = EXCLUDED.active;
