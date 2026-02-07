import { AddIQuBeForm } from "../../../components/registry/AddIQuBeForm";

export default function RegistryAddPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-3xl font-semibold">Add iQube</h1>
      <p className="text-slate-300 mb-4">
        Create and register a new iQube. This form allows you to configure MetaQube, BlakQube, and optionally mint a TokenQube.
      </p>
      <AddIQuBeForm />
    </div>
  );
}
