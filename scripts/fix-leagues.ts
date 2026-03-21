import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const API_KEY = process.env.API_FOOTBALL_KEY || '';
const API_HOST = 'v3.football.api-sports.io';
const SEASONS = Array.from({ length: 2024 - 2010 + 1 }, (_, i) => 2010 + i);
const TOP_5_LEAGUES = [39, 140, 135, 78, 61];

async function fetchApiFootball(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`https://${API_HOST}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  const response = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': API_KEY,
      'x-apisports-host': API_HOST,
    },
  });

  if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
  const data = await response.json();
  
  console.log(`    ⏳ Attesa di 6.5 secondi per il rate limit...`);
  await new Promise(resolve => setTimeout(resolve, 6500));
  return data;
}

async function fixLeagues() {
  console.log('🚀 Inizio aggiornamento league_id per le squadre...');
  
  for (const season of SEASONS) {
    for (const leagueId of TOP_5_LEAGUES) {
      console.log(`\n⚽ Recupero squadre per il campionato ID: ${leagueId} (Stagione ${season})`);
      try {
        const teamsResponse = await fetchApiFootball('/teams', { league: leagueId.toString(), season: season.toString() });
        const teamsData = teamsResponse.response;
        
        for (const item of teamsData) {
          const team = item.team;
          console.log(`  -> Aggiornamento squadra: ${team.name} con league_id: ${leagueId}`);
          
          await supabase!.from('teams').update({ league_id: leagueId }).eq('id', team.id);
        }
      } catch (error) {
        console.error(`❌ Errore:`, error);
      }
    }
  }
  console.log('\n✅ Aggiornamento completato!');
}

fixLeagues();
