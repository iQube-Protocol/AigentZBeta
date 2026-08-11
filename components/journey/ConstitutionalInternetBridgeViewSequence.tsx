'use client';

/**
 * ConstitutionalInternetBridgeViewSequence — the Constitutional Internet
 * Bridge's VIEW stage. Renders the ordered Video → Plate → Excerpt content
 * grammar from constitutionalInternetBridgeViewContent.ts (data, not
 * hardcoded prose). Video is omitted per-block until a real asset URL
 * exists (see that file's header — no URL is ever invented).
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { CI_BRIDGE_VIEW_CONTENT } from '@/services/journey/constitutionalInternetBridgeViewContent';
import { plateByNumber } from '@/services/artifact/canonicalPlates';

const CanonicalPlateFigure = dynamic(() => import('@/components/publishing/CanonicalPlateFigure'), { ssr: false });

export function ConstitutionalInternetBridgeViewSequence() {
  return (
    <div className="space-y-10">
      {CI_BRIDGE_VIEW_CONTENT.map((block) => {
        const plate = plateByNumber(block.plateNumber);
        return (
          <div key={block.id} className="rounded-2xl border border-white/10 bg-slate-900/40 overflow-hidden">
            {block.videoUrl && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video className="w-full" controls src={block.videoUrl} />
            )}
            <div className="p-5 sm:p-6">
              <p className="text-[11px] uppercase tracking-[0.25em] text-indigo-400 mb-3">{block.proposition}</p>
              {plate && (
                <div className="mb-4 rounded-xl overflow-hidden border border-white/10">
                  <CanonicalPlateFigure plate={plate} />
                </div>
              )}
              <blockquote className="whitespace-pre-line border-l-2 border-indigo-400/40 pl-4 text-sm italic leading-relaxed text-slate-300">
                {block.excerpt}
              </blockquote>
              <p className="mt-2 text-[10px] text-slate-600">The Constitutional Internet — {block.excerptSource}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ConstitutionalInternetBridgeViewSequence;
