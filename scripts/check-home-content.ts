#!/usr/bin/env tsx
/**
 * Check home page content in QubeBase
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bsjhfvctmduxhohtllly.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzamhmdmN0bWR1eGhvaHRsbGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDgyNTgsImV4cCI6MjA3MzEyNDI1OH0.JVDp4-F6EEXqVQ8sts2Z8KQg168aZ1YdtY53RRM_s7M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkHomeContent() {
  console.log('🏠 Checking Home Page Content in QubeBase\n');
  
  const { data: content, error } = await supabase
    .from('content')
    .select('id, title, placement, domain')
    .eq('status', 'published');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  // Group by placement.section
  const bySection: Record<string, any[]> = {};
  
  content.forEach(item => {
    const section = item.placement?.section || 'no-section';
    if (!bySection[section]) bySection[section] = [];
    bySection[section].push(item);
  });

  console.log('Content by placement.section:');
  console.log('══════════════════════════════════\n');
  
  Object.keys(bySection).sort().forEach(section => {
    const items = bySection[section];
    console.log(`📌 ${section}: ${items.length} items`);
    items.slice(0, 3).forEach(item => {
      console.log(`   - "${item.title}" (domain: ${item.domain})`);
    });
    if (items.length > 3) {
      console.log(`   ... and ${items.length - 3} more`);
    }
    console.log('');
  });

  console.log('\n🎯 Expected Home Page Sections:');
  console.log('══════════════════════════════════\n');
  console.log('  home-hero     - Hero section at top');
  console.log('  latest-news   - Carousel on home page');
  console.log('  second-hero   - Bottom hero section');
  console.log('');

  const homeHero = bySection['home-hero'] || [];
  const latestNews = bySection['latest-news'] || [];
  const secondHero = bySection['second-hero'] || [];

  if (homeHero.length === 0 && latestNews.length === 0 && secondHero.length === 0) {
    console.log('⚠️  No home page content found!');
    console.log('   All content may be using placement.section = "pennydrops", "scrolls", etc.');
    console.log('   Need to separate home page content from domain content.\n');
  } else {
    console.log('✅ Home page sections found!\n');
  }
}

checkHomeContent().catch(console.error);
