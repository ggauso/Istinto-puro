-- =====================================================
-- Statistiche Avanzate con Grafici (Milestone 12)
-- =====================================================

-- Funzione: Statistiche per difficoltà
DROP FUNCTION IF EXISTS public.get_stats_by_difficulty(UUID);

CREATE OR REPLACE FUNCTION public.get_stats_by_difficulty(p_user_id UUID)
RETURNS TABLE (
  difficulty INTEGER,
  matches_played INTEGER,
  matches_won INTEGER,
  matches_lost INTEGER,
  win_rate DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.difficulty::INTEGER,
    COUNT(*)::INTEGER AS matches_played,
    COUNT(*) FILTER (WHERE m.is_win = TRUE)::INTEGER AS matches_won,
    COUNT(*) FILTER (WHERE m.is_win = FALSE)::INTEGER AS matches_lost,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE m.is_win = TRUE)::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0
    END AS win_rate
  FROM public.matches_history m
  WHERE m.user_id = p_user_id
  GROUP BY m.difficulty
  ORDER BY m.difficulty;
END;
$$;

-- Funzione: Statistiche per tier avversario
DROP FUNCTION IF EXISTS public.get_stats_by_opponent_tier(UUID);

CREATE OR REPLACE FUNCTION public.get_stats_by_opponent_tier(p_user_id UUID)
RETURNS TABLE (
  opponent_tier TEXT,
  matches_played INTEGER,
  matches_won INTEGER,
  matches_lost INTEGER,
  win_rate DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(m.opponent_tier, 'AI')::TEXT AS opponent_tier,
    COUNT(*)::INTEGER AS matches_played,
    COUNT(*) FILTER (WHERE m.is_win = TRUE)::INTEGER AS matches_won,
    COUNT(*) FILTER (WHERE m.is_win = FALSE)::INTEGER AS matches_lost,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE m.is_win = TRUE)::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0
    END AS win_rate
  FROM public.matches_history m
  WHERE m.user_id = p_user_id
  GROUP BY COALESCE(m.opponent_tier, 'AI')
  ORDER BY
    CASE COALESCE(m.opponent_tier, 'AI')
      WHEN 'Bronze' THEN 1
      WHEN 'Silver' THEN 2
      WHEN 'Gold' THEN 3
      WHEN 'Platinum' THEN 4
      WHEN 'Diamond' THEN 5
      WHEN 'AI' THEN 6
      ELSE 7
    END;
END;
$$;

-- Funzione: Attività mensile (ultimi 6 mesi)
DROP FUNCTION IF EXISTS public.get_monthly_activity(UUID);

CREATE OR REPLACE FUNCTION public.get_monthly_activity(p_user_id UUID)
RETURNS TABLE (
  month TEXT,
  year INTEGER,
  matches_played INTEGER,
  matches_won INTEGER,
  total_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(m.played_at, 'Mon')::TEXT AS month,
    EXTRACT(YEAR FROM m.played_at)::INTEGER AS year,
    COUNT(*)::INTEGER AS matches_played,
    COUNT(*) FILTER (WHERE m.is_win = TRUE)::INTEGER AS matches_won,
    SUM(m.player_score)::INTEGER AS total_score
  FROM public.matches_history m
  WHERE m.user_id = p_user_id
    AND m.played_at >= NOW() - INTERVAL '6 months'
  GROUP BY TO_CHAR(m.played_at, 'Mon'), EXTRACT(YEAR FROM m.played_at)
  ORDER BY EXTRACT(YEAR FROM m.played_at), TO_CHAR(m.played_at, 'MM');
END;
$$;

-- Funzione: Distribuzione risultati
DROP FUNCTION IF EXISTS public.get_result_distribution(UUID);

CREATE OR REPLACE FUNCTION public.get_result_distribution(p_user_id UUID)
RETURNS TABLE (
  result_type TEXT,
  count INTEGER,
  percentage DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  -- Conta totale partite
  SELECT COUNT(*)::INTEGER INTO v_total
  FROM public.matches_history
  WHERE user_id = p_user_id;

  RETURN QUERY
  SELECT
    'Vittorie'::TEXT AS result_type,
    COUNT(*) FILTER (WHERE is_win = TRUE)::INTEGER AS count,
    CASE
      WHEN v_total > 0
      THEN ROUND((COUNT(*) FILTER (WHERE is_win = TRUE)::DECIMAL / v_total) * 100, 2)
      ELSE 0
    END AS percentage
  FROM public.matches_history
  WHERE user_id = p_user_id

  UNION ALL

  SELECT
    'Sconfitte'::TEXT AS result_type,
    COUNT(*) FILTER (WHERE is_win = FALSE)::INTEGER AS count,
    CASE
      WHEN v_total > 0
      THEN ROUND((COUNT(*) FILTER (WHERE is_win = FALSE)::DECIMAL / v_total) * 100, 2)
      ELSE 0
    END AS percentage
  FROM public.matches_history
  WHERE user_id = p_user_id

  UNION ALL

  SELECT
    'Abbandoni'::TEXT AS result_type,
    0::INTEGER AS count,
    0::DECIMAL(5,2) AS percentage
  FROM public.matches_history
  WHERE user_id = p_user_id
  LIMIT 1;

  -- Se abbiamo dati sugli abbandoni dalla tabella matches_history, usiamoli
  -- Nota: il campo is_abandoned potrebbe non esistere, usiamo matches_lost come proxy
END;
$$;

-- Funzione semplificata per distribuzione risultati (usando profile)
DROP FUNCTION IF EXISTS public.get_result_distribution_v2(UUID);

CREATE OR REPLACE FUNCTION public.get_result_distribution_v2(p_user_id UUID)
RETURNS TABLE (
  result_type TEXT,
  count INTEGER,
  percentage DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  -- Ottieni totali dal profilo
  SELECT COALESCE(matches_played, 0) + COALESCE(matches_abandoned, 0)
  INTO v_total
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT
    'Vittorie'::TEXT AS result_type,
    COALESCE(p.matches_won, 0)::INTEGER AS count,
    CASE
      WHEN v_total > 0
      THEN ROUND((COALESCE(p.matches_won, 0)::DECIMAL / v_total) * 100, 2)
      ELSE 0
    END AS percentage
  FROM public.profiles p
  WHERE p.id = p_user_id

  UNION ALL

  SELECT
    'Sconfitte'::TEXT AS result_type,
    COALESCE(p.matches_lost, 0)::INTEGER AS count,
    CASE
      WHEN v_total > 0
      THEN ROUND((COALESCE(p.matches_lost, 0)::DECIMAL / v_total) * 100, 2)
      ELSE 0
    END AS percentage
  FROM public.profiles p
  WHERE p.id = p_user_id

  UNION ALL

  SELECT
    'Abbandoni'::TEXT AS result_type,
    COALESCE(p.matches_abandoned, 0)::INTEGER AS count,
    CASE
      WHEN v_total > 0
      THEN ROUND((COALESCE(p.matches_abandoned, 0)::DECIMAL / v_total) * 100, 2)
      ELSE 0
    END AS percentage
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

-- Grant execute to anon for viewing stats
GRANT EXECUTE ON FUNCTION public.get_stats_by_difficulty TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stats_by_opponent_tier TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_activity TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_result_distribution_v2 TO anon, authenticated;

-- Test queries
-- SELECT * FROM public.get_stats_by_difficulty('user-uuid');
-- SELECT * FROM public.get_stats_by_opponent_tier('user-uuid');
-- SELECT * FROM public.get_monthly_activity('user-uuid');
-- SELECT * FROM public.get_result_distribution_v2('user-uuid');