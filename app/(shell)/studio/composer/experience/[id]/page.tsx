import { ComposerExperienceViewer } from "@/components/composer/ComposerExperienceViewer";

interface ComposerExperiencePageProps {
  params: { id: string };
}

export default function ComposerExperiencePage({ params }: ComposerExperiencePageProps) {
  return <ComposerExperienceViewer experienceId={params.id} />;
}
