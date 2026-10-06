-- =====================================================================
-- 01_extensions_and_game_data.sql
--
-- Estensioni Postgres + dati di gioco base (squadre, giocatori, storico
-- militanze). Stato consolidato, sostituisce: schema.sql, rpc.sql,
-- security.sql (parzialmente), database_setup/01_tables_and_schema.sql,
-- e la colonna league_id/season che sul DB reale erano state aggiunte
-- manualmente senza un file di migrazione dedicato.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- Squadre
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id BIGINT PRIMARY KEY,          -- ID da API-Football
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  league_id BIGINT                -- campionato di appartenenza
);

CREATE INDEX IF NOT EXISTS idx_teams_league_id ON public.teams (league_id);

-- =====================================================================
-- Giocatori
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.players (
  id BIGINT PRIMARY KEY,          -- ID da API-Football
  name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS players_name_trgm_idx ON public.players USING GIN (name gin_trgm_ops);

-- =====================================================================
-- Militanze (storico squadra/stagione di ogni giocatore)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.player_teams (
  player_id BIGINT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  PRIMARY KEY (player_id, team_id, season)
);

CREATE INDEX IF NOT EXISTS idx_player_teams_player_id ON public.player_teams (player_id);
CREATE INDEX IF NOT EXISTS idx_player_teams_team_id ON public.player_teams (team_id);

-- =====================================================================
-- RLS: lettura pubblica, scrittura solo service_role (import dati)
-- =====================================================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public teams are viewable by everyone" ON public.teams;
CREATE POLICY "Public teams are viewable by everyone" ON public.teams
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only service role can modify teams" ON public.teams;
CREATE POLICY "Only service role can modify teams" ON public.teams
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Public players are viewable by everyone" ON public.players;
CREATE POLICY "Public players are viewable by everyone" ON public.players
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only service role can modify players" ON public.players;
CREATE POLICY "Only service role can modify players" ON public.players
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Public player_teams are viewable by everyone" ON public.player_teams;
CREATE POLICY "Public player_teams are viewable by everyone" ON public.player_teams
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only service role can modify player_teams" ON public.player_teams;
CREATE POLICY "Only service role can modify player_teams" ON public.player_teams
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
