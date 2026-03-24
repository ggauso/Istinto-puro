-- Abilita l'estensione per la fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Crea la tabella delle squadre
CREATE TABLE IF NOT EXISTS teams (
  id BIGINT PRIMARY KEY, -- ID da API-Football
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL
);

-- Crea la tabella dei giocatori
CREATE TABLE IF NOT EXISTS players (
  id BIGINT PRIMARY KEY, -- ID da API-Football
  name TEXT NOT NULL
);

-- Crea la tabella di giunzione (militanza)
CREATE TABLE IF NOT EXISTS player_teams (
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  team_id BIGINT REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (player_id, team_id)
);

-- Indice per velocizzare la fuzzy search sui nomi dei giocatori
CREATE INDEX IF NOT EXISTS players_name_trgm_idx ON players USING GIN (name gin_trgm_ops);
