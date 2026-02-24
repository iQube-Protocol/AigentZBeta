import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchScrollsData() {
  try {
    // Fetch metaKnyts scrolls content
    const { data: scrolls, error } = await supabase
      .from('content')
      .select('*')
      .contains('placement', { section: 'scrolls', tab: 'metaknyts' })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching scrolls:', error);
      return;
    }

    console.log('Found scrolls:', scrolls?.length || 0);
    
    // Extract the relevant data for the 21 Awakenings campaign
    const awakeningScrolls = scrolls?.filter(scroll => 
      scroll.title?.includes('Shard #') || 
      scroll.title?.includes('Awakening') ||
      scroll.content?.watch?.video_url?.includes('theqriptopian')
    );

    console.log('\n=== 21 Awakenings Campaign Data ===\n');
    
    awakeningScrolls?.forEach((scroll, index) => {
      const dayNumber = index + 1; // Days 1-21
      const assetRef = scroll.content?.watch?.video_url?.match(/id=([^&]+)/)?.[1] || '';
      
      console.log(`-- Day ${dayNumber}: ${scroll.title}`);
      console.log(`asset_ref = 'smart_content_qubes:${assetRef}'`);
      console.log(`title = '${scroll.title}'`);
      console.log(`video_url = '${scroll.content?.watch?.video_url}'`);
      console.log(`description = '${scroll.content?.watch?.duration || 'No duration'}'`);
      console.log(`thumbnail = '${scroll.content?.watch?.thumbnail || 'No thumbnail'}'`);
      console.log('');
    });

    // Generate SQL INSERT statements
    console.log('\n=== SQL INSERT Statements ===\n');
    
    awakeningScrolls?.forEach((scroll, index) => {
      const dayNumber = index + 1;
      const assetRef = scroll.content?.watch?.video_url?.match(/id=([^&]+)/)?.[1] || '';
      const description = scroll.content?.read?.text?.substring(0, 200) || 'Part of your 21-day consciousness expansion journey.';
      
      console.log(`(`);
      console.log(`    gen_random_uuid(),`);
      console.log(`    'campaign_1768709183190_qq6f0x0sj',`);
      console.log(`    ${dayNumber},`);
      console.log(`    '${scroll.title}',`);
      console.log(`    '${description.replace(/'/g, "''")}',`);
      console.log(`    'smart_content_qubes:${assetRef}',`);
      console.log(`    '${scroll.content?.watch?.video_url || 'https://knyt.ai/claim-reward'}',`);
      console.log(`    ${dayNumber === 1 ? 'true' : 'false'},  -- ${dayNumber === 1 ? 'Day 1 also has explainer' : 'regular day'}`);
      console.log(`    'ready',`);
      console.log(`    '${scroll.content?.watch?.thumbnail || 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=450&fit=crop'}',`);
      console.log(`    300,`);
      console.log(`    NOW(),`);
      console.log(`    NOW(),`);
      console.log(`    '{}',`);
      console.log(`    ARRAY['awakening', 'day${dayNumber}']`);
      console.log(`),`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

fetchScrollsData();
