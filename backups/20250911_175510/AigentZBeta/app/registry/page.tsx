import { RegistryHome } from "../../components/registry/RegistryHome";

export default function RegistryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">iQube Registry</h1>
      <p className="text-slate-300 mb-4">
        Browse and manage iQube templates and instances in the registry.
      </p>
      <RegistryHome />
    </div>
  );
}
