-- File: 02_rpc_functions.sql
-- Obiettivo: Fornire al nuovo backend le stesse funzioni logiche potenti usate su Supabase.
-- Da lanciare SOLO DOPO aver creato 01_tables_and_schema.sql.

-- Elimina le funzioni esistenti per evitare errori di cambio tipo di ritorno
DROP FUNCTION IF EXISTS validate_player_intersection(BIGINT, BIGINT, TEXT);
DROP FUNCTION IF EXISTS get_random_match(BIGINT, BIGINT[], INT);
DROP FUNCTION IF EXISTS get_random_match(BIGINT, BIGINT[]);
DROP FUNCTION IF EXISTS get_random_match(BIGINT);
DROP FUNCTION IF EXISTS get_random_match();

-- ==============================================================================
-- 1. Funzione per la validazione dell'incrocio tra due squadre e un nome
-- ==============================================================================
CREATE OR REPLACE FUNCTION validate_player_intersection(
  team_a_id BIGINT,
  team_b_id BIGINT,
  input_name TEXT
) RETURNS TABLE (
  valid BOOLEAN,
  player_id BIGINT,
  player_name TEXT,
  similarity_score REAL,
  team_a_seasons INTEGER[],
  team_b_seasons INTEGER[]
) AS $$
BEGIN
  RETURN QUERY
  WITH MatchedPlayer AS (
    SELECT DISTINCT
      p.id AS pid,
      p.name AS pname,
      similarity(p.name, input_name) AS sim
    FROM players p
    JOIN player_teams pt1 ON p.id = pt1.player_id
    JOIN player_teams pt2 ON p.id = pt2.player_id
    WHERE pt1.team_id = team_a_id 
      AND pt2.team_id = team_b_id
      AND p.name % input_name
    ORDER BY sim DESC
    LIMIT 1
  )
  SELECT 
    TRUE AS valid,
    m.pid AS player_id,
    m.pname AS player_name,
    m.sim AS similarity_score,
    ARRAY(SELECT season FROM player_teams WHERE player_teams.player_id = m.pid AND team_id = team_a_id ORDER BY season) AS team_a_seasons,
    ARRAY(SELECT season FROM player_teams WHERE player_teams.player_id = m.pid AND team_id = team_b_id ORDER BY season) AS team_b_seasons
  FROM MatchedPlayer m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 2. Funzione per generare un mach casuale cross-league (anti-ripetizione)
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_random_match(
  p_league_id BIGINT DEFAULT NULL,
  p_recent_teams BIGINT[] DEFAULT ARRAY[]::BIGINT[],
  p_difficulty INT DEFAULT 1 -- 1: Facile, 2: Medio, 3: Difficile
) RETURNS TABLE (
  team1_id BIGINT,
  team1_name TEXT,
  team1_logo TEXT,
  team2_id BIGINT,
  team2_name TEXT,
  team2_logo TEXT,
  player_name TEXT,
  team1_seasons INTEGER[],
  team2_seasons INTEGER[]
) AS $$
DECLARE
  v_player_id BIGINT;
  v_team1_id BIGINT;
  v_team2_id BIGINT;
BEGIN
  -- Ottimizzazione estrema: invece di calcolare tutte le intersezioni (lento),
  -- peschiamo un giocatore casuale che ha giocato in almeno 2 squadre valide
  -- e prendiamo 2 di quelle squadre.

  WITH ValidTeams AS (
    SELECT id 
    FROM teams
    WHERE (p_league_id IS NULL OR league_id = p_league_id)
      AND NOT (id = ANY(p_recent_teams))
  ),
  PlayerWithMultipleTeams AS (
    SELECT pt.player_id
    FROM player_teams pt
    JOIN ValidTeams vt ON pt.team_id = vt.id
    GROUP BY pt.player_id
    HAVING COUNT(DISTINCT pt.team_id) >= 2
    ORDER BY random()
    LIMIT 1
  ),
  SelectedTeams AS (
    SELECT pt.team_id
    FROM player_teams pt
    JOIN ValidTeams vt ON pt.team_id = vt.id
    WHERE pt.player_id = (SELECT player_id FROM PlayerWithMultipleTeams)
    GROUP BY pt.team_id
    ORDER BY random()
    LIMIT 2
  )
  SELECT 
    MAX(CASE WHEN rn = 1 THEN team_id END),
    MAX(CASE WHEN rn = 2 THEN team_id END),
    MAX(player_id)
  INTO v_team1_id, v_team2_id, v_player_id
  FROM (
    SELECT team_id, (SELECT player_id FROM PlayerWithMultipleTeams) as player_id, row_number() OVER () as rn
    FROM SelectedTeams
  ) sub;

  -- Fallback: se non trova nulla (es. p_recent_teams troppo restrittivo), ignora i recent_teams
  IF v_team1_id IS NULL OR v_team2_id IS NULL THEN
    WITH ValidTeams AS (
      SELECT id 
      FROM teams
      WHERE (p_league_id IS NULL OR league_id = p_league_id)
    ),
    PlayerWithMultipleTeams AS (
      SELECT pt.player_id
      FROM player_teams pt
      JOIN ValidTeams vt ON pt.team_id = vt.id
      GROUP BY pt.player_id
      HAVING COUNT(DISTINCT pt.team_id) >= 2
      ORDER BY random()
      LIMIT 1
    ),
    SelectedTeams AS (
      SELECT pt.team_id
      FROM player_teams pt
      JOIN ValidTeams vt ON pt.team_id = vt.id
      WHERE pt.player_id = (SELECT player_id FROM PlayerWithMultipleTeams)
      GROUP BY pt.team_id
      ORDER BY random()
      LIMIT 2
    )
    SELECT 
      MAX(CASE WHEN rn = 1 THEN team_id END),
      MAX(CASE WHEN rn = 2 THEN team_id END),
      MAX(player_id)
    INTO v_team1_id, v_team2_id, v_player_id
    FROM (
      SELECT team_id, (SELECT player_id FROM PlayerWithMultipleTeams) as player_id, row_number() OVER () as rn
      FROM SelectedTeams
    ) sub;
  END IF;

  IF v_team1_id IS NOT NULL AND v_team2_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      t1.id, t1.name, t1.logo_url,
      t2.id, t2.name, t2.logo_url,
      p.name,
      ARRAY(SELECT season FROM player_teams WHERE player_teams.player_id = v_player_id AND team_id = v_team1_id ORDER BY season) AS team1_seasons,
      ARRAY(SELECT season FROM player_teams WHERE player_teams.player_id = v_player_id AND team_id = v_team2_id ORDER BY season) AS team2_seasons
    FROM teams t1
    CROSS JOIN teams t2
    CROSS JOIN players p
    WHERE t1.id = v_team1_id AND t2.id = v_team2_id AND p.id = v_player_id;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
