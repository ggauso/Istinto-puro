import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Configurazione API-Football
const API_KEY = process.env.API_FOOTBALL_KEY || '';
const API_HOST = 'v3.football.api-sports.io';
// Stagioni da importare (es. dal 2022 al 2024 per il piano gratuito)
const SEASONS = [2022, 2023, 2024];

// ID dei Top 5 Campionati Europei su API-Football
const TOP_5_LEAGUES = [
  39,  // Premier League (Inghilterra)
  140, // La Liga (Spagna)
  135, // Serie A (Italia)
  78,  // Bundesliga (Germania)
  61   // Ligue 1 (Francia)
];

const STATE_FILE = path.join(process.cwd(), 'import-state.json');
const IMPORTED_SQUADS_FILE = path.join(process.cwd(), 'imported-squads.json');

interface ImportState {
  seasonIndex: number;
  leagueIndex: number;
  teamIndex: number;
  page: number;
}

function loadState(): ImportState {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        seasonIndex: parsed.seasonIndex || 0,
        leagueIndex: parsed.leagueIndex || 0,
        teamIndex: parsed.teamIndex || 0,
        page: parsed.page || 1
      };
    } catch (e) {
      console.warn('Impossibile leggere il file di stato, ricomincio da zero.');
    }
  }
  return { seasonIndex: 0, leagueIndex: 0, teamIndex: 0, page: 1 };
}

function saveState(state: ImportState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadImportedSquads(): Record<string, boolean> {
  if (fs.existsSync(IMPORTED_SQUADS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(IMPORTED_SQUADS_FILE, 'utf-8'));
    } catch (e) {
      console.warn('Impossibile leggere imported-squads.json, ricomincio da zero.');
    }
  }
  return {};
}

function saveImportedSquads(squads: Record<string, boolean>) {
  fs.writeFileSync(IMPORTED_SQUADS_FILE, JSON.stringify(squads, null, 2));
}

// Helper per le chiamate ad API-Football
async function fetchApiFootball(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`https://${API_HOST}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  const response = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': API_KEY,
      'x-apisports-host': API_HOST,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error('API-Football Error:', data.errors);
    throw new Error('API-Football ha restituito un errore.');
  }
  
  // Rate limiting: API-Football free tier is 10 requests per minute (1 request every 6 seconds)
  console.log(`    ⏳ Attesa di 6.5 secondi per il rate limit...`);
  await new Promise(resolve => setTimeout(resolve, 6500));
  
  return data;
}

async function importData() {
  if (!supabaseUrl || !supabaseKey || !API_KEY) {
    console.error("❌ Variabili d'ambiente mancanti. Controlla il file .env");
    return;
  }

  console.log('🚀 Inizio importazione dati da API-Football a Supabase...');

  // Verifica preventiva di connessione a Supabase: senza questo controllo, se il DB
  // non è raggiungibile (es. Docker/colima spento) ogni upsert fallisce silenziosamente
  // (viene loggato e si passa oltre), lo script arriva comunque in fondo al ciclo,
  // stampa "completata con successo" ed elimina il checkpoint senza aver scritto nulla.
  const { error: connError } = await supabase!.from('teams').select('id').limit(1);
  if (connError) {
    console.error(`❌ Impossibile raggiungere Supabase (${supabaseUrl}): ${connError.message}`);
    console.error('Controlla che il DB/Docker sia avviato prima di rilanciare l\'import.');
    return;
  }

  let state = loadState();
  let importedSquads = loadImportedSquads();
  console.log(`📂 Stato ripristinato: Stagione Index ${state.seasonIndex}, Lega Index ${state.leagueIndex}, Team Index ${state.teamIndex}, Pagina ${state.page}`);

  for (let s = state.seasonIndex; s < SEASONS.length; s++) {
    const season = SEASONS[s];
    console.log(`\n📅 Inizio importazione per la stagione: ${season}`);

    for (let l = (s === state.seasonIndex ? state.leagueIndex : 0); l < TOP_5_LEAGUES.length; l++) {
      const leagueId = TOP_5_LEAGUES[l];
      console.log(`\n⚽ Recupero squadre per il campionato ID: ${leagueId} (Stagione ${season})`);
      
      try {
        // 1. Recupera le squadre del campionato per la stagione specifica
        const teamsResponse = await fetchApiFootball('/teams', { league: leagueId.toString(), season: season.toString() });
        const teamsData = teamsResponse.response;
        
        for (let t = (s === state.seasonIndex && l === state.leagueIndex ? state.teamIndex : 0); t < teamsData.length; t++) {
          const item = teamsData[t];
          const team = item.team;
          
          console.log(`  -> Inserimento squadra: ${team.name} (${t + 1}/${teamsData.length})`);
          
          // 2. Recupera i giocatori della squadra
          let page = (s === state.seasonIndex && l === state.leagueIndex && t === state.teamIndex) ? state.page : 1;
          let totalPages = page;

          const squadKey = `${team.id}_${season}`;
          if (importedSquads[squadKey] && page === 1) {
            console.log(`    ⏭️ Squadra ${team.name} (Stagione ${season}) già importata in precedenza. Salto.`);
            state = { seasonIndex: s, leagueIndex: l, teamIndex: t + 1, page: 1 };
            saveState(state);
            continue;
          }

          // Upsert Squadra
          const { error: teamError } = await supabase!.from('teams').upsert({
            id: team.id,
            name: team.name,
            logo_url: team.logo,
            league_id: leagueId
          }, { onConflict: 'id' });
          
          if (teamError) {
            console.error(`Errore inserimento squadra ${team.name}:`, teamError.message);
            continue;
          }

          do {
            console.log(`    -> Recupero giocatori squadra ${team.name}, pagina ${page}`);
            
            // Limitazione piano gratuito API-Football: max pagina 3
            if (page > 3) {
              console.log(`    ⚠️ Limite piano gratuito raggiunto (max pagina 3). Passo alla prossima squadra.`);
              break;
            }

            const playersResponse = await fetchApiFootball('/players', { 
              team: team.id.toString(), 
              season: season.toString(),
              page: page.toString()
            });

            const playersData = playersResponse.response;
            totalPages = playersResponse.paging?.total || 1;

            if (!playersData || playersData.length === 0) break;

            for (const pItem of playersData) {
              const player = pItem.player;
              const statistics = pItem.statistics[0]; // Statistiche per la squadra/stagione corrente

              // Filtro: Solo giocatori con almeno 1 presenza
              const appearances = statistics?.games?.appearences || 0;
              if (appearances > 0) {
                // Upsert Giocatore
                await supabase!.from('players').upsert({
                  id: player.id,
                  name: player.name
                }, { onConflict: 'id' });

                // Upsert Relazione Giocatore-Squadra
                await supabase!.from('player_teams').upsert({
                  player_id: player.id,
                  team_id: team.id,
                  season: season
                }, { onConflict: 'player_id,team_id,season' });
              }
            }
            
            // Salva lo stato dopo aver processato una pagina con successo
            state = { seasonIndex: s, leagueIndex: l, teamIndex: t, page: page + 1 };
            
            // Se abbiamo finito le pagine per questo team, il prossimo stato sarà la pagina 1 del team successivo
            if (page >= totalPages) {
              state = { seasonIndex: s, leagueIndex: l, teamIndex: t + 1, page: 1 };
            }
            
            saveState(state);
            page++;
          } while (page <= totalPages);

          // Segna la squadra come completata per questa stagione
          importedSquads[squadKey] = true;
          saveImportedSquads(importedSquads);
        }
        
        // Se abbiamo finito tutti i team di questa lega, passiamo alla lega successiva
        state = { seasonIndex: s, leagueIndex: l + 1, teamIndex: 0, page: 1 };
        saveState(state);
        
      } catch (error) {
        console.error(`❌ Errore durante l'importazione del campionato ${leagueId} (Stagione ${season}):`, error);
        console.log(`Lo script si è interrotto. Al prossimo avvio riprenderà dall'ultimo stato salvato.`);
        return; // Interrompiamo lo script in caso di errore (es. rate limit superato)
      }
    }
    
    // Se abbiamo finito tutte le leghe di questa stagione, passiamo alla stagione successiva
    state = { seasonIndex: s + 1, leagueIndex: 0, teamIndex: 0, page: 1 };
    saveState(state);
  }

  console.log('\n✅ Importazione completata con successo!');
  // Opzionale: eliminare il file di stato alla fine
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
}

importData();
