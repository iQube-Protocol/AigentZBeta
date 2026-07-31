/**
 * TAB_TEMPLATES — the canonical registry mapping `CartridgeTabTemplateId`
 * to its React component.
 *
 * Phase 5 of the myCartridge PRD §22. The CartridgeTabTemplateId union
 * lives in `types/ventureQube.ts` so the v0.4 schema, the Zod validator,
 * and this runtime registry stay in lockstep — adding a new template id
 * is a single-point edit that the TS compiler then propagates.
 *
 * `TabRenderer` dispatches here when `CodexTab.type === 'template'`.
 *
 * Phase 5a implements 4 reference templates (Pulse, Codex, Active,
 * Overview). The other 8 register a Stub that documents the scheduled
 * Phase for the deep implementation. Replacing a stub with a real
 * implementation is a one-line swap in this file.
 */

import type { TabTemplateRegistry } from "./types";

import { PulseTemplate } from "./PulseTemplate";
import { CodexTemplate } from "./CodexTemplate";
import { ActiveTemplate } from "./ActiveTemplate";
import { OverviewTemplate } from "./OverviewTemplate";
import { WalletTemplate } from "./WalletTemplate";
import {
  ExperienceStub,
  LedgerStub,
  CommunityStub,
  MembersStub,
  VentureStub,
  SettingsStub,
  AdminStub,
} from "./StubTemplate";

export const TAB_TEMPLATES: TabTemplateRegistry = {
  "pulse-v1": PulseTemplate,
  "codex-v1": CodexTemplate,
  "active-v1": ActiveTemplate,
  "overview-v1": OverviewTemplate,
  "wallet-v1": WalletTemplate,
  "experience-v1": ExperienceStub,
  "ledger-v1": LedgerStub,
  "community-v1": CommunityStub,
  "members-v1": MembersStub,
  "venture-v1": VentureStub,
  "settings-v1": SettingsStub,
  "admin-v1": AdminStub,
};

export type { TabTemplateProps, TabTemplateRegistry } from "./types";
