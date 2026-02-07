"use client";

type PersonaSetupWizardProps = {
  onComplete: (persona: { id: string; name?: string }) => void;
  onCancel: () => void;
};

export function PersonaSetupWizard({ onComplete, onCancel }: PersonaSetupWizardProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-950 p-6 text-white shadow-xl">
        <h3 className="text-lg font-semibold">Persona Setup</h3>
        <p className="mt-2 text-sm text-white/60">
          Persona wizard placeholder. Hook this into the real persona creation flow.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-full border border-white/10 px-4 py-1 text-sm text-white/70 hover:text-white"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-emerald-500/20 px-4 py-1 text-sm text-emerald-200 hover:bg-emerald-500/30"
            onClick={() => onComplete({ id: "persona-preview" })}
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}
