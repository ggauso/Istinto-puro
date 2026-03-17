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

async function checkPlayers() {
  console.log('Controllo giocatori con almeno 2 squadre...');
  
  // Eseguiamo una query RPC o usiamo l'API REST per contare
  // Visto che non possiamo fare GROUP BY con l'API REST di Supabase facilmente,
  // scarichiamo un po' di player_teams e vediamo.
  
  const { data, error } = await supabase
    .from('player_teams')
    .select('player_id')
    .limit(10000);
    
  if (error) {
    console.error('Errore:', error);
    return;
  }
  
  const counts: Record<string, number> = {};
  data.forEach(row => {
    counts[row.player_id] = (counts[row.player_id] || 0) + 1;
  });
  
  let playersWithMultipleTeams = 0;
  let maxTeams = 0;
  
  Object.values(counts).forEach(count => {
    if (count >= 2) playersWithMultipleTeams++;
    if (count > maxTeams) maxTeams = count;
  });
  
  console.log(`Totale record in player_teams analizzati: ${data.length}`);
  console.log(`Giocatori unici in questo campione: ${Object.keys(counts).length}`);
  console.log(`Giocatori con >= 2 squadre: ${playersWithMultipleTeams}`);
  console.log(`Numero massimo di squadre per un giocatore: ${maxTeams}`);
}

checkPlayers();
