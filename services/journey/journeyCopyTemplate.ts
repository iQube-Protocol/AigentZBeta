/**
 * Renders a journey narration string for the ACTUAL selected agent, never a
 * hardcoded one (Horizen Pilot Closure item 5, 2026-08-09).
 *
 * HORIZEN_MONEYPENNY_JOURNEY's stage copy (services/journey/horizenMoneyPennyJourney.ts)
 * carries the token `AGENT_DISPLAY_NAME_TOKEN` wherever the subject agent's
 * display name belongs — never the literal "MoneyPenny" — so the SAME stage
 * definition renders correctly regardless of which registrable agent is
 * selected. This is the one place that substitution happens; no renderer may
 * invent its own copy of this logic (inv.engineering.036/037).
 */

export const AGENT_DISPLAY_NAME_TOKEN = '{{agentDisplayName}}';

export function renderJourneyCopy(text: string, agent: { displayName: string }): string {
  return text.split(AGENT_DISPLAY_NAME_TOKEN).join(agent.displayName);
}
