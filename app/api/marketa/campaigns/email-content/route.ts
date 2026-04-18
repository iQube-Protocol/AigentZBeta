/**
 * GET /api/marketa/campaigns/email-content
 *
 * Returns structured campaign content for the Marketa Campaign Ops panel:
 *  - KS Prospects: 8-email sequence metadata with live engagement stats
 *  - KNYT Investors: 4 sub-cohort sequences
 *  - Social posts: all comms packs with comms_type='social'
 *
 * Email copy sourced from KNYT_CAMPAIGN_COPY_PACK.md (canonical op doc).
 * Combined with live engagement stats from Supabase.
 */

import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

// ── Static campaign copy (from KNYT_CAMPAIGN_COPY_PACK.md) ─────────────────

const KS_EMAIL_SEQUENCE = [
  {
    n: 1,
    subject: "It's live now — your investor access starts here",
    preview: "The KNYT Kickstarter just cleared. You're in the first wave of people who can see it.",
    target_filter: 'All active contacts — initial send',
    status_slug: 'email_1_sent',
    cta: 'Back KNYT on Kickstarter',
  },
  {
    n: 2,
    subject: 'Choose your investor tier before momentum begins',
    preview: 'Two investor tiers are open on Kickstarter — only 21 of each, across the entire investor base. Here\'s the difference and why the shelf matters.',
    target_filter: 'Email 1 sent + opened',
    status_slug: 'email_2_sent',
    cta: 'See the two tiers',
  },
  {
    n: 3,
    subject: 'Still deciding? Here\'s what investors in your position are doing',
    preview: 'The campaign is moving. The shelf tiers are being taken. Here\'s a clear look at what you\'re weighing.',
    target_filter: 'Email 2 sent + opened',
    status_slug: 'email_3_sent',
    cta: 'Lock in your tier',
  },
  {
    n: 4,
    subject: 'Your direct line to the KNYT founding stack',
    preview: 'The Top KNYT Shelf gives you more than a reward — it\'s founding position in the metaKnyts economy. Here\'s exactly what that means.',
    target_filter: 'Email 3 sent + clicked',
    status_slug: 'email_4_sent',
    cta: 'Claim Top Shelf',
  },
  {
    n: 5,
    subject: '21 of each. That\'s the ceiling.',
    preview: 'There are no additional investor tiers being added. 21 Top Shelf. 21 Zero. That\'s it across all investors, ever.',
    target_filter: 'Email 4 sent (non-backers)',
    status_slug: 'email_5_sent',
    cta: 'Back before it closes',
  },
  {
    n: 6,
    subject: '48 hours — the campaign window is closing',
    preview: 'You\'ve been tracking KNYT. The Kickstarter is in its final 48 hours. Investor tiers close when it does.',
    target_filter: 'All active contacts',
    status_slug: 'email_6_sent',
    cta: 'Back KNYT now',
  },
  {
    n: 7,
    subject: 'Final day. The shelf closes tonight.',
    preview: 'This is the last send before the campaign closes. Investor access ends at midnight.',
    target_filter: 'All active (not yet backed)',
    status_slug: 'email_7_sent',
    cta: 'Back KNYT — last chance',
  },
  {
    n: 8,
    subject: 'The campaign closed. What comes next for you.',
    preview: 'KNYT funded. Here\'s the roadmap, your position in the ecosystem, and what to watch for as we build.',
    target_filter: 'All contacts (post-campaign)',
    status_slug: 'email_8_sent',
    cta: 'See what\'s next',
  },
];

const KNYT_INVESTOR_SEQUENCES = [
  {
    cohort: 'top_shelf',
    label: 'Top KNYT Shelf',
    sequence_id: 'knyt_top_shelf_v1',
    subject: 'Your Top KNYT Shelf investor access — everything you need to know',
    preview: 'You\'re one of 21 Top Shelf investors. Here\'s your full package: 13 canonical iQube pairs, exclusive rewards, and your founding position in the metaKnyts economy.',
    accent: 'amber',
  },
  {
    cohort: 'zero_knyt',
    label: 'Zero KNYT Investor',
    sequence_id: 'knyt_zero_v1',
    subject: 'Your Zero KNYT investor position — what it unlocks',
    preview: 'As a Zero KNYT holder, you\'re in. Here\'s your pathway into the KNYT ecosystem and what the campaign phase means for your position.',
    accent: 'violet',
  },
  {
    cohort: 'reactivation',
    label: 'Reactivation',
    sequence_id: 'knyt_reactivation_v1',
    subject: 'KNYT is live — your investor access is still waiting',
    preview: 'The Kickstarter cleared. You haven\'t activated your investor position yet. Here\'s how to do it now.',
    accent: 'rose',
  },
  {
    cohort: 'general',
    label: 'General Investor',
    sequence_id: 'knyt_general_v1',
    subject: 'The KNYT campaign just launched — your investor brief',
    preview: 'The KNYT Kickstarter is live. As an early investor, here\'s what this phase means for you and what to do next.',
    accent: 'sky',
  },
];

// ── Handler ────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  try {
    const [ksResult, knytResult, socialResult] = await Promise.allSettled([
      // KS engagement breakdown per email
      supabase
        .from('ks_backers_staging')
        .select('engagement_status, suppression_status'),

      // KNYT sub-cohort stats
      supabase
        .from('nakamoto_knyt_personas')
        .select('campaign_cohort, campaign_state')
        .not('Email', 'is', null),

      // Social comms packs
      supabase
        .from('avl_comms_packs')
        .select('slug, title, comms_type, template_markdown, subject_lines, cta_options')
        .eq('comms_type', 'social')
        .eq('active', true)
        .order('slug'),
    ]);

    // ── KS stats per email ─────────────────────────────────────────────────
    const ksRows = ksResult.status === 'fulfilled' ? (ksResult.value.data ?? []) : [];

    const emailStats = KS_EMAIL_SEQUENCE.map((email) => {
      const statusMatch = ksRows.filter((r) => r.engagement_status === email.status_slug);
      const prevStatus = email.n === 1
        ? ksRows.filter((r) => r.suppression_status === 'active')
        : ksRows.filter((r) => r.engagement_status === KS_EMAIL_SEQUENCE[email.n - 2].status_slug);

      return {
        ...email,
        sent_count: statusMatch.length,
        eligible_count: prevStatus.length,
      };
    });

    // Determine which email is next to fire
    const maxSent = emailStats.reduce((max, e) => e.sent_count > 0 ? e.n : max, 0);
    const nextToFire = Math.min(maxSent + 1, 8);

    // ── KNYT cohort stats ──────────────────────────────────────────────────
    const knytRows = knytResult.status === 'fulfilled' ? (knytResult.value.data ?? []) : [];

    const knytSequences = KNYT_INVESTOR_SEQUENCES.map((seq) => {
      const rows = knytRows.filter((r) => r.campaign_cohort === seq.cohort);
      const sent = rows.filter((r) => r.campaign_state && r.campaign_state !== 'unsent').length;
      const opened = rows.filter((r) => ['opened', 'clicked', 'backed'].includes(r.campaign_state ?? '')).length;
      const backed = rows.filter((r) => r.campaign_state === 'backed').length;
      return {
        ...seq,
        total: rows.length,
        sent,
        unsent: rows.length - sent,
        opened,
        backed,
        status: sent === 0 ? 'pending' : sent < rows.length ? 'partial' : 'complete',
      };
    });

    // ── Social packs ───────────────────────────────────────────────────────
    const socialPacks = socialResult.status === 'fulfilled' ? (socialResult.value.data ?? []) : [];

    return NextResponse.json({
      ok: true,
      ks_prospects: {
        emails: emailStats,
        next_to_fire: nextToFire,
      },
      knyt_investors: {
        sequences: knytSequences,
      },
      social_posts: socialPacks,
    });
  } catch (err) {
    console.error('[marketa/campaigns/email-content] error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load email content' }, { status: 500 });
  }
}
