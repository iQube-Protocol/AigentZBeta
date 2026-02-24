import dynamic from "next/dynamic";

const ComposerStudio = dynamic(
  () => import("@/components/composer/ComposerStudio").then((mod) => mod.ComposerStudio),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-slate-400">
        Loading Composer Studio…
      </div>
    ),
  }
);

export default function ComposerStudioPage() {
  return <ComposerStudio />;
}
