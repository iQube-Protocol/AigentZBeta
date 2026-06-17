'use client';

/**
 * MobilityIntakeTab — Mobility Activation File (MAF) multi-step intake wizard.
 *
 * Covers MAF §2–13 across 7 steps. Each step auto-saves to the API on Next.
 * Score outputs (MAF §14) are computed server-side after each save.
 *
 * Steps:
 *   1. Household Profile         (MAF §2)
 *   2. Capability + Continuity   (MAF §3–4)
 *   3. Housing                   (MAF §6)
 *   4. Education                 (MAF §7)
 *   5. Business + Financial      (MAF §8–9)
 *   6. Mobility + Family         (MAF §10–11)
 *   7. Confidentiality + Dates   (MAF §12–13)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Users,
  TrendingUp,
  Home,
  GraduationCap,
  Briefcase,
  Heart,
  Shield,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CriticalDate {
  label: string;
  date_category: string;
  due_date: string;
  is_hard_deadline: boolean;
  workstream_key: string;
  notes: string;
}

interface HouseholdProfile {
  adultsCount: string;
  dependentsCount: string;
  citizenshipStatus: string;
  originCountry: string;
  originCity: string;
  destinationCountry: string;
  destinationCity: string;
  preferredArea: string;
  languageRequirements: string;
  specialRequirements: string;
}

interface CapabilityProfile {
  professionalBackground: string;
  founderExperience: string;
  specialistSkills: string;
  industrySectors: string;
  extraordinaryAbility: string;
  entrepreneurialHistory: string;
  contributionPotential: string;
}

interface ContinuityProfile {
  previousCommunities: string;
  previousSchools: string;
  professionalNetworks: string;
  familyNetworks: string;
  geographicFamiliarity: string;
  preferredContinuityAnchors: string;
}

interface HousingProfile {
  currentAddress: string;
  currentHousingStatus: string;
  requiredDepartureDate: string;
  housingBudget: string;
  preferredLocation: string;
  acceptableLocations: string;
  housingPriorities: string;
  guarantorsAvailable: string;
  temporaryHousingAvailable: string;
}

interface EducationProfile {
  childrenDetails: string;
  currentSchools: string;
  previousSchools: string;
  targetSchools: string;
  admissionsDeadlines: string;
  continuityPriorities: string;
  specialRequirements: string;
}

interface BusinessProfile {
  usEntities: string;
  ukEntities: string;
  bankingRelationships: string;
  complianceRequirements: string;
  revenueSources: string;
  currentContracts: string;
  registeredAgents: string;
  taxObligations: string;
}

interface FinancialProfile {
  liquidityRange: string;
  incomeSources: string;
  recurringObligations: string;
  immediateFinancialRisks: string;
  expectedRunway: string;
}

interface MobilityProfile {
  possessionsInventory: string;
  shippingRequirements: string;
  storageRequirements: string;
  preferredRelocationWindow: string;
  transportationConstraints: string;
}

interface FamilyProfile {
  stressFactors: string;
  supportRequirements: string;
  familyPriorities: string;
  communityReintegrationPreferences: string;
}

interface ConfidentialityProfile {
  classificationLevel: string;
  disclosureRules: string;
  standingProtectionRequirements: string;
  childrensInformationRules: string;
  businessInformationRules: string;
}

type StepId = 'household' | 'capability' | 'housing' | 'education' | 'business' | 'mobility' | 'confidentiality';

const STEPS: Array<{ id: StepId; label: string; icon: React.ReactNode; sectionKeys: string[] }> = [
  { id: 'household',      label: 'Household',         icon: <Users className="h-4 w-4" />,         sectionKeys: ['household_profile'] },
  { id: 'capability',     label: 'Capability',         icon: <TrendingUp className="h-4 w-4" />,    sectionKeys: ['capability_profile', 'continuity_profile'] },
  { id: 'housing',        label: 'Housing',            icon: <Home className="h-4 w-4" />,           sectionKeys: ['housing_profile'] },
  { id: 'education',      label: 'Education',          icon: <GraduationCap className="h-4 w-4" />, sectionKeys: ['education_profile'] },
  { id: 'business',       label: 'Business',           icon: <Briefcase className="h-4 w-4" />,     sectionKeys: ['business_profile', 'financial_profile'] },
  { id: 'mobility',       label: 'Relocation',         icon: <Heart className="h-4 w-4" />,         sectionKeys: ['mobility_profile', 'family_profile'] },
  { id: 'confidentiality',label: 'Confidentiality',    icon: <Shield className="h-4 w-4" />,        sectionKeys: ['confidentiality_profile'] },
];

// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-300">{label}</label>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30';
const textareaCls = `${inputCls} resize-none`;

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className={inputCls} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />;
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea className={textareaCls} rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  onComplete?: () => void;
}

export function MobilityIntakeTab({ caseId, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completedSections, setCompletedSections] = useState<string[]>([]);

  // Step data
  const [household, setHousehold] = useState<HouseholdProfile>({
    adultsCount: '', dependentsCount: '', citizenshipStatus: '', originCountry: '',
    originCity: '', destinationCountry: '', destinationCity: '', preferredArea: '',
    languageRequirements: '', specialRequirements: '',
  });
  const [capability, setCapability] = useState<CapabilityProfile>({
    professionalBackground: '', founderExperience: '', specialistSkills: '',
    industrySectors: '', extraordinaryAbility: '', entrepreneurialHistory: '', contributionPotential: '',
  });
  const [continuity, setContinuity] = useState<ContinuityProfile>({
    previousCommunities: '', previousSchools: '', professionalNetworks: '',
    familyNetworks: '', geographicFamiliarity: '', preferredContinuityAnchors: '',
  });
  const [housing, setHousing] = useState<HousingProfile>({
    currentAddress: '', currentHousingStatus: '', requiredDepartureDate: '', housingBudget: '',
    preferredLocation: '', acceptableLocations: '', housingPriorities: '', guarantorsAvailable: '',
    temporaryHousingAvailable: '',
  });
  const [education, setEducation] = useState<EducationProfile>({
    childrenDetails: '', currentSchools: '', previousSchools: '', targetSchools: '',
    admissionsDeadlines: '', continuityPriorities: '', specialRequirements: '',
  });
  const [business, setBusiness] = useState<BusinessProfile>({
    usEntities: '', ukEntities: '', bankingRelationships: '', complianceRequirements: '',
    revenueSources: '', currentContracts: '', registeredAgents: '', taxObligations: '',
  });
  const [financial, setFinancial] = useState<FinancialProfile>({
    liquidityRange: '', incomeSources: '', recurringObligations: '',
    immediateFinancialRisks: '', expectedRunway: '',
  });
  const [mobility, setMobility] = useState<MobilityProfile>({
    possessionsInventory: '', shippingRequirements: '', storageRequirements: '',
    preferredRelocationWindow: '', transportationConstraints: '',
  });
  const [family, setFamily] = useState<FamilyProfile>({
    stressFactors: '', supportRequirements: '', familyPriorities: '', communityReintegrationPreferences: '',
  });
  const [confidentiality, setConfidentiality] = useState<ConfidentialityProfile>({
    classificationLevel: 'black_cube', disclosureRules: '', standingProtectionRequirements: '',
    childrensInformationRules: '', businessInformationRules: '',
  });
  const [criticalDates, setCriticalDates] = useState<CriticalDate[]>([
    { label: '', date_category: 'housing', due_date: '', is_hard_deadline: true, workstream_key: 'B', notes: '' },
  ]);

  // Load existing case data
  useEffect(() => {
    (async () => {
      try {
        const res = await personaFetch(`/api/mobility/cases/${caseId}`, { cache: 'no-store' });
        const json = await res.json();
        if (!json.ok) return;
        const c = json.case;
        if (c.household_profile && Object.keys(c.household_profile).length > 0) setHousehold(c.household_profile);
        if (c.capability_profile && Object.keys(c.capability_profile).length > 0) setCapability(c.capability_profile);
        if (c.continuity_profile && Object.keys(c.continuity_profile).length > 0) setContinuity(c.continuity_profile);
        if (c.housing_profile && Object.keys(c.housing_profile).length > 0) setHousing(c.housing_profile);
        if (c.education_profile && Object.keys(c.education_profile).length > 0) setEducation(c.education_profile);
        if (c.business_profile && Object.keys(c.business_profile).length > 0) setBusiness(c.business_profile);
        if (c.financial_profile && Object.keys(c.financial_profile).length > 0) setFinancial(c.financial_profile);
        if (c.mobility_profile && Object.keys(c.mobility_profile).length > 0) setMobility(c.mobility_profile);
        if (c.family_profile && Object.keys(c.family_profile).length > 0) setFamily(c.family_profile);
        if (c.confidentiality_profile && Object.keys(c.confidentiality_profile).length > 0) setConfidentiality(c.confidentiality_profile);
        setCompletedSections(c.intake_sections_complete ?? []);
      } catch { /* silent */ }
    })();
  }, [caseId]);

  const saveStep = useCallback(async (stepIdx: number) => {
    setSaving(true);
    setSaveError(null);
    try {
      const payloads: Record<string, unknown> = {};
      if (stepIdx === 0) payloads.household_profile = household;
      if (stepIdx === 1) { payloads.capability_profile = capability; payloads.continuity_profile = continuity; }
      if (stepIdx === 2) payloads.housing_profile = housing;
      if (stepIdx === 3) payloads.education_profile = education;
      if (stepIdx === 4) { payloads.business_profile = business; payloads.financial_profile = financial; }
      if (stepIdx === 5) { payloads.mobility_profile = mobility; payloads.family_profile = family; }
      if (stepIdx === 6) payloads.confidentiality_profile = confidentiality;

      const res = await personaFetch(`/api/mobility/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloads),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Save failed');
      setCompletedSections(json.case.intake_sections_complete ?? []);

      // Save critical dates on last step
      if (stepIdx === 6) {
        for (const d of criticalDates) {
          if (d.label && d.due_date) {
            await personaFetch(`/api/mobility/cases/${caseId}/dates`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(d),
            });
          }
        }
        onComplete?.();
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [caseId, household, capability, continuity, housing, education, business, financial, mobility, family, confidentiality, criticalDates, onComplete]);

  const handleNext = useCallback(async () => {
    await saveStep(step);
    if (!saving) setStep(s => Math.min(s + 1, STEPS.length - 1));
  }, [step, saveStep, saving]);

  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const isStepComplete = (idx: number) => {
    const s = STEPS[idx];
    return s.sectionKeys.every(k => completedSections.includes(k));
  };

  const currentStep = STEPS[step];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      {/* Progress bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>MAF Intake — Step {step + 1} of {STEPS.length}</span>
          <span>{Math.round(((step + 1) / STEPS.length) * 100)}% complete</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-700">
          <div
            className="h-1.5 rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        {/* Step chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={cls(
                'flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-medium transition-colors',
                i === step
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : isStepComplete(i)
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500',
              )}
            >
              {isStepComplete(i) ? <CheckCircle2 className="h-3 w-3" /> : s.icon}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step title */}
      <div className="flex items-center gap-2">
        <span className="text-slate-300">{currentStep.icon}</span>
        <h3 className="text-base font-semibold text-slate-100">{currentStep.label}</h3>
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 space-y-4">
        {step === 0 && <StepHousehold state={household} set={setHousehold} />}
        {step === 1 && <StepCapability cap={capability} setCap={setCapability} con={continuity} setCon={setContinuity} />}
        {step === 2 && <StepHousing state={housing} set={setHousing} />}
        {step === 3 && <StepEducation state={education} set={setEducation} />}
        {step === 4 && <StepBusiness bus={business} setBus={setBusiness} fin={financial} setFin={setFinancial} />}
        {step === 5 && <StepMobility mob={mobility} setMob={setMobility} fam={family} setFam={setFamily} />}
        {step === 6 && <StepConfidentiality conf={confidentiality} setConf={setConfidentiality} dates={criticalDates} setDates={setCriticalDates} />}
      </div>

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <p className="text-xs text-rose-300">{saveError}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={step === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {step === STEPS.length - 1 ? 'Complete Intake' : (
            <>Save & Continue <ChevronRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepHousehold({ state, set }: { state: HouseholdProfile; set: React.Dispatch<React.SetStateAction<HouseholdProfile>> }) {
  const u = (k: keyof HouseholdProfile) => (v: string) => set(s => ({ ...s, [k]: v }));
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Number of adults"><TextInput value={state.adultsCount} onChange={u('adultsCount')} placeholder="2" /></Field>
        <Field label="Number of dependents"><TextInput value={state.dependentsCount} onChange={u('dependentsCount')} placeholder="2" /></Field>
      </div>
      <Field label="Citizenship status" hint="All family members' citizenship status">
        <TextInput value={state.citizenshipStatus} onChange={u('citizenshipStatus')} placeholder="All UK citizens, UK passport holders" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Origin country"><TextInput value={state.originCountry} onChange={u('originCountry')} placeholder="United States" /></Field>
        <Field label="Origin city / state"><TextInput value={state.originCity} onChange={u('originCity')} placeholder="Hudson County, New Jersey" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Destination country"><TextInput value={state.destinationCountry} onChange={u('destinationCountry')} placeholder="United Kingdom" /></Field>
        <Field label="Destination city"><TextInput value={state.destinationCity} onChange={u('destinationCity')} placeholder="London" /></Field>
      </div>
      <Field label="Preferred area / continuity zone" hint="Specific neighbourhoods or areas important for continuity">
        <TextInput value={state.preferredArea} onChange={u('preferredArea')} placeholder="Dulwich Village, North Dulwich, East Dulwich, West Dulwich" />
      </Field>
      <Field label="Special requirements (optional)">
        <TextArea value={state.specialRequirements} onChange={u('specialRequirements')} placeholder="Any accessibility, health, or other household requirements" rows={2} />
      </Field>
    </>
  );
}

function StepCapability({
  cap, setCap, con, setCon,
}: {
  cap: CapabilityProfile; setCap: React.Dispatch<React.SetStateAction<CapabilityProfile>>;
  con: ContinuityProfile; setCon: React.Dispatch<React.SetStateAction<ContinuityProfile>>;
}) {
  const uc = (k: keyof CapabilityProfile) => (v: string) => setCap(s => ({ ...s, [k]: v }));
  const un = (k: keyof ContinuityProfile) => (v: string) => setCon(s => ({ ...s, [k]: v }));
  return (
    <>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Capability Profile</p>
      <Field label="Professional background" hint="Employment history, leadership roles, areas of expertise">
        <TextArea value={cap.professionalBackground} onChange={uc('professionalBackground')} placeholder="Technology leadership, founder/operator, international experience…" />
      </Field>
      <Field label="Founder / entrepreneurial experience">
        <TextInput value={cap.founderExperience} onChange={uc('founderExperience')} placeholder="Yes — founded X, operated Y; active ventures include…" />
      </Field>
      <Field label="Extraordinary ability indicators" hint="O-1 visa, industry awards, published work, speaking, patents">
        <TextInput value={cap.extraordinaryAbility} onChange={uc('extraordinaryAbility')} placeholder="Long-term O-1 visa holder; recognised under extraordinary ability criteria" />
      </Field>
      <Field label="Industry sectors">
        <TextInput value={cap.industrySectors} onChange={uc('industrySectors')} placeholder="Technology, AI, SaaS, fintech…" />
      </Field>
      <Field label="Contribution potential" hint="Expected contribution to UK economy, community, or institutions">
        <TextArea value={cap.contributionPotential} onChange={uc('contributionPotential')} placeholder="Founder track — consulting, advisory, AI ecosystem contribution…" rows={2} />
      </Field>

      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2">Continuity Profile</p>
      <Field label="Previous UK communities" hint="Prior areas, neighbourhoods, communities the family has lived in">
        <TextInput value={con.previousCommunities} onChange={un('previousCommunities')} placeholder="Dulwich, South London — prior family residence" />
      </Field>
      <Field label="Previous UK schools">
        <TextInput value={con.previousSchools} onChange={un('previousSchools')} placeholder="Dulwich-area educational pathway" />
      </Field>
      <Field label="Professional networks in UK">
        <TextArea value={con.professionalNetworks} onChange={un('professionalNetworks')} placeholder="Founder networks, AI ecosystem contacts, advisory relationships…" rows={2} />
      </Field>
      <Field label="Preferred continuity anchors" hint="What would make this feel like coming home?">
        <TextArea value={con.preferredContinuityAnchors} onChange={un('preferredContinuityAnchors')} placeholder="Dulwich, specific school, community networks…" rows={2} />
      </Field>
    </>
  );
}

function StepHousing({ state, set }: { state: HousingProfile; set: React.Dispatch<React.SetStateAction<HousingProfile>> }) {
  const u = (k: keyof HousingProfile) => (v: string) => set(s => ({ ...s, [k]: v }));
  return (
    <>
      <Field label="Current housing status">
        <TextInput value={state.currentHousingStatus} onChange={u('currentHousingStatus')} placeholder="Renting — lease expiry / eviction notice pending" />
      </Field>
      <Field label="Required departure date" hint="Hard deadline by which current accommodation must be vacated">
        <input type="date" className={inputCls} value={state.requiredDepartureDate} onChange={e => u('requiredDepartureDate')(e.target.value)} />
      </Field>
      <Field label="Housing budget" hint="Monthly rental budget in GBP">
        <TextInput value={state.housingBudget} onChange={u('housingBudget')} placeholder="£X,XXX/month" />
      </Field>
      <Field label="Preferred location">
        <TextInput value={state.preferredLocation} onChange={u('preferredLocation')} placeholder="Dulwich Village / North Dulwich / West Dulwich / East Dulwich" />
      </Field>
      <Field label="Acceptable alternative locations">
        <TextInput value={state.acceptableLocations} onChange={u('acceptableLocations')} placeholder="Herne Hill, Forest Hill, Crystal Palace…" />
      </Field>
      <Field label="Housing priorities">
        <TextArea value={state.housingPriorities} onChange={u('housingPriorities')} placeholder="Proximity to school catchment, 3+ bedrooms, private garden…" rows={2} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Guarantors available?">
          <TextInput value={state.guarantorsAvailable} onChange={u('guarantorsAvailable')} placeholder="Yes / No / Family support" />
        </Field>
        <Field label="Temporary housing available?">
          <TextInput value={state.temporaryHousingAvailable} onChange={u('temporaryHousingAvailable')} placeholder="Yes (family) / No" />
        </Field>
      </div>
    </>
  );
}

function StepEducation({ state, set }: { state: EducationProfile; set: React.Dispatch<React.SetStateAction<EducationProfile>> }) {
  const u = (k: keyof EducationProfile) => (v: string) => set(s => ({ ...s, [k]: v }));
  return (
    <>
      <Field label="Children details" hint="Age, year group, any relevant educational history">
        <TextArea value={state.childrenDetails} onChange={u('childrenDetails')} placeholder="Child 1: age 13, Year 9 secondary. Child 2: age 5, Reception/Year 1." rows={3} />
      </Field>
      <Field label="Current schools (US)">
        <TextInput value={state.currentSchools} onChange={u('currentSchools')} placeholder="Current NJ school(s)" />
      </Field>
      <Field label="Previous UK schools">
        <TextInput value={state.previousSchools} onChange={u('previousSchools')} placeholder="Any prior Dulwich-area school attendance" />
      </Field>
      <Field label="Target schools (UK)">
        <TextArea value={state.targetSchools} onChange={u('targetSchools')} placeholder="Preferred school(s) — continuity targets in Dulwich…" rows={2} />
      </Field>
      <Field label="Admissions deadlines">
        <TextInput value={state.admissionsDeadlines} onChange={u('admissionsDeadlines')} placeholder="September intake — applications required by…" />
      </Field>
      <Field label="Continuity priorities">
        <TextArea value={state.continuityPriorities} onChange={u('continuityPriorities')} placeholder="Maximise continuity with prior Dulwich educational pathway…" rows={2} />
      </Field>
      <Field label="Special educational requirements (optional)">
        <TextInput value={state.specialRequirements} onChange={u('specialRequirements')} placeholder="Any SEND, EHC plans, or specialist provision needed" />
      </Field>
    </>
  );
}

function StepBusiness({
  bus, setBus, fin, setFin,
}: {
  bus: BusinessProfile; setBus: React.Dispatch<React.SetStateAction<BusinessProfile>>;
  fin: FinancialProfile; setFin: React.Dispatch<React.SetStateAction<FinancialProfile>>;
}) {
  const ub = (k: keyof BusinessProfile) => (v: string) => setBus(s => ({ ...s, [k]: v }));
  const uf = (k: keyof FinancialProfile) => (v: string) => setFin(s => ({ ...s, [k]: v }));
  return (
    <>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Business Continuity</p>
      <Field label="US entities" hint="Incorporated companies, LLCs, registered businesses">
        <TextArea value={bus.usEntities} onChange={ub('usEntities')} placeholder="LLC / Corp names, states of registration, registered agents…" rows={2} />
      </Field>
      <Field label="UK entities (existing)">
        <TextInput value={bus.ukEntities} onChange={ub('ukEntities')} placeholder="Any existing UK Ltd or registered entities" />
      </Field>
      <Field label="Banking relationships">
        <TextInput value={bus.bankingRelationships} onChange={ub('bankingRelationships')} placeholder="US business banking, UK banking status…" />
      </Field>
      <Field label="Active contracts / revenue sources">
        <TextArea value={bus.currentContracts} onChange={ub('currentContracts')} placeholder="Ongoing client contracts, SaaS revenue, advisory engagements…" rows={2} />
      </Field>
      <Field label="Compliance obligations">
        <TextInput value={bus.complianceRequirements} onChange={ub('complianceRequirements')} placeholder="Filing deadlines, registered agent requirements, tax obligations…" />
      </Field>

      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2">Financial Profile</p>
      <Field label="Liquidity range" hint="Approximate cash reserves available now — ranges are sufficient, exact figures not required">
        <TextInput value={fin.liquidityRange} onChange={uf('liquidityRange')} placeholder="e.g. under £5k / £5–15k / £15–30k / £30k+" />
      </Field>
      <Field label="Immediate financial risks">
        <TextArea value={fin.immediateFinancialRisks} onChange={uf('immediateFinancialRisks')} placeholder="Housing deadline, outstanding debts, payroll…" rows={2} />
      </Field>
      <Field label="Expected financial runway" hint="How long current reserves cover basic outgoings">
        <TextInput value={fin.expectedRunway} onChange={uf('expectedRunway')} placeholder="e.g. 30 days / 60 days" />
      </Field>
    </>
  );
}

function StepMobility({
  mob, setMob, fam, setFam,
}: {
  mob: MobilityProfile; setMob: React.Dispatch<React.SetStateAction<MobilityProfile>>;
  fam: FamilyProfile; setFam: React.Dispatch<React.SetStateAction<FamilyProfile>>;
}) {
  const um = (k: keyof MobilityProfile) => (v: string) => setMob(s => ({ ...s, [k]: v }));
  const uf = (k: keyof FamilyProfile) => (v: string) => setFam(s => ({ ...s, [k]: v }));
  return (
    <>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Relocation Logistics</p>
      <Field label="Preferred relocation window">
        <TextInput value={mob.preferredRelocationWindow} onChange={um('preferredRelocationWindow')} placeholder="Within 30 days / by [date]" />
      </Field>
      <Field label="Possessions" hint="High-level summary — full inventory not required at this stage">
        <TextArea value={mob.possessionsInventory} onChange={um('possessionsInventory')} placeholder="Household goods, priority items, vehicles, equipment…" rows={2} />
      </Field>
      <Field label="Shipping / storage requirements">
        <TextInput value={mob.shippingRequirements} onChange={um('shippingRequirements')} placeholder="International shipping, UK storage, carry-on only…" />
      </Field>
      <Field label="Transportation constraints">
        <TextInput value={mob.transportationConstraints} onChange={um('transportationConstraints')} placeholder="Flight booking requirements, pet travel, vehicle…" />
      </Field>

      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2">Family Stabilization</p>
      <Field label="Primary stress factors" hint="What is creating the most pressure on the family right now?">
        <TextArea value={fam.stressFactors} onChange={uf('stressFactors')} placeholder="Housing deadline, children's school uncertainty, financial pressure…" rows={2} />
      </Field>
      <Field label="Community reintegration preferences">
        <TextArea value={fam.communityReintegrationPreferences} onChange={uf('communityReintegrationPreferences')} placeholder="Re-connecting with Dulwich community, school community, founder networks…" rows={2} />
      </Field>
    </>
  );
}

function StepConfidentiality({
  conf, setConf, dates, setDates,
}: {
  conf: ConfidentialityProfile; setConf: React.Dispatch<React.SetStateAction<ConfidentialityProfile>>;
  dates: CriticalDate[]; setDates: React.Dispatch<React.SetStateAction<CriticalDate[]>>;
}) {
  const uc = (k: keyof ConfidentialityProfile) => (v: string) => setConf(s => ({ ...s, [k]: v }));

  const addDate = () => setDates(ds => [...ds, {
    label: '', date_category: 'other', due_date: '', is_hard_deadline: true, workstream_key: 'A', notes: '',
  }]);
  const removeDate = (i: number) => setDates(ds => ds.filter((_, j) => j !== i));
  const updateDate = (i: number, k: keyof CriticalDate, v: string | boolean) =>
    setDates(ds => ds.map((d, j) => j === i ? { ...d, [k]: v } : d));

  const DATE_CATEGORIES = ['housing', 'school', 'travel', 'compliance', 'business', 'legal', 'other'];
  const WORKSTREAM_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  return (
    <>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Confidentiality Classification</p>
      <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 space-y-1">
        <p className="text-xs font-semibold text-rose-300">Black Cube — Active</p>
        <p className="text-xs text-slate-400">
          This case is classified Black Cube by default. All information is compartmentalized.
          Agents receive only information required for their assigned workstream.
          Agent Me functions as the family&apos;s confidentiality guardian and disclosure broker.
        </p>
      </div>
      <Field label="Standing protection requirements" hint="What professional or reputational standing must be protected?">
        <TextArea value={conf.standingProtectionRequirements} onChange={uc('standingProtectionRequirements')} placeholder="Protect founder reputation, business relationships, O-1 visa history, professional standing…" rows={2} />
      </Field>
      <Field label="Business information rules" hint="What business information may NOT be disclosed to housing agents, schools etc.">
        <TextArea value={conf.businessInformationRules} onChange={uc('businessInformationRules')} placeholder="Revenue figures and business names are need-to-know only. Do not disclose to housing agents." rows={2} />
      </Field>
      <Field label="Children's information rules">
        <TextArea value={conf.childrensInformationRules} onChange={uc('childrensInformationRules')} placeholder="Children's names and school records shared only with admissions officers. Not with housing agents." rows={2} />
      </Field>
      <Field label="Additional disclosure rules (optional)">
        <TextArea value={conf.disclosureRules} onChange={uc('disclosureRules')} placeholder="Any other rules about what information may be shared with which agents…" rows={2} />
      </Field>

      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-3">Critical Date Register</p>
      <p className="text-xs text-slate-500">Add all hard deadlines and critical dates. These drive workstream prioritization.</p>
      <div className="space-y-3">
        {dates.map((d, i) => (
          <div key={i} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">Date {i + 1}</span>
              {dates.length > 1 && (
                <button onClick={() => removeDate(i)} className="text-slate-500 hover:text-rose-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Label">
                <input className={inputCls} value={d.label} onChange={e => updateDate(i, 'label', e.target.value)} placeholder="NJ housing deadline" />
              </Field>
              <Field label="Due date">
                <input type="date" className={inputCls} value={d.due_date} onChange={e => updateDate(i, 'due_date', e.target.value)} />
              </Field>
              <Field label="Category">
                <select className={inputCls} value={d.date_category} onChange={e => updateDate(i, 'date_category', e.target.value)}>
                  {DATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Workstream">
                <select className={inputCls} value={d.workstream_key} onChange={e => updateDate(i, 'workstream_key', e.target.value)}>
                  {WORKSTREAM_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </Field>
            </div>
          </div>
        ))}
        <button
          onClick={addDate}
          className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add critical date
        </button>
      </div>
    </>
  );
}

