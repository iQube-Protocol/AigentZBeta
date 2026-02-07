"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { RegistryHome } from "../../components/registry/RegistryHome";
import { IQubeDetailModal } from "../../components/registry/IQubeDetailModal";

export function RegistryClient() {
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
    <>
      <RegistryHome />
      {templateId && (
        <IQubeDetailModal
          templateId={templateId}
          edit={edit}
          onClose={onClose}
        />
      )}
    </>
  );
}