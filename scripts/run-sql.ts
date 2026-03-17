import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const sql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'rpc.sql'), 'utf-8');
  
  // Try to use Postgres meta API to execute SQL
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey!,
      'Authorization': `Bearer ${supabaseKey!}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ query: sql })
  });
  
  console.log(res.status, await res.text());
}

run();
