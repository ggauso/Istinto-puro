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

-- Funzione RPC per validare l'intersezione (chiamata dal client)
CREATE OR REPLACE FUNCTION validate_player_intersection(
  team_a_id BIGINT,
  team_b_id BIGINT,
  input_name TEXT
) RETURNS TABLE (
  valid BOOLEAN,
  player_id BIGINT,
  player_name TEXT,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE AS valid,
    p.id AS player_id,
    p.name AS player_name,
    similarity(p.name, input_name) AS similarity_score
  FROM players p
  JOIN player_teams pt1 ON p.id = pt1.player_id
  JOIN player_teams pt2 ON p.id = pt2.player_id
  WHERE pt1.team_id = team_a_id 
    AND pt2.team_id = team_b_id
    -- Usa la soglia di similarità (es. 0.3 per tollerare refusi o cognomi parziali)
    AND p.name % input_name
  ORDER BY similarity_score DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
