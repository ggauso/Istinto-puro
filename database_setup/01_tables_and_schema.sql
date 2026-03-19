-- File: 01_tables_and_schema.sql
-- Obiettivo: Inizializzare lo schema del database da zero per un server PostgreSQL indipendente (no Supabase)

-- 1. Abilitare l'estensione per la fuzzy search sui nomi (essenziale per validate_player_intersection)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Creare la tabella delle Squadre (Teams)
CREATE TABLE IF NOT EXISTS teams (
  id BIGINT PRIMARY KEY, -- ID proveniente dalla sorgente API-Football
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  league_id BIGINT -- Campionato associato
);

-- 3. Creare la tabella dei Giocatori (Players)
CREATE TABLE IF NOT EXISTS players (
  id BIGINT PRIMARY KEY, -- ID proveniente dalla sorgente API-Football
  name TEXT NOT NULL
);

-- 4. Creare la tabella di legame (Player_Teams - storico militanze)
CREATE TABLE IF NOT EXISTS player_teams (
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  team_id BIGINT REFERENCES teams(id) ON DELETE CASCADE,
  season INTEGER,
  PRIMARY KEY (player_id, team_id, season)
);

-- 5. Creare la tabella dei Profili Utente (Indipendente da Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Usa un UUID nativo di postgres
  email TEXT UNIQUE NOT NULL, -- Per eventuale sistema di login o reset password
  password_hash TEXT, -- Obbligatorio se gestisci tu il login (es. con bcrypt dal backend)
  first_name TEXT,
  last_name TEXT,
  birth_date DATE,
  favorite_team TEXT,
  privacy_accepted BOOLEAN DEFAULT false,
  avatar_url TEXT,
  total_score INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  matches_won INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Indici di ottimizzazione per grandi moli di dati strutturati e ricerca fuzzy
CREATE INDEX IF NOT EXISTS players_name_trgm_idx ON players USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_player_teams_team_id ON player_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_player_teams_player_id ON player_teams(player_id);
CREATE INDEX IF NOT EXISTS idx_teams_league_id ON teams(league_id);
