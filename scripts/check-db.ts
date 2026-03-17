import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  const { data: teams, error: teamsError } = await supabase.from('teams').select('id, name, league_id').limit(10);
  console.log('Teams:', teams, teamsError);

  const { data: players, error: playersError } = await supabase.from('players').select('id, name').limit(10);
  console.log('Players:', players, playersError);

  const { data: pt, error: ptError } = await supabase.from('player_teams').select('*').limit(10);
  console.log('Player Teams:', pt, ptError);
}

checkDb();
