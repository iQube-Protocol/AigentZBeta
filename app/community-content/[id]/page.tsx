/**
 * Public viewer for shared community-generated content.
 *
 * Pulls the row server-side via the same service-role API the cartridge
 * tab uses, so this page works for unauthenticated visitors who land
 * here from a share link (X / mailto / clipboard). Drafts and rejected
 * rows resolve to a 404.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Item {
  id: string;
  title: string;
  prompt: string;
  skill: 'article' | 'story';
  articleBody: string | null;
  imageUrl: string | null;
  qcCost: number;
  promotedToRuntime: boolean;
  creator: { firstName: string | null; handle: string | null };
  createdAt: string;
}

async function loadItem(id: string): Promise<Item | null> {
  const supabase = getCommunityContentSupabase();

  const { data: row } = await supabase
    .from('community_generated_content')
    .select(
      'id, creator_persona_id, skill, title, prompt, article_body, image_url, status, qc_cost, runtime_promoted_at, created_at',
    )
    .eq('id', id)
    .in('status', ['shared', 'runtime_promoted'])
    .maybeSingle();

  if (!row) return null;
  const r = row as {
    id: string;
    creator_persona_id: string;
    skill: 'article' | 'story';
    title: string;
    prompt: string;
    article_body: string | null;
    image_url: string | null;
    status: string;
    qc_cost: number;
    created_at: string;
  };

  const { data: persona } = await supabase
    .from('nakamoto_knyt_personas')
    .select('"First-Name", "Twitter-Handle", "Telegram-Handle", "Discord-Handle"')
    .eq('id', r.creator_persona_id)
    .maybeSingle();
  const p = (persona ?? {}) as Record<string, string | null>;

  return {
    id: r.id,
    title: r.title,
    prompt: r.prompt,
    skill: r.skill,
    articleBody: r.article_body,
    imageUrl: r.image_url,
    qcCost: r.qc_cost,
    promotedToRuntime: r.status === 'runtime_promoted',
    creator: {
      firstName: p['First-Name'] || null,
      handle: p['Twitter-Handle'] || p['Telegram-Handle'] || p['Discord-Handle'] || null,
    },
    createdAt: r.created_at,
  };
}

function byline(item: Item): string {
  const name = item.creator.firstName?.trim();
  const handle = item.creator.handle?.trim();
  if (name && handle) return `${name} · @${handle}`;
  if (name) return name;
  if (handle) return `@${handle}`;
  return 'Anonymous';
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await loadItem(id);
  if (!item) return { title: 'Not found · Community Content' };
  const author = byline(item);
  return {
    title: `${item.title} · KNYT Community`,
    description: `${item.skill === 'story' ? 'A KNYT story' : 'A KNYT article'} by ${author}.`,
    openGraph: {
      title: item.title,
      description: `By ${author}`,
      images: item.imageUrl ? [{ url: item.imageUrl }] : undefined,
      type: 'article',
    },
  };
}

export default async function CommunityContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await loadItem(id);
  if (!item) notFound();

  const dateLabel = new Date(item.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const skillLabel = item.skill === 'story' ? 'Story' : 'Article';
  await headers();

  return (
    <main className="min-h-full bg-zinc-950 text-zinc-100">
      <article className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <header className="mb-8 border-b border-zinc-800 pb-6">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
            <span className="rounded-full bg-violet-500/10 px-2.5 py-1 font-semibold text-violet-300">
              {skillLabel}
            </span>
            {item.promotedToRuntime && (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-300">
                Runtime
              </span>
            )}
            {item.qcCost === 0 && (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-300">
                Free
              </span>
            )}
          </div>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{item.title}</h1>
          <p className="mt-3 text-sm text-zinc-400">
            By <span className="text-zinc-200">{byline(item)}</span> · {dateLabel}
          </p>
        </header>

        {item.imageUrl && (
          <figure className="mb-10 overflow-hidden rounded-xl border border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={item.title} className="w-full object-cover" />
          </figure>
        )}

        {item.articleBody ? (
          <div className="prose prose-invert max-w-none whitespace-pre-wrap text-base leading-relaxed text-zinc-200">
            {item.articleBody}
          </div>
        ) : (
          <p className="text-zinc-500 italic">No body — this piece may have failed generation.</p>
        )}

        <footer className="mt-12 flex items-center justify-between border-t border-zinc-800 pt-6 text-sm text-zinc-400">
          <Link
            href="/triad/embed/codex/knyt-codex?tab=community-content"
            className="text-violet-300 hover:text-violet-200"
          >
            ← More from the KNYT community
          </Link>
          <span className="font-mono text-xs text-zinc-600">{item.id.slice(0, 8)}</span>
        </footer>
      </article>
    </main>
  );
}
