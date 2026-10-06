/**
 * Esporta teams/players/player_teams dal tuo progetto Supabase Cloud (sola lettura)
 * in un file SQL da caricare nello stack Docker locale, evitando di dover
 * rifare l'import da API-Football (che richiede una API_FOOTBALL_KEY e consuma
 * la tua quota).
 *
 * Uso (con il tuo .env "reale", puntato a Supabase Cloud):
 *   npm run export-seed
 *
 * Poi, con lo stack Docker locale già avviato:
 *   docker exec -i istintopuro-db psql -U postgres -d postgres < docker/volumes/db/seed/local-data.sql
 *
 * Non modifica né cancella nulla sul progetto Cloud: fa solo SELECT.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Mancano SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY nel tuo .env (quello del progetto Cloud).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const PAGE_SIZE = 1000;

function sqlString(v: string | null): string {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function fetchAll(table: string, columns: string): Promise<any[]> {
  const rows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function main() {
  console.log('Esporto teams...');
  const teams = await fetchAll('teams', 'id,name,logo_url,league_id');
  console.log(`  ${teams.length} righe`);

  console.log('Esporto players...');
  const players = await fetchAll('players', 'id,name');
  console.log(`  ${players.length} righe`);

  console.log('Esporto player_teams...');
  const playerTeams = await fetchAll('player_teams', 'player_id,team_id,season');
  console.log(`  ${playerTeams.length} righe`);

  const lines: string[] = [
    '-- Seed generato da scripts/export-local-seed.ts',
    '-- Esportazione in sola lettura dal progetto Supabase Cloud, per uso nello stack Docker locale.',
    'BEGIN;',
    '',
  ];

  if (teams.length > 0) {
    lines.push('INSERT INTO teams (id, name, logo_url, league_id) VALUES');
    lines.push(
      teams
        .map(
          (t: any) =>
            `  (${t.id}, ${sqlString(t.name)}, ${sqlString(t.logo_url)}, ${t.league_id ?? 'NULL'})`
        )
        .join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n'
    );
  }

  if (players.length > 0) {
    lines.push('INSERT INTO players (id, name) VALUES');
    lines.push(
      players.map((p: any) => `  (${p.id}, ${sqlString(p.name)})`).join(',\n') +
        '\nON CONFLICT (id) DO NOTHING;\n'
    );
  }

  if (playerTeams.length > 0) {
    lines.push('INSERT INTO player_teams (player_id, team_id, season) VALUES');
    lines.push(
      playerTeams
        .map((pt: any) => `  (${pt.player_id}, ${pt.team_id}, ${pt.season ?? 'NULL'})`)
        .join(',\n') + '\nON CONFLICT (player_id, team_id, season) DO NOTHING;\n'
    );
  }

  lines.push('COMMIT;');

  const outDir = path.join(process.cwd(), 'docker', 'volumes', 'db', 'seed');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'local-data.sql');
  fs.writeFileSync(outFile, lines.join('\n'));

  console.log(`\nScritto: ${outFile}`);
  console.log('Per caricarlo nello stack Docker locale (già avviato):');
  console.log('  docker exec -i istintopuro-db psql -U postgres -d postgres < docker/volumes/db/seed/local-data.sql');
}

main().catch((err) => {
  console.error('Errore export:', err);
  process.exit(1);
});
