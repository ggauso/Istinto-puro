-- Funzione per generare un match casuale forzando combinazioni cross-league
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
  -- MODALITA' TUTTI I CAMPIONATI (CROSS-LEAGUE STRICT)
  IF p_league_id IS NULL THEN
    -- 1. Cerchiamo uno specifico GIOCATORE che ha militato in almeno DUE LEGHE DIVERSE, 
    -- assicurandoci che ci siano almeno due squadre valide (non nei recenti) in queste leghe diverse.
    WITH cross_league_players AS (
      SELECT p.id as player_id
      FROM players p
      JOIN player_teams pt ON p.id = pt.player_id
      JOIN teams t ON pt.team_id = t.id
      WHERE NOT (t.id = ANY(p_recent_teams))
      GROUP BY p.id
      HAVING COUNT(DISTINCT t.league_id) >= 2 -- Ha giocato in almeno due leghe diverse, escludendo i team saltati
    )
    SELECT player_id INTO v_player_id
    FROM cross_league_players
    ORDER BY random()
    LIMIT 1;

    IF v_player_id IS NOT NULL THEN
      -- Se abbiamo un giocatore "giramondo", peschiamo due squadre di leghe diverse non recenti.
      WITH eligible_teams AS (
        SELECT t.id, t.league_id
        FROM teams t
        JOIN player_teams pt ON t.id = pt.team_id
        WHERE pt.player_id = v_player_id AND NOT (t.id = ANY(p_recent_teams))
      )
      SELECT t1.id, t2.id INTO v_team1_id, v_team2_id
      FROM eligible_teams t1
      JOIN eligible_teams t2 ON t1.league_id <> t2.league_id
      ORDER BY random()
      LIMIT 1;
    END IF;

    -- FALLBACK: Se la lista p_recent_teams blocca tutto o non ci sono giocatori multisquadra, 
    -- ripieghiamo ignorando i filtri recenti e di lega (pura logica random).
    IF v_team1_id IS NULL THEN
       SELECT p.id INTO v_player_id
       FROM players p
       JOIN player_teams pt ON p.id = pt.player_id
       GROUP BY p.id
       HAVING COUNT(DISTINCT pt.team_id) >= 2
       ORDER BY random()
       LIMIT 1;

       IF v_player_id IS NOT NULL THEN
           WITH ptd AS (SELECT team_id as id FROM player_teams WHERE player_id = v_player_id)
           SELECT t1.id, t2.id INTO v_team1_id, v_team2_id
           FROM ptd t1
           JOIN ptd t2 ON t1.id < t2.id
           ORDER BY random()
           LIMIT 1;
       END IF;
    END IF;

  ELSE
    -- MODALITA' LEGA SINGOLA
    -- 1. Selezioniamo un giocatore casuale che abbia giocato in almeno 2 squadre DELLA LEGA, 
    -- evitando i recenti.
    WITH eligible_players AS (
      SELECT p.id
      FROM players p
      JOIN player_teams pt ON p.id = pt.player_id
      JOIN teams t ON pt.team_id = t.id
      WHERE t.league_id = p_league_id AND NOT (t.id = ANY(p_recent_teams))
      GROUP BY p.id
      HAVING COUNT(DISTINCT pt.team_id) >= 2
    )
    SELECT id INTO v_player_id
    FROM eligible_players
    ORDER BY random()
    LIMIT 1;

    IF v_player_id IS NOT NULL THEN
        -- Prendiamo 2 team ENTRAMBI del campionato, ed EVITANDO i recenti
        WITH eligible_teams AS (
           SELECT t.id 
           FROM teams t 
           JOIN player_teams pt ON t.id = pt.team_id
           WHERE pt.player_id = v_player_id 
             AND t.league_id = p_league_id 
             AND NOT (t.id = ANY(p_recent_teams))
        )
        SELECT t1.id, t2.id INTO v_team1_id, v_team2_id
        FROM eligible_teams t1
        JOIN eligible_teams t2 ON t1.id < t2.id
        ORDER BY random() 
        LIMIT 1;
    END IF;
    
    -- Fallback per singola lega: ignora recenti, ma MANTIENI il vincolo della lega
    IF v_team1_id IS NULL THEN
       WITH fallback_players AS (
         SELECT p.id FROM players p
         JOIN player_teams pt ON p.id = pt.player_id
         JOIN teams t ON pt.team_id = t.id
         WHERE t.league_id = p_league_id
         GROUP BY p.id
         HAVING COUNT(DISTINCT pt.team_id) >= 2
       )
       SELECT id INTO v_player_id FROM fallback_players ORDER BY random() LIMIT 1;

       IF v_player_id IS NOT NULL THEN
          WITH et AS (
            SELECT t.id 
            FROM teams t 
            JOIN player_teams pt ON t.id = pt.team_id 
            WHERE pt.player_id = v_player_id AND t.league_id = p_league_id
          )
          SELECT t1.id, t2.id INTO v_team1_id, v_team2_id
          FROM et t1 JOIN et t2 ON t1.id < t2.id
          ORDER BY random() LIMIT 1;
       END IF;
    END IF;

  END IF;

  -- 3. Ritorna il risultato combinato
  IF v_team1_id IS NOT NULL THEN
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
$$ LANGUAGE plpgsql;
