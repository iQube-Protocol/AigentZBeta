import { ComposerExperienceViewer } from "@/components/composer/ComposerExperienceViewer";

interface ComposerExperiencePageProps {
  params: Promise<{ id: string }>;
}

export default async function ComposerExperiencePage(props: ComposerExperiencePageProps) {
  const params = await props.params;
  return <ComposerExperienceViewer experienceId={params.id} />;
}
