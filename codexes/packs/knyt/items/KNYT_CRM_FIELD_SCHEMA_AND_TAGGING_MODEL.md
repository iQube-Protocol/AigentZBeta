# KNYT CRM Field Schema + Tagging Model

## Purpose
Define the minimum CRM structure needed to operate the metaKnyt Kickstarter campaign cleanly.

## Design principles
- keep it operational
- separate identity from campaign state
- support both human and agentic operation
- preserve future usefulness for Runtime, KNYT, OM, PCS, and Venture Studio follow-up

---

## Core identity fields
- contact_id
- full_name / first_name / last_name
- email_primary / email_secondary
- phone_primary
- persona_id
- channel opt-ins
- contact_status

## Investor-specific fields
- is_metaiye_media_investor
- investor_source
- investment_date
- investment_amount_band
- investor_priority_band
- legacy_investor_flag
- strategic_backer_flag
- reg_cf_verified

## Ownership / collector fields
- owns_qriptographic_novel_print
- owns_all_13_print_comics
- owns_legacy_motioncomic_nfts
- legacy_motioncomic_count
- collector_intent_band
- codex_value_awareness
- likely_shelf_completion_buyer
- likely_zero_tier_buyer
- order_status_interest
- digital_asset_affinity
- iq_cube_affinity

## Campaign segmentation fields
- campaign_cohort
- campaign_state
- activation_readiness
- preferred_channel_primary
- best_message_angle
- best_offer_fit
- current_blocker
- reactivation_potential
- advocacy_potential
- partner_intro_potential

## metaMe / PCS / OM mapping fields
- metame_ladder_stage
- campaign_ladder_state
- pcs_signal_stage
- om_status_current
- om_status_target
- knyt_pcs_render_stage
- future_creator_path_interest
- future_correspondent_path_interest
- runtime_followup_eligible

## Outreach and engagement fields
- last_email_sent_at / opened / clicked
- last_sms_sent_at / clicked
- last_direct_outreach_at
- last_reply_at
- reply_sentiment
- kickstarter_clicked
- kickstarter_backed
- kickstarter_backer_tier
- shared_campaign
- referred_supporter_count
- runtime_reentered
- knyt_followup_taken

## Scarcity / offer tracking fields
- investor_offer_shown
- investor_offer_interest
- investor_offer_reserved
- scarcity_message_seen
- ring_fence_message_seen
- post_campaign_benefit_explained

---

## Recommended tags
### Identity / investor tags
- investor
- reg_cf_investor
- legacy_investor
- strategic_backer

### Collector tags
- owns_13_prints
- owns_legacy_motioncomic_nfts
- collector_high
- codex_value_unaware
- codex_value_aware

### Campaign tags
- cohort_a_high_confidence_early_backer
- cohort_b_dormant_legacy_believer
- cohort_c_collector_oriented
- cohort_d_status_order_oriented
- cohort_e_digital_ecosystem_forward
- cohort_f_strategic_champion
- cohort_zero_knyt_legacy_1000_plus
- campaign_dormant
- campaign_reactivated
- campaign_engaged
- campaign_advocate
- campaign_recruiter

### Offer tags
- fit_top_knyt_shelf
- fit_zero_knyt
- fit_post_campaign_digital
- offer_interest_unknown
- scarcity_shown
- ks_only_explained

### Progression tags
- metame_participant
- metame_curator
- metame_composer
- future_creator_path
- future_correspondent_path
- runtime_followup_ready

---

## Minimum viable setup
### Required immediately
- name
- email
- phone
- investor flag
- contact status
- cohort
- campaign state
- likely offer fit
- best message angle
- owns all 13 prints?
- owns legacy motioncomic NFTs?
- Kickstarter clicked?
- Kickstarter backed?
- Kickstarter tier chosen
- shared campaign?
- runtime followup eligible

## Canonical shorthand
**The CRM should not just store contacts. It should store campaign readiness, offer fit, progression potential, and next-best action.**