"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RegistryHome } from "../../../components/registry/RegistryHome";
import { IQubeDetailModal } from "../../../components/registry/IQubeDetailModal";
import { RegistryClient } from "./RegistryClient";

function RegistryPageInner() {
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
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">iQube Registry</h1>
        <p className="text-slate-300 text-lg">
          Browse and manage iQube templates and instances in the registry.
        </p>
      </div>
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400"></div>
            Loading registry...
          </div>
        </div>
      }>
        <RegistryClient />
      </Suspense>
    </div>
  );
}

export default function RegistryPage() {
  return (
    <Suspense fallback={null}>
      <RegistryPageInner />
    </Suspense>
  );
}
