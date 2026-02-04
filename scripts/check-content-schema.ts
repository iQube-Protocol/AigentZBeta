import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  // Query the information schema to get column details
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'content'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    console.log('RPC not available, trying direct query...');
    
    // Try inserting a minimal record to see what's required
    const testRecord = {
      slug: 'test-slug-' + Date.now(),
      title: 'Test Title',
      excerpt: 'Test excerpt',
      status: 'draft',
      tags: ['test'],
      placement: { section: 'test', tab: 'test' },
      modalities: {}
    };
    
    const { error: insertError } = await supabase.from('content').insert(testRecord);
    
    if (insertError) {
      console.log('\nRequired fields error:', insertError.message);
      console.log('\nTrying with domain field...');
      
      const testRecord2 = { ...testRecord, domain: 'qriptopian' };
      const { error: insertError2 } = await supabase.from('content').insert(testRecord2);
      
      if (insertError2) {
        console.log('Error with domain:', insertError2.message);
        
        console.log('\nTrying with type and format fields...');
        const testRecord3 = { ...testRecord2, type: 'article', format: 'html' };
        const { error: insertError3 } = await supabase.from('content').insert(testRecord3);
        
        if (insertError3) {
          console.log('Error with type/format:', insertError3.message);
        } else {
          console.log('✓ Success with: domain, type, format');
          // Clean up
          await supabase.from('content').delete().eq('slug', testRecord.slug);
        }
      } else {
        console.log('✓ Success with just domain field');
        // Clean up
        await supabase.from('content').delete().eq('slug', testRecord.slug);
      }
    } else {
      console.log('✓ Success without domain field');
      // Clean up
      await supabase.from('content').delete().eq('slug', testRecord.slug);
    }
  } else {
    console.log('Schema:', data);
  }
}

checkSchema();
