/**
 * useLiveCodex - Fetch live content from QubeBase (Supabase)
 * Transforms raw content into CodexQube format
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CodexQube } from '@agentiq/codex';

interface QubeBaseContent {
  id: string;
  title: string;
  type: string;
  format: string;
  domain: string;
  content: any;
  excerpt?: string;
  thumbnail?: string;
  tags?: string[];
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  author_id?: string;
  author_type?: string;
  issue_ref?: string;
  placement?: any;
  modalities?: any;
}

const domainConfigs: Record<string, { title: string; icon: string; description: string; published?: boolean }> = {
  home: { title: 'Home', icon: 'Home', description: 'Home page content', published: false },
  signals: { title: 'Signals', icon: 'Radar', description: 'Market insights and trading signals', published: false },
  pennydrops: { title: 'Penny Drops', icon: 'Droplets', description: 'Q¢ use cases and practical applications', published: true },
  scrolls: { title: 'Scrolls', icon: 'BookOpen', description: 'Chronicles from the Quantum-Ready Internet', published: true },
  kn0wdz: { title: 'Kn0wdZ', icon: 'Code2', description: 'Technical knowledge and developer resources', published: true },
  staybull: { title: 'Stay Bull', icon: 'TrendingUp', description: 'Bullish market perspectives', published: false },
};

function groupByDomain(content: QubeBaseContent[]) {
  const domains: Record<string, QubeBaseContent[]> = {};
  
  content.forEach(item => {
    // Use placement.section if available, otherwise fall back to domain
    // Normalize domain names (e.g., 'home-hero' -> 'home', 'latest-news' -> 'home')
    let domainKey = item.placement?.section || item.domain || 'home';
    
    // Map placement sections to domain IDs
    if (domainKey === 'home-hero' || domainKey === 'second-hero' || domainKey === 'latest-news') {
      domainKey = 'home';
    }
    
    if (!domains[domainKey]) {
      domains[domainKey] = [];
    }
    domains[domainKey].push(item);
  });
  
  return domains;
}

function transformToCodexQube(content: QubeBaseContent[]): CodexQube {
  const domainGroups = groupByDomain(content);
  
  const domains = Object.keys(domainGroups).map(domainId => {
    const items = domainGroups[domainId];
    const config = domainConfigs[domainId] || { title: domainId, icon: 'Circle', description: '' };
    
    // Sort by position if available
    const sortedItems = [...items].sort((a, b) => {
      const posA = a.placement?.position ?? 999;
      const posB = b.placement?.position ?? 999;
      return posA - posB;
    });
    
    const contentQubes = sortedItems.map(item => ({
      qubeId: `qube://theqriptopian/content/${item.id}`,
      qubeType: 'contentQube' as const,
      protocolVersion: '1.0.0',
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || new Date().toISOString(),
      
      contentId: item.id,
      title: item.title,
      type: item.type,
      format: item.format,
      content: item.content || {},
      excerpt: item.excerpt || '',
      placement: item.placement || {},
      modalities: item.modalities || {},
      media: {
        thumbnail: item.thumbnail || '',
        hero: item.thumbnail || '',
      },
      tags: item.tags || [],
      publishedAt: item.published_at || item.created_at || new Date().toISOString(),
      author: {
        id: item.author_id || 'unknown',
        type: item.author_type || 'agent',
      },
    }));

    return {
      qubeId: `qube://theqriptopian/domain/${domainId}`,
      qubeType: 'domainQube' as const,
      protocolVersion: '1.0.0',
      createdAt: items[0]?.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      domainId,
      title: config.title,
      icon: config.icon,
      description: config.description,
      published: config.published ?? true,
      sections: contentQubes,
    };
  });

  return {
    qubeId: 'qube://theqriptopian/codex/issue-0',
    qubeType: 'codexQube',
    protocolVersion: '0.1.0',
    createdAt: '2025-11-27T00:02:37.492744+00:00',
    updatedAt: new Date().toISOString(),
    codexId: 'theqriptopian-issue-0',
    franchiseId: 'theqriptopian',
    issueNumber: 0,
    title: 'The Genesis Issue',
    description: 'Stories from the Quantum-Ready Internet',
    publishedAt: '2025-12-01T00:00:00Z',
    status: 'published',
    version: '0.1',
    tags: ['genesis', 'qriptocent', 'scrolls', 'knowledge', 'aigentiq'],
    editorial: {
      editor: 'The Qriptopian Editorial Team',
      theme: 'Q¢ use cases, Chronicles, and Knowledge',
      notes: 'Our inaugural issue features practical Q¢ stories, Chronicles from the Quantum-Ready Internet, and knowledge resources for devs, creatives, and execs.',
    },
    domains,
  } as CodexQube;
}

export function useLiveCodex() {
  const [codex, setCodex] = useState<CodexQube | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('content')
        .select('*')
        .in('status', ['published', 'archived'])
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const codexQube = transformToCodexQube(data || []);
      setCodex(codexQube);
    } catch (err: any) {
      console.error('[useLiveCodex] Error fetching content:', err);
      setError(err.message || 'Failed to fetch content');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  return { codex, isLoading, error, refresh: fetchContent };
}
