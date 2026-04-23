import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('subjects').select('*');
  console.log("Subjects error:", error);
  console.log("Subjects count:", data ? data.length : 0);
  console.log("Data:", data);
}
check();
