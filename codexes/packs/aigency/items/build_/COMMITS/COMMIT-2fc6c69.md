# Commit Brief: `2fc6c69` — Add MoneyPenny MPY2-3 Risk Envelope: risk factors + limits from Financial Profile

| Field | Value |
|-------|-------|
| SHA | [`2fc6c69`](https://github.com/iQube-Protocol/AigentZBeta/commit/2fc6c69150cdf8059d2dbfdb417758bf6b32e856) |
| Author | Claude |
| Date | 2026-09-01T16:44:11Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add MoneyPenny MPY2-3 Risk Envelope: risk factors + limits from Financial Profile

Derives risk factors (liquidity/concentration/volatility/commitment-coverage)
and recommended limits (position notional, loss/risk budget, drawdown,
liquidity reserve, concentration caps) from MPY2-2's Financial Profile
aggregates — no second financial-state model, no raw-statement copy.

Reuses existing vocabulary rather than inventing parallel ones:
  - RiskLimits.serviceClass is always 'PROPOSAL', the same three-rung
    Advisor/Architect/Runtime axis every MoneyPenny service already
    declares itself against (types/financialServices.ts) — Risk Envelope
    sits at Architect tier, never authorizes anything itself.
  - evaluateActionAgainstRiskEnvelope() returns CTP-001's own
    ConsequenceProjection shape (types/ctp.ts), not a new one, so a future
    CTP primitive or the MPY2-4 Scenario Engine can consume it directly.

Honest by construction: a risk category with no underlying aggregate (e.g.
no balance column -> liquidityBufferDays null) produces no factor and is
reported in `unassessed`, never defaulted to 'low'. The worst observed
severity governs the whole envelope, never diluted by averaging against a
calmer factor. No envelope is proposed when surplus is non-positive.

Persisted in the existing financial_profile_qubes.blak_qube jsonb column
(services/iqube/financialProfileQube.ts) — no migration needed. Also fixes
a real regression this change surfaced: the new 'ShieldAlert' tab icon
wasn't registered in app/triad/components/codex/iconMap.ts.

[merge spec/moneypenny-mpy2-3]
```

## Body

Derives risk factors (liquidity/concentration/volatility/commitment-coverage)
and recommended limits (position notional, loss/risk budget, drawdown,
liquidity reserve, concentration caps) from MPY2-2's Financial Profile
aggregates — no second financial-state model, no raw-statement copy.

Reuses existing vocabulary rather than inventing parallel ones:
  - RiskLimits.serviceClass is always 'PROPOSAL', the same three-rung
    Advisor/Architect/Runtime axis every MoneyPenny service already
    declares itself against (types/financialServices.ts) — Risk Envelope
    sits at Architect tier, never authorizes anything itself.
  - evaluateActionAgainstRiskEnvelope() returns CTP-001's own
    ConsequenceProjection shape (types/ctp.ts), not a new one, so a future
    CTP primitive or the MPY2-4 Scenario Engine can consume it directly.

Honest by construction: a risk category with no underlying aggregate (e.g.
no balance column -> liquidityBufferDays null) produces no factor and is
reported in `unassessed`, never defaulted to 'low'. The worst observed
severity governs the whole envelope, never diluted by averaging against a
calmer factor. No envelope is proposed when surplus is non-positive.

Persisted in the existing financial_profile_qubes.blak_qube jsonb column
(services/iqube/financialProfileQube.ts) — no migration needed. Also fixes
a real regression this change surfaced: the new 'ShieldAlert' tab icon
wasn't registered in app/triad/components/codex/iconMap.ts.

[merge spec/moneypenny-mpy2-3]

## Files Changed

| Change | File |
|--------|------|
| Added | `app/(shell)/moneypenny/components/RiskEnvelopePanel.tsx` |
| Modified | `app/(shell)/moneypenny/components/moneypennyCapabilities.ts` |
| Modified | `app/api/moneypenny/financial-profile/compute/route.ts` |
| Modified | `app/api/moneypenny/financial-profile/route.ts` |
| Modified | `app/triad/components/codex/iconMap.ts` |
| Modified | `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` |
| Modified | `data/codex-configs.ts` |
| Added | `services/financialServices/riskEnvelope.ts` |
| Modified | `services/iqube/financialProfileQube.ts` |
| Added | `tests/moneypenny-risk-envelope.test.ts` |

## Stats

 10 files changed, 760 insertions(+), 2 deletions(-)
