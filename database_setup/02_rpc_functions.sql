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
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    TRUE AS valid,
    p.id AS player_id,
    p.name AS player_name,
    similarity(p.name, input_name) AS similarity_score
  FROM players p
  JOIN player_teams pt1 ON p.id = pt1.player_id
  JOIN player_teams pt2 ON p.id = pt2.player_id
  WHERE pt1.team_id = team_a_id 
    AND pt2.team_id = team_b_id
    AND p.name % input_name
  ORDER BY similarity_score DESC
  LIMIT 1;
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
  player_name TEXT
) AS $$
DECLARE
  v_player_id BIGINT;
  v_team1_id BIGINT;
  v_team2_id BIGINT;
BEGIN
  WITH ValidTeams AS (
    SELECT id, league_id 
    FROM teams
    WHERE NOT (id = ANY(p_recent_teams))
      AND (p_league_id IS NULL OR league_id = p_league_id)
  ),
  DistinctPT AS (
    SELECT DISTINCT pt.player_id, pt.team_id, vt.league_id
    FROM player_teams pt
    JOIN ValidTeams vt ON pt.team_id = vt.id
  ),
  TeamIntersections AS (
    SELECT 
        a.team_id AS team_a, 
        b.team_id AS team_b, 
        COUNT(a.player_id) AS common_players
    FROM DistinctPT a
    JOIN DistinctPT b ON a.player_id = b.player_id
    WHERE a.team_id < b.team_id
      -- Se p_league_id è NULL (Tutti i campionati), vogliamo squadre di leghe DIVERSE
      -- Se p_league_id è impostato, ValidTeams ha già filtrato per quella lega
      AND (p_league_id IS NOT NULL OR a.league_id <> b.league_id)
    GROUP BY a.team_id, b.team_id
  ),
  RankedTeams AS (
    SELECT 
        team_a, 
        team_b, 
        common_players,
        NTILE(3) OVER (ORDER BY common_players DESC) AS group_tier
    FROM TeamIntersections
  ),
  FilteredTeams AS (
    SELECT team_a, team_b
    FROM RankedTeams
    WHERE group_tier = p_difficulty
  )
  SELECT team_a, team_b INTO v_team1_id, v_team2_id
  FROM FilteredTeams
  ORDER BY random()
  LIMIT 1;

  -- Fallback 1: Se non trova nulla per quel livello di difficoltà (es. pochi dati), 
  -- ripiega su qualsiasi tier tra i team validi
  IF v_team1_id IS NULL THEN
    WITH ValidTeams AS (
      SELECT id, league_id 
      FROM teams
      WHERE NOT (id = ANY(p_recent_teams))
        AND (p_league_id IS NULL OR league_id = p_league_id)
    ),
    DistinctPT AS (
      SELECT DISTINCT pt.player_id, pt.team_id, vt.league_id
      FROM player_teams pt
      JOIN ValidTeams vt ON pt.team_id = vt.id
    ),
    TeamIntersections AS (
      SELECT a.team_id AS team_a, b.team_id AS team_b
      FROM DistinctPT a
      JOIN DistinctPT b ON a.player_id = b.player_id
      WHERE a.team_id < b.team_id
        AND (p_league_id IS NOT NULL OR a.league_id <> b.league_id)
      GROUP BY a.team_id, b.team_id
    )
    SELECT team_a, team_b INTO v_team1_id, v_team2_id
    FROM TeamIntersections
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- Fallback 2: Se ancora NULL (es. p_recent_teams blocca tutto), ignora p_recent_teams
  IF v_team1_id IS NULL THEN
    WITH ValidTeams AS (
      SELECT id, league_id 
      FROM teams
      WHERE (p_league_id IS NULL OR league_id = p_league_id)
    ),
    DistinctPT AS (
      SELECT DISTINCT pt.player_id, pt.team_id, vt.league_id
      FROM player_teams pt
      JOIN ValidTeams vt ON pt.team_id = vt.id
    ),
    TeamIntersections AS (
      SELECT a.team_id AS team_a, b.team_id AS team_b
      FROM DistinctPT a
      JOIN DistinctPT b ON a.player_id = b.player_id
      WHERE a.team_id < b.team_id
        AND (p_league_id IS NOT NULL OR a.league_id <> b.league_id)
      GROUP BY a.team_id, b.team_id
    )
    SELECT team_a, team_b INTO v_team1_id, v_team2_id
    FROM TeamIntersections
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- Seleziona un giocatore casuale in comune
  IF v_team1_id IS NOT NULL THEN
    SELECT a.player_id INTO v_player_id
    FROM player_teams a
    JOIN player_teams b ON a.player_id = b.player_id
    WHERE a.team_id = v_team1_id AND b.team_id = v_team2_id
    ORDER BY random()
    LIMIT 1;

    RETURN QUERY
    SELECT 
      t1.id, t1.name, t1.logo_url,
      t2.id, t2.name, t2.logo_url,
      p.name
    FROM teams t1
    CROSS JOIN teams t2
    CROSS JOIN players p
    WHERE t1.id = v_team1_id AND t2.id = v_team2_id AND p.id = v_player_id;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
