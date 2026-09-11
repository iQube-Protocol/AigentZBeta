# Commit Brief: `a875f3e` — metaMe: KNYT rename + ExpandedNBEPill contextualTitle + markdown strip on email drafts

| Field | Value |
|-------|-------|
| SHA | [`a875f3e`](https://github.com/iQube-Protocol/AigentZBeta/commit/a875f3e5d2d6ad220b59329a817ee2297ba2d54a) |
| Author | Claude |
| Date | 2026-06-01T02:07:36Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
metaMe: KNYT rename + ExpandedNBEPill contextualTitle + markdown strip on email drafts

Three operator-driven fixes rolled up:

1. metaMe cartridge: rename "Order of Metayé" → "KNYT"
   data/codex-configs.ts — tabGroups entry + the static tab itself
   data/activation-catalog.ts — activation label (the activation only
     surfaces in metaMe per its description; KNYT cartridge keeps its
     own naming intact). longDescription updated to reference "KNYT
     tab" with a parenthetical note that the activation id
     'order-of-metaye' is retained for back-compat.

2. ExpandedNBEPill: render contextualTitle instead of catalogue label
   The inline brief Pill (the most-seen NBA card surface — sits inside
   Brief / Move-forward / Venture / Specialists Capsules) was still
   rendering action.label even after the contextualTitle plumbing
   landed in NextBestActionCard. Now mirrors the same fallback:
   contextualTitle && contextualTitle.trim().length > 0 ? contextualTitle
   : label. So once nbeLlmRerank emits a contextual title for an NBE
   id, both card surfaces pick it up.

3. Markdown leak in email body / subject
   Operator-reported: Anthropic Sonnet emits **bold** lead-ins
   ("1. **User Experience**:") in email body text despite the system
   prompt rule "bodyText is plain text (no Markdown)". Result: the
   asterisks ship as visible chrome in the recipient's inbox.

   draftEmail.ts + draftMarketaEmail.ts:
     - SYSTEM_PROMPT hardened: explicit "no asterisks for bold, no
       underscores for italic, no hash headers, no backticks" list,
       plus the rule that numbered-list item text after "1. " is
       plain (never bold lead-in).
     - stripMarkdown() helper applied to BOTH subject and bodyText
       on the parsed-result return path. Conservative — strips bold
       (**x**, __x__), italic (*x*, _x_ with word-boundary guards
       to spare snake_case), inline code (`x`), leading hash headers,
       leading blockquote markers. Triple-newline cleanup at the end.

   nbeLlmRerank.ts:
     - Same minimal markdown strip on the contextual title text
       before length-clip. NBA card h4 renders titles verbatim, so
       an unstripped **bold** title shows asterisks on the card.

The user's open suggestion to extract a generic CTA-alignment helper
(title + body + subject + recipient all generated from the same prompt
context) is the natural next step — Phase 3 candidate. For now both
sides (rerank-emits-title, draft-service-emits-body) read from
ExperienceQube blak strategicGoals / experienceGoals, so they're at
least anchored to the same Venture iQube state.
```

## Body

Three operator-driven fixes rolled up:

1. metaMe cartridge: rename "Order of Metayé" → "KNYT"
   data/codex-configs.ts — tabGroups entry + the static tab itself
   data/activation-catalog.ts — activation label (the activation only
     surfaces in metaMe per its description; KNYT cartridge keeps its
     own naming intact). longDescription updated to reference "KNYT
     tab" with a parenthetical note that the activation id
     'order-of-metaye' is retained for back-compat.

2. ExpandedNBEPill: render contextualTitle instead of catalogue label
   The inline brief Pill (the most-seen NBA card surface — sits inside
   Brief / Move-forward / Venture / Specialists Capsules) was still
   rendering action.label even after the contextualTitle plumbing
   landed in NextBestActionCard. Now mirrors the same fallback:
   contextualTitle && contextualTitle.trim().length > 0 ? contextualTitle
   : label. So once nbeLlmRerank emits a contextual title for an NBE
   id, both card surfaces pick it up.

3. Markdown leak in email body / subject
   Operator-reported: Anthropic Sonnet emits **bold** lead-ins
   ("1. **User Experience**:") in email body text despite the system
   prompt rule "bodyText is plain text (no Markdown)". Result: the
   asterisks ship as visible chrome in the recipient's inbox.

   draftEmail.ts + draftMarketaEmail.ts:
     - SYSTEM_PROMPT hardened: explicit "no asterisks for bold, no
       underscores for italic, no hash headers, no backticks" list,
       plus the rule that numbered-list item text after "1. " is
       plain (never bold lead-in).
     - stripMarkdown() helper applied to BOTH subject and bodyText
       on the parsed-result return path. Conservative — strips bold
       (**x**, __x__), italic (*x*, _x_ with word-boundary guards
       to spare snake_case), inline code (`x`), leading hash headers,
       leading blockquote markers. Triple-newline cleanup at the end.

   nbeLlmRerank.ts:
     - Same minimal markdown strip on the contextual title text
       before length-clip. NBA card h4 renders titles verbatim, so
       an unstripped **bold** title shows asterisks on the card.

The user's open suggestion to extract a generic CTA-alignment helper
(title + body + subject + recipient all generated from the same prompt
context) is the natural next step — Phase 3 candidate. For now both
sides (rerank-emits-title, draft-service-emits-body) read from
ExperienceQube blak strategicGoals / experienceGoals, so they're at
least anchored to the same Venture iQube state.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/cards/ExpandedNBEPill.tsx` |
| Modified | `data/activation-catalog.ts` |
| Modified | `data/codex-configs.ts` |
| Modified | `services/agents/draftEmail.ts` |
| Modified | `services/agents/draftMarketaEmail.ts` |
| Modified | `services/orchestration/nbeLlmRerank.ts` |

## Stats

 6 files changed, 78 insertions(+), 14 deletions(-)
