import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testMinimal() {
  console.log('Testing minimal insert without format field...\n');
  
  const testRecord = {
    slug: 'test-minimal-' + Date.now(),
    title: 'Test Article',
    excerpt: 'Test excerpt',
    status: 'draft',
    tags: ['test'],
    placement: { section: 'test', tab: 'test' },
    modalities: {
      read: {
        available: true,
        text: 'Test content',
        duration: '1 min read'
      }
    },
    domain: 'qriptopian',
    type: 'article'
  };
  
  const { data, error } = await supabase.from('content').insert(testRecord).select();
  
  if (error) {
    console.log('✗ Error:', error.message);
    console.log('\nTrying with type="text"...');
    
    const testRecord2 = { ...testRecord, type: 'text', slug: 'test-minimal-2-' + Date.now() };
    const { data: data2, error: error2 } = await supabase.from('content').insert(testRecord2).select();
    
    if (error2) {
      console.log('✗ Error with type="text":', error2.message);
      
      console.log('\nTrying with type="content"...');
      const testRecord3 = { ...testRecord, type: 'content', slug: 'test-minimal-3-' + Date.now() };
      const { data: data3, error: error3 } = await supabase.from('content').insert(testRecord3).select();
      
      if (error3) {
        console.log('✗ Error with type="content":', error3.message);
      } else {
        console.log('✓ SUCCESS with type="content"!');
        console.log('Inserted record:', JSON.stringify(data3, null, 2));
        await supabase.from('content').delete().eq('slug', testRecord3.slug);
      }
    } else {
      console.log('✓ SUCCESS with type="text"!');
      console.log('Inserted record:', JSON.stringify(data2, null, 2));
      await supabase.from('content').delete().eq('slug', testRecord2.slug);
    }
  } else {
    console.log('✓ SUCCESS with type="article"!');
    console.log('Inserted record:', JSON.stringify(data, null, 2));
    await supabase.from('content').delete().eq('slug', testRecord.slug);
  }
}

testMinimal();
