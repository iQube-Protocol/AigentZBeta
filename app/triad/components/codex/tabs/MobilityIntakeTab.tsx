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
  Link,
  RefreshCw,
  Lock,
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
  role: string;
  sector: string;
  founderOperator: string;
  o1VisaHistory: string;
  yearsOnO1: string;
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

interface ChildRecord {
  childId: string;
  age: string;
  currentGrade: string;
  yearGroup: string;
  currentSchool: string;
  targetSchool: string;
  alternativeSchools: string;
  continuityPriority: string;
  notes: string;
}

interface EducationProfile {
  children: ChildRecord[];
  admissionsDeadlines: string;
  continuityPriorities: string;
  specialRequirements: string;
  childrenDetails?: string; // legacy — read-only migration reference
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
  liquidityLevel: string;
  urgencyLevel: string;
  runwayMonths: string;
  incomeStatus: string;
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

// ─── Professional Profile types ──────────────────────────────────────────────

type FactConfidence = 'SOURCE_DERIVED' | 'PRINCIPAL_VERIFIED';

interface ProfessionalFact {
  factId: string;
  source: string;
  sourceUrl?: string;
  confidence: FactConfidence;
  principalApproved: boolean;
}

interface RoleFact extends ProfessionalFact {
  organization: string;
  title: string;
  isCurrent: boolean;
}
interface EducationFact extends ProfessionalFact {
  institution: string;
  degree: string;
  field: string;
  years: string;
}
interface PublicationFact extends ProfessionalFact {
  title: string;
  type: string;
  year: string;
}
interface PatentFact extends ProfessionalFact {
  number: string;
  title: string;
  year: string;
}
interface AwardFact extends ProfessionalFact {
  title: string;
  issuer: string;
  year: string;
}
interface EAIFact extends ProfessionalFact {
  description: string;
  category: string;
}

interface ProfessionalProfile {
  sourceDocuments: Array<{ type: string; url: string; lastVerified: string }>;
  currentRoles: RoleFact[];
  education: EducationFact[];
  publications: PublicationFact[];
  patents: PatentFact[];
  awards: AwardFact[];
  licenses: AwardFact[];
  extraordinaryAbilityIndicators: EAIFact[];
  principalApproved: boolean;
  approvedAt?: string;
}

type StepId = 'household' | 'capability' | 'professional' | 'housing' | 'education' | 'business' | 'mobility' | 'confidentiality';

const STEPS: Array<{ id: StepId; label: string; icon: React.ReactNode; sectionKeys: string[] }> = [
  { id: 'household',      label: 'Household',          icon: <Users className="h-4 w-4" />,         sectionKeys: ['household_profile'] },
  { id: 'capability',     label: 'Capability',          icon: <TrendingUp className="h-4 w-4" />,    sectionKeys: ['capability_profile', 'continuity_profile'] },
  { id: 'professional',   label: 'Professional Profile',icon: <Lock className="h-4 w-4" />,          sectionKeys: ['capability_profile'] },
  { id: 'housing',        label: 'Housing',             icon: <Home className="h-4 w-4" />,           sectionKeys: ['housing_profile'] },
  { id: 'education',      label: 'Education',           icon: <GraduationCap className="h-4 w-4" />, sectionKeys: ['education_profile'] },
  { id: 'business',       label: 'Business',            icon: <Briefcase className="h-4 w-4" />,     sectionKeys: ['business_profile', 'financial_profile'] },
  { id: 'mobility',       label: 'Relocation',          icon: <Heart className="h-4 w-4" />,         sectionKeys: ['mobility_profile', 'family_profile'] },
  { id: 'confidentiality',label: 'Confidentiality',     icon: <Shield className="h-4 w-4" />,        sectionKeys: ['confidentiality_profile'] },
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
    role: '', sector: '', founderOperator: '', o1VisaHistory: '', yearsOnO1: '',
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
    children: [], admissionsDeadlines: '', continuityPriorities: '', specialRequirements: '',
  });
  const [business, setBusiness] = useState<BusinessProfile>({
    usEntities: '', ukEntities: '', bankingRelationships: '', complianceRequirements: '',
    revenueSources: '', currentContracts: '', registeredAgents: '', taxObligations: '',
  });
  const [financial, setFinancial] = useState<FinancialProfile>({
    liquidityLevel: '', urgencyLevel: '', runwayMonths: '', incomeStatus: '',
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
  const [professionalProfile, setProfessionalProfile] = useState<ProfessionalProfile>({
    sourceDocuments: [],
    currentRoles: [], education: [], publications: [], patents: [],
    awards: [], licenses: [], extraordinaryAbilityIndicators: [],
    principalApproved: false,
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
        if (c.capability_profile && Object.keys(c.capability_profile).length > 0) {
          const cap = c.capability_profile as Record<string, unknown>;
          setCapability(cap as unknown as typeof capability);
          if (cap.professionalProfile) setProfessionalProfile(cap.professionalProfile as ProfessionalProfile);
        }
        if (c.continuity_profile && Object.keys(c.continuity_profile).length > 0) setContinuity(c.continuity_profile);
        if (c.housing_profile && Object.keys(c.housing_profile).length > 0) setHousing(c.housing_profile);
        if (c.education_profile && Object.keys(c.education_profile).length > 0) {
          const ep = c.education_profile as Record<string, unknown>;
          setEducation({
            children: Array.isArray(ep.children) ? (ep.children as ChildRecord[]) : [],
            admissionsDeadlines: String(ep.admissionsDeadlines ?? ''),
            continuityPriorities: String(ep.continuityPriorities ?? ''),
            specialRequirements: String(ep.specialRequirements ?? ''),
            childrenDetails: ep.childrenDetails ? String(ep.childrenDetails) : undefined,
          });
        }
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
      if (stepIdx === 1) { payloads.capability_profile = { ...capability }; payloads.continuity_profile = continuity; }
      if (stepIdx === 2) {
        // Professional Profile — merge into capability_profile.professionalProfile
        payloads.capability_profile = { ...capability, professionalProfile };
      }
      if (stepIdx === 3) payloads.housing_profile = housing;
      if (stepIdx === 4) payloads.education_profile = education;
      if (stepIdx === 5) { payloads.business_profile = business; payloads.financial_profile = financial; }
      if (stepIdx === 6) { payloads.mobility_profile = mobility; payloads.family_profile = family; }
      if (stepIdx === 7) payloads.confidentiality_profile = confidentiality;

      const res = await personaFetch(`/api/mobility/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloads),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Save failed');
      setCompletedSections(json.case.intake_sections_complete ?? []);

      // Save critical dates on last step
      if (stepIdx === 7) {
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
  }, [caseId, household, capability, continuity, professionalProfile, housing, education, business, financial, mobility, family, confidentiality, criticalDates, onComplete]);

  const handleNext = useCallback(async () => {
    let failed = false;
    try { await saveStep(step); } catch { failed = true; }
    if (!failed) setStep(s => Math.min(s + 1, STEPS.length - 1));
  }, [step, saveStep]);

  // Save current step without advancing — used when re-editing a completed step
  const handleSaveOnly = useCallback(async () => {
    await saveStep(step);
  }, [step, saveStep]);

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
        {step === 2 && <StepProfessional caseId={caseId} profile={professionalProfile} setProfile={setProfessionalProfile} />}
        {step === 3 && <StepHousing state={housing} set={setHousing} />}
        {step === 4 && <StepEducation state={education} set={setEducation} />}
        {step === 5 && <StepBusiness bus={business} setBus={setBusiness} fin={financial} setFin={setFinancial} />}
        {step === 6 && <StepMobility mob={mobility} setMob={setMobility} fam={family} setFam={setFamily} />}
        {step === 7 && <StepConfidentiality conf={confidentiality} setConf={setConfidentiality} dates={criticalDates} setDates={setCriticalDates} />}
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
        <div className="flex items-center gap-2">
          {/* Show standalone Save when re-editing a completed step (not the last step) */}
          {isStepComplete(step) && step < STEPS.length - 1 && (
            <button
              onClick={handleSaveOnly}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {step === STEPS.length - 1 ? 'Save Changes' : (
              <>Save & Continue <ChevronRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
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
      <div className="grid grid-cols-2 gap-4">
        <Field label="Role / title *" hint="Required for SRB">
          <TextInput value={cap.role} onChange={uc('role')} placeholder="Founder & CEO / Technology Director…" />
        </Field>
        <Field label="Primary sector *" hint="Required for SRB">
          <TextInput value={cap.sector} onChange={uc('sector')} placeholder="AI / Web3 / Fintech / Deep Tech…" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Founder / operator?">
          <select className={inputCls} value={cap.founderOperator} onChange={e => uc('founderOperator')(e.target.value)}>
            <option value="">Select…</option>
            <option value="yes">Yes — active founder</option>
            <option value="prior">Prior founder — now advisory</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="O-1 / extraordinary ability visa?">
          <select className={inputCls} value={cap.o1VisaHistory} onChange={e => uc('o1VisaHistory')(e.target.value)}>
            <option value="">Select…</option>
            <option value="current">Yes — currently held</option>
            <option value="prior">Yes — prior holder</option>
            <option value="no">No</option>
          </select>
        </Field>
      </div>
      {cap.o1VisaHistory && cap.o1VisaHistory !== 'no' && (
        <Field label="Years on O-1">
          <TextInput value={cap.yearsOnO1} onChange={uc('yearsOnO1')} placeholder="e.g. 8 years" />
        </Field>
      )}
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
  const addChild = () => set(s => ({
    ...s,
    children: [...s.children, {
      childId: `c${Date.now()}`,
      age: '', currentGrade: '', yearGroup: '', currentSchool: '',
      targetSchool: '', alternativeSchools: '', continuityPriority: '', notes: '',
    }],
  }));

  const removeChild = (idx: number) => set(s => ({
    ...s, children: s.children.filter((_, i) => i !== idx),
  }));

  const updateChild = (idx: number, field: keyof ChildRecord, value: string) =>
    set(s => ({
      ...s,
      children: s.children.map((c, i) => i === idx ? { ...c, [field]: value } : c),
    }));

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Children (one card per child)</p>
        <button
          type="button"
          onClick={addChild}
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded px-2 py-1 transition-colors"
        >
          <Plus className="h-3 w-3" /> Add child
        </button>
      </div>

      {/* Legacy migration notice */}
      {state.childrenDetails && state.children.length === 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
          <p className="text-xs font-semibold text-amber-300">⚠ Previous text entry found — not usable for SRB</p>
          <p className="text-[11px] text-amber-300/70">Unstructured text cannot be used in deterministic SRB generation. Please add each child using the form above.</p>
          <p className="text-[11px] text-amber-400/50 font-mono mt-1">{state.childrenDetails}</p>
        </div>
      )}

      {state.children.length === 0 && !state.childrenDetails && (
        <p className="text-xs text-slate-500 py-2">No children added. Click "Add child" for each dependent child.</p>
      )}

      {state.children.map((child, idx) => (
        <div key={child.childId} className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Child {idx + 1}</span>
            <button type="button" onClick={() => removeChild(idx)} className="text-slate-500 hover:text-rose-400 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Age *" hint="Required for SRB">
              <TextInput value={child.age} onChange={v => updateChild(idx, 'age', v)} placeholder="e.g. 13" />
            </Field>
            <Field label="Current grade" hint="Local grade in origin country">
              <TextInput value={child.currentGrade} onChange={v => updateChild(idx, 'currentGrade', v)} placeholder="e.g. Grade 8 (US)" />
            </Field>
            <Field label="UK year group">
              <TextInput value={child.yearGroup} onChange={v => updateChild(idx, 'yearGroup', v)} placeholder="e.g. Year 9" />
            </Field>
          </div>
          <Field label="Current school (origin country)">
            <TextInput value={child.currentSchool} onChange={v => updateChild(idx, 'currentSchool', v)} placeholder="Current school name, state / city" />
          </Field>
          <Field label="Target school (destination) *" hint="Primary preference — appears in SRB exactly as entered">
            <TextInput value={child.targetSchool} onChange={v => updateChild(idx, 'targetSchool', v)} placeholder="Preferred school name" />
          </Field>
          <Field label="Alternative schools">
            <TextInput value={child.alternativeSchools} onChange={v => updateChild(idx, 'alternativeSchools', v)} placeholder="Comma-separated alternatives" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="School level">
              <select
                className={inputCls}
                value={child.continuityPriority}
                onChange={e => updateChild(idx, 'continuityPriority', e.target.value)}
              >
                <option value="">Select…</option>
                <option value="primary">Primary (ages 4–11)</option>
                <option value="secondary">Secondary (ages 11–16)</option>
                <option value="sixth_form">Sixth Form (16–18)</option>
                <option value="university">University</option>
              </select>
            </Field>
            <Field label="Notes (optional)">
              <TextInput value={child.notes} onChange={v => updateChild(idx, 'notes', v)} placeholder="SEND, EHC plan, specialist needs…" />
            </Field>
          </div>
        </div>
      ))}

      <Field label="Admissions deadlines">
        <TextInput value={state.admissionsDeadlines} onChange={v => set(s => ({ ...s, admissionsDeadlines: v }))} placeholder="e.g. September 2026 intake — local authority deadline" />
      </Field>
      <Field label="Special educational requirements (optional)">
        <TextInput value={state.specialRequirements} onChange={v => set(s => ({ ...s, specialRequirements: v }))} placeholder="Any SEND, EHC plans, or specialist provision needed" />
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
      <div className="grid grid-cols-2 gap-4">
        <Field label="Liquidity level *" hint="Required for SRB — do not leave blank">
          <select className={inputCls} value={fin.liquidityLevel} onChange={e => uf('liquidityLevel')(e.target.value)}>
            <option value="">Select…</option>
            <option value="high">High — 6+ months runway</option>
            <option value="medium">Medium — 3–6 months</option>
            <option value="low">Low — 1–3 months</option>
            <option value="critical">Critical — under 30 days</option>
          </select>
        </Field>
        <Field label="Urgency level *">
          <select className={inputCls} value={fin.urgencyLevel} onChange={e => uf('urgencyLevel')(e.target.value)}>
            <option value="">Select…</option>
            <option value="critical">Critical — immediate action required</option>
            <option value="high">High — within 30 days</option>
            <option value="medium">Medium — within 60 days</option>
            <option value="low">Low — planned transition</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Income status">
          <select className={inputCls} value={fin.incomeStatus} onChange={e => uf('incomeStatus')(e.target.value)}>
            <option value="">Select…</option>
            <option value="active">Active — ongoing revenue</option>
            <option value="transitional">Transitional — reduced / variable</option>
            <option value="deferred">Deferred — income pending</option>
            <option value="none">None currently</option>
          </select>
        </Field>
        <Field label="Runway (months)">
          <TextInput value={fin.runwayMonths} onChange={uf('runwayMonths')} placeholder="e.g. 2 months / 6 months" />
        </Field>
      </div>
      <Field label="Immediate financial risks">
        <TextArea value={fin.immediateFinancialRisks} onChange={uf('immediateFinancialRisks')} placeholder="Housing deadline, outstanding debts, payroll…" rows={2} />
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

// ─── FactRow (module-level — must not be defined inside StepProfessional) ────

type FactRowProps = {
  fact: ProfessionalFact;
  category: keyof Pick<ProfessionalProfile, 'currentRoles' | 'education' | 'publications' | 'patents' | 'awards' | 'licenses' | 'extraordinaryAbilityIndicators'>;
  summary: string;
  onToggle: (category: FactRowProps['category'], factId: string) => void;
  onRemove: (category: FactRowProps['category'], factId: string) => void;
};

function FactRow({ fact, category, summary, onToggle, onRemove }: FactRowProps) {
  return (
    <div className={cls(
      'flex items-start gap-2 rounded-lg border px-3 py-2',
      fact.principalApproved
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : 'border-slate-700 bg-slate-800/50',
    )}>
      <button
        type="button"
        onClick={() => onToggle(category, fact.factId)}
        className={cls('mt-0.5 h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors', fact.principalApproved ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-500')}
      >
        {fact.principalApproved && <CheckCircle2 className="h-3 w-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-200">{summary}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          {fact.confidence === 'PRINCIPAL_VERIFIED' ? '✓ Verified' : 'SOURCE_DERIVED — approve to use in SRB'}
          {fact.sourceUrl ? ` · ${fact.sourceUrl}` : ''}
        </p>
      </div>
      <button type="button" onClick={() => onRemove(category, fact.factId)} className="text-slate-600 hover:text-rose-400 shrink-0">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── StepProfessional ────────────────────────────────────────────────────────

function StepProfessional({
  caseId,
  profile,
  setProfile,
}: {
  caseId: string;
  profile: ProfessionalProfile;
  setProfile: React.Dispatch<React.SetStateAction<ProfessionalProfile>>;
}) {
  const [sourceType, setSourceType] = useState<string>('linkedin');
  const [sourceUrl, setSourceUrl]   = useState<string>('');
  const [sourceText, setSourceText] = useState<string>('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [candidate, setCandidate]   = useState<Partial<ProfessionalProfile> | null>(null);

  const extract = async () => {
    if (!sourceText.trim()) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await personaFetch(`/api/mobility/cases/${caseId}/professional-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: sourceType, source_url: sourceUrl, source_text: sourceText }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Extraction failed');
      setCandidate(json.candidate);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setExtracting(false);
    }
  };

  const approveAll = () => {
    if (!candidate) return;
    const merge = (arr: ProfessionalFact[]) =>
      arr.map(f => ({ ...f, principalApproved: true, confidence: 'PRINCIPAL_VERIFIED' as const }));
    setProfile(p => ({
      ...p,
      sourceDocuments: sourceUrl
        ? [...p.sourceDocuments, { type: sourceType, url: sourceUrl, lastVerified: new Date().toISOString() }]
        : p.sourceDocuments,
      currentRoles: [...p.currentRoles, ...merge((candidate.currentRoles ?? []) as ProfessionalFact[])],
      education: [...p.education, ...merge((candidate.education ?? []) as ProfessionalFact[])],
      publications: [...p.publications, ...merge((candidate.publications ?? []) as ProfessionalFact[])],
      patents: [...p.patents, ...merge((candidate.patents ?? []) as ProfessionalFact[])],
      awards: [...p.awards, ...merge((candidate.awards ?? []) as ProfessionalFact[])],
      licenses: [...p.licenses, ...merge((candidate.licenses ?? []) as ProfessionalFact[])],
      extraordinaryAbilityIndicators: [...p.extraordinaryAbilityIndicators, ...merge((candidate.extraordinaryAbilityIndicators ?? []) as ProfessionalFact[])],
    }));
    setCandidate(null);
    setSourceText('');
    setSourceUrl('');
  };

  const toggleApprove = (
    category: keyof Pick<ProfessionalProfile, 'currentRoles' | 'education' | 'publications' | 'patents' | 'awards' | 'licenses' | 'extraordinaryAbilityIndicators'>,
    factId: string,
  ) => {
    setProfile(p => ({
      ...p,
      [category]: (p[category] as ProfessionalFact[]).map(f =>
        f.factId === factId
          ? { ...f, principalApproved: !f.principalApproved, confidence: (!f.principalApproved ? 'PRINCIPAL_VERIFIED' : 'SOURCE_DERIVED') as FactConfidence }
          : f
      ),
    }));
  };

  const removeFact = (
    category: keyof Pick<ProfessionalProfile, 'currentRoles' | 'education' | 'publications' | 'patents' | 'awards' | 'licenses' | 'extraordinaryAbilityIndicators'>,
    factId: string,
  ) => {
    setProfile(p => ({ ...p, [category]: (p[category] as ProfessionalFact[]).filter(f => f.factId !== factId) }));
  };

  const lockProfile = () => setProfile(p => ({ ...p, principalApproved: true, approvedAt: new Date().toISOString() }));
  const unlockProfile = () => setProfile(p => ({ ...p, principalApproved: false, approvedAt: undefined }));

  const approvedCount = [
    ...profile.currentRoles, ...profile.education, ...profile.publications,
    ...profile.patents, ...profile.awards, ...profile.licenses, ...profile.extraordinaryAbilityIndicators,
  ].filter(f => f.principalApproved).length;

  const totalCount = profile.currentRoles.length + profile.education.length + profile.publications.length +
    profile.patents.length + profile.awards.length + profile.licenses.length + profile.extraordinaryAbilityIndicators.length;

  return (
    <>
      {/* Lock status */}
      {profile.principalApproved ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-xs font-semibold text-emerald-200">Profile locked — {approvedCount} verified facts</p>
              {profile.approvedAt && <p className="text-[10px] text-emerald-400/60">Locked {new Date(profile.approvedAt).toLocaleDateString()}</p>}
            </div>
          </div>
          <button onClick={unlockProfile} className="text-[10px] text-slate-400 hover:text-slate-200 border border-slate-600 rounded px-2 py-1">Unlock to edit</button>
        </div>
      ) : totalCount > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <p className="text-xs text-amber-200">{approvedCount}/{totalCount} facts approved — lock profile to use in SRB</p>
          <button
            onClick={lockProfile}
            disabled={approvedCount === 0}
            className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
          >
            <Lock className="h-3 w-3" /> Lock profile
          </button>
        </div>
      ) : null}

      {/* Source import */}
      {!profile.principalApproved && (
        <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <p className="text-xs font-semibold text-slate-300">Import from source</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source type">
              <select className={inputCls} value={sourceType} onChange={e => setSourceType(e.target.value)}>
                <option value="linkedin">LinkedIn</option>
                <option value="cv">CV / Résumé</option>
                <option value="patent_record">Patent record</option>
                <option value="publication">Publication</option>
                <option value="award_citation">Award citation</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Source URL (optional)">
              <div className="relative">
                <Link className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input className={`${inputCls} pl-8`} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
              </div>
            </Field>
          </div>
          <Field label="Paste source text" hint="Paste LinkedIn About + Experience section, CV text, or bio. aigentMe will extract structured facts — you approve each one.">
            <textarea
              className={textareaCls}
              rows={6}
              value={sourceText}
              onChange={e => setSourceText(e.target.value)}
              placeholder="Paste LinkedIn profile text, CV, patent abstract, bio, or any document text here…"
            />
          </Field>
          {extractError && (
            <p className="text-xs text-rose-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {extractError}</p>
          )}
          <button
            onClick={extract}
            disabled={extracting || !sourceText.trim()}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Extract & review facts
          </button>
        </div>
      )}

      {/* Candidate review */}
      {candidate && !profile.principalApproved && (
        <div className="space-y-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-violet-200">Extracted facts — review and approve</p>
            <button onClick={approveAll} className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded px-2 py-1">Approve all</button>
          </div>
          {(candidate.currentRoles ?? []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Roles</p>
              {(candidate.currentRoles as RoleFact[]).map((f, i) => (
                <div key={i} className="rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-xs text-slate-200">
                  {f.title} @ {f.organization}{f.isCurrent ? ' (current)' : ''}
                </div>
              ))}
            </div>
          )}
          {(candidate.education ?? []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Education</p>
              {(candidate.education as EducationFact[]).map((f, i) => (
                <div key={i} className="rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-xs text-slate-200">
                  {f.degree || 'Study'} at {f.institution}{f.years ? ` (${f.years})` : ''}
                </div>
              ))}
            </div>
          )}
          {(candidate.publications ?? []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Publications</p>
              {(candidate.publications as PublicationFact[]).map((f, i) => (
                <div key={i} className="rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-xs text-slate-200">{f.title}{f.year ? ` (${f.year})` : ''}</div>
              ))}
            </div>
          )}
          {(candidate.patents ?? []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Patents</p>
              {(candidate.patents as PatentFact[]).map((f, i) => (
                <div key={i} className="rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-xs text-slate-200">{f.title}{f.number ? ` (${f.number})` : ''}{f.year ? ` · ${f.year}` : ''}</div>
              ))}
            </div>
          )}
          {(candidate.awards ?? []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Awards & recognition</p>
              {(candidate.awards as AwardFact[]).map((f, i) => (
                <div key={i} className="rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-xs text-slate-200">{f.title}{f.issuer ? ` — ${f.issuer}` : ''}{f.year ? ` (${f.year})` : ''}</div>
              ))}
            </div>
          )}
          {(candidate.extraordinaryAbilityIndicators ?? []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Extraordinary ability indicators</p>
              {(candidate.extraordinaryAbilityIndicators as EAIFact[]).map((f, i) => (
                <div key={i} className="rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-xs text-slate-200">{f.description} <span className="text-slate-500">({f.category})</span></div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-violet-300/60">Click "Approve all" to accept these facts into your profile, or approve them individually after adding.</p>
        </div>
      )}

      {/* Approved facts */}
      {totalCount > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Profile facts</p>
          {profile.currentRoles.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Roles</p>
              {profile.currentRoles.map(f => (
                <FactRow key={f.factId} fact={f} category="currentRoles" summary={`${f.title} @ ${f.organization}${f.isCurrent ? ' (current)' : ''}`} onToggle={toggleApprove} onRemove={removeFact} />
              ))}
            </div>
          )}
          {profile.education.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Education</p>
              {profile.education.map(f => (
                <FactRow key={f.factId} fact={f} category="education" summary={`${f.degree || 'Study'} at ${f.institution}${f.years ? ` (${f.years})` : ''}`} onToggle={toggleApprove} onRemove={removeFact} />
              ))}
            </div>
          )}
          {profile.publications.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Publications</p>
              {profile.publications.map(f => (
                <FactRow key={f.factId} fact={f} category="publications" summary={`${f.title}${f.year ? ` (${f.year})` : ''}`} onToggle={toggleApprove} onRemove={removeFact} />
              ))}
            </div>
          )}
          {profile.patents.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Patents</p>
              {profile.patents.map(f => (
                <FactRow key={f.factId} fact={f} category="patents" summary={`${f.title}${f.number ? ` (${f.number})` : ''}${f.year ? ` · ${f.year}` : ''}`} onToggle={toggleApprove} onRemove={removeFact} />
              ))}
            </div>
          )}
          {profile.awards.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Awards & recognition</p>
              {profile.awards.map(f => (
                <FactRow key={f.factId} fact={f} category="awards" summary={`${f.title}${f.issuer ? ` — ${f.issuer}` : ''}${f.year ? ` (${f.year})` : ''}`} onToggle={toggleApprove} onRemove={removeFact} />
              ))}
            </div>
          )}
          {profile.licenses.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Licences</p>
              {profile.licenses.map(f => (
                <FactRow key={f.factId} fact={f} category="licenses" summary={`${f.title}${f.issuer ? ` — ${f.issuer}` : ''}${f.year ? ` (${f.year})` : ''}`} onToggle={toggleApprove} onRemove={removeFact} />
              ))}
            </div>
          )}
          {profile.extraordinaryAbilityIndicators.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Extraordinary ability indicators</p>
              {profile.extraordinaryAbilityIndicators.map(f => (
                <FactRow key={f.factId} fact={f} category="extraordinaryAbilityIndicators" summary={`${f.description} (${f.category})`} onToggle={toggleApprove} onRemove={removeFact} />
              ))}
            </div>
          )}
        </div>
      )}

      {totalCount === 0 && !candidate && (
        <p className="text-xs text-slate-500 py-4 text-center">
          No professional facts yet. Paste source text above and click &ldquo;Extract &amp; review facts&rdquo; to begin.
        </p>
      )}
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
          aigentMe functions as the family&apos;s confidentiality guardian and disclosure broker.
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

