import { redirect } from 'next/navigation';
import { decodeContentReference } from '@/services/smartcontent/codexArticleDeepLink';

interface RouteProps {
  params: Promise<{ article: string }>;
}

/** Backward-compatible title/slug link for the pre-existing /metame path. */
export default async function LegacyCodexArticlePage({ params }: RouteProps) {
  const { article } = await params;
  redirect(`/codex/viewer/${encodeURIComponent(decodeContentReference(article))}`);
}
