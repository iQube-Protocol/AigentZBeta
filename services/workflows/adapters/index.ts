import { WorkflowEngineAdapter } from "../bindingTypes";
import { makeAdapter } from "./makeAdapter";
import { n8nAdapter } from "./n8nAdapter";
import { aciAdapter } from "./aciAdapter";

const ADAPTERS: Record<string, WorkflowEngineAdapter> = {
  make: makeAdapter,
  n8n: n8nAdapter,
  aci: aciAdapter,
};

export function getAdapter(engine: string): WorkflowEngineAdapter | null {
  return ADAPTERS[engine] ?? null;
}
