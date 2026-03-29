"use client";

/**
 * KnytSubmissionShell
 *
 * Guided contribution submission shell for Living Canon / 21 Sats.
 * Extends the RuntimeCapsuleAdminEditor pattern — same inline chip UX,
 * same save/cancel/toast flow — but available to qualified contributors,
 * not just admins.
 *
 * Access gate:
 *   - type === 'correspondent' requires entitlement 'knyt:correspondent'
 *   - all other types require entitlement 'knyt:contributor' OR 'knyt:correspondent'
 *
 * Schema:
 *   Loaded from /api/codex/knyt/living-canon/schemas?type=<slug>
 *   Cartridge injects the task template slug via `schemaSlug` prop.
 *   Each schema defines fields[], prompts[], branch_target, reward_task_type.
 *
 * Submission:
 *   Saves to crm_contributions via /api/crm/contributions (existing route).
 *   Creates a knyt_publication_state record in 'draft' state.
 *   Each submission becomes a PoKW receipt on acceptance.
 *
 * Positioning:
 *   Same as RuntimeCapsuleAdminEditor — lives within the runtime viewport,
 *   between context chip and media artifact.
 */

import React, { useState, useCallback } from "react";
import { Loader2, PenLine, ChevronDown, ChevronUp } from "lucide-react";
import { BranchLabel, type CanonBranch } from "@/components/ui/BranchLabel";
import { useToast } from "@/hooks/use-toast";

// =============================================================================
// TYPES (matching schema_json structure from crm_task_templates)
// =============================================================================

type FieldType = "text" | "textarea" | "select" | "tags" | "number";

interface SchemaField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  options?: string[];
  optionsEndpoint?: string;
  placeholder?: string;
}

interface ContributionSchema {
  slug: string;
  title: string;
  description?: string;
  schema_json: {
    branch_target: CanonBranch;
    reward_task_type: string;
    required_entitlement?: string;
    fields: SchemaField[];
    prompts?: string[];
  };
}

type FieldValues = Record<string, string | string[]>;

// =============================================================================
// PROPS
// =============================================================================

export interface KnytSubmissionShellProps {
  /** Task template slug — e.g. 'knyt:dispatch', 'knyt:theory' */
  schemaSlug: string;
  /** Persona ID making the submission */
  personaId: string;
  /** Persona's entitlements — used to gate access */
  entitlements: string[];
  /** World ID (defaults to '21sats') */
  worldId?: string;
  /** Called after successful submission */
  onSubmitted?: (submissionId: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function KnytSubmissionShell({
  schemaSlug,
  personaId,
  entitlements,
  worldId = "21sats",
  onSubmitted,
}: KnytSubmissionShellProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<ContributionSchema | null>(null);
  const [values, setValues] = useState<FieldValues>({});
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, string[]>>({});

  // Access gate check
  const hasAccess = useCallback(
    (requiredEntitlement?: string) => {
      if (requiredEntitlement) return entitlements.includes(requiredEntitlement);
      return (
        entitlements.includes("knyt:contributor") ||
        entitlements.includes("knyt:correspondent")
      );
    },
    [entitlements]
  );

  const handleOpen = async () => {
    if (open) { setOpen(false); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/codex/knyt/living-canon/schemas?type=${encodeURIComponent(schemaSlug)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load contribution schema.");
      const data = await res.json();
      const loadedSchema: ContributionSchema = data.schema;

      // Check access after loading schema (correspondent gate)
      if (!hasAccess(loadedSchema.schema_json?.required_entitlement)) {
        throw new Error(
          loadedSchema.schema_json?.required_entitlement === "knyt:correspondent"
            ? "Correspondent status required for this submission type."
            : "Contributor access required to submit."
        );
      }

      // Initialise field values
      const initial: FieldValues = {};
      for (const field of loadedSchema.schema_json.fields ?? []) {
        initial[field.id] = field.type === "tags" ? [] : "";
      }
      setValues(initial);
      setSchema(loadedSchema);

      // Fetch dynamic option lists (e.g. character cards)
      for (const field of loadedSchema.schema_json.fields ?? []) {
        if (field.optionsEndpoint) {
          fetch(field.optionsEndpoint)
            .then((r) => r.json())
            .then((d) => {
              const opts: string[] = Array.isArray(d?.cards)
                ? d.cards.map((c: Record<string, unknown>) => String(c.name ?? c.id ?? ""))
                : Array.isArray(d) ? d.map(String) : [];
              setDynamicOptions((prev) => ({ ...prev, [field.id]: opts }));
            })
            .catch(() => {/* non-fatal */});
        }
      }

      setOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load submission form.");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: string | string[]) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleTagInput = (fieldId: string, raw: string) => {
    const tags = raw.split(",").map((t) => t.trim()).filter(Boolean);
    setValues((prev) => ({ ...prev, [fieldId]: tags }));
  };

  const validate = (): string | null => {
    if (!schema) return "Schema not loaded.";
    for (const field of schema.schema_json.fields) {
      if (!field.required) continue;
      const val = values[field.id];
      const str = Array.isArray(val) ? val.join(",") : val ?? "";
      if (!str.trim()) return `"${field.label}" is required.`;
      if (field.minLength && str.trim().length < field.minLength)
        return `"${field.label}" must be at least ${field.minLength} characters.`;
    }
    return null;
  };

  const handleSave = async (submit: boolean) => {
    if (!schema) return;
    const validationError = submit ? validate() : null;
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    setError(null);
    try {
      // POST to KNYT-specific contribution endpoint
      const res = await fetch("/api/codex/knyt/living-canon/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_id: personaId,
          world_id: worldId,
          task_slug: schemaSlug,
          branch_target: schema.schema_json.branch_target,
          status: submit ? "submitted" : "draft",
          field_values: values,
          metadata: {
            reward_task_type: schema.schema_json.reward_task_type,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as Record<string, unknown>)?.error as string || "Failed to save submission.");
      }

      const result = await res.json();
      const submissionId: string = result?.id ?? "";

      toast(submit ? "Submission sent for review" : "Draft saved", "success");
      if (submit) {
        setOpen(false);
        onSubmitted?.(submissionId);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (!schema && !open) {
    // Collapsed chip — matches RuntimeCapsuleAdminEditor visual style
    return (
      <div className="rounded-xl border border-amber-400/25 bg-slate-900/70 p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80">
              Living Canon
            </div>
            <div className="text-sm font-medium text-white">Submit a contribution</div>
          </div>
          <button
            type="button"
            onClick={() => void handleOpen()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            Open form
          </button>
        </div>
        {error && (
          <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-400/25 bg-slate-900/70 p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-medium text-white">
            {schema?.title ?? "Contribution"}
          </div>
          {schema?.schema_json.branch_target && (
            <BranchLabel branch={schema.schema_json.branch_target} />
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-slate-400 hover:text-white transition"
          aria-label={open ? "Collapse form" : "Expand form"}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && schema && (
        <>
          {error && (
            <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          {/* Prompts */}
          {schema.schema_json.prompts && schema.schema_json.prompts.length > 0 && (
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Prompts</div>
              <ul className="space-y-1">
                {schema.schema_json.prompts.map((p, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-2">
                    <span className="text-amber-400/70 shrink-0">›</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fields */}
          <div className="grid gap-4">
            {schema.schema_json.fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={values[field.id]}
                dynamicOptions={dynamicOptions[field.id]}
                onChange={(val) => handleFieldChange(field.id, val)}
                onTagChange={(raw) => handleTagInput(field.id, raw)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void handleSave(false)}
              disabled={saving}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
              Save draft
            </button>
            <button
              type="button"
              onClick={() => void handleSave(true)}
              disabled={saving}
              className="rounded-full border border-amber-300/30 bg-amber-500/15 px-4 py-1.5 text-xs text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
              Submit for review
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// FIELD RENDERER
// Renders each field according to its schema type.
// =============================================================================

function FieldRenderer({
  field,
  value,
  dynamicOptions,
  onChange,
  onTagChange,
}: {
  field: SchemaField;
  value: string | string[] | undefined;
  dynamicOptions?: string[];
  onChange: (val: string | string[]) => void;
  onTagChange: (raw: string) => void;
}) {
  const strValue = Array.isArray(value) ? value.join(", ") : (value ?? "");
  const inputClass =
    "rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-amber-300/40 w-full";
  const labelClass = "text-[11px] uppercase tracking-[0.16em] text-slate-400";

  if (field.type === "textarea") {
    return (
      <label className="grid gap-2">
        <span className={labelClass}>
          {field.label}
          {field.required && <span className="text-amber-400 ml-1">*</span>}
        </span>
        <textarea
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          maxLength={field.maxLength}
          className={inputClass}
          placeholder={field.placeholder}
        />
        {field.maxLength && (
          <span className="text-[10px] text-slate-500 text-right">
            {strValue.length}/{field.maxLength}
          </span>
        )}
      </label>
    );
  }

  if (field.type === "select") {
    const opts = dynamicOptions ?? field.options ?? [];
    return (
      <label className="grid gap-2">
        <span className={labelClass}>
          {field.label}
          {field.required && <span className="text-amber-400 ml-1">*</span>}
        </span>
        <select
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} appearance-none`}
        >
          <option value="">— select —</option>
          {opts.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "tags") {
    return (
      <label className="grid gap-2">
        <span className={labelClass}>{field.label}</span>
        <input
          type="text"
          value={strValue}
          onChange={(e) => onTagChange(e.target.value)}
          placeholder="Comma-separated tags"
          className={inputClass}
        />
        {Array.isArray(value) && value.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {value.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </label>
    );
  }

  // Default: text input
  return (
    <label className="grid gap-2">
      <span className={labelClass}>
        {field.label}
        {field.required && <span className="text-amber-400 ml-1">*</span>}
      </span>
      <input
        type="text"
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        className={inputClass}
      />
    </label>
  );
}
