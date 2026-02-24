import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFormats() {
  const formats = ['html', 'text', 'markdown', 'md', 'json', 'rich-text', 'richtext', 'plain'];
  
  for (const format of formats) {
    const testRecord = {
      slug: 'test-' + Date.now(),
      title: 'Test',
      excerpt: 'Test',
      status: 'draft',
      tags: ['test'],
      placement: { section: 'test', tab: 'test' },
      modalities: {},
      domain: 'qriptopian',
      type: 'article',
      format: format
    };
    
    const { error } = await supabase.from('content').insert(testRecord);
    
    if (!error) {
      console.log(`✓ Format '${format}' works!`);
      await supabase.from('content').delete().eq('slug', testRecord.slug);
      return format;
    } else {
      console.log(`✗ Format '${format}' failed: ${error.message}`);
    }
  }
  
  console.log('\nNone of the common formats worked. The constraint might be more specific.');
}

testFormats();
