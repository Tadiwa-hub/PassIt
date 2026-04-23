import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase
      .from('profiles')
      .select('*, user_subscriptions(subject_id, subjects(title))')
      .eq('role', 'student')
      .order('created_at', { ascending: false });
  console.log("Error:", error);
}

test();
