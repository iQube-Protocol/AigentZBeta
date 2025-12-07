#!/usr/bin/env ts-node
/**
 * Fetch Content from QubeBase and Generate issue-0.ts
 * 
 * This script:
 * 1. Connects to QubeBase (Supabase)
 * 2. Fetches all published content for The Qriptopian
 * 3. Generates a proper CodexQube structure
 * 4. Outputs to apps/theqriptopian-web/src/data/issue-0.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// QubeBase credentials (from Lovable)
const SUPABASE_URL = "https://bsjhfvctmduxhohtllly.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzamhmdmN0bWR1eGhvaHRsbGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDgyNTgsImV4cCI6MjA3MzEyNDI1OH0.JVDp4-F6EEXqVQ8sts2Z8KQg168aZ1YdtY53RRM_s7M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
}

async function fetchContent() {
  console.log('🔍 Fetching content from QubeBase...\n');
  
  const { data, error } = await supabase
    .from('content')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching content:', error);
    throw error;
  }

  console.log(`✅ Fetched ${data?.length || 0} content items\n`);
  return data as QubeBaseContent[];
}

function groupByDomain(content: QubeBaseContent[]) {
  const domains: Record<string, QubeBaseContent[]> = {};
  
  content.forEach(item => {
    if (!domains[item.domain]) {
      domains[item.domain] = [];
    }
    domains[item.domain].push(item);
  });
  
  return domains;
}

function generateCodexQube(content: QubeBaseContent[]) {
  const domainGroups = groupByDomain(content);
  
  const domainConfigs: Record<string, {title: string, icon: string, description: string}> = {
    signals: { title: 'Signals', icon: 'Radar', description: 'Market insights and trading signals' },
    pennydrops: { title: 'Penny Drops', icon: 'Droplets', description: 'Q¢ use cases and practical applications' },
    scrolls: { title: 'Scrolls', icon: 'BookOpen', description: 'Chronicles from the Quantum-Ready Internet' },
    kn0wdz: { title: 'Kn0wdZ', icon: 'Code2', description: 'Technical knowledge and developer resources' },
    staybull: { title: 'Stay Bull', icon: 'TrendingUp', description: 'Bullish market perspectives' },
  };

  const domains = Object.keys(domainGroups).map(domainId => {
    const items = domainGroups[domainId];
    const config = domainConfigs[domainId] || { title: domainId, icon: 'Circle', description: '' };
    
    const contentQubes = items.map(item => ({
      qubeId: `qube://theqriptopian/content/${item.id}`,
      qubeType: 'contentQube',
      protocolVersion: '1.0.0',
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || new Date().toISOString(),
      
      contentId: item.id,
      title: item.title,
      type: item.type,
      format: item.format,
      content: item.content,
      excerpt: item.excerpt || '',
      media: item.thumbnail ? {
        thumbnail: item.thumbnail,
        hero: item.thumbnail,
      } : undefined,
      tags: item.tags || [],
      publishedAt: item.published_at || item.created_at,
      author: item.author_id ? {
        id: item.author_id,
        type: item.author_type || 'user',
      } : undefined,
    }));

    return {
      qubeId: `qube://theqriptopian/domain/${domainId}`,
      qubeType: 'domainQube',
      protocolVersion: '1.0.0',
      createdAt: items[0]?.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      domainId,
      title: config.title,
      icon: config.icon,
      description: config.description,
      published: ['pennydrops', 'scrolls', 'kn0wdz'].includes(domainId), // Issue #0 active domains
      sections: contentQubes,
    };
  });

  const codexQube = {
    qubeId: 'qube://theqriptopian/codex/issue-0',
    qubeType: 'codexQube',
    protocolVersion: '0.1.0',
    createdAt: content[0]?.created_at || '2025-12-01T00:00:00Z',
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
  };

  return codexQube;
}

function generateTypeScriptFile(codexQube: any) {
  const header = `/**
 * The Qriptopian - Issue #0: The Genesis Issue
 * LIVE DATA FROM QUBEBASE
 * 
 * Generated: ${new Date().toISOString()}
 * Source: QubeBase (Supabase)
 * 
 * iQube Protocol compliant CodexQube
 * ACTIVE DOMAINS: PennyDrops, Scrolls, Kn0wdZ
 * HIDDEN DOMAINS: Signals (exists but filtered from nav)
 * 
 * This file is AUTO-GENERATED from QubeBase.
 * To update: Run 'pnpm fetch-content' from the monorepo root
 */

import type { CodexQube } from '@agentiq/codex';

export const issue0: CodexQube = ${JSON.stringify(codexQube, null, 2)} as const;
`;

  return header;
}

async function main() {
  try {
    console.log('📦 QubeBase Content Fetcher\n');
    console.log('================================\n');
    
    // Fetch content
    const content = await fetchContent();
    
    if (!content || content.length === 0) {
      console.log('⚠️  No published content found in QubeBase');
      console.log('   This might be expected if the database is empty');
      console.log('   Keeping existing dummy data\n');
      return;
    }
    
    // Log content summary
    const domainGroups = groupByDomain(content);
    console.log('📊 Content Summary:\n');
    Object.entries(domainGroups).forEach(([domain, items]) => {
      console.log(`   ${domain}: ${items.length} items`);
    });
    console.log('');
    
    // Generate CodexQube
    console.log('🔨 Generating CodexQube structure...\n');
    const codexQube = generateCodexQube(content);
    
    // Generate TypeScript file
    const tsContent = generateTypeScriptFile(codexQube);
    
    // Write to file
    const outputPath = path.join(__dirname, '../apps/theqriptopian-web/src/data/issue-0.ts');
    fs.writeFileSync(outputPath, tsContent, 'utf-8');
    
    console.log(`✅ Generated: ${outputPath}\n`);
    console.log('================================\n');
    console.log('🎉 Content successfully fetched and generated!\n');
    console.log('Next steps:');
    console.log('1. Review the generated file');
    console.log('2. Run `pnpm dev` to see the live content');
    console.log('3. Commit the changes to preserve the content\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
