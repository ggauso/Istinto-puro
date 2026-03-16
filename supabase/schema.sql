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

-- Funzione per generare un match casuale garantendo più varietà
CREATE OR REPLACE FUNCTION get_random_match(
  p_league_id BIGINT DEFAULT NULL,
  p_recent_teams BIGINT[] DEFAULT ARRAY[]::BIGINT[]
) RETURNS TABLE (
  team1_id BIGINT,
  team1_name TEXT,
  team1_logo TEXT,
  team2_id BIGINT,
  team2_name TEXT,
  team2_logo TEXT,
  player_name TEXT
) AS $$
DECLARE
  v_player_id BIGINT;
  v_team1_id BIGINT;
  v_team2_id BIGINT;
BEGIN
  -- 1. Trovare un giocatore valido
  SELECT p.id INTO v_player_id
  FROM players p
  JOIN player_teams pt ON p.id = pt.player_id
  JOIN teams t ON pt.team_id = t.id
  WHERE 
    -- Se è fornita una lega, il giocatore deve aver giocato in almeno un team di quella lega
    (p_league_id IS NULL OR t.league_id = p_league_id)
  GROUP BY p.id
  HAVING 
    -- Deve aver giocato in almeno 2 squadre (escludendo quelle appena viste)
    COUNT(DISTINCT pt.team_id) FILTER (WHERE NOT (pt.team_id = ANY(p_recent_teams))) >= 2
  ORDER BY random()
  LIMIT 1;

  -- Se non troviamo giocatori validi (es. troppe esclusioni), ripieghiamo senza escludere i recenti
  IF v_player_id IS NULL THEN
    SELECT p.id INTO v_player_id
    FROM players p
    JOIN player_teams pt ON p.id = pt.player_id
    JOIN teams t ON pt.team_id = t.id
    WHERE (p_league_id IS NULL OR t.league_id = p_league_id)
    GROUP BY p.id
    HAVING COUNT(DISTINCT pt.team_id) >= 2
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- Se il DB è vuoto, ritorna null (gestito dal client)
  IF v_player_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Dalla rosa delle squadre del giocatore, estrai 2 squadre
  IF p_league_id IS NULL THEN
    -- Modalità "Tutti i campionati": forza/privilegia la selezione di due squadre di leghe diverse
    WITH player_team_data AS (
      SELECT t.id, t.league_id
      FROM teams t
      JOIN player_teams pt ON t.id = pt.team_id
      WHERE pt.player_id = v_player_id
    )
    SELECT
      t1.id, t2.id INTO v_team1_id, v_team2_id
    FROM player_team_data t1
    JOIN player_team_data t2 ON t1.id <> t2.id
    WHERE 
      -- Cerca squadre in leghe diverse, ed evita squadre recenti (se possibile)
      t1.league_id <> t2.league_id 
      AND NOT (t1.id = ANY(p_recent_teams)) 
      AND NOT (t2.id = ANY(p_recent_teams))
    ORDER BY random()
    LIMIT 1;
    
    -- Fallback: se il giocatore non ha giocato in campionati diversi o le squadre diverse sono nei recenti
    IF v_team1_id IS NULL THEN
       SELECT t1.id, t2.id INTO v_team1_id, v_team2_id
       FROM (SELECT team_id as id FROM player_teams WHERE player_id = v_player_id ORDER BY random() LIMIT 1) t1
       CROSS JOIN (SELECT team_id as id FROM player_teams WHERE player_id = v_player_id ORDER BY random() LIMIT 1) t2
       WHERE t1.id <> t2.id;
    END IF;
  ELSE
    -- Modalità campionato specifico: entrambe le squadre **devono** essere preferibilmente filtrate in parte,
    -- ma per la regola del gioco basta che ALMENO una sia del campionato (oppure entrambe se forzato).
    -- Scegliamo di prendere due squadre casuali, ignorando preferibilmente i rcenti.
    WITH eligible_teams AS (
       SELECT team_id as id FROM player_teams WHERE player_id = v_player_id AND NOT (team_id = ANY(p_recent_teams))
    )
    SELECT t1.id, t2.id INTO v_team1_id, v_team2_id
    FROM eligible_teams t1, eligible_teams t2
    WHERE t1.id <> t2.id 
    ORDER BY random() 
    LIMIT 1;
    
    -- Fallback senza filtro recenti
    IF v_team1_id IS NULL THEN
       SELECT t1.id, t2.id INTO v_team1_id, v_team2_id
       FROM (SELECT team_id as id FROM player_teams WHERE player_id = v_player_id ORDER BY random() LIMIT 1) t1
       CROSS JOIN (SELECT team_id as id FROM player_teams WHERE player_id = v_player_id ORDER BY random() LIMIT 1) t2
       WHERE t1.id <> t2.id;
    END IF;
  END IF;

  -- 3. Ritorna i dati finali
  RETURN QUERY
  SELECT 
    t1.id, t1.name, t1.logo_url,
    t2.id, t2.name, t2.logo_url,
    p.name
  FROM teams t1
  CROSS JOIN teams t2
  CROSS JOIN players p
  WHERE t1.id = v_team1_id AND t2.id = v_team2_id AND p.id = v_player_id;

END;
$$ LANGUAGE plpgsql;
