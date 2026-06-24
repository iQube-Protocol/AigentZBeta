"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { personaFetch } from '@/utils/personaSpine';
import {
  Star, Plus, CheckCircle2, XCircle,
  Edit2, RefreshCw, Link2, FileText, Loader2, AlertCircle,
  Lock, Package, GitBranch, Sparkles, ChevronDown, ChevronRight,
  Upload, X as XIcon, Wand2, ShieldCheck, Rocket, Layers, Compass,
} from 'lucide-react';
import { StandingCoreWizard } from '@/components/metame/setup/StandingCoreWizard';
import { VentureLightWizard } from '@/components/metame/setup/VentureLightWizard';
import { VentureProWizard } from '@/components/metame/setup/VentureProWizard';
import { VenturePortfolioWizard } from '@/components/metame/setup/VenturePortfolioWizard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VspProfile {
  id: string;
  label: string;
  profile_type: string;
  status: string;
  compiled_at: string | null;
  created_at: string;
  updated_at: string;
  vsp_content?: Record<string, unknown> | null;
  standing_graph?: StandingGraph | null;
}

/** The auto-created Standing Core profile label (see services/standing/standingCore.ts). */
const CORE_PROFILE_LABEL = 'Standing Core';

/** Normalised match so trailing-space / case variants of the core label still collapse. */
function isCoreLabel(label: string): boolean {
  return (label ?? '').trim().toLowerCase() === CORE_PROFILE_LABEL.toLowerCase();
}

/**
 * Defensive dedupe: exactly one "Standing Core" profile should ever exist, but
 * historical rows created before the backend dedupe fix can leave two. Collapse
 * all "Standing Core" profiles to the earliest-created one so the UI never
 * renders two Core tabs, regardless of DB state. Non-core profiles pass through
 * untouched (operators may name custom profiles freely).
 */
function dedupeCoreProfiles(profiles: VspProfile[]): VspProfile[] {
  const cores = profiles.filter((p) => isCoreLabel(p.label));
  if (cores.length <= 1) return profiles;
  const keepId = cores
    .slice()
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))[0].id;
  return profiles.filter((p) => !isCoreLabel(p.label) || p.id === keepId);
}

interface VspEvidence {
  id: string;
  source_type: string;
  label: string;
  content_text: string;
  extraction_status: string;
  extracted_fact_count: number;
  extracted_at: string | null;
  created_at: string;
  classification: string;
  disclosure_policy: string;
  verification_status: string;
  source_provenance: string | null;
}

interface StandingGraphClaim {
  id: string;
  label: string;
  category: string;
  confidence_level: string;
  supporting_evidence_count: number;
}

interface StandingGraphEdge {
  from_domain: string;
  from_field: string;
  to_claim_id: string;
  weight: number;
  rationale: string;
}

interface StandingGraph {
  built_at: string;
  capability_claims: StandingGraphClaim[];
  edges: StandingGraphEdge[];
}

interface VspFact {
  id: string;
  evidence_id: string | null;
  domain: string;
  field: string;
  label: string;
  extracted_value: string;
  confidence: string;
  status: string;
  principal_value: string | null;
  approved_at: string | null;
  locked_at: string | null;
  created_at: string;
}

interface MobilityCase {
  id: string;
  case_type: string;
  case_status: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PROFILE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'o1', label: 'O-1 Visa' },
  { value: 'eb1', label: 'EB-1' },
  { value: 'global_talent', label: 'Global Talent' },
  { value: 'founder', label: 'Founder' },
  { value: 'executive', label: 'Executive' },
  { value: 'academic', label: 'Academic' },
];

const SOURCE_TYPES = [
  { group: 'Identity', value: 'passport', label: 'Passport' },
  { group: 'Identity', value: 'national_id', label: 'National ID' },
  { group: 'Identity', value: 'birth_certificate', label: 'Birth Certificate' },
  { group: 'Identity', value: 'citizenship_record', label: 'Citizenship Record' },
  { group: 'Identity', value: 'visa_record', label: 'Visa Record' },
  { group: 'Identity', value: 'residency_record', label: 'Residency Record' },
  { group: 'Education', value: 'academic_transcript', label: 'Academic Transcript' },
  { group: 'Education', value: 'degree_certificate', label: 'Degree Certificate' },
  { group: 'Education', value: 'professional_qualification', label: 'Professional Qualification' },
  { group: 'Education', value: 'professional_license', label: 'Professional License' },
  { group: 'Education', value: 'training_record', label: 'Training Record' },
  { group: 'Professional', value: 'cv', label: 'CV / Resume' },
  { group: 'Professional', value: 'linkedin', label: 'LinkedIn Profile' },
  { group: 'Professional', value: 'employment_record', label: 'Employment Record' },
  { group: 'Professional', value: 'executive_appointment', label: 'Executive Appointment' },
  { group: 'Professional', value: 'board_membership', label: 'Board Membership' },
  { group: 'Founder', value: 'company_record', label: 'Company Record' },
  { group: 'Founder', value: 'patent', label: 'Patent' },
  { group: 'Founder', value: 'startup_record', label: 'Startup Record' },
  { group: 'Founder', value: 'fundraising_record', label: 'Fundraising Record' },
  { group: 'Publications', value: 'published_article', label: 'Published Article' },
  { group: 'Publications', value: 'book', label: 'Book / Chapter' },
  { group: 'Publications', value: 'white_paper', label: 'White Paper' },
  { group: 'Publications', value: 'research_paper', label: 'Research Paper' },
  { group: 'Publications', value: 'technical_publication', label: 'Technical Publication' },
  { group: 'Media', value: 'media_interview', label: 'Media Interview' },
  { group: 'Media', value: 'press_coverage', label: 'Press Coverage' },
  { group: 'Media', value: 'podcast_appearance', label: 'Podcast Appearance' },
  { group: 'Media', value: 'television_appearance', label: 'Television Appearance' },
  { group: 'Media', value: 'documentary', label: 'Documentary' },
  { group: 'Media', value: 'publication_feature', label: 'Publication Feature' },
  { group: 'Speaking', value: 'conference_presentation', label: 'Conference Presentation' },
  { group: 'Speaking', value: 'keynote', label: 'Keynote' },
  { group: 'Speaking', value: 'panel_appearance', label: 'Panel Appearance' },
  { group: 'Speaking', value: 'guest_lecture', label: 'Guest Lecture' },
  { group: 'Speaking', value: 'roundtable', label: 'Roundtable' },
  { group: 'Recognition', value: 'award_record', label: 'Award Record' },
  { group: 'Recognition', value: 'industry_distinction', label: 'Industry Distinction' },
  { group: 'Validation', value: 'reference_letter', label: 'Reference Letter' },
  { group: 'Immigration', value: 'o1_petition', label: 'O-1 Petition' },
  { group: 'Immigration', value: 'eb1_petition', label: 'EB-1 Petition' },
  { group: 'Immigration', value: 'global_talent_application', label: 'Global Talent Application' },
  { group: 'Other', value: 'other', label: 'Other' },
];

const CLASSIFICATION_OPTIONS = [
  { value: 'WHITE', label: 'WHITE — Public', description: 'Publicly available information' },
  { value: 'GREY', label: 'GREY — Limited', description: 'CVs, professional profiles, reference lists' },
  { value: 'BLACK', label: 'BLACK — Sensitive', description: 'Passports, transcripts, private contracts' },
  { value: 'BLAKQUBE', label: 'BLAKQUBE — Highly Sensitive', description: 'Financial records, immigration filings, personal correspondence' },
];

const DOMAIN_LABELS: Record<string, string> = {
  identity: 'Identity',
  education: 'Education',
  professional: 'Professional',
  founder: 'Founder',
  recognition: 'Recognition',
  publications: 'Publications',
  media: 'Media',
  speaking: 'Speaking',
  validation: 'Validation',
  extraordinary_ability: 'Extraordinary Ability',
};

const DOMAIN_ORDER = [
  'identity','education','professional','founder','recognition',
  'publications','media','speaking','validation','extraordinary_ability',
];

const OUTPUT_TYPES = [
  { value: 'biography', label: 'Professional Biography' },
  { value: 'executive_biography', label: 'Executive Biography' },
  { value: 'speaker_bio', label: 'Speaker Bio' },
  { value: 'cv', label: 'CV Summary (JSON)' },
  { value: 'founder_profile', label: 'Founder Profile' },
  { value: 'investor_profile', label: 'Investor Profile' },
  { value: 'media_profile', label: 'Media Profile' },
  { value: 'linkedin_summary', label: 'LinkedIn Summary' },
  { value: 'board_biography', label: 'Board Biography' },
  { value: 'capability_assessment', label: 'Capability Assessment (JSON)' },
  { value: 'mobility_profile_summary', label: 'Mobility Profile Summary' },
];

// ─── Badge helpers ────────────────────────────────────────────────────────────

function ExtractionBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-slate-700 text-slate-300',
    extracting: 'bg-amber-900/60 text-amber-300',
    extracted: 'bg-emerald-900/60 text-emerald-300',
    failed: 'bg-rose-900/60 text-rose-300',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-slate-700 text-slate-300'}`}>
      {status}
    </span>
  );
}

function FactStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-slate-700 text-slate-300',
    approved: 'bg-emerald-900/60 text-emerald-300',
    rejected: 'bg-rose-900/60 text-rose-300',
    corrected: 'bg-violet-900/60 text-violet-300',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-slate-700 text-slate-300'}`}>
      {status}
    </span>
  );
}

function ClassificationBadge({ classification }: { classification: string }) {
  const map: Record<string, string> = {
    WHITE: 'bg-slate-700 text-slate-300',
    GREY: 'bg-slate-700/80 text-slate-400',
    BLACK: 'bg-slate-900 text-slate-400 border border-slate-600',
    BLAKQUBE: 'bg-black text-violet-400 border border-violet-800',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${map[classification] ?? 'bg-slate-700 text-slate-400'}`}>
      {classification}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const map: Record<string, string> = {
    DOCUMENT_VERIFIED: 'text-blue-400',
    PRINCIPAL_VERIFIED: 'text-violet-400',
    AGENT_VERIFIED: 'text-amber-400',
    UNKNOWN: 'text-slate-500',
  };
  return (
    <span className={`text-xs font-mono ${map[confidence] ?? 'text-slate-500'}`}>
      {confidence.replace('_', ' ')}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface StandingCartridgeTabProps {
  personaId?: string;
  isAdmin?: boolean;
}

export function StandingCartridgeTab({ personaId: _personaId, isAdmin: _isAdmin }: StandingCartridgeTabProps) {
  const [profiles, setProfiles] = useState<VspProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<VspProfile | null>(null);
  const [evidence, setEvidence] = useState<VspEvidence[]>([]);
  const [facts, setFacts] = useState<VspFact[]>([]);
  const [cases, setCases] = useState<MobilityCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wizard launcher — parity with aigentMe. Citizens can build their Standing
  // Graph via the guided wizards here too. Gated by wizardAccess from the plan.
  const [wizardAccess, setWizardAccess] = useState<{
    core: boolean; light: boolean; pro: boolean; operatingModel: boolean; portfolio: boolean;
  } | null>(null);
  const [coreWizardOpen, setCoreWizardOpen] = useState(false);
  const [lightWizardOpen, setLightWizardOpen] = useState(false);
  const [proWizardOpen, setProWizardOpen] = useState(false);
  const [portfolioWizardOpen, setPortfolioWizardOpen] = useState(false);
  // Portfolio wizard doubles as the Operating Brief surface (operating mode is
  // any Founder Office tier; portfolio mode is Operator Pro/Elite).
  const [portfolioWizardMode, setPortfolioWizardMode] = useState<'portfolio' | 'operating'>('portfolio');
  useEffect(() => {
    void (async () => {
      try {
        const res = await personaFetch('/api/billing/plan', { personaIdHint: _personaId, cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.ok && data.wizardAccess) setWizardAccess(data.wizardAccess);
      } catch { /* best-effort */ }
    })();
  }, [_personaId]);

  // Create profile form
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState('Standing Profile');
  const [newType, setNewType] = useState('general');
  const [creating, setCreating] = useState(false);

  // Evidence form
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evSourceType, setEvSourceType] = useState('cv');
  const [evLabel, setEvLabel] = useState('');
  const [evContent, setEvContent] = useState('');
  const [evClassification, setEvClassification] = useState('GREY');
  const [evProvenance, setEvProvenance] = useState('');
  const [addingEvidence, setAddingEvidence] = useState(false);

  // File upload state
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extracting state per evidence
  const [extracting, setExtracting] = useState<Record<string, boolean>>({});

  // Fact correction state
  const [correctingFact, setCorrectingFact] = useState<string | null>(null);
  const [correctionValue, setCorrectionValue] = useState('');
  const [factActioning, setFactActioning] = useState<Record<string, boolean>>({});

  // Compile
  const [compiling, setCompiling] = useState(false);

  // Standing Asset Graph
  const [buildingGraph, setBuildingGraph] = useState(false);
  const [graphExpanded, setGraphExpanded] = useState(false);

  // Output generation
  const [showGenerate, setShowGenerate] = useState(false);
  const [genOutputType, setGenOutputType] = useState('biography');
  const [genContext, setGenContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState<string | null>(null);

  // Vault (Walrus/Sui) per evidence
  const [vaulting, setVaulting] = useState<Record<string, boolean>>({});

  // Link case
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [linking, setLinking] = useState(false);

  const loadProfile = useCallback(async (profileId: string) => {
    try {
      const res = await personaFetch(`/api/vsp/profiles/${profileId}`);
      const json = await res.json();
      if (json.ok) {
        setActiveProfile(json.profile);
        setEvidence(json.evidence ?? []);
        setFacts(json.facts ?? []);
      }
    } catch {
      setError('Failed to load profile details');
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch('/api/vsp/profiles');
      const json = await res.json();
      if (json.ok) {
        const deduped = dedupeCoreProfiles(json.profiles ?? []);
        setProfiles(deduped);
        if (deduped.length > 0) {
          await loadProfile(deduped[0].id);
        }
      } else {
        setError(json.error ?? 'Failed to load profiles');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  const loadCases = useCallback(async () => {
    try {
      const res = await personaFetch('/api/mobility/cases');
      const json = await res.json();
      if (json.ok) setCases(json.cases ?? []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    loadCases();
  }, [loadProfiles, loadCases]);

  // Create profile
  async function handleCreate() {
    setCreating(true);
    try {
      const res = await personaFetch('/api/vsp/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel, profile_type: newType }),
      });
      const json = await res.json();
      if (json.ok) {
        setProfiles(prev => [json.profile, ...prev]);
        await loadProfile(json.profile.id);
        setShowCreate(false);
        setNewLabel('Standing Profile');
        setNewType('general');
      } else {
        setError(json.error ?? 'Failed to create profile');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  }

  // Add evidence
  async function handleAddEvidence() {
    if (!activeProfile || !evLabel) return;
    setAddingEvidence(true);
    try {
      const res = await personaFetch(`/api/vsp/profiles/${activeProfile.id}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: evSourceType,
          label: evLabel,
          content_text: evContent,
          classification: evClassification,
          source_provenance: evProvenance || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setEvidence(prev => [...prev, json.evidence]);
        setShowAddEvidence(false);
        setEvLabel('');
        setEvContent('');
        setEvSourceType('cv');
        setEvClassification('GREY');
        setEvProvenance('');
      } else {
        setError(json.error ?? 'Failed to add evidence');
      }
    } catch {
      setError('Network error');
    } finally {
      setAddingEvidence(false);
    }
  }

  // Upload file evidence
  async function handleUploadFile() {
    if (!activeProfile || !uploadFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('source_type', evSourceType);
      fd.append('label', evLabel || uploadFile.name);
      fd.append('classification', evClassification);
      if (evProvenance) fd.append('source_provenance', evProvenance);

      const res = await personaFetch(
        `/api/vsp/profiles/${activeProfile.id}/evidence/upload`,
        { method: 'POST', body: fd },
      );
      const json = await res.json();
      if (json.ok) {
        setEvidence(prev => [...prev, json.evidence]);
        setShowAddEvidence(false);
        setUploadFile(null);
        setEvLabel('');
        setEvSourceType('cv');
        setEvClassification('GREY');
        setEvProvenance('');
      } else {
        setError(json.error ?? 'Upload failed');
      }
    } catch {
      setError('Upload network error');
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(file: File | null) {
    if (!file) return;
    setUploadFile(file);
    if (!evLabel) setEvLabel(file.name.replace(/\.[^.]+$/, ''));
  }

  // Extract facts
  async function handleExtract(evidenceId: string) {
    if (!activeProfile) return;
    setExtracting(prev => ({ ...prev, [evidenceId]: true }));
    try {
      const res = await personaFetch(
        `/api/vsp/profiles/${activeProfile.id}/evidence/${evidenceId}/extract`,
        { method: 'POST' },
      );
      const json = await res.json();
      if (json.ok) {
        await loadProfile(activeProfile.id);
      } else {
        setError(json.error ?? 'Extraction failed');
      }
    } catch {
      setError('Extraction network error');
    } finally {
      setExtracting(prev => ({ ...prev, [evidenceId]: false }));
    }
  }

  // Vault evidence to Standing Vault (Walrus/Sui)
  async function handleVault(evidenceId: string) {
    if (!activeProfile) return;
    setVaulting(prev => ({ ...prev, [evidenceId]: true }));
    try {
      const res = await personaFetch(
        `/api/vsp/profiles/${activeProfile.id}/evidence/${evidenceId}/vault`,
        { method: 'POST' },
      );
      const json = await res.json();
      if (json.ok) {
        await loadProfile(activeProfile.id);
      } else {
        setError(json.error ?? 'Vault failed');
      }
    } catch {
      setError('Vault network error');
    } finally {
      setVaulting(prev => ({ ...prev, [evidenceId]: false }));
    }
  }

  // Fact action
  async function handleFactAction(
    factId: string,
    action: 'approve' | 'reject' | 'correct',
    correctedValue?: string,
  ) {
    setFactActioning(prev => ({ ...prev, [factId]: true }));
    try {
      const body: Record<string, unknown> = { action };
      if (correctedValue !== undefined) body.corrected_value = correctedValue;
      const res = await personaFetch(`/api/vsp/facts/${factId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) {
        setFacts(prev => prev.map(f => f.id === factId ? json.fact : f));
        setCorrectingFact(null);
        setCorrectionValue('');
      } else {
        setError(json.error ?? 'Action failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setFactActioning(prev => ({ ...prev, [factId]: false }));
    }
  }

  // Compile
  async function handleCompile() {
    if (!activeProfile) return;
    setCompiling(true);
    try {
      const res = await personaFetch(`/api/vsp/profiles/${activeProfile.id}/compile`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.ok) {
        await loadProfile(activeProfile.id);
      } else {
        setError(json.error ?? 'Compile failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setCompiling(false);
    }
  }

  // Link case
  async function handleLinkCase() {
    if (!activeProfile || !selectedCaseId) return;
    setLinking(true);
    try {
      const res = await personaFetch(`/api/vsp/profiles/${activeProfile.id}/link-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: selectedCaseId }),
      });
      const json = await res.json();
      if (!json.ok) setError(json.error ?? 'Link failed');
    } catch {
      setError('Network error');
    } finally {
      setLinking(false);
    }
  }

  // Build Standing Asset Graph
  async function handleBuildGraph() {
    if (!activeProfile) return;
    setBuildingGraph(true);
    try {
      const res = await personaFetch(`/api/vsp/profiles/${activeProfile.id}/graph`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        setActiveProfile(prev => prev ? { ...prev, standing_graph: json.graph } : prev);
        setGraphExpanded(true);
      } else {
        setError(json.error ?? 'Graph build failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setBuildingGraph(false);
    }
  }

  // Generate output
  async function handleGenerate() {
    if (!activeProfile) return;
    setGenerating(true);
    setGeneratedOutput(null);
    try {
      const res = await personaFetch(`/api/vsp/profiles/${activeProfile.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output_type: genOutputType, context: genContext || undefined }),
      });
      const json = await res.json();
      if (json.ok) {
        const out = typeof json.output === 'string' ? json.output : JSON.stringify(json.output, null, 2);
        setGeneratedOutput(out);
      } else {
        setError(json.error ?? 'Generation failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setGenerating(false);
    }
  }

  // Group facts by domain
  const factsByDomain: Record<string, VspFact[]> = {};
  for (const fact of facts) {
    if (!factsByDomain[fact.domain]) factsByDomain[fact.domain] = [];
    factsByDomain[fact.domain].push(fact);
  }

  const approvedCount = facts.filter(f => f.status === 'approved' || f.status === 'corrected').length;

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading standing profiles…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-white">Standing Cartridge</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Verified Standing Profile — evidence-derived capability and reputation profile
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Profile
          </button>
        )}
      </div>

      {/* Guided wizards — parity with aigentMe. Build your Standing Graph via
          the guided flow, or use the manual evidence intake below. The venture
          wizards unlock with Founder Office / Venture Lab access. */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white">Guided wizards</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 snap-x [scrollbar-width:thin]">
          <button
            type="button"
            onClick={() => setCoreWizardOpen(true)}
            className="text-left rounded-lg border border-violet-500/40 bg-violet-500/10 p-3 hover:bg-violet-500/20 transition-colors shrink-0 w-56 snap-start"
          >
            <div className="flex items-center gap-1.5 text-sm font-medium text-violet-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Standing Core
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Attest who you are + your intent → Standing Graph.</p>
            <span className="inline-block mt-1.5 text-[9px] uppercase tracking-wider text-emerald-300">Free · available</span>
          </button>

          <button
            type="button"
            onClick={() => setLightWizardOpen(true)}
            className="text-left rounded-lg border border-violet-500/40 bg-violet-500/10 p-3 hover:bg-violet-500/20 transition-colors shrink-0 w-56 snap-start"
          >
            <div className="flex items-center gap-1.5 text-sm font-medium text-violet-200">
              <Sparkles className="w-3.5 h-3.5" /> Venture Light
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Incubate one venture (the essentials).</p>
            <span className="inline-block mt-1.5 text-[9px] uppercase tracking-wider text-emerald-300">Free · available</span>
          </button>

          {/* Venture Pro — gated by wizardAccess.pro (Venture Lab Lite+). The
              wizard itself shows a locked upgrade panel when access is absent,
              so the card always opens it (discoverable paywall). */}
          <button
            type="button"
            onClick={() => setProWizardOpen(true)}
            className={`text-left rounded-lg border p-3 transition-colors shrink-0 w-56 snap-start ${
              wizardAccess?.pro
                ? 'border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20'
                : 'border-slate-700/60 bg-slate-900/40 hover:bg-slate-800/60'
            }`}
            title={wizardAccess?.pro ? 'Venture Pro' : 'Venture Pro — upgrade to unlock'}
          >
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
              <Rocket className="w-3.5 h-3.5" /> Venture Pro
              {!wizardAccess?.pro && <Lock className="w-3 h-3 text-slate-500" />}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Full 13-layer VentureQube.</p>
            <span className={`inline-block mt-1.5 text-[9px] uppercase tracking-wider ${wizardAccess?.pro ? 'text-emerald-300' : 'text-slate-500'}`}>
              {wizardAccess?.pro ? 'Available' : 'Upgrade to unlock'}
            </span>
          </button>

          {/* Operating Brief — any Founder Office tier (Operator+). Ships with the
              Pro schema; not gated behind the portfolio. */}
          <button
            type="button"
            onClick={() => { setPortfolioWizardMode('operating'); setPortfolioWizardOpen(true); }}
            className={`text-left rounded-lg border p-3 transition-colors shrink-0 w-56 snap-start ${
              wizardAccess?.operatingModel
                ? 'border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20'
                : 'border-slate-700/60 bg-slate-900/40 hover:bg-slate-800/60'
            }`}
            title={wizardAccess?.operatingModel ? 'Operating Brief' : 'Operating Brief — enter the Founder Office to unlock'}
          >
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
              <Compass className="w-3.5 h-3.5" /> Operating Brief
              {!wizardAccess?.operatingModel && <Lock className="w-3 h-3 text-slate-500" />}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Your Chief-of-Staff operating brief.</p>
            <span className={`inline-block mt-1.5 text-[9px] uppercase tracking-wider ${wizardAccess?.operatingModel ? 'text-emerald-300' : 'text-slate-500'}`}>
              {wizardAccess?.operatingModel ? 'Available' : 'Enter Founder Office'}
            </span>
          </button>

          {/* Venture Portfolio — Operator Pro/Elite. The wizard shows a locked
              upgrade panel without access, so the card always opens it. */}
          <button
            type="button"
            onClick={() => { setPortfolioWizardMode('portfolio'); setPortfolioWizardOpen(true); }}
            className={`text-left rounded-lg border p-3 transition-colors shrink-0 w-56 snap-start ${
              wizardAccess?.portfolio
                ? 'border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20'
                : 'border-slate-700/60 bg-slate-900/40 hover:bg-slate-800/60'
            }`}
            title={wizardAccess?.portfolio ? 'Venture Portfolio' : 'Venture Portfolio — upgrade to unlock'}
          >
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
              <Layers className="w-3.5 h-3.5" /> Venture Portfolio
              {!wizardAccess?.portfolio && <Lock className="w-3 h-3 text-slate-500" />}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Multiple ventures, cross-venture.</p>
            <span className={`inline-block mt-1.5 text-[9px] uppercase tracking-wider ${wizardAccess?.portfolio ? 'text-emerald-300' : 'text-slate-500'}`}>
              {wizardAccess?.portfolio ? 'Available' : 'Upgrade to unlock'}
            </span>
          </button>
        </div>
      </div>

      <StandingCoreWizard
        open={coreWizardOpen}
        onOpenChange={setCoreWizardOpen}
        personaId={_personaId}
        onSaved={() => { void loadProfiles(); }}
      />
      <VentureLightWizard
        open={lightWizardOpen}
        onOpenChange={setLightWizardOpen}
        personaId={_personaId}
      />
      <VentureProWizard
        open={proWizardOpen}
        onOpenChange={setProWizardOpen}
        personaId={_personaId}
        hasProAccess={!!wizardAccess?.pro}
        onOpenOperatingBrief={
          wizardAccess?.operatingModel
            ? () => { setProWizardOpen(false); setPortfolioWizardMode('operating'); setPortfolioWizardOpen(true); }
            : undefined
        }
      />
      <VenturePortfolioWizard
        open={portfolioWizardOpen}
        onOpenChange={setPortfolioWizardOpen}
        personaId={_personaId}
        mode={portfolioWizardMode}
        hasOperatingAccess={!!wizardAccess?.operatingModel}
        hasPortfolioAccess={!!wizardAccess?.portfolio}
      />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-950 border border-rose-800 rounded-lg text-rose-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button className="ml-auto text-rose-400 hover:text-rose-200" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-violet-300">New Verified Standing Profile</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Label</label>
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                placeholder="e.g. O-1 Application Profile"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Profile Type</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                {PROFILE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newLabel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Profile selector */}
      {profiles.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => loadProfile(p.id)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                activeProfile?.id === p.id
                  ? 'border-violet-500 bg-violet-900/30 text-violet-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* No profiles empty state */}
      {profiles.length === 0 && !showCreate && (
        <div className="text-center py-16 text-slate-500">
          <Star className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No standing profiles yet.</p>
          <p className="text-xs mt-1">Create your first profile to begin building your VSP.</p>
        </div>
      )}

      {activeProfile && (
        <>
          {/* Profile header */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white">{activeProfile.label}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-violet-900/50 text-violet-300 px-2 py-0.5 rounded-full">
                    {PROFILE_TYPES.find(t => t.value === activeProfile.profile_type)?.label ?? activeProfile.profile_type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    activeProfile.status === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {activeProfile.status}
                  </span>
                  {activeProfile.compiled_at && (
                    <span className="text-xs text-slate-500">
                      Compiled {new Date(activeProfile.compiled_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {approvedCount > 0 && (
                  <button
                    onClick={handleCompile}
                    disabled={compiling}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    {compiling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                    Compile VSP
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Evidence panel */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-white">Evidence</span>
                <span className="text-xs text-slate-500">({evidence.length})</span>
              </div>
              <button
                onClick={() => setShowAddEvidence(!showAddEvidence)}
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Evidence
              </button>
            </div>

            {showAddEvidence && (
              <div className="p-4 border-b border-slate-700 space-y-3 bg-slate-850">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Source Type</label>
                    <select
                      value={evSourceType}
                      onChange={e => setEvSourceType(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                    >
                      {Array.from(new Set(SOURCE_TYPES.map(s => s.group))).map(group => (
                        <optgroup key={group} label={group}>
                          {SOURCE_TYPES.filter(s => s.group === group).map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Label</label>
                    <input
                      value={evLabel}
                      onChange={e => setEvLabel(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                      placeholder="e.g. LinkedIn profile export"
                    />
                  </div>
                </div>
                {/* Upload mode toggle */}
                <div className="flex gap-1 p-1 bg-slate-900 rounded-lg w-fit">
                  <button
                    onClick={() => setUploadMode('file')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors ${uploadMode === 'file' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <Upload className="w-3 h-3" /> Upload file
                  </button>
                  <button
                    onClick={() => setUploadMode('text')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors ${uploadMode === 'text' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <FileText className="w-3 h-3" /> Paste text
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Classification</label>
                    <select
                      value={evClassification}
                      onChange={e => setEvClassification(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                    >
                      {CLASSIFICATION_OPTIONS.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Source / Provenance</label>
                    <input
                      value={evProvenance}
                      onChange={e => setEvProvenance(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                      placeholder="URL or institution name"
                    />
                  </div>
                </div>

                {uploadMode === 'file' ? (
                  <div>
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.rtf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.heic,.mp3,.m4a,.wav,.ogg,.flac,.aac,.mp4,.mov,.avi,.mkv,.webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*,image/*,audio/*,video/*"
                      onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
                    />
                    {uploadFile ? (
                      <div className="flex items-center gap-3 p-3 bg-slate-700 border border-violet-500/40 rounded-lg">
                        <FileText className="w-5 h-5 text-violet-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white truncate">{uploadFile.name}</p>
                          <p className="text-xs text-slate-400">{(uploadFile.size / 1024).toFixed(1)} KB · {uploadFile.type || 'unknown type'}</p>
                        </div>
                        <button onClick={() => { setUploadFile(null); setEvLabel(''); }} className="text-slate-500 hover:text-rose-400">
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDragOver(false); handleFileChange(e.dataTransfer.files?.[0] ?? null); }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${dragOver ? 'border-violet-400 bg-violet-900/20' : 'border-slate-600 hover:border-violet-500/60 hover:bg-slate-700/40'}`}
                      >
                        <Upload className="w-6 h-6 text-slate-500" />
                        <p className="text-sm text-slate-400">Drop file here or <span className="text-violet-400">browse</span></p>
                        <p className="text-xs text-slate-600 text-center">PDF, DOCX, TXT, CSV, JSON, JPEG, PNG, MP3, MP4 and more · max 20 MB</p>
                        <p className="text-xs text-violet-500/70 mt-1 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> File content encrypted and stored in Standing Vault
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Document Text</label>
                    <textarea
                      value={evContent}
                      onChange={e => setEvContent(e.target.value)}
                      rows={6}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none"
                      placeholder="Paste the document text for AI fact extraction…"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  {uploadMode === 'file' ? (
                    <button
                      onClick={handleUploadFile}
                      disabled={uploading || !uploadFile || !evLabel}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                    >
                      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploading ? 'Uploading…' : 'Upload & Add'}
                    </button>
                  ) : (
                    <button
                      onClick={handleAddEvidence}
                      disabled={addingEvidence || !evLabel}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                    >
                      {addingEvidence ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Add
                    </button>
                  )}
                  <button
                    onClick={() => { setShowAddEvidence(false); setUploadFile(null); }}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {evidence.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">No evidence added yet.</div>
            ) : (
              <div className="divide-y divide-slate-700">
                {evidence.map(ev => (
                  <div key={ev.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{ev.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">{SOURCE_TYPES.find(s => s.value === ev.source_type)?.label ?? ev.source_type}</span>
                        <ClassificationBadge classification={ev.classification ?? 'GREY'} />
                        <ExtractionBadge status={ev.extraction_status} />
                        {ev.extracted_fact_count > 0 && (
                          <span className="text-xs text-slate-500">{ev.extracted_fact_count} facts</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ev.storage_backend === 'sui_locker' ? (
                        <span className="flex items-center gap-1 text-xs text-violet-400 font-mono px-2 py-1 bg-violet-900/30 rounded-lg">
                          <Lock className="w-3 h-3" /> Vaulted
                        </span>
                      ) : (
                        <button
                          onClick={() => handleVault(ev.id)}
                          disabled={vaulting[ev.id]}
                          title="Encrypt and store in Standing Vault (Walrus/Sui)"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-violet-800 disabled:opacity-50 text-slate-400 hover:text-white text-xs rounded-lg transition-colors"
                        >
                          {vaulting[ev.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                          Vault
                        </button>
                      )}
                      <button
                        onClick={() => handleExtract(ev.id)}
                        disabled={extracting[ev.id] || ev.extraction_status === 'extracting'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs rounded-lg transition-colors"
                      >
                        {extracting[ev.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Extract Facts
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Facts panel */}
          {facts.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                <Star className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium text-white">Facts</span>
                <span className="text-xs text-slate-500">
                  ({approvedCount} approved / {facts.length} total)
                </span>
              </div>
              <div className="divide-y divide-slate-700/50">
                {DOMAIN_ORDER.filter(d => factsByDomain[d]?.length > 0).map(domain => (
                  <div key={domain} className="p-4">
                    <h3 className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-3">
                      {DOMAIN_LABELS[domain] ?? domain}
                    </h3>
                    <div className="space-y-2">
                      {factsByDomain[domain].map(fact => (
                        <div
                          key={fact.id}
                          className={`p-3 rounded-lg border ${
                            fact.locked_at
                              ? 'border-slate-700/50 bg-slate-900/50'
                              : fact.status === 'approved' || fact.status === 'corrected'
                              ? 'border-emerald-800/50 bg-emerald-950/20'
                              : fact.status === 'rejected'
                              ? 'border-rose-800/50 bg-rose-950/20'
                              : 'border-slate-700 bg-slate-900/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-slate-300">{fact.label}</span>
                                {fact.locked_at && <Lock className="w-3 h-3 text-slate-600" />}
                              </div>
                              <p className="text-sm text-white">
                                {fact.status === 'corrected' && fact.principal_value
                                  ? fact.principal_value
                                  : fact.extracted_value}
                              </p>
                              {fact.status === 'corrected' && fact.principal_value && (
                                <p className="text-xs text-slate-500 mt-0.5 line-through">{fact.extracted_value}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <ConfidenceBadge confidence={fact.confidence} />
                                <FactStatusBadge status={fact.status} />
                              </div>
                            </div>

                            {/* Actions */}
                            {!fact.locked_at && fact.status === 'pending' && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleFactAction(fact.id, 'approve')}
                                  disabled={factActioning[fact.id]}
                                  className="p-1.5 rounded-lg bg-emerald-900/50 hover:bg-emerald-800/50 text-emerald-400 disabled:opacity-50 transition-colors"
                                  title="Approve"
                                >
                                  {factActioning[fact.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => setCorrectingFact(correctingFact === fact.id ? null : fact.id)}
                                  className="p-1.5 rounded-lg bg-violet-900/50 hover:bg-violet-800/50 text-violet-400 transition-colors"
                                  title="Correct"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleFactAction(fact.id, 'reject')}
                                  disabled={factActioning[fact.id]}
                                  className="p-1.5 rounded-lg bg-rose-900/50 hover:bg-rose-800/50 text-rose-400 disabled:opacity-50 transition-colors"
                                  title="Reject"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Correction form */}
                          {correctingFact === fact.id && (
                            <div className="mt-3 flex gap-2">
                              <input
                                value={correctionValue}
                                onChange={e => setCorrectionValue(e.target.value)}
                                className="flex-1 bg-slate-700 border border-violet-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                                placeholder="Enter corrected value…"
                              />
                              <button
                                onClick={() => handleFactAction(fact.id, 'correct', correctionValue)}
                                disabled={!correctionValue || factActioning[fact.id]}
                                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setCorrectingFact(null); setCorrectionValue(''); }}
                                className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compiled VSP */}
          {activeProfile.vsp_content && (
            <div className="bg-slate-800 border border-emerald-800/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-emerald-800/30 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-white">Compiled VSP</span>
                {activeProfile.compiled_at && (
                  <span className="text-xs text-slate-500 ml-auto">
                    {new Date(activeProfile.compiled_at).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="p-4 space-y-4">
                {DOMAIN_ORDER.map(domain => {
                  const content = activeProfile.vsp_content as Record<string, unknown>;
                  const domains = content?.domains as Record<string, unknown[]> | undefined;
                  const domainFacts = domains?.[domain];
                  if (!domainFacts || domainFacts.length === 0) return null;
                  return (
                    <div key={domain}>
                      <h3 className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-2">
                        {DOMAIN_LABELS[domain] ?? domain}
                      </h3>
                      <div className="space-y-1">
                        {(domainFacts as Array<Record<string, string>>).map((f, i) => (
                          <div key={i} className="flex items-baseline gap-2 text-sm">
                            <span className="text-slate-400 min-w-[140px] shrink-0">{f.label}:</span>
                            <span className="text-white">{f.value}</span>
                            <ConfidenceBadge confidence={f.confidence} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standing Asset Graph */}
          {activeProfile?.compiled_at && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-medium text-white">Standing Asset Graph</span>
                  {activeProfile.standing_graph && (
                    <span className="text-xs text-slate-500">
                      {activeProfile.standing_graph.capability_claims?.length ?? 0} capability claims
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {activeProfile.standing_graph && (
                    <button
                      onClick={() => setGraphExpanded(v => !v)}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      {graphExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={handleBuildGraph}
                    disabled={buildingGraph}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                  >
                    {buildingGraph ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {activeProfile.standing_graph ? 'Rebuild' : 'Build'} Graph
                  </button>
                </div>
              </div>
              {graphExpanded && activeProfile.standing_graph && (
                <div className="border-t border-slate-700 p-4 space-y-3">
                  <p className="text-xs text-slate-500">
                    Built {new Date(activeProfile.standing_graph.built_at).toLocaleString()}
                  </p>
                  <div className="space-y-2">
                    {activeProfile.standing_graph.capability_claims?.map(claim => {
                      const edges = activeProfile.standing_graph?.edges?.filter(e => e.to_claim_id === claim.id) ?? [];
                      return (
                        <div key={claim.id} className="bg-slate-750 border border-slate-600 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm text-white font-medium">{claim.label}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              claim.confidence_level === 'high' ? 'bg-emerald-900/60 text-emerald-300' :
                              claim.confidence_level === 'medium' ? 'bg-amber-900/60 text-amber-300' :
                              'bg-slate-700 text-slate-400'
                            }`}>
                              {claim.confidence_level}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {edges.map((edge, i) => (
                              <p key={i} className="text-xs text-slate-400">
                                <span className="text-slate-500 font-mono">{edge.from_domain}.{edge.from_field}</span>
                                {' → '}
                                <span className="text-violet-400">w{edge.weight}</span>
                                {' — '}{edge.rationale}
                              </p>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generate Outputs */}
          {activeProfile?.compiled_at && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">Generate Outputs</span>
                </div>
                <button
                  onClick={() => setShowGenerate(v => !v)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {showGenerate ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
              {showGenerate && (
                <div className="border-t border-slate-700 p-4 space-y-3">
                  <p className="text-xs text-slate-400">
                    Generate reusable professional documents from the compiled VSP. The Standing Cartridge is the authoritative source — outputs are derived, not the record.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Output Type</label>
                      <select
                        value={genOutputType}
                        onChange={e => setGenOutputType(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                      >
                        {OUTPUT_TYPES.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Context (optional)</label>
                      <input
                        value={genContext}
                        onChange={e => setGenContext(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        placeholder="e.g. target audience, role, company"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate
                  </button>
                  {generatedOutput && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">Generated output</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(generatedOutput)}
                          className="text-xs text-slate-500 hover:text-white transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap overflow-auto max-h-80">
                        {generatedOutput}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Link to Case */}
          {cases.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-white">Link to Mobility Case</span>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedCaseId}
                  onChange={e => setSelectedCaseId(e.target.value)}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="">Select a case…</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.case_type} — {c.case_status}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleLinkCase}
                  disabled={linking || !selectedCaseId}
                  className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  {linking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                  Link
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
