-- =====================================================
-- 4. FUNZIONI PER CLASSIFICHE SETTIMANALI E MENSILI
-- =====================================================

-- Get week start date (Monday)
CREATE OR REPLACE FUNCTION public.get_week_start()
RETURNS DATE
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN DATE_TRUNC('week', CURRENT_DATE)::DATE;
END;
$$;

-- Get month start date
CREATE OR REPLACE FUNCTION public.get_month_start()
RETURNS DATE
LANGUAGE plpgsql
AS $$
BEGIN
  return DATE_TRUNC('month', CURRENT_DATE)::DATE;
END;
$$;

-- Aggiorna classifica settimanale
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

  -- Check if record exists
  SELECT EXISTS(SELECT 1 FROM public.leaderboard_weekly WHERE user_id = p_user_id AND week_start = v_week_start)
  INTO v_exists;

  IF v_exists THEN
    -- Update existing record
    UPDATE public.leaderboard_weekly
    SET
      total_score = total_score + p_score_delta,
      matches_played = matches_played + p_matches_played_delta,
      matches_won = matches_won + p_matches_won_delta,
      updated_at = NOW()
    WHERE user_id = p_user_id AND week_start = v_week_start;
  ELSE
    -- Insert new record
    INSERT INTO public.leaderboard_weekly (user_id, total_score, matches_played, matches_won, week_start, updated_at)
    VALUES (p_user_id, p_score_delta, p_matches_played_delta, p_matches_won_delta, v_week_start, NOW());
  END IF;
END;
$$;

-- Aggiorna classifica mensile
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

  -- Check if record exists
  SELECT EXISTS(SELECT 1 FROM public.leaderboard_monthly WHERE user_id = p_user_id AND month_start = v_month_start)
  INTO v_exists;

  IF v_exists THEN
    -- Update existing record
    UPDATE public.leaderboard_monthly
    SET
      total_score = total_score + p_score_delta,
      matches_played = matches_played + p_matches_played_delta,
      matches_won = matches_won + p_matches_won_delta,
      updated_at = NOW()
    WHERE user_id = p_user_id AND month_start = v_month_start;
  ELSE
    -- Insert new record
    INSERT INTO public.leaderboard_monthly (user_id, total_score, matches_played, matches_won, month_start, updated_at)
    VALUES (p_user_id, p_score_delta, p_matches_played_delta, p_matches_won_delta, v_month_start, NOW());
  END IF;
END;
$$;

-- Modifica save_match_result per aggiornare anche le classifiche
CREATE OR REPLACE FUNCTION public.save_match_result(
  p_user_id UUID,
  p_player_name TEXT,
  p_opponent_name TEXT,
  p_player_tier TEXT,
  p_opponent_tier TEXT,
  p_player_score INTEGER,
  p_opponent_score INTEGER,
  p_is_win BOOLEAN,
  p_difficulty INTEGER DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_id UUID;
  v_won_delta INTEGER;
BEGIN
  v_won_delta := CASE WHEN p_is_win THEN 1 ELSE 0 END;

  -- Inserisci nello storico
  INSERT INTO public.matches_history (
    user_id,
    player_name,
    opponent_name,
    player_tier,
    opponent_tier,
    player_score,
    opponent_score,
    is_win,
    difficulty,
    played_at
  ) VALUES (
    p_user_id,
    p_player_name,
    p_opponent_name,
    p_player_tier,
    p_opponent_tier,
    p_player_score,
    p_opponent_score,
    p_is_win,
    p_difficulty,
    NOW()
  )
  RETURNING id INTO v_match_id;

  -- Aggiorna i punteggi dell'utente
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

  -- Aggiorna classifica settimanale
  PERFORM public.update_weekly_leaderboard(p_user_id, p_player_score, 1, v_won_delta);

  -- Aggiorna classifica mensile
  PERFORM public.update_monthly_leaderboard(p_user_id, p_player_score, 1, v_won_delta);

  RETURN v_match_id;
END;
$$;

-- Ottieni classifica settimanale
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  rank INTEGER,
  user_id UUID,
  display_name TEXT,
  total_score INTEGER,
  tier TEXT,
  matches_played INTEGER,
  matches_won INTEGER,
  win_rate INTEGER
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
    CASE
      WHEN lw.matches_played > 0 THEN ((lw.matches_won::FLOAT / lw.matches_played::FLOAT) * 100)::INTEGER
      ELSE 0
    END::INTEGER AS win_rate
  FROM public.leaderboard_weekly lw
  JOIN public.profiles p ON lw.user_id = p.id
  WHERE lw.week_start = public.get_week_start()
  ORDER BY lw.total_score DESC
  LIMIT p_limit;
END;
$$;

-- Ottieni classifica mensile
CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  rank INTEGER,
  user_id UUID,
  display_name TEXT,
  total_score INTEGER,
  tier TEXT,
  matches_played INTEGER,
  matches_won INTEGER,
  win_rate INTEGER
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
    CASE
      WHEN lm.matches_played > 0 THEN ((lm.matches_won::FLOAT / lm.matches_played::FLOAT) * 100)::INTEGER
      ELSE 0
    END::INTEGER AS win_rate
  FROM public.leaderboard_monthly lm
  JOIN public.profiles p ON lm.user_id = p.id
  WHERE lm.month_start = public.get_month_start()
  ORDER BY lm.total_score DESC
  LIMIT p_limit;
END;
$$;

-- Ricostruisci classifiche (da chiamare manualmente o via cron job)
CREATE OR REPLACE FUNCTION public.rebuild_leaderboards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_week_start DATE;
  v_month_start DATE;
  v_history_week RECORD;
  v_history_month RECORD;
BEGIN
  v_week_start := public.get_week_start();
  v_month_start := public.get_month_start();

  -- Clear current week/month leaderboards
  DELETE FROM public.leaderboard_weekly WHERE week_start = v_week_start;
  DELETE FROM public.leaderboard_monthly WHERE month_start = v_month_start;

  -- Rebuild weekly from matches_history
  FOR v_history_week IN
    SELECT
      user_id,
      SUM(player_score) as total_score,
      COUNT(*) as matches_played,
      SUM(CASE WHEN is_win THEN 1 ELSE 0 END) as matches_won
    FROM public.matches_history
    WHERE played_at >= v_week_start
    GROUP BY user_id
  LOOP
    INSERT INTO public.leaderboard_weekly (user_id, total_score, matches_played, matches_won, week_start, updated_at)
    VALUES (
      v_history_week.user_id,
      v_history_week.total_score,
      v_history_week.matches_played,
      v_history_week.matches_won,
      v_week_start,
      NOW()
    )
    ON CONFLICT (user_id, week_start) DO UPDATE SET
      total_score = EXCLUDED.total_score,
      matches_played = EXCLUDED.matches_played,
      matches_won = EXCLUDED.matches_won,
      updated_at = NOW();
  END LOOP;

  -- Rebuild monthly from matches_history
  FOR v_history_month IN
    SELECT
      user_id,
      SUM(player_score) as total_score,
      COUNT(*) as matches_played,
      SUM(CASE WHEN is_win THEN 1 ELSE 0 END) as matches_won
    FROM public.matches_history
    WHERE played_at >= v_month_start
    GROUP BY user_id
  LOOP
    INSERT INTO public.leaderboard_monthly (user_id, total_score, matches_played, matches_won, month_start, updated_at)
    VALUES (
      v_history_month.user_id,
      v_history_month.total_score,
      v_history_month.matches_played,
      v_history_month.matches_won,
      v_month_start,
      NOW()
    )
    ON CONFLICT (user_id, month_start) DO UPDATE SET
      total_score = EXCLUDED.total_score,
      matches_played = EXCLUDED.matches_played,
      matches_won = EXCLUDED.matches_won,
      updated_at = NOW();
  END LOOP;
END;
$$;

-- Pulisci vecchie classifiche (da chiamare periodicamente)
CREATE OR REPLACE FUNCTION public.cleanup_old_leaderboards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete weekly leaderboards older than 8 weeks
  DELETE FROM public.leaderboard_weekly
  WHERE week_start < CURRENT_DATE - INTERVAL '8 weeks';

  -- Delete monthly leaderboards older than 13 months
  DELETE FROM public.leaderboard_monthly
  WHERE month_start < CURRENT_DATE - INTERVAL '13 months';
END;
$$;

-- =====================================================
-- VERIFICA
-- =====================================================

-- Verifica conteggi
SELECT 'leaderboard_weekly' as table_name, count(*) as count FROM public.leaderboard_weekly;
SELECT 'leaderboard_monthly' as table_name, count(*) as count FROM public.leaderboard_monthly;
SELECT 'matches_history' as table_name, count(*) as count FROM public.matches_history;

-- Test funzioni
SELECT * FROM public.get_weekly_leaderboard(10);
SELECT * FROM public.get_monthly_leaderboard(10);

-- Per ricostruire le classifiche eseguire:
-- SELECT public.rebuild_leaderboards();