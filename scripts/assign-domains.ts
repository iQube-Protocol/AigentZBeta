#!/usr/bin/env tsx
/**
 * Assign Content to Proper Domains Based on Published Issue #0 Spec
 * 
 * Source: PUBLISHED_ISSUE_0_ALIGNMENT.md
 * 
 * Domain Structure:
 * - pennydrops: Q¢ use cases (tab: stories)
 * - scrolls: Chronicles (tabs: metaknyts, synthsims)
 * - kn0wdz: Builder knowledge (tabs: dev, creative, exec)
 * - signals: Hidden domain (tabs: current, archive)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bsjhfvctmduxhohtllly.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzamhmdmN0bWR1eGhvaHRsbGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDgyNTgsImV4cCI6MjA3MzEyNDI1OH0.JVDp4-F6EEXqVQ8sts2Z8KQg168aZ1YdtY53RRM_s7M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface ContentItem {
  id: string;
  title: string;
  domain: string;
  placement?: {
    tab?: string;
    section?: string;
  };
  tags?: string[];
  type?: string;
}

async function assignDomains() {
  console.log('📝 Assigning Content to Domains per Published Issue #0 Spec\n');
  console.log('════════════════════════════════════════════════════════\n');
  
  const { data: content, error } = await supabase
    .from('content')
    .select('id, title, domain, placement, tags, type')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching content:', error);
    return;
  }

  console.log(`Found ${content.length} published items\n`);

  // Domain assignment logic based on placement.tab or section
  const assignments = content.map((item: ContentItem) => {
    const placement = item.placement || {};
    const tab = placement.tab?.toLowerCase();
    const section = placement.section?.toLowerCase();
    const title = (item.title || '').toLowerCase();
    const tags = (item.tags || []).map(t => t.toLowerCase());
    
    let newDomain = 'pennydrops'; // default
    
    // Priority 1: Check placement.tab (most specific)
    if (tab) {
      // Scrolls tabs
      if (tab === 'metaknyts' || tab === 'synthsims') {
        newDomain = 'scrolls';
      }
      // Kn0wdZ tabs
      else if (tab === 'dev' || tab === 'creative' || tab === 'exec') {
        newDomain = 'kn0wdz';
      }
      // Signals tabs
      else if (tab === 'current' || tab === 'archive') {
        newDomain = 'signals';
      }
      // PennyDrops tab
      else if (tab === 'stories') {
        newDomain = 'pennydrops';
      }
    }
    
    // Priority 2: Check placement.section
    if (section) {
      if (section === 'pennydrops') newDomain = 'pennydrops';
      else if (section === 'scrolls') newDomain = 'scrolls';
      else if (section === '21knowdz' || section === 'kn0wdz') newDomain = 'kn0wdz';
      else if (section === 'signals') newDomain = 'signals';
    }
    
    // Priority 3: Fallback heuristics based on title/tags
    if (!tab && !section) {
      const combined = `${title} ${tags.join(' ')}`;
      
      // PennyDrops indicators
      if (
        combined.includes('q¢') ||
        combined.includes('qriptocent') ||
        combined.includes('use case') ||
        combined.includes('pennydrop')
      ) {
        newDomain = 'pennydrops';
      }
      // Scrolls indicators (metaKnyts, SynthSims)
      else if (
        title.includes('metaknyt') ||
        title.includes('synthsim') ||
        combined.includes('chronicle') ||
        combined.includes('story') ||
        tags.includes('narrative')
      ) {
        newDomain = 'scrolls';
      }
      // Kn0wdZ indicators
      else if (
        combined.includes('builder') ||
        combined.includes('developer') ||
        combined.includes('technical') ||
        combined.includes('tutorial') ||
        combined.includes('guide') ||
        tags.includes('dev') ||
        tags.includes('technical')
      ) {
        newDomain = 'kn0wdz';
      }
    }
    
    return {
      id: item.id,
      title: item.title,
      oldDomain: item.domain,
      newDomain,
      needsUpdate: item.domain !== newDomain,
      reason: tab ? `placement.tab=${tab}` : section ? `placement.section=${section}` : 'heuristic'
    };
  });

  // Summary
  const needsUpdate = assignments.filter(a => a.needsUpdate);
  const distribution: Record<string, number> = {};
  assignments.forEach(a => {
    distribution[a.newDomain] = (distribution[a.newDomain] || 0) + 1;
  });

  console.log('Target Domain Distribution:');
  console.log('──────────────────────────\n');
  Object.entries(distribution).forEach(([domain, count]) => {
    const emoji = domain === 'pennydrops' ? '💧' : domain === 'scrolls' ? '📜' : domain === 'kn0wdz' ? '💻' : '📡';
    console.log(`  ${emoji} ${domain}: ${count} items`);
  });
  console.log('\n');

  console.log(`Items to update: ${needsUpdate.length} / ${content.length}\n`);

  if (needsUpdate.length > 0) {
    console.log('Assignment Preview (first 15):');
    console.log('──────────────────────────────────\n');
    needsUpdate.slice(0, 15).forEach(item => {
      console.log(`  "${item.title}"`);
      console.log(`    ${item.oldDomain} → ${item.newDomain} (${item.reason})\n`);
    });
    
    if (needsUpdate.length > 15) {
      console.log(`  ... and ${needsUpdate.length - 15} more\n`);
    }
  }

  // Generate SQL
  console.log('\n');
  console.log('════════════════════════════════════════════════════════');
  console.log('📝 SQL UPDATE SCRIPT');
  console.log('════════════════════════════════════════════════════════\n');
  console.log('-- Run this in Supabase SQL Editor:\n');
  
  const domainUpdates: Record<string, string[]> = {};
  needsUpdate.forEach(item => {
    if (!domainUpdates[item.newDomain]) {
      domainUpdates[item.newDomain] = [];
    }
    domainUpdates[item.newDomain].push(item.id);
  });

  Object.entries(domainUpdates).forEach(([domain, ids]) => {
    const emoji = domain === 'pennydrops' ? '💧' : domain === 'scrolls' ? '📜' : domain === 'kn0wdz' ? '💻' : '📡';
    console.log(`-- ${emoji} Assign ${ids.length} items to '${domain}'`);
    console.log(`UPDATE content SET domain = '${domain}' WHERE id IN (`);
    ids.forEach((id, idx) => {
      console.log(`  '${id}'${idx < ids.length - 1 ? ',' : ''}`);
    });
    console.log(`);\n`);
  });

  console.log('-- Verify distribution');
  console.log(`SELECT domain, COUNT(*) as count FROM content WHERE status = 'published' GROUP BY domain ORDER BY domain;\n`);
  
  console.log('════════════════════════════════════════════════════════\n');
  
  // Ask for confirmation
  console.log('⚠️  Review the SQL above carefully before running in Supabase.\n');
  console.log('After running SQL, execute:');
  console.log('  pnpm tsx scripts/fetch-qubebase-content.ts\n');
}

assignDomains().catch(console.error);
