/* eslint-env node */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

async function makeAdmin(email) {
  console.log(`Looking up ID for ${email}...`);
  // Note: Anon key cannot read auth.users directly. 
  console.log("=========================================");
  console.log("IMPORTANT: Have you registered this email on the website yet?");
  console.log("You MUST register the account normally first before running this SQL.");
  console.log("=========================================\n");
  console.log("Since we are using the public Anon Key, we cannot run arbitrary updates in Node.");
  console.log("Please run the following SQL command directly in your Supabase SQL Editor:\n");
  
  console.log("```sql");
  console.log("-- 1. Reset any existing admins back to student (optional, removes old admins)");
  console.log("UPDATE profiles SET role = 'student' WHERE role = 'admin';\n");
  console.log("-- 2. Make this specific user an admin");
  console.log(`UPDATE profiles 
SET role = 'admin' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email ILIKE '${email}'
);`);
  console.log("```\n");
}

makeAdmin('PassIt@gmail.com');
