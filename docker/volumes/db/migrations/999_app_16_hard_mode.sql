-- =====================================================================
-- 16_hard_mode.sql
--
-- Milestone 10 (ROADMAP_FEATURES.md): Modalità Hard, selectedDifficulty = 4
-- lato client. Timer (5s) e penalità punteggio sono gestiti interamente
-- lato client (gameplaySlice.ts) — qui solo le due modifiche server-side:
--
-- 1) validate_player_intersection: matching più severo quando p_strict è
--    TRUE (richiede nome+cognome, soglia di similarity più alta).
-- 2) get_random_match: il clamp su p_difficulty includeva solo 1-3, esteso
--    a 1-4 per coerenza (il parametro resta comunque inutilizzato nella
--    selezione del match, come già prima di questa modifica — la
--    difficoltà incide solo su punteggio/timer/validazione lato client,
--    mai sulla scelta di squadre/giocatore).
-- =====================================================================

-- La vecchia funzione a 3 argomenti va rimossa esplicitamente prima di
-- ricrearla a 4: CREATE OR REPLACE NON sostituisce una funzione quando
-- cambia il numero di parametri (anche se il nuovo è opzionale con
-- DEFAULT) — crea invece un secondo overload, e PostgREST poi rifiuta le
-- chiamate RPC a 3 argomenti con "Could not choose the best candidate
-- function" per via dell'ambiguità tra i due overload. Verificato in
-- questa sessione (vedi DOCKER.md per lo stesso tipo di gotcha su
-- cambi di firma).
DROP FUNCTION IF EXISTS public.validate_player_intersection(BIGINT, BIGINT, TEXT);

CREATE FUNCTION public.validate_player_intersection(
  team_a_id BIGINT,
  team_b_id BIGINT,
  input_name TEXT,
  p_strict BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
  valid BOOLEAN,
  player_id BIGINT,
  player_name TEXT,
  similarity_score REAL,
  team_a_seasons INTEGER[],
  team_b_seasons INTEGER[]
) AS $$
BEGIN
  IF team_a_id IS NULL OR team_b_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::BIGINT, NULL::TEXT, NULL::REAL, NULL::INTEGER[], NULL::INTEGER[];
    RETURN;
  END IF;

  IF character_length(input_name) > 100 THEN
    input_name := LEFT(input_name, 100);
  END IF;

  IF input_name LIKE '%--%' OR input_name LIKE '%/*%' OR input_name LIKE '%\x27%' THEN
    RETURN QUERY SELECT FALSE, NULL::BIGINT, NULL::TEXT, NULL::REAL, NULL::INTEGER[], NULL::INTEGER[];
    RETURN;
  END IF;

  -- Modalità Hard: un singolo cognome non basta più, serve nome E cognome
  -- (almeno due parole separate da spazio) — a differenza delle altre
  -- difficoltà dove un cognome abbastanza distintivo è sufficiente.
  IF p_strict AND trim(input_name) !~ '\s' THEN
    RETURN QUERY SELECT FALSE, NULL::BIGINT, NULL::TEXT, NULL::REAL, NULL::INTEGER[], NULL::INTEGER[];
    RETURN;
  END IF;

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
      -- Modalità Hard: soglia di somiglianza più alta della soglia di
      -- default dell'operatore % (pg_trgm.similarity_threshold, 0.3) — una
      -- corrispondenza vaga/parziale non basta più.
      AND (NOT p_strict OR similarity(p.name, input_name) >= 0.65)
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

REVOKE ALL ON FUNCTION public.validate_player_intersection(BIGINT, BIGINT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_player_intersection(BIGINT, BIGINT, TEXT, BOOLEAN) TO authenticated;

-- get_random_match: solo il body cambia (stessa firma a 3 argomenti),
-- CREATE OR REPLACE è sufficiente.
CREATE OR REPLACE FUNCTION public.get_random_match(
  p_league_id BIGINT DEFAULT NULL,
  p_recent_teams BIGINT[] DEFAULT ARRAY[]::BIGINT[],
  p_difficulty INT DEFAULT 1
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
  IF p_league_id IS NOT NULL AND (character_length(p_league_id::TEXT) > 20 OR p_league_id < 0) THEN
    p_league_id := NULL;
  END IF;

  IF p_recent_teams IS NULL THEN
    p_recent_teams := ARRAY[]::BIGINT[];
  END IF;
  p_recent_teams := array_remove(p_recent_teams, NULL);

  IF p_difficulty < 1 OR p_difficulty > 4 THEN
    p_difficulty := 1;
  END IF;

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

  -- Fallback: se il filtro p_recent_teams è troppo restrittivo, ignoralo
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
