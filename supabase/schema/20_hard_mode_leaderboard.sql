-- =====================================================================
-- 20_hard_mode_leaderboard.sql
--
-- Follow-up Task 10.3 (ROADMAP_FEATURES.md, Milestone 10 "Modalità Hard"):
-- classifica dedicata alla modalità hard, rimandata quando è stata
-- implementata Task 10.1/10.2 per non toccare LeaderboardScreen.tsx in
-- parallelo con l'agente di Milestone 11 (Classifiche Amici).
--
-- Nessuna nuova tabella: i dati sono già in `matches_history.difficulty`
-- (4 = Hard, vedi HARD_MODE_DIFFICULTY in src/store/types.ts), scritta da
-- `save_match_result` fin da quando la Milestone 8 ha corretto il bug per
-- cui quella funzione non era mai chiamata (matches_history era sempre
-- vuota). Pubblica in lettura come le altre leaderboard, nessun auth.uid()
-- guard.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_hard_mode_leaderboard(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  rank INTEGER, user_id UUID, display_name TEXT, total_score INTEGER,
  tier TEXT, matches_played INTEGER, matches_won INTEGER, win_rate INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH hard_stats AS (
    SELECT
      m.user_id AS uid,
      SUM(m.player_score)::INTEGER AS total_score,
      COUNT(*)::INTEGER AS matches_played,
      COUNT(*) FILTER (WHERE m.is_win)::INTEGER AS matches_won
    FROM public.matches_history m
    WHERE m.difficulty = 4
    GROUP BY m.user_id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY hs.total_score DESC)::INTEGER AS rank,
    hs.uid::UUID,
    COALESCE(NULLIF(p.nickname, ''), NULLIF(p.first_name, ''), 'Giocatore')::TEXT AS display_name,
    hs.total_score,
    COALESCE(p.tier, 'bronze')::TEXT,
    hs.matches_played,
    hs.matches_won,
    CASE WHEN hs.matches_played > 0 THEN ((hs.matches_won::FLOAT / hs.matches_played::FLOAT) * 100)::INTEGER ELSE 0 END::INTEGER AS win_rate
  FROM hard_stats hs
  JOIN public.profiles p ON p.id = hs.uid
  ORDER BY hs.total_score DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hard_mode_leaderboard(INTEGER) TO anon, authenticated;
