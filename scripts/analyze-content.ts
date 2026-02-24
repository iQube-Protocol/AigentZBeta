#!/usr/bin/env tsx
/**
 * Analyze QubeBase Content and Suggest Domain Assignments
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bsjhfvctmduxhohtllly.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzamhmdmN0bWR1eGhvaHRsbGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDgyNTgsImV4cCI6MjA3MzEyNDI1OH0.JVDp4-F6EEXqVQ8sts2Z8KQg168aZ1YdtY53RRM_s7M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function analyzeDomains() {
  console.log('📊 Analyzing Content Distribution\n');
  
  const { data: content, error } = await supabase
    .from('content')
    .select('id, title, domain, type, tags, excerpt')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  // Current distribution
  const currentDomains: Record<string, number> = {};
  content.forEach(item => {
    currentDomains[item.domain] = (currentDomains[item.domain] || 0) + 1;
  });

  console.log('Current Domain Distribution:');
  console.log('─────────────────────────────\n');
  Object.entries(currentDomains).forEach(([domain, count]) => {
    console.log(`  ${domain}: ${count} items`);
  });
  console.log('\n');

  // Suggest domain assignments based on heuristics
  const suggestions = content.map(item => {
    let suggestedDomain = 'qriptopian'; // default
    
    const title = (item.title || '').toLowerCase();
    const excerpt = (item.excerpt || '').toLowerCase();
    const tags = item.tags || [];
    const combined = `${title} ${excerpt} ${tags.join(' ')}`.toLowerCase();
    
    // PennyDrops: Q¢ use cases, practical applications
    if (
      combined.includes('q¢') ||
      combined.includes('qriptocent') ||
      combined.includes('use case') ||
      combined.includes('pennydrop') ||
      tags.some(t => ['qriptocent', 'usecase', 'penny'].includes(t.toLowerCase()))
    ) {
      suggestedDomain = 'pennydrops';
    }
    
    // Scrolls: Narratives, stories, chronicles
    else if (
      combined.includes('story') ||
      combined.includes('chronicle') ||
      combined.includes('narrative') ||
      combined.includes('scroll') ||
      item.type === 'narrative' ||
      tags.some(t => ['story', 'chronicle', 'narrative', 'scroll'].includes(t.toLowerCase()))
    ) {
      suggestedDomain = 'scrolls';
    }
    
    // Kn0wdZ: Technical, developer, knowledge
    else if (
      combined.includes('technical') ||
      combined.includes('developer') ||
      combined.includes('tutorial') ||
      combined.includes('guide') ||
      combined.includes('knowledge') ||
      combined.includes('kn0w') ||
      item.type === 'technical' ||
      tags.some(t => ['dev', 'technical', 'tutorial', 'guide', 'knowledge'].includes(t.toLowerCase()))
    ) {
      suggestedDomain = 'kn0wdz';
    }
    
    // Signals: Market, trading, signals
    else if (
      combined.includes('signal') ||
      combined.includes('market') ||
      combined.includes('trading') ||
      combined.includes('price') ||
      tags.some(t => ['signal', 'market', 'trading'].includes(t.toLowerCase()))
    ) {
      suggestedDomain = 'signals';
    }
    
    return {
      id: item.id,
      title: item.title,
      currentDomain: item.domain,
      suggestedDomain,
      needsUpdate: item.domain !== suggestedDomain,
    };
  });

  // Summary
  const needsUpdate = suggestions.filter(s => s.needsUpdate);
  const suggestedDistribution: Record<string, number> = {};
  suggestions.forEach(s => {
    suggestedDistribution[s.suggestedDomain] = (suggestedDistribution[s.suggestedDomain] || 0) + 1;
  });

  console.log('Suggested Domain Distribution:');
  console.log('─────────────────────────────\n');
  Object.entries(suggestedDistribution).forEach(([domain, count]) => {
    console.log(`  ${domain}: ${count} items`);
  });
  console.log('\n');

  console.log(`Items needing update: ${needsUpdate.length} / ${content.length}\n`);

  if (needsUpdate.length > 0) {
    console.log('Items to Update:');
    console.log('─────────────────────────────\n');
    needsUpdate.slice(0, 10).forEach(item => {
      console.log(`  "${item.title}"`);
      console.log(`    ${item.currentDomain} → ${item.suggestedDomain}\n`);
    });
    
    if (needsUpdate.length > 10) {
      console.log(`  ... and ${needsUpdate.length - 10} more\n`);
    }
  }

  // Generate SQL
  console.log('\n📝 SQL Update Script:');
  console.log('═══════════════════════════════════════\n');
  
  const domainUpdates: Record<string, string[]> = {};
  needsUpdate.forEach(item => {
    if (!domainUpdates[item.suggestedDomain]) {
      domainUpdates[item.suggestedDomain] = [];
    }
    domainUpdates[item.suggestedDomain].push(item.id);
  });

  Object.entries(domainUpdates).forEach(([domain, ids]) => {
    console.log(`-- Update ${ids.length} items to '${domain}'`);
    console.log(`UPDATE content SET domain = '${domain}' WHERE id IN (`);
    ids.forEach((id, idx) => {
      console.log(`  '${id}'${idx < ids.length - 1 ? ',' : ''}`);
    });
    console.log(`);\n`);
  });

  console.log('═══════════════════════════════════════\n');
}

analyzeDomains().catch(console.error);
