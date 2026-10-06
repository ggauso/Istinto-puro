-- =====================================================================
-- 10_advanced_stats.sql
--
-- Statistiche giocatore (base + avanzate con grafici). Stato consolidato
-- di alter-010-statistics.sql + alter-022-security-fixes.sql
-- (update_profile_stats: fix di sicurezza) + alter-011-advanced-stats.sql.
-- Esclusa get_result_distribution (v1): confermata superata da v2,
-- stessa funzione, mai chiamata dal client.
-- =====================================================================

-- update_profile_stats — con fix di sicurezza: auth.uid() = p_user_id
CREATE OR REPLACE FUNCTION public.update_profile_stats(
  p_user_id UUID,
  p_is_win BOOLEAN,
  p_score INTEGER DEFAULT 0,
  p_is_abandoned BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak INTEGER;
  v_current_streak_type TEXT;
  v_longest_win_streak INTEGER;
  v_longest_loss_streak INTEGER;
  v_new_streak INTEGER;
  v_new_streak_type TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato ad aggiornare le statistiche di un altro utente';
  END IF;

  SELECT COALESCE(current_streak, 0), COALESCE(streak_type, 'none'),
         COALESCE(longest_win_streak, 0), COALESCE(longest_loss_streak, 0)
  INTO v_current_streak, v_current_streak_type, v_longest_win_streak, v_longest_loss_streak
  FROM public.profiles
  WHERE id = p_user_id;

  IF p_is_abandoned THEN
    v_new_streak := 0;
    v_new_streak_type := 'none';
  ELSIF p_is_win THEN
    IF v_current_streak_type = 'win' THEN
      v_new_streak := v_current_streak + 1;
      v_new_streak_type := 'win';
    ELSE
      v_new_streak := 1;
      v_new_streak_type := 'win';
    END IF;
  ELSE
    IF v_current_streak_type = 'loss' THEN
      v_new_streak := v_current_streak + 1;
      v_new_streak_type := 'loss';
    ELSE
      v_new_streak := 1;
      v_new_streak_type := 'loss';
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    matches_played = COALESCE(matches_played, 0) + 1,
    matches_won = COALESCE(matches_won, 0) + CASE WHEN p_is_win THEN 1 ELSE 0 END,
    matches_lost = COALESCE(matches_lost, 0) + CASE WHEN NOT p_is_win AND NOT p_is_abandoned THEN 1 ELSE 0 END,
    matches_abandoned = COALESCE(matches_abandoned, 0) + CASE WHEN p_is_abandoned THEN 1 ELSE 0 END,
    total_score = COALESCE(total_score, 0) + GREATEST(p_score, 0),
    best_score = GREATEST(COALESCE(best_score, 0), p_score),
    current_streak = v_new_streak,
    streak_type = v_new_streak_type,
    longest_win_streak = GREATEST(COALESCE(longest_win_streak, 0),
      CASE WHEN v_new_streak_type = 'win' THEN v_new_streak ELSE 0 END),
    longest_loss_streak = GREATEST(COALESCE(longest_loss_streak, 0),
      CASE WHEN v_new_streak_type = 'loss' THEN v_new_streak ELSE 0 END),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS TABLE (
  matches_played INTEGER, matches_won INTEGER, matches_lost INTEGER,
  matches_abandoned INTEGER, win_rate DECIMAL(5,2), average_score DECIMAL(10,2),
  current_streak INTEGER, streak_type TEXT, longest_win_streak INTEGER,
  longest_loss_streak INTEGER, best_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(p.matches_played, 0), COALESCE(p.matches_won, 0), COALESCE(p.matches_lost, 0),
    COALESCE(p.matches_abandoned, 0),
    CASE WHEN COALESCE(p.matches_played, 0) > 0
      THEN ROUND((COALESCE(p.matches_won, 0)::DECIMAL / p.matches_played::DECIMAL) * 100, 2)
      ELSE 0 END,
    CASE WHEN COALESCE(p.matches_played, 0) > 0
      THEN ROUND(p.total_score::DECIMAL / p.matches_played::DECIMAL, 2)
      ELSE 0 END,
    COALESCE(p.current_streak, 0), COALESCE(p.streak_type, 'none')::TEXT,
    COALESCE(p.longest_win_streak, 0), COALESCE(p.longest_loss_streak, 0),
    COALESCE(p.best_score, 0)
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_stats_by_difficulty(p_user_id UUID)
RETURNS TABLE (difficulty INTEGER, matches_played INTEGER, matches_won INTEGER, matches_lost INTEGER, win_rate DECIMAL(5,2))
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.difficulty::INTEGER,
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE m.is_win = TRUE)::INTEGER,
    COUNT(*) FILTER (WHERE m.is_win = FALSE)::INTEGER,
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE m.is_win = TRUE)::DECIMAL / COUNT(*)) * 100, 2) ELSE 0 END
  FROM public.matches_history m
  WHERE m.user_id = p_user_id
  GROUP BY m.difficulty
  ORDER BY m.difficulty;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_stats_by_opponent_tier(p_user_id UUID)
RETURNS TABLE (opponent_tier TEXT, matches_played INTEGER, matches_won INTEGER, matches_lost INTEGER, win_rate DECIMAL(5,2))
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(m.opponent_tier, 'AI')::TEXT,
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE m.is_win = TRUE)::INTEGER,
    COUNT(*) FILTER (WHERE m.is_win = FALSE)::INTEGER,
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE m.is_win = TRUE)::DECIMAL / COUNT(*)) * 100, 2) ELSE 0 END
  FROM public.matches_history m
  WHERE m.user_id = p_user_id
  GROUP BY COALESCE(m.opponent_tier, 'AI')
  ORDER BY
    CASE COALESCE(m.opponent_tier, 'AI')
      WHEN 'Bronze' THEN 1 WHEN 'Silver' THEN 2 WHEN 'Gold' THEN 3
      WHEN 'Platinum' THEN 4 WHEN 'Diamond' THEN 5 WHEN 'AI' THEN 6 ELSE 7
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_activity(p_user_id UUID)
RETURNS TABLE (month TEXT, year INTEGER, matches_played INTEGER, matches_won INTEGER, total_score INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(m.played_at, 'Mon')::TEXT,
    EXTRACT(YEAR FROM m.played_at)::INTEGER,
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE m.is_win = TRUE)::INTEGER,
    SUM(m.player_score)::INTEGER
  FROM public.matches_history m
  WHERE m.user_id = p_user_id
    AND m.played_at >= NOW() - INTERVAL '6 months'
  GROUP BY TO_CHAR(m.played_at, 'Mon'), EXTRACT(YEAR FROM m.played_at)
  ORDER BY EXTRACT(YEAR FROM m.played_at), TO_CHAR(m.played_at, 'MM');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_result_distribution_v2(p_user_id UUID)
RETURNS TABLE (result_type TEXT, count INTEGER, percentage DECIMAL(5,2))
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(matches_played, 0) + COALESCE(matches_abandoned, 0)
  INTO v_total
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT
    'Vittorie'::TEXT,
    COALESCE(p.matches_won, 0)::INTEGER,
    CASE WHEN v_total > 0 THEN ROUND((COALESCE(p.matches_won, 0)::DECIMAL / v_total) * 100, 2) ELSE 0 END
  FROM public.profiles p WHERE p.id = p_user_id

  UNION ALL

  SELECT
    'Sconfitte'::TEXT,
    COALESCE(p.matches_lost, 0)::INTEGER,
    CASE WHEN v_total > 0 THEN ROUND((COALESCE(p.matches_lost, 0)::DECIMAL / v_total) * 100, 2) ELSE 0 END
  FROM public.profiles p WHERE p.id = p_user_id

  UNION ALL

  SELECT
    'Abbandoni'::TEXT,
    COALESCE(p.matches_abandoned, 0)::INTEGER,
    CASE WHEN v_total > 0 THEN ROUND((COALESCE(p.matches_abandoned, 0)::DECIMAL / v_total) * 100, 2) ELSE 0 END
  FROM public.profiles p WHERE p.id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stats_by_difficulty TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stats_by_opponent_tier TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_activity TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_result_distribution_v2 TO anon, authenticated;
