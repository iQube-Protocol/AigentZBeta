-- ============================================================================
-- AVL Comms Packs v3 — Calendly CTAs + correct KS URL
--
-- Updates all three packs:
--   - Closing paragraph updated with Calendly link in each
--   - KS URL corrected to production campaign URL
--   - cta_options updated with Calendly entry
-- ============================================================================

INSERT INTO public.avl_comms_packs
  (slug, title, audience_type, comms_type, template_markdown, subject_lines, cta_options, send_rules, active)
VALUES

-- ── First Contact ─────────────────────────────────────────────────────────────
(
  'partner-first-contact-w1',
  'Wave 1 Partner — First Contact',
  'partner',
  'first_contact',
  E'Hi {{partner.first_name}},\n\nI''m reaching out from metaProof.\n\nWe''re building a new class of media experiences powered by iQubes, our core technology. AgentiQ OS is our open-source sovereign agentic harness, and metaMe Runtime is our user-controlled consumer layer where participatory media experiences come to life.\n\nOur lead title, [metaKnyt: The Agentic Graphic Novel](https://www.kickstarter.com/projects/430245948/metaknyt-the-legend-of-kn0w1-and-the-21-sats), is the flagship showcase of that vision.\n\nWe''re currently inviting a small number of aligned organizations to join the KNYT campaign. This is more than a title promotion. It''s a chance to build a strategically aligned communications partnership that activates both of our audiences around the value of our relationship.\n\nThat can include shared storytelling, audience activation, and editorial collaboration through [The Qriptopian](https://qriptopia.com), our agentic magazine. It is also supported by Marketa, our relationship manager and marketing agent, who is designed to help automate and strengthen the partnership process.\n\nIf this feels relevant, I''d be glad to send a short overview and set up a call to show you how this could work and explore fit. Please use my Calendly [here](https://calendly.com/qripto/30min) to find a time that works for you.\n\nBest,\n\nDele Atanda | CEO | metaProof\ncc Aigent Marketa',
  '["A new kind of media partnership — metaKnyt", "Exploring a strategic partnership — {{partner.name}} × metaProof", "metaKnyt campaign — partnership opportunity"]',
  '[{"label": "Book a call", "url": "https://calendly.com/qripto/30min"}, {"label": "KS Campaign", "url": "https://www.kickstarter.com/projects/430245948/metaknyt-the-legend-of-kn0w1-and-the-21-sats"}, {"label": "The Qriptopian", "url": "https://qriptopia.com"}]',
  '{"min_days_since_last_contact": null, "target_outreach_status": "uncontacted"}',
  true
),

-- ── Partner Invite (warm / existing relationship) ─────────────────────────────
(
  'partner-invite-w1',
  'Wave 1 Partner — Invitation',
  'partner',
  'invitation',
  E'Hi {{partner.first_name}},\n\nI wanted to reach out with a direct invitation to join us in the KNYT campaign.\n\nAt metaProof, we''re building an ecosystem powered by iQubes, with AgentiQ OS as the open-source sovereign agentic harness and metaMe Runtime as the user-controlled consumer layer where participatory media experiences come to life. [metaKnyt: The Agentic Graphic Novel](https://www.kickstarter.com/projects/430245948/metaknyt-the-legend-of-kn0w1-and-the-21-sats) is our lead showcase of that vision.\n\nThat''s why this is more than a graphic novel campaign. It''s an opportunity to participate in a strategically aligned communications effort that can create value for both of our organizations through shared visibility, audience activation, and editorial collaboration.\n\nWe can support that through campaign packs, coordinated messaging, features through [The Qriptopian](https://qriptopia.com), our agentic magazine, and Marketa, our relationship manager and marketing agent, who is designed to help automate and strengthen the process.\n\nIf you''re open, I''d love to send over a short partner brief and set up a call to show you how this could work and discuss how your organization could participate. Please use my Calendly [here](https://calendly.com/qripto/30min) to find a time that works for you.\n\nBest,\n\nDele Atanda | CEO | metaProof\ncc Aigent Marketa',
  '["A direct invitation to join the KNYT campaign", "{{partner.name}} × metaProof — partner brief inside", "Your invitation to the KNYT campaign"]',
  '[{"label": "Book a call", "url": "https://calendly.com/qripto/30min"}, {"label": "KS Campaign", "url": "https://www.kickstarter.com/projects/430245948/metaknyt-the-legend-of-kn0w1-and-the-21-sats"}, {"label": "The Qriptopian", "url": "https://qriptopia.com"}]',
  '{"min_days_since_last_contact": null, "target_outreach_status": "uncontacted"}',
  true
),

-- ── Re-engagement ─────────────────────────────────────────────────────────────
(
  'partner-reengagement',
  'Partner Re-engagement',
  'partner',
  'reengagement',
  E'Hi {{partner.first_name}},\n\nI wanted to follow up on my earlier note in case the timing was off.\n\nWe''re still actively building the KNYT campaign, and I continue to think there could be a strong fit between our organizations.\n\nTo briefly restate the opportunity: [metaKnyt: The Agentic Graphic Novel](https://www.kickstarter.com/projects/430245948/metaknyt-the-legend-of-kn0w1-and-the-21-sats) is not just a title launch. It is a flagship showcase of how iQubes, AgentiQ OS, and metaMe Runtime can come together to create a more user-controlled, participatory media experience.\n\nThat gives us a strong basis for a more meaningful partnership than a simple promotional exchange — one built around aligned communications, audience activation, and shared editorial opportunities through [The Qriptopian](https://qriptopia.com), our agentic magazine, with relationship building supported by Marketa, our relationship manager and marketing agent.\n\nIf there''s interest, I''d be happy to send a short overview and set up a call to show you how this could work and suggest a simple starting point. Please use my Calendly [here](https://calendly.com/qripto/30min) to find a time that works for you.\n\nBest,\n\nDele Atanda | CEO | metaProof\ncc Aigent Marketa',
  '["Following up on the KNYT partnership", "Still open — KNYT campaign, {{partner.name}}", "Revisiting the KNYT partnership opportunity"]',
  '[{"label": "Book a call", "url": "https://calendly.com/qripto/30min"}, {"label": "KS Campaign", "url": "https://www.kickstarter.com/projects/430245948/metaknyt-the-legend-of-kn0w1-and-the-21-sats"}, {"label": "The Qriptopian", "url": "https://qriptopia.com"}]',
  '{"min_days_since_last_contact": 7, "target_outreach_status": "contacted"}',
  true
)

ON CONFLICT (slug) DO UPDATE SET
  title             = EXCLUDED.title,
  comms_type        = EXCLUDED.comms_type,
  template_markdown = EXCLUDED.template_markdown,
  subject_lines     = EXCLUDED.subject_lines,
  cta_options       = EXCLUDED.cta_options,
  send_rules        = EXCLUDED.send_rules,
  active            = EXCLUDED.active;
