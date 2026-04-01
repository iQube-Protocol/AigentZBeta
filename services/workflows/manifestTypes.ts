export type ManifestFieldType = "string" | "number" | "boolean" | "object" | "array";

export interface ManifestField {
  name: string;
  type: ManifestFieldType;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
}

export interface InputManifest {
  id: string;
  workflowId: string;
  tenantId: string;
  version: number;
  fields: ManifestField[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutputManifest {
  id: string;
  workflowId: string;
  tenantId: string;
  version: number;
  fields: ManifestField[];
  successCriteria: Record<string, unknown>;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Validate an input object against an InputManifest.
 * Returns list of missing required field names, or empty array if valid.
 */
export function validateInput(input: unknown, manifest: InputManifest): string[] {
  const obj = (input && typeof input === "object" && !Array.isArray(input))
    ? (input as Record<string, unknown>)
    : {};
  return manifest.fields
    .filter((f) => f.required && !(f.name in obj))
    .map((f) => f.name);
}

/**
 * Normalize engine output against an OutputManifest.
 * Projects to declared fields only; fills defaultValue for missing optional fields.
 */
export function normalizeAgainstManifest(raw: unknown, manifest: OutputManifest): Record<string, unknown> {
  const obj = (raw && typeof raw === "object" && !Array.isArray(raw))
    ? (raw as Record<string, unknown>)
    : {};
  const result: Record<string, unknown> = {};
  for (const field of manifest.fields) {
    result[field.name] = field.name in obj ? obj[field.name] : field.defaultValue ?? null;
  }
  return result;
}
