import { redirect } from 'next/navigation';

interface RouteProps {
  params: Promise<{ article: string }>;
}

/**
 * Canonical human-facing Codex deep link.
 *
 * Selection remains inside the existing Qriptopian Essays/SmartTriad flow:
 * the article query is resolved to the already-published content UUID by
 * QriptoEssaysTab before it calls actions.loadContent().
 */
export default async function CodexArticlePage({ params }: RouteProps) {
  const { article } = await params;
  redirect(
    `/codex/viewer?id=qripto-codex&tab=essays&article=${encodeURIComponent(article)}`,
  );
}
