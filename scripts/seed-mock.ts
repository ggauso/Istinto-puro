import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedMockData() {
  console.log('🚀 Inserimento dati di test...');

  const teams = [
    { id: 496, name: 'Juventus', logo_url: 'https://media.api-sports.io/football/teams/496.png' },
    { id: 505, name: 'Inter', logo_url: 'https://media.api-sports.io/football/teams/505.png' },
    { id: 489, name: 'AC Milan', logo_url: 'https://media.api-sports.io/football/teams/489.png' },
    { id: 541, name: 'Real Madrid', logo_url: 'https://media.api-sports.io/football/teams/541.png' },
    { id: 529, name: 'Barcelona', logo_url: 'https://media.api-sports.io/football/teams/529.png' },
    { id: 85, name: 'Paris Saint Germain', logo_url: 'https://media.api-sports.io/football/teams/85.png' },
    { id: 33, name: 'Manchester United', logo_url: 'https://media.api-sports.io/football/teams/33.png' }
  ];

  const players = [
    { id: 1, name: 'Zlatan Ibrahimovic' },
    { id: 2, name: 'Ronaldo' }, // Il Fenomeno
    { id: 3, name: 'Andrea Pirlo' },
    { id: 4, name: 'Clarence Seedorf' },
    { id: 5, name: 'Lionel Messi' },
    { id: 6, name: 'Cristiano Ronaldo' },
    { id: 7, name: 'Angel Di Maria' },
    { id: 8, name: 'Paul Pogba' },
    { id: 9, name: 'Luis Figo' },
    { id: 10, name: 'Roberto Baggio' }
  ];

  const playerTeams = [
    // Ibrahimovic: Juve, Inter, Milan, Barca, PSG, Man Utd
    { player_id: 1, team_id: 496 }, { player_id: 1, team_id: 505 }, { player_id: 1, team_id: 489 },
    { player_id: 1, team_id: 529 }, { player_id: 1, team_id: 85 }, { player_id: 1, team_id: 33 },
    // Ronaldo (Fenomeno): Inter, Milan, Real Madrid, Barca
    { player_id: 2, team_id: 505 }, { player_id: 2, team_id: 489 }, { player_id: 2, team_id: 541 }, { player_id: 2, team_id: 529 },
    // Pirlo: Inter, Milan, Juve
    { player_id: 3, team_id: 505 }, { player_id: 3, team_id: 489 }, { player_id: 3, team_id: 496 },
    // Seedorf: Inter, Milan, Real Madrid
    { player_id: 4, team_id: 505 }, { player_id: 4, team_id: 489 }, { player_id: 4, team_id: 541 },
    // Messi: Barca, PSG
    { player_id: 5, team_id: 529 }, { player_id: 5, team_id: 85 },
    // CR7: Man Utd, Real Madrid, Juve
    { player_id: 6, team_id: 33 }, { player_id: 6, team_id: 541 }, { player_id: 6, team_id: 496 },
    // Di Maria: Real Madrid, Man Utd, PSG, Juve
    { player_id: 7, team_id: 541 }, { player_id: 7, team_id: 33 }, { player_id: 7, team_id: 85 }, { player_id: 7, team_id: 496 },
    // Pogba: Man Utd, Juve
    { player_id: 8, team_id: 33 }, { player_id: 8, team_id: 496 },
    // Figo: Barca, Real Madrid, Inter
    { player_id: 9, team_id: 529 }, { player_id: 9, team_id: 541 }, { player_id: 9, team_id: 505 },
    // Baggio: Juve, Milan, Inter
    { player_id: 10, team_id: 496 }, { player_id: 10, team_id: 489 }, { player_id: 10, team_id: 505 }
  ];

  // Inserimento
  const { error: tErr } = await supabase.from('teams').upsert(teams);
  if (tErr) console.error('Errore teams:', tErr);
  else console.log('✅ Squadre inserite');

  const { error: pErr } = await supabase.from('players').upsert(players);
  if (pErr) console.error('Errore players:', pErr);
  else console.log('✅ Giocatori inseriti');

  const { error: ptErr } = await supabase.from('player_teams').upsert(playerTeams);
  if (ptErr) console.error('Errore player_teams:', ptErr);
  else console.log('✅ Relazioni inserite');

  console.log('🎉 Dati di test pronti!');
}

seedMockData();
