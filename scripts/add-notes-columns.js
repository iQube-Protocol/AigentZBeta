require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Check if column exists
  const { data, error } = await client.from('crm_contributions').select('notes').limit(1);
  
  if (error && error.message.includes('notes')) {
    console.log('Column "notes" does not exist.');
    console.log('Please run this SQL in the Supabase dashboard SQL editor:');
    console.log(`
ALTER TABLE public.crm_contributions 
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS impact_level INTEGER;
    `);
  } else if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Column "notes" already exists!');
  }
}

run();
