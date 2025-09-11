"use client";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RegistryHome } from "../../components/registry/RegistryHome";
import { IQubeDetailModal } from "../../components/registry/IQubeDetailModal";

export default function RegistryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const templateId = searchParams?.get("template");
  const edit = searchParams?.get("edit") === "1";

  const onClose = () => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.delete("template");
    params.delete("edit");
    const qs = params.toString();
    router.push(`/registry${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">iQube Registry</h1>
      <p className="text-slate-300 mb-4">
        Browse and manage iQube templates and instances in the registry.
      </p>
      <RegistryHome />
      {templateId && (
        <IQubeDetailModal templateId={templateId} edit={edit} onClose={onClose} />
      )}
    </div>
  );
}
