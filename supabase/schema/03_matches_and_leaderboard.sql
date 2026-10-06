-- =====================================================================
-- 03_matches_and_leaderboard.sql
--
-- Partite (in corso/storico), classifiche, e le due RPC centrali del
-- gioco (get_random_match, validate_player_intersection). Stato
-- consolidato di: alter_features.sql/alter-002-gioco.sql (matches,
-- matches_history, leaderboard), alter-004-leaderboard.sql (classifiche
-- settimanali/mensili), alter-003-nickname.sql/alter-022 (save_match_result
-- finale con fix di sicurezza), setup-auth.sql + database_setup/02_rpc_functions.sql
-- (get_random_match/validate_player_intersection, fuse insieme per non
-- perdere le validazioni anti-injection della prima versione).
--
-- FIX applicata qui rispetto alla cronologia originale: la PK di
-- leaderboard_weekly/leaderboard_monthly era solo `user_id`, incompatibile
-- con l'uso a rotazione settimanale/mensile e con l'ON CONFLICT di
-- rebuild_leaderboards(). Corretta a (user_id, week_start)/(user_id, month_start).
-- =====================================================================

-- =====================================================================
-- Tabella matches (partite in corso) — oggi non scritta da nessuna
-- funzione né dal client; mantenuta per compatibilità futura.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  opponent_name TEXT NOT NULL,
  opponent_tier TEXT DEFAULT 'bronze',
  difficulty INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matches_user_id_idx ON public.matches (user_id);
CREATE INDEX IF NOT EXISTS matches_status_idx ON public.matches (status);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;
CREATE POLICY "Users can view own matches" ON public.matches
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own matches" ON public.matches;
CREATE POLICY "Users can insert own matches" ON public.matches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own matches" ON public.matches;
CREATE POLICY "Users can update own matches" ON public.matches
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================================
-- Tabella matches_history (storico partite)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.matches_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  opponent_name TEXT NOT NULL,
  player_tier TEXT NOT NULL,
  opponent_tier TEXT NOT NULL,
  player_score INTEGER NOT NULL,
  opponent_score INTEGER NOT NULL,
  is_win BOOLEAN NOT NULL,
  difficulty INTEGER DEFAULT 1,
  -- Aggiunta per Milestone 8 (Achievement): distingue PvP da IA, non
  -- derivabile in modo affidabile da opponent_tier (sempre valorizzato a
  -- 'bronze' di default anche per le partite contro l'IA, vedi gameplaySlice.ts).
  is_pvp BOOLEAN DEFAULT FALSE,
  played_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.matches_history ADD COLUMN IF NOT EXISTS is_pvp BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS matches_history_user_id_idx ON public.matches_history (user_id);
CREATE INDEX IF NOT EXISTS matches_history_played_at_idx ON public.matches_history (played_at DESC);
CREATE INDEX IF NOT EXISTS matches_history_is_win_idx ON public.matches_history (is_win);

ALTER TABLE public.matches_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own history" ON public.matches_history;
CREATE POLICY "Users can view own history" ON public.matches_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own history" ON public.matches_history;
CREATE POLICY "Users can insert own history" ON public.matches_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- Classifiche settimanali/mensili — PK corretta (vedi nota in testa al file)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.leaderboard_weekly (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_score INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  matches_won INTEGER DEFAULT 0,
  week_start DATE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.leaderboard_monthly (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_score INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  matches_won INTEGER DEFAULT 0,
  month_start DATE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, month_start)
);

ALTER TABLE public.leaderboard_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view weekly leaderboard" ON public.leaderboard_weekly;
CREATE POLICY "Anyone can view weekly leaderboard" ON public.leaderboard_weekly
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view monthly leaderboard" ON public.leaderboard_monthly;
CREATE POLICY "Anyone can view monthly leaderboard" ON public.leaderboard_monthly
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can update weekly leaderboard" ON public.leaderboard_weekly;
CREATE POLICY "Service role can update weekly leaderboard" ON public.leaderboard_weekly
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Service role can update monthly leaderboard" ON public.leaderboard_monthly;
CREATE POLICY "Service role can update monthly leaderboard" ON public.leaderboard_monthly
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================
-- get_random_match / validate_player_intersection
-- Logica di matching da database_setup/02_rpc_functions.sql (versione con
-- p_difficulty), validazioni di input/anti-injection riportate da
-- setup-auth.sql per non perderle nel consolidamento.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.validate_player_intersection(
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

  IF p_difficulty < 1 OR p_difficulty > 3 THEN
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

REVOKE ALL ON FUNCTION public.validate_player_intersection(BIGINT, BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_random_match(BIGINT, BIGINT[], INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_player_intersection(BIGINT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_random_match(BIGINT, BIGINT[], INT) TO authenticated;

-- =====================================================================
-- save_match_result — versione finale con fix di sicurezza
-- (alter-003-nickname.sql + alter-004-leaderboard.sql + alter-022-security-fixes.sql)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.save_match_result(
  p_user_id UUID,
  p_player_name TEXT,
  p_opponent_name TEXT,
  p_player_tier TEXT,
  p_opponent_tier TEXT,
  p_player_score INTEGER,
  p_opponent_score INTEGER,
  p_is_win BOOLEAN,
  p_difficulty INTEGER DEFAULT 1,
  p_is_pvp BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_id UUID;
  v_won_delta INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a salvare il risultato per un altro utente';
  END IF;

  v_won_delta := CASE WHEN p_is_win THEN 1 ELSE 0 END;

  INSERT INTO public.matches_history (
    user_id, player_name, opponent_name, player_tier, opponent_tier,
    player_score, opponent_score, is_win, difficulty, is_pvp, played_at
  ) VALUES (
    p_user_id, p_player_name, p_opponent_name, p_player_tier, p_opponent_tier,
    p_player_score, p_opponent_score, p_is_win, p_difficulty, p_is_pvp, NOW()
  )
  RETURNING id INTO v_match_id;

  UPDATE public.profiles
  SET
    total_score = total_score + p_player_score,
    matches_played = matches_played + 1,
    matches_won = matches_won + v_won_delta,
    tier = CASE
      WHEN total_score + p_player_score >= 5001 THEN 'diamond'
      WHEN total_score + p_player_score >= 3001 THEN 'platinum'
      WHEN total_score + p_player_score >= 1501 THEN 'gold'
      WHEN total_score + p_player_score >= 501 THEN 'silver'
      ELSE 'bronze'
    END,
    updated_at = NOW()
  WHERE id = p_user_id;

  PERFORM public.update_weekly_leaderboard(p_user_id, p_player_score, 1, v_won_delta);
  PERFORM public.update_monthly_leaderboard(p_user_id, p_player_score, 1, v_won_delta);

  RETURN v_match_id;
END;
$$;

-- =====================================================================
-- Funzioni leaderboard / rank (alter_features.sql + alter-004-leaderboard.sql)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_limit INTEGER DEFAULT 100,
  p_tier TEXT DEFAULT NULL
)
RETURNS TABLE (
  rank INTEGER, user_id UUID, display_name TEXT, total_score INTEGER,
  tier TEXT, matches_played INTEGER, matches_won INTEGER, win_rate INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.total_score DESC)::INTEGER AS rank,
    p.id::UUID,
    COALESCE(p.first_name, 'Anonimo')::TEXT AS display_name,
    p.total_score::INTEGER,
    p.tier::TEXT,
    p.matches_played::INTEGER,
    p.matches_won::INTEGER,
    CASE WHEN p.matches_played > 0 THEN ((p.matches_won::FLOAT / p.matches_played::FLOAT) * 100)::INTEGER ELSE 0 END::INTEGER AS win_rate
  FROM public.profiles p
  WHERE p.tier = COALESCE(p_tier, p.tier)
  ORDER BY p.total_score DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_rank(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rank INTEGER;
  v_total_score INTEGER;
BEGIN
  SELECT total_score INTO v_total_score FROM public.profiles WHERE id = p_user_id;
  SELECT COUNT(*)::INTEGER INTO v_rank FROM public.profiles WHERE total_score > v_total_score;
  RETURN v_rank + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_week_start()
RETURNS DATE
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN DATE_TRUNC('week', CURRENT_DATE)::DATE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_month_start()
RETURNS DATE
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN DATE_TRUNC('month', CURRENT_DATE)::DATE;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_weekly_leaderboard(
  p_user_id UUID,
  p_score_delta INTEGER,
  p_matches_played_delta INTEGER DEFAULT 1,
  p_matches_won_delta INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_week_start DATE;
  v_exists BOOLEAN;
BEGIN
  v_week_start := public.get_week_start();

  SELECT EXISTS(SELECT 1 FROM public.leaderboard_weekly WHERE user_id = p_user_id AND week_start = v_week_start)
  INTO v_exists;

  IF v_exists THEN
    UPDATE public.leaderboard_weekly
    SET total_score = total_score + p_score_delta,
        matches_played = matches_played + p_matches_played_delta,
        matches_won = matches_won + p_matches_won_delta,
        updated_at = NOW()
    WHERE user_id = p_user_id AND week_start = v_week_start;
  ELSE
    INSERT INTO public.leaderboard_weekly (user_id, total_score, matches_played, matches_won, week_start, updated_at)
    VALUES (p_user_id, p_score_delta, p_matches_played_delta, p_matches_won_delta, v_week_start, NOW());
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_monthly_leaderboard(
  p_user_id UUID,
  p_score_delta INTEGER,
  p_matches_played_delta INTEGER DEFAULT 1,
  p_matches_won_delta INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_start DATE;
  v_exists BOOLEAN;
BEGIN
  v_month_start := public.get_month_start();

  SELECT EXISTS(SELECT 1 FROM public.leaderboard_monthly WHERE user_id = p_user_id AND month_start = v_month_start)
  INTO v_exists;

  IF v_exists THEN
    UPDATE public.leaderboard_monthly
    SET total_score = total_score + p_score_delta,
        matches_played = matches_played + p_matches_played_delta,
        matches_won = matches_won + p_matches_won_delta,
        updated_at = NOW()
    WHERE user_id = p_user_id AND month_start = v_month_start;
  ELSE
    INSERT INTO public.leaderboard_monthly (user_id, total_score, matches_played, matches_won, month_start, updated_at)
    VALUES (p_user_id, p_score_delta, p_matches_played_delta, p_matches_won_delta, v_month_start, NOW());
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  rank INTEGER, user_id UUID, display_name TEXT, total_score INTEGER,
  tier TEXT, matches_played INTEGER, matches_won INTEGER, win_rate INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY lw.total_score DESC)::INTEGER AS rank,
    lw.user_id::UUID,
    COALESCE(p.first_name, 'Anonimo')::TEXT AS display_name,
    lw.total_score::INTEGER,
    p.tier::TEXT,
    lw.matches_played::INTEGER,
    lw.matches_won::INTEGER,
    CASE WHEN lw.matches_played > 0 THEN ((lw.matches_won::FLOAT / lw.matches_played::FLOAT) * 100)::INTEGER ELSE 0 END::INTEGER AS win_rate
  FROM public.leaderboard_weekly lw
  JOIN public.profiles p ON lw.user_id = p.id
  WHERE lw.week_start = public.get_week_start()
  ORDER BY lw.total_score DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  rank INTEGER, user_id UUID, display_name TEXT, total_score INTEGER,
  tier TEXT, matches_played INTEGER, matches_won INTEGER, win_rate INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY lm.total_score DESC)::INTEGER AS rank,
    lm.user_id::UUID,
    COALESCE(p.first_name, 'Anonimo')::TEXT AS display_name,
    lm.total_score::INTEGER,
    p.tier::TEXT,
    lm.matches_played::INTEGER,
    lm.matches_won::INTEGER,
    CASE WHEN lm.matches_played > 0 THEN ((lm.matches_won::FLOAT / lm.matches_played::FLOAT) * 100)::INTEGER ELSE 0 END::INTEGER AS win_rate
  FROM public.leaderboard_monthly lm
  JOIN public.profiles p ON lm.user_id = p.id
  WHERE lm.month_start = public.get_month_start()
  ORDER BY lm.total_score DESC
  LIMIT p_limit;
END;
$$;

-- Manutenzione (non chiamate dal client, uso amministrativo/cron)
CREATE OR REPLACE FUNCTION public.rebuild_leaderboards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_week_start DATE;
  v_month_start DATE;
  v_history_week RECORD;
  v_history_month RECORD;
BEGIN
  v_week_start := public.get_week_start();
  v_month_start := public.get_month_start();

  DELETE FROM public.leaderboard_weekly WHERE week_start = v_week_start;
  DELETE FROM public.leaderboard_monthly WHERE month_start = v_month_start;

  FOR v_history_week IN
    SELECT user_id, SUM(player_score) as total_score, COUNT(*) as matches_played,
           SUM(CASE WHEN is_win THEN 1 ELSE 0 END) as matches_won
    FROM public.matches_history
    WHERE played_at >= v_week_start
    GROUP BY user_id
  LOOP
    INSERT INTO public.leaderboard_weekly (user_id, total_score, matches_played, matches_won, week_start, updated_at)
    VALUES (v_history_week.user_id, v_history_week.total_score, v_history_week.matches_played, v_history_week.matches_won, v_week_start, NOW())
    ON CONFLICT (user_id, week_start) DO UPDATE SET
      total_score = EXCLUDED.total_score, matches_played = EXCLUDED.matches_played,
      matches_won = EXCLUDED.matches_won, updated_at = NOW();
  END LOOP;

  FOR v_history_month IN
    SELECT user_id, SUM(player_score) as total_score, COUNT(*) as matches_played,
           SUM(CASE WHEN is_win THEN 1 ELSE 0 END) as matches_won
    FROM public.matches_history
    WHERE played_at >= v_month_start
    GROUP BY user_id
  LOOP
    INSERT INTO public.leaderboard_monthly (user_id, total_score, matches_played, matches_won, month_start, updated_at)
    VALUES (v_history_month.user_id, v_history_month.total_score, v_history_month.matches_played, v_history_month.matches_won, v_month_start, NOW())
    ON CONFLICT (user_id, month_start) DO UPDATE SET
      total_score = EXCLUDED.total_score, matches_played = EXCLUDED.matches_played,
      matches_won = EXCLUDED.matches_won, updated_at = NOW();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_leaderboards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.leaderboard_weekly WHERE week_start < CURRENT_DATE - INTERVAL '8 weeks';
  DELETE FROM public.leaderboard_monthly WHERE month_start < CURRENT_DATE - INTERVAL '13 months';
END;
$$;
